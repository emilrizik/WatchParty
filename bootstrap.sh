#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este script como root: sudo bash bootstrap.sh"
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/watchparty}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/watchparty/uploads}"
APP_USER="${APP_USER:-root}"
DOMAIN="${DOMAIN:-watchparty.tudominio.com}"
DB_NAME="${DB_NAME:-watchparty}"
DB_USER="${DB_USER:-watchparty_user}"
DB_PASSWORD="${DB_PASSWORD:-change_me_db_password}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-change_me_nextauth_secret}"
ADMIN_CODE="${ADMIN_CODE:-change_me_admin_code}"
APP_PORT="${APP_PORT:-3001}"
PUBLIC_URL="${PUBLIC_URL:-https://${DOMAIN}}"
REPO_URL="${REPO_URL:-https://github.com/emilrizik/WatchParty.git}"
ENABLE_SSL="${ENABLE_SSL:-false}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Falta comando requerido: $1"
    exit 1
  }
}

echo "==> Instalando dependencias del sistema"
apt update
apt install -y curl git ffmpeg nginx certbot python3-certbot-nginx postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1; then
  echo "==> Instalando Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

need_cmd node
need_cmd npm
need_cmd git
need_cmd psql
need_cmd ffmpeg
corepack enable

echo "==> Preparando directorios"
mkdir -p "$(dirname "$APP_DIR")"
mkdir -p "$UPLOAD_DIR"
chown -R "$APP_USER":"$APP_USER" "$UPLOAD_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Clonando repositorio"
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "==> Repositorio ya existe; actualizando"
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" pull --ff-only origin main
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> Creando base de datos PostgreSQL"
sudo -u postgres psql <<SQL
DO
\$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
   ELSE
      ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
   END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

echo "==> Escribiendo .env"
cat > "$APP_DIR/.env" <<ENVEOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="${PUBLIC_URL}"
INTERNAL_APP_URL="http://127.0.0.1:${APP_PORT}"
ADMIN_CODE="${ADMIN_CODE}"
STORAGE_MODE="local"
UPLOAD_DIR="${UPLOAD_DIR}"
ENVEOF
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"

echo "==> Instalando dependencias Node"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && corepack yarn"

echo "==> Prisma y build"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma generate"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma db push"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && corepack yarn build"

echo "==> Instalando servicio systemd"
cat > /etc/systemd/system/watchparty.service <<SERVICEEOF
[Unit]
Description=WatchParty Next.js
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
ExecStart=/usr/bin/env bash -lc 'corepack yarn start'
Restart=always
RestartSec=5
User=${APP_USER}

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable watchparty.service
systemctl restart watchparty.service

echo "==> Configurando nginx"
cat > /etc/nginx/sites-available/watchparty <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/watchparty /etc/nginx/sites-enabled/watchparty
nginx -t
systemctl restart nginx

if [[ "$ENABLE_SSL" == "true" ]]; then
  echo "==> Solicitando certificado SSL"
  certbot --nginx --non-interactive --agree-tos -m "$ADMIN_EMAIL" -d "$DOMAIN" || {
    echo "Certbot falló. Revisa DNS y vuelve a ejecutar manualmente."
  }
fi

echo "==> Estado final"
systemctl --no-pager --full status watchparty.service | sed -n '1,20p'
echo
echo "Instalación base terminada."
echo "App dir: $APP_DIR"
echo "Uploads: $UPLOAD_DIR"
echo "Dominio esperado: $DOMAIN"
echo "URL pública: $PUBLIC_URL"
echo "Si no usaste SSL, termina ese paso con certbot cuando el DNS apunte al VPS."

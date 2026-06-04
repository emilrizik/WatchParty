# Instalar WatchParty en otro servidor

Esta guía instala `WatchParty` en un VPS nuevo, con:

- aplicación `Next.js`
- PostgreSQL local
- multimedia local en disco
- `systemd`
- `nginx`
- SSL con `certbot`

## 1. Requisitos

Instala estos paquetes:

```bash
sudo apt update
sudo apt install -y curl git ffmpeg nginx certbot python3-certbot-nginx postgresql postgresql-contrib
```

Instala Node.js 20+:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
```

Verifica:

```bash
node -v
npm -v
ffmpeg -version | head -n 1
psql --version
```

## 2. Clonar el proyecto

```bash
cd /opt
sudo git clone https://github.com/emilrizik/WatchParty.git watchparty
sudo chown -R $USER:$USER /opt/watchparty
cd /opt/watchparty
```

## 3. Crear PostgreSQL

Entra a postgres:

```bash
sudo -u postgres psql
```

Crea usuario y base:

```sql
CREATE USER watchparty_user WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
CREATE DATABASE watchparty OWNER watchparty_user;
GRANT ALL PRIVILEGES ON DATABASE watchparty TO watchparty_user;
\q
```

## 4. Crear carpeta de uploads

```bash
sudo mkdir -p /var/lib/watchparty/uploads
sudo chown -R $USER:$USER /var/lib/watchparty/uploads
```

## 5. Configurar variables de entorno

Crea `.env`:

```bash
cp .env.example .env 2>/dev/null || true
nano .env
```

Contenido mínimo recomendado:

```env
DATABASE_URL="postgresql://watchparty_user:CAMBIA_ESTA_PASSWORD@localhost:5432/watchparty"
NEXTAUTH_SECRET="CAMBIA_ESTO_POR_UN_SECRETO_LARGO_Y_ALEATORIO"
NEXTAUTH_URL="https://watchparty.tudominio.com"
INTERNAL_APP_URL="http://127.0.0.1:3001"
ADMIN_CODE="CAMBIA_ESTE_CODIGO_ADMIN"
STORAGE_MODE="local"
UPLOAD_DIR="/var/lib/watchparty/uploads"
```

## 6. Instalar dependencias de Node

```bash
corepack yarn
```

## 7. Prisma y build

```bash
npx prisma generate
npx prisma db push
corepack yarn build
```

## 8. Probar arranque manual

```bash
PORT=3001 corepack yarn start
```

Abre en el mismo servidor:

```bash
curl -I http://127.0.0.1:3001
```

Si responde `200`, `307` o `308`, la app está viva.

Detén la app manual con `Ctrl+C`.

## 9. Instalar servicio systemd

Copia la plantilla:

```bash
sudo cp deploy/watchparty.service /etc/systemd/system/watchparty.service
```

Edita si cambiaste rutas:

```bash
sudo nano /etc/systemd/system/watchparty.service
```

Activa el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable watchparty.service
sudo systemctl restart watchparty.service
sudo systemctl status watchparty.service
```

## 10. Configurar nginx

Copia la plantilla:

```bash
sudo cp deploy/watchparty.nginx /etc/nginx/sites-available/watchparty
```

Edita el dominio:

```bash
sudo nano /etc/nginx/sites-available/watchparty
```

Activa el sitio:

```bash
sudo ln -sf /etc/nginx/sites-available/watchparty /etc/nginx/sites-enabled/watchparty
sudo nginx -t
sudo systemctl restart nginx
```

## 11. Sacar certificado SSL

Asegúrate de que el dominio ya apunta al VPS.

Ejecuta:

```bash
sudo certbot --nginx -d watchparty.tudominio.com
```

Luego prueba:

```bash
curl -I https://watchparty.tudominio.com
```

## 12. Si quieres mover contenido existente

Necesitas dos cosas:

- la base PostgreSQL
- la carpeta de uploads

### Exportar base en el servidor viejo

```bash
pg_dump -U watchparty_user -d watchparty > watchparty.sql
```

### Importar base en el servidor nuevo

```bash
psql -U watchparty_user -d watchparty < watchparty.sql
```

### Copiar uploads

Desde el servidor viejo al nuevo:

```bash
rsync -avz /ruta/vieja/uploads/ usuario@IP_NUEVA:/var/lib/watchparty/uploads/
```

### Punto crítico

La base guarda rutas como `uploads/...`.

Por eso `UPLOAD_DIR` del nuevo servidor debe apuntar exactamente al directorio donde pongas esos archivos.

## 13. Verificaciones finales

Verifica servicio:

```bash
systemctl status watchparty.service
```

Verifica logs:

```bash
journalctl -u watchparty.service -n 100 --no-pager
```

Verifica nginx:

```bash
nginx -t
```

Verifica app pública:

- `/`
- `/dashboard`
- `/series/[id]`
- `/watch/episode/[id]`
- `/admin`

## 14. Problemas comunes

### No reproduce videos

Revisa:

- que `UPLOAD_DIR` sea correcto
- que existan archivos en esa carpeta
- que `/uploads/...` responda `206 Partial Content`

Prueba:

```bash
curl -I -H 'Range: bytes=0-1023' https://watchparty.tudominio.com/uploads/archivo.mp4
```

Debe responder `206 Partial Content`.

### El panel admin no guarda

Revisa:

- `ADMIN_CODE`
- logs de `watchparty.service`
- que PostgreSQL esté arriba

### No carga miniaturas

Revisa:

- permisos sobre `UPLOAD_DIR`
- que `ffmpeg` esté instalado
- logs del servicio

## 15. Actualizar en el futuro

```bash
cd /opt/watchparty
git pull origin main
corepack yarn
npx prisma generate
npx prisma db push
corepack yarn build
sudo systemctl restart watchparty.service
```

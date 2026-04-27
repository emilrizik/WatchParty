# WatchParty

Aplicación `Next.js` para ver películas y series, con salas sincronizadas, chat y panel administrativo.

## Despliegue objetivo

La arquitectura que estamos dejando documentada es esta:

- **Aplicación web**: corre en el VPS.
- **Base de datos**: PostgreSQL en el VPS.
- **Multimedia**: vive en `rizik.abacusai.app`.
- **Optimización de video**: se ejecuta vía Abacus AI cuando el archivo no se procesa localmente.

## Modos de almacenamiento soportados

`lib/s3.ts` ahora puede trabajar en dos esquemas remotos distintos además del almacenamiento local:

1. **`STORAGE_MODE=local`**
   - Guarda archivos en disco local.
   - Útil para desarrollo o instalación simple.

2. **S3 / compatible**
   - Usa `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, etc.
   - Puede usar `AWS_PUBLIC_BASE_URL` para reproducir multimedia desde un dominio distinto al bucket.

3. **Proxy de multimedia**
   - El VPS no firma ni sirve multimedia directamente.
   - En su lugar llama a:
     - `https://rizik.abacusai.app/api/media-url`
     - `https://rizik.abacusai.app/api/media-upload`
   - Esto se activa con `MEDIA_HOST` y `MEDIA_PROXY_KEY`.

## Variables de entorno

Usa `.env.example` como base.

### Opción recomendada para este proyecto

Código en VPS + multimedia en `rizik.abacusai.app`:

```env
DATABASE_URL="postgresql://watchparty_user:TU_PASSWORD@localhost:5432/watchparty"
NEXTAUTH_SECRET="genera-un-secreto-aleatorio"
NEXTAUTH_URL="https://tu-dominio-del-vps"
ADMIN_CODE="tu-codigo-admin"

# Si el VPS solo consume multimedia remota
MEDIA_HOST="https://rizik.abacusai.app"
MEDIA_PROXY_KEY="tu-clave-compartida"

# Si además el host remoto usa S3/compatible internamente
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="..."
AWS_FOLDER_PREFIX=""
AWS_ENDPOINT_URL="https://rizik.abacusai.app"
AWS_PUBLIC_BASE_URL="https://rizik.abacusai.app"

ABACUSAI_API_KEY="..."
```

### Opción local

```env
STORAGE_MODE=local
UPLOAD_DIR=/opt/watchparty/uploads
```

## Funcionalidad principal

- Catálogo público para ver contenido.
- Panel admin.
- Upload de películas y series.
- Salas sincronizadas para videos y episodios.
- Chat por sala.
- Logging de errores cliente hacia `/api/client-logs`.

## Rutas clave

- Público:
  - `/dashboard`
  - `/search`
  - `/series/[id]`
  - `/watch/[id]`
  - `/watch/episode/[id]`
  - `/join/[code]`

- Admin:
  - `/admin`
  - `/admin/upload`
  - `/admin/manage`

- Multimedia proxy:
  - `/api/media-url`
  - `/api/media-upload`

## Desarrollo local

```bash
corepack yarn
corepack yarn build
corepack yarn start
```

## Despliegue en VPS

```bash
git clone https://github.com/emilrizik/WatchParty.git
cd WatchParty
cp .env.example .env
corepack yarn
npx prisma generate
npx prisma db push
corepack yarn seed
corepack yarn build
corepack yarn start
```

## Nota práctica

Si el plan definitivo es:

- **frontend/app** en el VPS
- **multimedia** en `rizik.abacusai.app`

entonces el modo más limpio es usar `MEDIA_HOST` + `MEDIA_PROXY_KEY`, y dejar que el host remoto resuelva URLs firmadas y uploads.

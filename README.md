# WatchParty

Aplicación `Next.js` para ver películas y series, con salas sincronizadas, chat y panel administrativo.

## Estado actual del despliegue

La instalación real de este proyecto hoy es esta:

- **Aplicación web**: corre en este VPS.
- **Base de datos**: PostgreSQL en este VPS.
- **Multimedia**: vive físicamente en este VPS.
- **Optimización de video**: se ejecuta localmente con `ffmpeg`.

Ya no dependemos de `Abacus` para servir multimedia en producción.

## Componentes principales

- **Frontend público**
  - `app/page.tsx`
  - `app/dashboard/page.tsx`
  - `app/search/page.tsx`
  - `app/series/[id]/page.tsx`
  - `app/watch/[id]/page.tsx`
  - `app/watch/episode/[id]/page.tsx`

- **Panel admin**
  - `app/admin/page.tsx`
  - `app/admin/upload/page.tsx`
  - `app/admin/manage/page.tsx`

- **APIs**
  - contenido: `app/api/videos/*`, `app/api/series/*`, `app/api/episodes/*`
  - salas: `app/api/rooms/*`
  - multimedia local: `app/api/upload-local/route.ts`, `app/uploads/[...path]/route.ts`
  - miniaturas automáticas: `app/api/generate-thumbnail/route.ts`
  - optimización local: `app/api/convert-hls/route.ts`

- **Persistencia**
  - Prisma schema: `prisma/schema.prisma`
  - PostgreSQL como base única

## Almacenamiento multimedia

### Modo activo

El proyecto está configurado para usar almacenamiento local:

```env
STORAGE_MODE="local"
UPLOAD_DIR="/app/nextjs_space/uploads"
```

### Qué significa

- Los uploads nuevos se guardan en disco del VPS.
- Las miniaturas generadas automáticamente también se guardan en disco local.
- Las URLs públicas de reproducción salen como `/uploads/...`.
- El endpoint `app/uploads/[...path]/route.ts` sirve archivos con soporte `Range`, necesario para streaming de MP4.

### Ubicación física

Directorio actual de multimedia:

```bash
/app/nextjs_space/uploads
```

## Variables de entorno relevantes

Usa `.env.example` como base, pero para esta instalación la configuración efectiva es:

```env
DATABASE_URL="postgresql://watchparty_user:TU_PASSWORD@localhost:5432/watchparty"
NEXTAUTH_SECRET="genera-un-secreto-aleatorio"
NEXTAUTH_URL="https://watchparty.rizikgroup.com"
INTERNAL_APP_URL="http://127.0.0.1:3001"
ADMIN_CODE="tu-codigo-admin"
STORAGE_MODE="local"
UPLOAD_DIR="/app/nextjs_space/uploads"
```

## Funcionalidad principal

- Catálogo público para ver contenido.
- Películas y series públicas sin login de usuario.
- Panel admin con código único.
- Upload de películas y series.
- Edición de series y películas desde admin.
- Eliminación de series, películas y episodios.
- Generación automática de miniaturas de episodios/películas cuando faltan.
- Salas sincronizadas para videos y episodios.
- Chat por sala.
- Persistencia de identidad anónima por navegador en salas.

## Rutas clave

### Público

- `/`
- `/dashboard`
- `/search`
- `/series/[id]`
- `/watch/[id]`
- `/watch/episode/[id]`
- `/join/[code]`

### Admin

- `/admin`
- `/admin/upload`
- `/admin/manage`

### Multimedia local

- `/api/upload-local`
- `/uploads/[...path]`
- `/api/generate-thumbnail`
- `/api/convert-hls`

## Salas sincronizadas

El proyecto maneja dos tipos de salas:

- salas para películas/videos
- salas para episodios

Características actuales:

- sincronización de `play`, `pause`, `seek` y tiempo actual
- chat por sala
- presencia por navegador con `guestSessionId`
- reingreso desde el mismo navegador sin volver a pedir nombre
- limpieza de participantes inactivos

## Miniaturas automáticas

Cuando un video o episodio se crea sin miniatura:

- se dispara `POST /api/generate-thumbnail`
- se toma un frame con `ffmpeg`
- se sube el `.jpg` al storage local
- se guarda la ruta resultante en DB

Archivo clave:

- `lib/video-thumbnails.ts`

## Optimización local de video

La ruta `app/api/convert-hls/route.ts` actualmente hace una optimización local simple:

- toma el MP4 original
- ejecuta `ffmpeg` con `-movflags +faststart`
- guarda un MP4 optimizado en `uploads/optimized/...`
- actualiza `hlsPath` con la ruta local resultante

Nota: aunque el campo histórico se llama `hlsPath`, hoy en modo local el resultado puede ser un MP4 optimizado y no necesariamente un `.m3u8`.

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
corepack yarn build
corepack yarn start
```

## Servicio actual

En este VPS la app corre como servicio `systemd`:

```bash
systemctl status watchparty.service
```

Dominio público actual:

```text
https://watchparty.rizikgroup.com
```

## Migración desde storage remoto

Si vienes de una instalación antigua con multimedia remota, el script usado para bajar la media al VPS es:

- `scripts/migrate-media-to-local.js`

Ese script:

- descarga archivos remotos
- los guarda en `uploads/`
- reescribe `cloud_storage_path` y miniaturas a rutas locales
- limpia dependencia operativa de URLs remotas

## Nota operativa

Si vuelves a querer usar storage remoto en el futuro, `lib/s3.ts` todavía conserva abstracción para:

- local
- S3 / compatible
- proxy remoto

Pero la configuración recomendada para este proyecto hoy es **todo en el mismo VPS**: app, DB y multimedia.

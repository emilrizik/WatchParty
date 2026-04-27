# 🎬 WatchParty

A self-hosted Netflix/Kodi-like streaming platform with synchronized watch parties. Built with Next.js 14, PostgreSQL, and Prisma.

## Architecture Overview

```
.
├── app/                    # Next.js App Router (pages + API routes)
│   ├── page.tsx            # Landing → redirects to /dashboard
│   ├── dashboard/          # Main content browser (public)
│   ├── watch/[id]/         # Video player with room sync
│   ├── watch/episode/[id]/ # Episode player with room sync
│   ├── series/[id]/        # Series detail (seasons/episodes)
│   ├── search/             # Content search
│   ├── join/[code]/        # Join room via shared link
│   ├── admin/              # Admin panel (code-protected)
│   │   ├── login/          # Admin NextAuth login
│   │   ├── upload/         # Upload movies/series
│   │   ├── manage/         # Edit/delete content, add seasons
│   │   └── users/          # CRUD admin users
│   ├── auth/               # Login/signup pages (admin-only)
│   └── api/                # REST API endpoints (see below)
├── components/             # Shared React components
│   ├── navbar.tsx          # Main nav with search + admin access
│   ├── ui/                 # shadcn/ui primitives
│   └── theme-provider.tsx  # Dark theme provider
├── lib/                    # Core utilities
│   ├── db.ts               # Prisma client singleton
│   ├── s3.ts               # Storage abstraction (local/S3/proxy)
│   ├── aws-config.ts       # S3 client factory (supports MinIO)
│   ├── auth-options.ts     # NextAuth config (admin-only login)
│   └── utils.ts            # Helpers
├── prisma/
│   └── schema.prisma       # Database schema
├── scripts/
│   ├── seed.ts             # DB seed (admin users + categories)
│   └── safe-seed.ts        # Non-destructive seed variant
├── public/                 # Static assets + PWA icons
└── types/                  # TypeScript type extensions
```

## Key Concepts

### Content Model
- **Videos** (`Video`): Standalone movies/documentaries with optional S3-stored file + thumbnail
- **Series** (`Series`) → **Seasons** (`Season`) → **Episodes** (`Episode`): Hierarchical structure; each episode has its own video file
- **Categories** (`Category`): `Películas`, `Series`, `Documentales`, `Música`

### Watch Rooms (Synchronized Playback)
- **Room** (for videos) and **EpisodeRoom** (for episodes) enable multiple users to watch together in sync
- Each room has a unique 8-char `code`, tracks `isPlaying`, `currentTime`, and `lastUpdatedAt`
- Sync is polling-based (every 2s): clients call `/api/rooms/sync` or `/api/rooms/episode/sync`
- Episode rooms support **synchronized episode navigation**: when one user changes episode, all participants follow
- Each room has a real-time chat (polling every 2s) via `/api/rooms/[code]/messages`
- Rooms can be joined via shared link: `/join/{code}`

### Authentication & Access
- **Public access**: All content browsing, watching, and room participation is public (no login required)
- **Admin panel**: Protected by a simple code (`rizik`) stored in `localStorage`, entered via navbar button
- **NextAuth**: Used only for admin user management (JWT strategy, credentials provider)
- Admin users have `isAdmin: true` in the `User` model

### Storage Abstraction (`lib/s3.ts`)
The storage layer supports three modes controlled by `STORAGE_MODE` env var:
1. **`local`**: Files stored on disk in `UPLOAD_DIR` directory, served via `/uploads/` path
2. **`s3`**: Direct AWS S3 or MinIO access with explicit credentials
3. **`proxy`** (via `s3-proxy.ts` patch): Delegates to a remote host's `/api/media-url` and `/api/media-upload` endpoints

Key functions: `generatePresignedUploadUrl()`, `getFileUrl()`, `deleteFile()`, `initiateMultipartUpload()`

### Video Optimization
- `/api/convert-hls` optimizes videos with FFmpeg: `-c copy -movflags +faststart` (fast, no re-encoding)
- Uses **local FFmpeg** binary on VPS (not cloud API)
- Updates `hlsPath` and `hlsStatus` in DB on completion
- `hlsStatus` values: `pending` → `processing` → `completed` | `failed`

## Database Schema (PostgreSQL + Prisma)

### Core Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Admin accounts | `email`, `password`, `isAdmin` |
| `Category` | Content categories | `name`, `slug` |
| `Video` | Standalone videos | `title`, `cloud_storage_path`, `hlsPath`, `hlsStatus`, `categoryId` |
| `Series` | Series container | `title`, `thumbnail_path`, `categoryId` |
| `Season` | Season within series | `seriesId`, `number` |
| `Episode` | Episode within season | `seasonId`, `number`, `cloud_storage_path`, `hlsPath` |

### Room Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Room` | Video watch party | `code`, `videoId`, `isPlaying`, `currentTime` |
| `EpisodeRoom` | Episode watch party | `code`, `episodeId`, `isPlaying`, `currentTime` |
| `RoomParticipant` / `EpisodeRoomParticipant` | Room members | `roomId`, `guestName`, `odysId?` |
| `RoomMessage` / `EpisodeRoomMessage` | Chat messages | `roomId`, `guestName`, `message` |

All participant/message models support **guest users** (no account required) via `guestName` field and optional `odysId` link to `User`.

## API Routes

### Content (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | List all videos with URLs |
| GET | `/api/videos/[id]` | Single video details |
| GET | `/api/videos/by-category` | Videos filtered by category |
| GET | `/api/videos/search` | Search videos by title |
| GET | `/api/series` | List all series with seasons/episodes |
| GET | `/api/series/[id]` | Single series with all data |
| GET | `/api/episodes/[id]` | Single episode details |
| GET | `/api/seasons/[id]/episodes` | Episodes for a season |
| GET | `/api/categories` | List categories |

### Rooms (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/active` | All active rooms with participants |
| POST | `/api/rooms/create` | Create video room |
| POST | `/api/rooms/join` | Join video room |
| POST | `/api/rooms/sync` | Sync playback state |
| GET | `/api/rooms/[code]` | Room details |
| POST | `/api/rooms/[code]/leave` | Leave room |
| GET/POST | `/api/rooms/[code]/messages` | Chat messages |
| POST | `/api/rooms/episode/create` | Create episode room |
| POST | `/api/rooms/episode/join` | Join episode room |
| POST | `/api/rooms/episode/sync` | Sync episode playback (supports episode changes) |
| GET | `/api/rooms/episode/[code]` | Episode room details |
| POST | `/api/rooms/episode/[code]/leave` | Leave episode room |
| GET/POST | `/api/rooms/episode/[code]/messages` | Episode room chat |

### Upload & Management (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/upload-presigned` | Get presigned upload URL |
| POST | `/api/videos/complete` | Complete upload + trigger optimization |
| POST | `/api/series` | Create new series |
| POST | `/api/series/[id]/seasons` | Add season to series |
| POST | `/api/seasons/[id]/episodes` | Add episodes to season |
| POST | `/api/convert-hls` | Trigger FFmpeg optimization |
| DELETE | `/api/videos/[id]` | Delete video |
| DELETE | `/api/series/[id]` | Delete series |
| DELETE | `/api/episodes/[id]` | Delete episode |

### Admin Users (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/users` | List/create admin users |
| PATCH/DELETE | `/api/admin/users/[id]` | Update/delete admin user |

### Media Proxy (API Key Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/media-url?path=...&public=...` | Get file URL (header: `x-media-key`) |
| POST | `/api/media-upload` | Upload operations (header: `x-media-key`) |

## Environment Variables

```env
# Required
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
NEXTAUTH_SECRET="openssl rand -base64 32"
NEXTAUTH_URL="https://your-domain.com"

# Storage - Option A: Local disk
STORAGE_MODE=local
UPLOAD_DIR=/opt/watchparty/uploads

# Storage - Option B: AWS S3 / MinIO
STORAGE_MODE=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET_NAME=...
AWS_FOLDER_PREFIX=...
AWS_ENDPOINT_URL=http://localhost:9000  # Only for MinIO

# Storage - Option C: Proxy to remote host
MEDIA_HOST=https://rizik.abacusai.app
MEDIA_PROXY_KEY=...

# Optional
MEDIA_PROXY_KEY=...  # Protects /api/media-url and /api/media-upload
```

## Quick Start (VPS / Debian)

```bash
# Prerequisites: Node.js 18+, PostgreSQL 14+, FFmpeg
git clone https://github.com/emilrizik/WatchParty.git
cd WatchParty

cp .env.example .env
# Edit .env with your database URL and storage config

yarn install
yarn prisma generate
yarn prisma db push
yarn tsx scripts/seed.ts  # Creates admin users + categories

yarn build
yarn start  # Runs on port 3000
```

### Default Admin Access
- **Quick admin code** (navbar button): `rizik`
- **Admin login**: `john@doe.com` / `johndoe123` or `rizik@admin.com` / `rizik`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (JWT, credentials) |
| Storage | Local disk / AWS S3 / MinIO |
| Video | hls.js player, FFmpeg optimization |
| UI | Tailwind CSS + shadcn/ui + Framer Motion |
| PWA | Web App Manifest + icons |

## UI Components

Uses [shadcn/ui](https://ui.shadcn.com/) primitives in `components/ui/`. Key custom components:
- `components/navbar.tsx` — Global navigation + admin code entry
- `app/watch/*/watch-client.tsx` — Video player with floating chat bubble + room sync
- `app/dashboard/_components/dashboard-client.tsx` — Content browser + active rooms list

## Development Notes

- The app uses **polling** (not WebSockets) for room sync and chat (every 2 seconds)
- Room participants are identified by `guestName` (no account needed); optional `odysId` links to a `User`
- All content browsing/watching is public; only content management requires admin access
- The `convert-hls` endpoint name is historical — it now does MP4 fast-start optimization, not HLS segmentation
- Prisma schema uses `onDelete: Cascade` on most relations for clean deletion
- `isPublic` on videos/episodes controls S3 URL type (public direct URL vs presigned)

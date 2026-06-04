const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const mediaHost = process.env.MEDIA_HOST;
const mediaKey = process.env.MEDIA_PROXY_KEY || process.env.NEXTAUTH_SECRET;
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function basenameFromUrl(url) {
  const pathname = new URL(url).pathname;
  return path.basename(pathname) || `file-${Date.now()}`;
}

function toLocalStoragePath(sourcePath, fallbackPrefix) {
  if (!sourcePath) return null;
  if (sourcePath.startsWith('/uploads/')) return sourcePath.slice(1);
  if (sourcePath.startsWith('uploads/')) return sourcePath;
  if (/^https?:\/\//.test(sourcePath)) {
    return `uploads/${fallbackPrefix}/${basenameFromUrl(sourcePath)}`;
  }
  const publicMatch = sourcePath.match(/public\/uploads\/(.+)$/);
  if (publicMatch) return `uploads/${publicMatch[1]}`;
  const uploadMatch = sourcePath.match(/uploads\/(.+)$/);
  if (uploadMatch) return `uploads/${uploadMatch[1]}`;
  return `uploads/${fallbackPrefix}/${path.basename(sourcePath)}`;
}

async function resolveSourceUrl(sourcePath, isPublic) {
  if (!sourcePath) return null;
  if (/^https?:\/\//.test(sourcePath)) return sourcePath;
  const params = new URLSearchParams({ path: sourcePath, public: String(Boolean(isPublic)) });
  const res = await fetch(`${mediaHost}/api/media-url?${params.toString()}`, {
    headers: { 'x-media-key': mediaKey },
  });
  if (!res.ok) {
    throw new Error(`media-url ${res.status} for ${sourcePath}`);
  }
  return (await res.json()).url;
}

async function downloadToLocal(sourcePath, isPublic, fallbackPrefix) {
  const localStoragePath = toLocalStoragePath(sourcePath, fallbackPrefix);
  const localFsPath = path.join(uploadDir, localStoragePath.replace(/^uploads\//, ''));
  if (fs.existsSync(localFsPath) && fs.statSync(localFsPath).size > 0) {
    return localStoragePath;
  }
  const sourceUrl = await resolveSourceUrl(sourcePath, isPublic);
  const res = await fetch(sourceUrl);
  if (!res.ok || !res.body) {
    throw new Error(`download ${res.status} for ${sourcePath}`);
  }
  ensureDir(localFsPath);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(localFsPath));
  return localStoragePath;
}

(async () => {
  if (!mediaHost) throw new Error('MEDIA_HOST is required for migration');
  console.log(`Using upload dir: ${uploadDir}`);

  const videos = await prisma.video.findMany();
  const episodes = await prisma.episode.findMany();
  const seriesList = await prisma.series.findMany();

  let migrated = 0;

  for (const series of seriesList) {
    const data = {};
    if (series.thumbnail_path && !series.thumbnail_path.startsWith('uploads/')) {
      data.thumbnail_path = await downloadToLocal(series.thumbnail_path, series.thumbnailIsPublic, 'series-thumbs');
    }
    if (Object.keys(data).length > 0) {
      await prisma.series.update({ where: { id: series.id }, data });
      migrated++;
      console.log(`series ${series.id} migrated`);
    }
  }

  for (const video of videos) {
    const data = {
      cloud_storage_path: await downloadToLocal(video.cloud_storage_path, video.isPublic, 'videos'),
      hlsPath: null,
      hlsStatus: 'pending',
    };
    if (video.thumbnail_path) {
      data.thumbnail_path = await downloadToLocal(video.thumbnail_path, video.thumbnailIsPublic, 'video-thumbs');
    }
    await prisma.video.update({ where: { id: video.id }, data });
    migrated++;
    console.log(`video ${video.id} migrated`);
  }

  for (const episode of episodes) {
    const data = {
      cloud_storage_path: await downloadToLocal(episode.cloud_storage_path, episode.isPublic, 'episodes'),
      hlsPath: null,
      hlsStatus: 'pending',
    };
    if (episode.thumbnail_path) {
      data.thumbnail_path = await downloadToLocal(episode.thumbnail_path, episode.thumbnailIsPublic, 'episode-thumbs');
    }
    await prisma.episode.update({ where: { id: episode.id }, data });
    migrated++;
    console.log(`episode ${episode.id} migrated`);
  }

  console.log(JSON.stringify({ success: true, migrated }, null, 2));
  await prisma.$disconnect();
})();

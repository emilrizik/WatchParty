/**
 * migrate-data.ts - Script de migración de datos para WatchParty VPS
 * 
 * Uso:
 *   cd /opt/watchparty
 *   npx tsx migrate-data.ts
 * 
 * Requiere que DATABASE_URL esté configurado en .env
 * Importa los datos desde db-dump.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface DumpData {
  categories: any[];
  users: any[];
  series: any[];
  seasons: any[];
  episodes: any[];
  videos: any[];
}

async function migrate() {
  const dumpPath = path.join(__dirname, 'db-dump.json');
  
  if (!fs.existsSync(dumpPath)) {
    console.error('\u274c db-dump.json no encontrado. Colócalo junto a este script.');
    process.exit(1);
  }

  const data: DumpData = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));

  console.log('\n\ud83d\udce6 Datos a migrar:');
  console.log(`   Categorías: ${data.categories.length}`);
  console.log(`   Usuarios:   ${data.users.length}`);
  console.log(`   Series:     ${data.series.length}`);
  console.log(`   Temporadas: ${data.seasons.length}`);
  console.log(`   Episodios:  ${data.episodes.length}`);
  console.log(`   Videos:     ${data.videos.length}`);
  console.log('');

  // 1. Categories
  console.log('\u2192 Migrando categorías...');
  for (const cat of data.categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        createdAt: new Date(cat.createdAt),
      },
    });
  }
  console.log(`   \u2713 ${data.categories.length} categorías`);

  // 2. Users (only real users, skip test users)
  console.log('\u2192 Migrando usuarios...');
  const realUsers = data.users.filter(u => 
    !u.email.includes('testuser') || u.isAdmin
  );
  for (const user of realUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        isAdmin: user.isAdmin,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt || user.createdAt),
      },
    });
  }
  console.log(`   \u2713 ${realUsers.length} usuarios (${data.users.length - realUsers.length} test users omitidos)`);

  // 3. Series
  console.log('\u2192 Migrando series...');
  for (const s of data.series) {
    await prisma.series.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        title: s.title,
        description: s.description,
        thumbnail_path: s.thumbnail_path,
        thumbnailIsPublic: s.thumbnailIsPublic,
        categoryId: s.categoryId,
        uploadedById: s.uploadedById,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      },
    });
  }
  console.log(`   \u2713 ${data.series.length} series`);

  // 4. Seasons
  console.log('\u2192 Migrando temporadas...');
  for (const season of data.seasons) {
    await prisma.season.upsert({
      where: { id: season.id },
      update: {},
      create: {
        id: season.id,
        seriesId: season.seriesId,
        number: season.number,
        title: season.title,
        createdAt: new Date(season.createdAt),
        updatedAt: new Date(season.updatedAt),
      },
    });
  }
  console.log(`   \u2713 ${data.seasons.length} temporadas`);

  // 5. Episodes
  console.log('\u2192 Migrando episodios...');
  for (const ep of data.episodes) {
    await prisma.episode.upsert({
      where: { id: ep.id },
      update: {},
      create: {
        id: ep.id,
        seasonId: ep.seasonId,
        number: ep.number,
        title: ep.title,
        description: ep.description,
        cloud_storage_path: ep.cloud_storage_path,
        isPublic: ep.isPublic,
        thumbnail_path: ep.thumbnail_path,
        thumbnailIsPublic: ep.thumbnailIsPublic,
        duration: ep.duration,
        hlsPath: ep.hlsPath,
        hlsStatus: ep.hlsStatus,
        createdAt: new Date(ep.createdAt),
        updatedAt: new Date(ep.updatedAt),
      },
    });
  }
  console.log(`   \u2713 ${data.episodes.length} episodios`);

  // 6. Videos (standalone)
  if (data.videos.length > 0) {
    console.log('\u2192 Migrando videos...');
    for (const v of data.videos) {
      await prisma.video.upsert({
        where: { id: v.id },
        update: {},
        create: {
          id: v.id,
          title: v.title,
          description: v.description,
          cloud_storage_path: v.cloud_storage_path,
          isPublic: v.isPublic,
          thumbnail_path: v.thumbnail_path,
          thumbnailIsPublic: v.thumbnailIsPublic,
          duration: v.duration,
          categoryId: v.categoryId,
          uploadedById: v.uploadedById,
          hlsPath: v.hlsPath,
          hlsStatus: v.hlsStatus,
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        },
      });
    }
    console.log(`   \u2713 ${data.videos.length} videos`);
  }

  console.log('\n\u2705 Migración completada exitosamente!');
  console.log('\n\ud83d\udcdd Resumen:');
  console.log(`   - 1 serie: GAME OF THRONES`);
  console.log(`   - 8 temporadas (S1-S8)`);
  console.log(`   - 33 episodios con URLs de multimedia apuntando a rizik.abacusai.app`);
  console.log(`   - Los videos se sirven vía el proxy MEDIA_HOST`);
  
  await prisma.$disconnect();
}

migrate().catch(async (e) => {
  console.error('\u274c Error en migración:', e);
  await prisma.$disconnect();
  process.exit(1);
});

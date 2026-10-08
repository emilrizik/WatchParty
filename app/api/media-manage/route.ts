import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const s3 = createS3Client();
function authorized(req: NextRequest) {
  const given = req.headers.get('x-media-key'), expected = process.env.MEDIA_PROXY_KEY || process.env.NEXTAUTH_SECRET;
  return Boolean(given && expected && timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected!).digest()));
}
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { bucketName, folderPrefix } = getBucketConfig();
    const namespace = folderPrefix.replace(/^\/+|\/+$/g, '') + '/';
    if (!bucketName || namespace === '/' || namespace.includes('..')) return NextResponse.json({ error: "Configura AWS_BUCKET_NAME y AWS_FOLDER_PREFIX para limitar la gestión a este proyecto" }, { status: 503 });
    const body = await req.json();
    if (body.action === 'capabilities') return NextResponse.json({ version: 1, stats: true, listFiles: true, deleteFiles: true, namespace, bucketName });
    if (body.action === 'stats') {
      let cursor: string | undefined; let usedBytes = 0, fileCount = 0;
      do { const page = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: namespace, MaxKeys: 1000, ContinuationToken: cursor })); for (const file of page.Contents || []) { usedBytes += file.Size || 0; fileCount++; } cursor = page.NextContinuationToken; } while (cursor);
      const configuredLimit = Number(process.env.MEDIA_STORAGE_LIMIT_BYTES || 0);
      return NextResponse.json({ usedBytes, fileCount, limitBytes: configuredLimit > 0 ? configuredLimit : null, measuredAt: new Date().toISOString() });
    }
    if (body.action === 'list') {
      const token = typeof body.cursor === 'string' ? body.cursor : undefined;
      const page = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: namespace, MaxKeys: 100, ContinuationToken: token }));
      return NextResponse.json({ files: (page.Contents || []).filter(file => file.Key && !file.Key.endsWith('/')).map(file => ({ key: file.Key, size: file.Size || 0, modifiedAt: file.LastModified?.toISOString() || null })), nextCursor: page.NextContinuationToken || null });
    }
    if (body.action === 'delete') {
      if (!Array.isArray(body.paths) || !body.paths.length || body.paths.length > 100 || body.paths.some((key: unknown) => typeof key !== 'string' || !key.startsWith(namespace) || key.split('/').some(part => part === '..') || key.includes('\\'))) return NextResponse.json({ error: "Ruta fuera del proyecto o lote no válido" }, { status: 400 });
      const keys: string[] = [...new Set<string>(body.paths)];
      const deleted = await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: keys.map(Key => ({ Key })), Quiet: false } }));
      if (deleted.Errors?.length) return NextResponse.json({ error: "S3 no pudo borrar todos los archivos", failed: deleted.Errors.map(error => ({ key: error.Key, code: error.Code })) }, { status: 502 });
      let next = 0; const confirmed: string[] = []; const failed: string[] = [];
      await Promise.all(Array.from({ length: Math.min(8, keys.length) }, async () => { while (next < keys.length) { const key = keys[next++]; try { await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key })); failed.push(key); } catch (error: any) { if (error.$metadata?.httpStatusCode === 404 || error.name === 'NotFound' || error.name === 'NoSuchKey') confirmed.push(key); else failed.push(key); } } }));
      if (failed.length) return NextResponse.json({ error: "No se pudo confirmar el borrado físico", failed }, { status: 502 });
      return NextResponse.json({ deleted: confirmed, verified: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error('Media management error:', error.name);
    return NextResponse.json({ error: "No se pudo gestionar el almacenamiento. Comprueba los permisos S3 del despliegue." }, { status: 502 });
  }
}

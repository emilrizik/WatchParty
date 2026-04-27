/**
 * s3.ts para VPS - Proxy de multimedia a través de rizik.abacusai.app
 * 
 * Este archivo reemplaza el s3.ts original. En vez de acceder a S3 directamente,
 * llama a los endpoints /api/media-url y /api/media-upload de rizik.abacusai.app
 * para obtener URLs firmadas.
 * 
 * Configurar en .env:
 *   MEDIA_HOST=https://rizik.abacusai.app
 *   MEDIA_PROXY_KEY=<tu-clave-secreta>
 */

const getMediaHost = () => process.env.MEDIA_HOST || "https://rizik.abacusai.app";
const getMediaKey = () => process.env.MEDIA_PROXY_KEY || "";

async function callMediaProxy(endpoint: string, params: Record<string, any>) {
  const host = getMediaHost();
  const key = getMediaKey();

  const response = await fetch(`${host}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-media-key": key,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Media proxy error (${response.status}): ${err}`);
  }

  return response.json();
}

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic = false
) {
  return callMediaProxy("/api/media-upload", {
    action: "presign-upload",
    fileName,
    contentType,
    isPublic,
  });
}

export async function initiateMultipartUpload(
  fileName: string,
  isPublic = false
) {
  return callMediaProxy("/api/media-upload", {
    action: "initiate-multipart",
    fileName,
    isPublic,
  });
}

export async function getPresignedUrlForPart(
  cloud_storage_path: string,
  uploadId: string,
  partNumber: number
) {
  const result = await callMediaProxy("/api/media-upload", {
    action: "presign-part",
    cloud_storage_path,
    uploadId,
    partNumber,
  });
  return result.url;
}

export async function completeMultipartUpload(
  cloud_storage_path: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
) {
  await callMediaProxy("/api/media-upload", {
    action: "complete-multipart",
    cloud_storage_path,
    uploadId,
    parts,
  });
}

export async function getFileUrl(cloud_storage_path: string, isPublic: boolean) {
  const host = getMediaHost();
  const key = getMediaKey();

  const params = new URLSearchParams({
    path: cloud_storage_path,
    public: String(isPublic),
  });

  const response = await fetch(`${host}/api/media-url?${params}`, {
    headers: { "x-media-key": key },
  });

  if (!response.ok) {
    throw new Error(`Media URL proxy error: ${response.status}`);
  }

  const data = await response.json();
  return data.url;
}

export async function deleteFile(cloud_storage_path: string) {
  // Deletion not supported via proxy for security
  // Delete content from the admin panel on rizik.abacusai.app
  console.warn("deleteFile via proxy not supported. Use rizik.abacusai.app admin panel.");
}

import fs from "fs";
import path from "path";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const isLocalStorage = () => process.env.STORAGE_MODE === "local";

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

let s3Client: ReturnType<typeof createS3Client> | null = null;
function getS3Client() {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic = false
) {
  if (isLocalStorage()) {
    const cloud_storage_path = `uploads/${Date.now()}-${fileName}`;
    return {
      uploadUrl: `/api/upload-local?path=${encodeURIComponent(cloud_storage_path)}`,
      cloud_storage_path,
    };
  }

  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: 3600,
  });

  return { uploadUrl, cloud_storage_path };
}

export async function initiateMultipartUpload(
  fileName: string,
  isPublic = false
) {
  if (isLocalStorage()) {
    return {
      uploadId: `local-${Date.now()}`,
      cloud_storage_path: `uploads/${Date.now()}-${fileName}`,
    };
  }

  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const response = await getS3Client().send(command);

  return {
    uploadId: response.UploadId,
    cloud_storage_path,
  };
}

export async function getPresignedUrlForPart(
  cloud_storage_path: string,
  uploadId: string,
  partNumber: number
) {
  if (isLocalStorage()) {
    return `/api/upload-local?path=${encodeURIComponent(cloud_storage_path)}&part=${partNumber}`;
  }

  const { bucketName } = getBucketConfig();
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
}

export async function completeMultipartUpload(
  cloud_storage_path: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
) {
  if (isLocalStorage()) {
    return;
  }

  const { bucketName } = getBucketConfig();
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await getS3Client().send(command);
}

export async function getFileUrl(cloud_storage_path: string, isPublic: boolean) {
  if (isLocalStorage()) {
    return `/${cloud_storage_path}`;
  }

  const { bucketName } = getBucketConfig();
  const region = process.env.AWS_REGION ?? "us-east-1";

  if (isPublic) {
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: "attachment",
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
}

export async function deleteFile(cloud_storage_path: string) {
  if (isLocalStorage()) {
    const normalizedPath = cloud_storage_path.replace(/^\/?uploads\//, "");
    const localPath = path.join(
      getUploadDir(),
      normalizedPath
    );
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return;
  }

  const { bucketName } = getBucketConfig();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  await getS3Client().send(command);
}

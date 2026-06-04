import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFileUrl, uploadBufferToStorage } from "@/lib/s3";

const execFileAsync = promisify(execFile);

function sanitizeBaseName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "thumbnail";
}

function getSeekSeconds(duration?: number | null) {
  if (!duration || Number.isNaN(duration)) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(duration * 0.15), 1), 30);
}

function isLocalStorage() {
  return process.env.STORAGE_MODE === "local";
}

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function getLocalInputPath(sourcePath: string) {
  return path.join(getUploadDir(), sourcePath.replace(/^\/+/, "").replace(/^uploads\//, ""));
}

export async function generateThumbnailFromVideo(options: {
  sourcePath: string;
  isPublic: boolean;
  duration?: number | null;
  filePrefix: string;
}) {
  const sourceInput = isLocalStorage()
    ? getLocalInputPath(options.sourcePath)
    : await getFileUrl(options.sourcePath, options.isPublic);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "watchparty-thumb-"));
  const outputPath = path.join(tempDir, `${sanitizeBaseName(options.filePrefix)}.jpg`);

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      String(getSeekSeconds(options.duration)),
      "-i",
      sourceInput,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outputPath,
    ]);

    const buffer = await fs.readFile(outputPath);
    const { cloud_storage_path } = await uploadBufferToStorage(
      `${sanitizeBaseName(options.filePrefix)}-${Date.now()}.jpg`,
      "image/jpeg",
      buffer,
      true
    );

    return cloud_storage_path;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

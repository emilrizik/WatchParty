import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { resolveAdminWriterUserId } from "@/lib/admin-write-access";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

function isLocalStorage() {
  return process.env.STORAGE_MODE === "local";
}

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function getLocalInputPath(storagePath: string) {
  return path.join(getUploadDir(), storagePath.replace(/^\/+/, "").replace(/^uploads\//, ""));
}

function buildOptimizedOutput(itemId: string) {
  const relativePath = `uploads/optimized/${itemId}.mp4`;
  const fullPath = path.join(getUploadDir(), "optimized", `${itemId}.mp4`);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  return { relativePath, fullPath };
}

async function optimizeForStreamingRemote(inputUrl: string, outputName: string): Promise<{ optimizedUrl: string } | null> {
  try {
    const ffmpegCommand = `-i {{in_1}} -c copy -movflags +faststart -f mp4 {{out_1}}`;

    const createResponse = await fetch("https://apps.abacus.ai/api/createRunFfmpegCommandRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        input_files: { in_1: inputUrl },
        output_files: { out_1: `${outputName}.mp4` },
        ffmpeg_command: ffmpegCommand,
      }),
    });

    if (!createResponse.ok) {
      console.error("Failed to create FFmpeg request:", await createResponse.text());
      return null;
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return null;
    }

    for (let attempts = 0; attempts < 600; attempts++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusResponse = await fetch("https://apps.abacus.ai/api/getRunFfmpegCommandStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || "PENDING";
      const result = statusResult?.result || null;

      if (status === "SUCCESS" && result?.result) {
        return { optimizedUrl: result.result.out_1 };
      }

      if (status === "FAILED") {
        console.error("Remote FFmpeg failed:", result?.error || statusResult);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Remote video optimization error:", error);
    return null;
  }
}

async function optimizeForStreamingLocal(storagePath: string, itemId: string) {
  const inputPath = getLocalInputPath(storagePath);
  const { relativePath, fullPath } = buildOptimizedOutput(itemId);

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    fullPath,
  ]);

  return { optimizedUrl: `/${relativePath}` };
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, episodeId, internalKey } = await req.json();
    const isInternalCall = internalKey === process.env.NEXTAUTH_SECRET;

    if (!isInternalCall) {
      const writerUserId = await resolveAdminWriterUserId();
      if (!writerUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!videoId && !episodeId) {
      return NextResponse.json({ error: "videoId or episodeId required" }, { status: 400 });
    }

    let item: any;
    let table: "video" | "episode";

    if (videoId) {
      item = await prisma.video.findUnique({ where: { id: videoId } });
      table = "video";
    } else {
      item = await prisma.episode.findUnique({ where: { id: episodeId } });
      table = "episode";
    }

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (table === "video") {
      await prisma.video.update({ where: { id: videoId }, data: { hlsStatus: "processing" } });
    } else {
      await prisma.episode.update({ where: { id: episodeId }, data: { hlsStatus: "processing" } });
    }

    const result = isLocalStorage()
      ? await optimizeForStreamingLocal(item.cloud_storage_path, item.id)
      : await optimizeForStreamingRemote(await getFileUrl(item.cloud_storage_path, item.isPublic), `optimized_${Date.now()}_${item.id}`);

    if (result) {
      if (table === "video") {
        await prisma.video.update({ where: { id: videoId }, data: { hlsPath: result.optimizedUrl, hlsStatus: "completed" } });
      } else {
        await prisma.episode.update({ where: { id: episodeId }, data: { hlsPath: result.optimizedUrl, hlsStatus: "completed" } });
      }

      return NextResponse.json({ success: true, hlsUrl: result.optimizedUrl });
    }

    if (table === "video") {
      await prisma.video.update({ where: { id: videoId }, data: { hlsStatus: "failed" } });
    } else {
      await prisma.episode.update({ where: { id: episodeId }, data: { hlsStatus: "failed" } });
    }

    return NextResponse.json({ error: "HLS conversion failed" }, { status: 500 });
  } catch (error: any) {
    console.error("HLS conversion error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

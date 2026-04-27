import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const isLocalStorage = () => process.env.STORAGE_MODE === "local";

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

async function optimizeForStreaming(
  inputPath: string,
  outputName: string
): Promise<{ optimizedUrl: string } | null> {
  try {
    const outputDir = path.join(getUploadDir(), "optimized");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${outputName}.mp4`);

    // Usar FFmpeg local para optimizar el video
    const cmd = `ffmpeg -i "${inputPath}" -c copy -movflags +faststart -f mp4 -y "${outputPath}"`;
    console.log("Running FFmpeg:", cmd);

    await execAsync(cmd, { timeout: 600000 }); // 10 min timeout

    if (fs.existsSync(outputPath)) {
      if (isLocalStorage()) {
        return { optimizedUrl: `/uploads/optimized/${outputName}.mp4` };
      }
      return { optimizedUrl: outputPath };
    }

    return null;
  } catch (error) {
    console.error("Video optimization error:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, episodeId, internalKey } = await req.json();

    const isInternalCall = internalKey === process.env.NEXTAUTH_SECRET;
    if (!isInternalCall) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
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

    // Update status to processing
    if (table === "video") {
      await prisma.video.update({ where: { id: videoId }, data: { hlsStatus: "processing" } });
    } else {
      await prisma.episode.update({ where: { id: episodeId }, data: { hlsStatus: "processing" } });
    }

    // Resolver la ruta del video
    let inputPath: string;
    if (isLocalStorage()) {
      inputPath = path.join(getUploadDir(), item.cloud_storage_path.replace(/^uploads\//, ""));
    } else {
      inputPath = await getFileUrl(item.cloud_storage_path, item.isPublic);
    }

    const outputName = `optimized_${Date.now()}_${item.id}`;
    console.log("Starting video optimization for:", inputPath);

    const result = await optimizeForStreaming(inputPath, outputName);

    if (result) {
      if (table === "video") {
        await prisma.video.update({
          where: { id: videoId },
          data: { hlsPath: result.optimizedUrl, hlsStatus: "completed" },
        });
      } else {
        await prisma.episode.update({
          where: { id: episodeId },
          data: { hlsPath: result.optimizedUrl, hlsStatus: "completed" },
        });
      }
      return NextResponse.json({ success: true, hlsUrl: result.optimizedUrl });
    } else {
      if (table === "video") {
        await prisma.video.update({ where: { id: videoId }, data: { hlsStatus: "failed" } });
      } else {
        await prisma.episode.update({ where: { id: episodeId }, data: { hlsStatus: "failed" } });
      }
      return NextResponse.json({ error: "Optimization failed" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("HLS conversion error:", error);
    return NextResponse.json({ error: error?.message ?? "Internal server error" }, { status: 500 });
  }
}

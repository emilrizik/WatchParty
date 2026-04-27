import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

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
    if (isLocalStorage()) {
      const outputDir = path.join(getUploadDir(), "optimized");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, `${outputName}.mp4`);
      await execAsync(
        `ffmpeg -i "${inputPath}" -c copy -movflags +faststart -f mp4 -y "${outputPath}"`,
        { timeout: 600000 }
      );

      if (fs.existsSync(outputPath)) {
        return { optimizedUrl: `/uploads/optimized/${outputName}.mp4` };
      }

      return null;
    }

    const ffmpegCommand = `-i {{in_1}} -c copy -movflags +faststart -f mp4 {{out_1}}`;

    const createResponse = await fetch(
      "https://apps.abacus.ai/api/createRunFfmpegCommandRequest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          input_files: { in_1: inputPath },
          output_files: { out_1: `${outputName}.mp4` },
          ffmpeg_command: ffmpegCommand,
        }),
      }
    );

    if (!createResponse.ok) {
      return null;
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return null;
    }

    let attempts = 0;
    while (attempts < 600) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        "https://apps.abacus.ai/api/getRunFfmpegCommandStatus",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id,
            deployment_token: process.env.ABACUSAI_API_KEY,
          }),
        }
      );

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || "PENDING";
      const result = statusResult?.result || null;

      if (status === "SUCCESS" && result?.result) {
        return { optimizedUrl: result.result.out_1 };
      }
      if (status === "FAILED") {
        return null;
      }
      attempts += 1;
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
      if (!session?.user?.id || !session.user.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!videoId && !episodeId) {
      return NextResponse.json(
        { error: "videoId or episodeId required" },
        { status: 400 }
      );
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
      await prisma.video.update({
        where: { id: videoId },
        data: { hlsStatus: "processing" },
      });
    } else {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { hlsStatus: "processing" },
      });
    }

    const inputPath = isLocalStorage()
      ? path.join(getUploadDir(), item.cloud_storage_path.replace(/^uploads\//, ""))
      : await getFileUrl(item.cloud_storage_path, item.isPublic);

    const outputName = `optimized_${Date.now()}_${item.id}`;
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
    }

    if (table === "video") {
      await prisma.video.update({
        where: { id: videoId },
        data: { hlsStatus: "failed" },
      });
    } else {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { hlsStatus: "failed" },
      });
    }

    return NextResponse.json(
      { error: "HLS conversion failed" },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("HLS conversion error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

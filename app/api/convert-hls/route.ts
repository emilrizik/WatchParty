import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

async function optimizeForStreaming(inputUrl: string, outputName: string): Promise<{ optimizedUrl: string } | null> {
  try {
    // Fast optimization - just move moov atom to beginning without re-encoding
    // This is MUCH faster and allows videos to start playing immediately
    const ffmpegCommand = `-i {{in_1}} -c copy -movflags +faststart -f mp4 {{out_1}}`;

    // Step 1: Create FFmpeg request
    const createResponse = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        input_files: { "in_1": inputUrl },
        output_files: { "out_1": `${outputName}.mp4` },
        ffmpeg_command: ffmpegCommand,
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('Failed to create FFmpeg request:', errText);
      return null;
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      console.error('No request_id returned');
      return null;
    }

    console.log('FFmpeg request created:', request_id);

    // Step 2: Poll for status
    const maxAttempts = 600; // 10 minutes max for longer videos
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });

      const statusResult = await statusResponse.json();
      const status = statusResult?.status || 'PENDING';
      const result = statusResult?.result || null;

      console.log(`FFmpeg status (attempt ${attempts}): ${status}`);

      if (status === 'SUCCESS' && result?.result) {
        return { optimizedUrl: result.result['out_1'] };
      } else if (status === 'FAILED') {
        console.error('FFmpeg processing failed:', result?.error || statusResult);
        return null;
      }
      attempts++;
    }

    console.error('FFmpeg processing timed out');
    return null;
  } catch (error) {
    console.error('Video optimization error:', error);
    return null;
  }
}

// Convert a video to HLS
export async function POST(req: NextRequest) {
  try {
    // Allow internal calls without session (for background processing)
    const { videoId, episodeId, internalKey } = await req.json();
    
    // Validate either session or internal key
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
    let table: 'video' | 'episode';

    if (videoId) {
      item = await prisma.video.findUnique({ where: { id: videoId } });
      table = 'video';
    } else {
      item = await prisma.episode.findUnique({ where: { id: episodeId } });
      table = 'episode';
    }

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update status to processing
    if (table === 'video') {
      await prisma.video.update({
        where: { id: videoId },
        data: { hlsStatus: 'processing' },
      });
    } else {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { hlsStatus: 'processing' },
      });
    }

    // Get video URL
    const videoUrl = await getFileUrl(item.cloud_storage_path, item.isPublic);
    const outputName = `optimized_${Date.now()}_${item.id}`;

    console.log('Starting video optimization for:', videoUrl);

    // Start optimization (this may take a while)
    const result = await optimizeForStreaming(videoUrl, outputName);

    if (result) {
      // Update with optimized path
      if (table === 'video') {
        await prisma.video.update({
          where: { id: videoId },
          data: { hlsPath: result.optimizedUrl, hlsStatus: 'completed' },
        });
      } else {
        await prisma.episode.update({
          where: { id: episodeId },
          data: { hlsPath: result.optimizedUrl, hlsStatus: 'completed' },
        });
      }

      return NextResponse.json({ success: true, hlsUrl: result.optimizedUrl });
    } else {
      // Mark as failed
      if (table === 'video') {
        await prisma.video.update({
          where: { id: videoId },
          data: { hlsStatus: 'failed' },
        });
      } else {
        await prisma.episode.update({
          where: { id: episodeId },
          data: { hlsStatus: 'failed' },
        });
      }

      return NextResponse.json({ error: "HLS conversion failed" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("HLS conversion error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAdminWriterUserId } from "@/lib/admin-write-access";
import { generateThumbnailFromVideo } from "@/lib/video-thumbnails";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { videoId, episodeId, internalKey, force } = await req.json();
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

    if (videoId) {
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      if (video.thumbnail_path && !force) {
        return NextResponse.json({ success: true, thumbnail_path: video.thumbnail_path, skipped: true });
      }

      const thumbnailPath = await generateThumbnailFromVideo({
        sourcePath: video.cloud_storage_path,
        isPublic: video.isPublic,
        duration: video.duration,
        filePrefix: `${video.id}-video-thumb`,
      });

      await prisma.video.update({
        where: { id: videoId },
        data: {
          thumbnail_path: thumbnailPath,
          thumbnailIsPublic: true,
        },
      });

      return NextResponse.json({ success: true, thumbnail_path: thumbnailPath });
    }

    const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    if (episode.thumbnail_path && !force) {
      return NextResponse.json({ success: true, thumbnail_path: episode.thumbnail_path, skipped: true });
    }

    const thumbnailPath = await generateThumbnailFromVideo({
      sourcePath: episode.cloud_storage_path,
      isPublic: episode.isPublic,
      duration: episode.duration,
      filePrefix: `${episode.id}-episode-thumb`,
    });

    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        thumbnail_path: thumbnailPath,
        thumbnailIsPublic: true,
      },
    });

    return NextResponse.json({ success: true, thumbnail_path: thumbnailPath });
  } catch (error: any) {
    console.error("Generate thumbnail error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

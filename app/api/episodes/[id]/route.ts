import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { deleteFile, getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

// GET single episode (public access)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: {
        season: {
          include: {
            series: true,
            episodes: {
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    });

    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const videoUrl = await getFileUrl(episode.cloud_storage_path, episode.isPublic);
    const thumbnailUrl = episode.thumbnail_path
      ? await getFileUrl(episode.thumbnail_path, episode.thumbnailIsPublic)
      : null;

    return NextResponse.json({ ...episode, videoUrl, thumbnailUrl });
  } catch (error: any) {
    console.error("Get episode error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE episode
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const episode = await prisma.episode.findUnique({ where: { id } });
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    await deleteFile(episode.cloud_storage_path);
    if (episode.thumbnail_path) {
      await deleteFile(episode.thumbnail_path);
    }
    if (episode.hlsPath) {
      await deleteFile(episode.hlsPath);
    }

    await prisma.episode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete episode error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

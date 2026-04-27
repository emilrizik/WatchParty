import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const room = await prisma.episodeRoom.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        participants: {
          where: { isActive: true },
          select: {
            id: true,
            guestName: true,
            joinedAt: true,
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
        episode: {
          include: {
            season: {
              include: {
                series: true,
              },
            },
          },
        },
      },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Generate episode URL
    const videoUrl = await getFileUrl(
      room.episode.cloud_storage_path,
      room.episode.isPublic
    );
    const thumbnailUrl = room.episode.thumbnail_path
      ? await getFileUrl(
          room.episode.thumbnail_path,
          room.episode.thumbnailIsPublic
        )
      : null;

    return NextResponse.json({
      ...room,
      episode: {
        ...room.episode,
        videoUrl,
        thumbnailUrl,
      },
    });
  } catch (error: any) {
    console.error("Get episode room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

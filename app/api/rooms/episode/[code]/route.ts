import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import {
  cleanupEpisodeRoomPresence,
  touchEpisodeParticipant,
} from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const participantId = req.nextUrl.searchParams.get("participantId");

    const room = await prisma.episodeRoom.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, isActive: true },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (participantId) {
      await touchEpisodeParticipant(room.id, participantId);
    }

    const activeParticipants = await cleanupEpisodeRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const hydratedRoom = await prisma.episodeRoom.findUnique({
      where: { id: room.id },
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

    if (!hydratedRoom || !hydratedRoom.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const videoUrl = await getFileUrl(
      hydratedRoom.episode.cloud_storage_path,
      hydratedRoom.episode.isPublic
    );
    const thumbnailUrl = hydratedRoom.episode.thumbnail_path
      ? await getFileUrl(
          hydratedRoom.episode.thumbnail_path,
          hydratedRoom.episode.thumbnailIsPublic
        )
      : null;

    return NextResponse.json({
      ...hydratedRoom,
      episode: {
        ...hydratedRoom.episode,
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { getRoomPresenceCutoff } from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cutoff = getRoomPresenceCutoff();

    await prisma.roomParticipant.updateMany({
      where: {
        isActive: true,
        lastSeenAt: { lt: cutoff },
      },
      data: { isActive: false },
    });

    await prisma.episodeRoomParticipant.updateMany({
      where: {
        isActive: true,
        lastSeenAt: { lt: cutoff },
      },
      data: { isActive: false },
    });

    await prisma.room.updateMany({
      where: {
        isActive: true,
        participants: { none: { isActive: true, lastSeenAt: { gte: cutoff } } },
      },
      data: { isActive: false },
    });

    await prisma.episodeRoom.updateMany({
      where: {
        isActive: true,
        participants: { none: { isActive: true, lastSeenAt: { gte: cutoff } } },
      },
      data: { isActive: false },
    });

    const videoRooms = await prisma.room.findMany({
      where: {
        isActive: true,
        participants: { some: { isActive: true, lastSeenAt: { gte: cutoff } } },
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            thumbnail_path: true,
            thumbnailIsPublic: true,
          },
        },
        participants: {
          where: { isActive: true, lastSeenAt: { gte: cutoff } },
          select: {
            id: true,
            guestName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const episodeRooms = await prisma.episodeRoom.findMany({
      where: {
        isActive: true,
        participants: { some: { isActive: true, lastSeenAt: { gte: cutoff } } },
      },
      include: {
        episode: {
          include: {
            season: {
              include: {
                series: {
                  select: {
                    id: true,
                    title: true,
                    thumbnail_path: true,
                    thumbnailIsPublic: true,
                  },
                },
              },
            },
          },
        },
        participants: {
          where: { isActive: true, lastSeenAt: { gte: cutoff } },
          select: {
            id: true,
            guestName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedVideoRooms = await Promise.all(
      videoRooms.map(async (room) => {
        const thumbnailUrl = room.video.thumbnail_path
          ? await getFileUrl(room.video.thumbnail_path, room.video.thumbnailIsPublic)
          : null;
        return {
          id: room.id,
          code: room.code,
          name: room.name,
          type: "video" as const,
          isPlaying: room.isPlaying,
          content: {
            id: room.video.id,
            title: room.video.title,
            thumbnailUrl,
          },
          participants: room.participants,
          createdAt: room.createdAt,
        };
      })
    );

    const formattedEpisodeRooms = await Promise.all(
      episodeRooms.map(async (room) => {
        const thumbnailUrl = room.episode.season.series.thumbnail_path
          ? await getFileUrl(
              room.episode.season.series.thumbnail_path,
              room.episode.season.series.thumbnailIsPublic
            )
          : null;
        return {
          id: room.id,
          code: room.code,
          name: room.name,
          type: "episode" as const,
          isPlaying: room.isPlaying,
          content: {
            id: room.episode.id,
            title: `${room.episode.season.series.title} - S${room.episode.season.number}E${room.episode.number}`,
            seriesTitle: room.episode.season.series.title,
            episodeTitle: room.episode.title,
            thumbnailUrl,
          },
          participants: room.participants,
          createdAt: room.createdAt,
        };
      })
    );

    const allRooms = [...formattedVideoRooms, ...formattedEpisodeRooms].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(allRooms);
  } catch (error: any) {
    console.error("Get active rooms error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

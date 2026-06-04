import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  cleanupEpisodeRoomPresence,
  touchEpisodeParticipant,
} from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { roomCode, isPlaying, currentTime, participantId, episodeId } = await req.json();

    if (!roomCode) {
      return NextResponse.json({ error: "Room code is required" }, { status: 400 });
    }

    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    const room = await prisma.episodeRoom.findUnique({
      where: { code: roomCode.toUpperCase() },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const participantIsActive = await touchEpisodeParticipant(room.id, participantId);
    if (!participantIsActive) {
      return NextResponse.json(
        { error: "Participant not active in room" },
        { status: 409 }
      );
    }

    const activeParticipants = await cleanupEpisodeRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const updateData: {
      lastUpdatedAt: Date;
      lastUpdatedBy: string;
      isPlaying?: boolean;
      currentTime?: number;
      episodeId?: string;
    } = {
      lastUpdatedAt: new Date(),
      lastUpdatedBy: participantId,
    };

    if (isPlaying !== undefined) updateData.isPlaying = isPlaying;
    if (currentTime !== undefined) updateData.currentTime = currentTime;

    if (episodeId && episodeId !== room.episodeId) {
      updateData.episodeId = episodeId;
      updateData.currentTime = 0;
      updateData.isPlaying = false;
    }

    const updatedRoom = await prisma.episodeRoom.update({
      where: { id: room.id },
      data: updateData,
      include: {
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

    return NextResponse.json(updatedRoom);
  } catch (error: any) {
    console.error("Sync episode room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

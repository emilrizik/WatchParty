import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  cleanupVideoRoomPresence,
  touchVideoParticipant,
} from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { roomCode, isPlaying, currentTime, participantId } = await req.json();

    if (!roomCode) {
      return NextResponse.json(
        { error: "roomCode is required" },
        { status: 400 }
      );
    }

    if (!participantId) {
      return NextResponse.json(
        { error: "participantId is required" },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const participantIsActive = await touchVideoParticipant(room.id, participantId);
    if (!participantIsActive) {
      return NextResponse.json(
        { error: "Participant not active in room" },
        { status: 409 }
      );
    }

    const activeParticipants = await cleanupVideoRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        isPlaying: isPlaying ?? room.isPlaying,
        currentTime: currentTime ?? room.currentTime,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: participantId,
      },
    });

    return NextResponse.json(updatedRoom);
  } catch (error: any) {
    console.error("Sync room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Update room sync state
    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        isPlaying: isPlaying ?? room.isPlaying,
        currentTime: currentTime ?? room.currentTime,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: participantId || null,
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

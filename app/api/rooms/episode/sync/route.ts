import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { roomCode, isPlaying, currentTime, participantId, episodeId } = await req.json();

    if (!roomCode) {
      return NextResponse.json({ error: "Room code is required" }, { status: 400 });
    }

    // Find room
    const room = await prisma.episodeRoom.findUnique({
      where: { code: roomCode.toUpperCase() },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {
      lastUpdatedAt: new Date(),
      lastUpdatedBy: participantId || null,
    };

    if (isPlaying !== undefined) updateData.isPlaying = isPlaying;
    if (currentTime !== undefined) updateData.currentTime = currentTime;
    
    // Si se cambia de episodio, actualizar y resetear tiempo
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

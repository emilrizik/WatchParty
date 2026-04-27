import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code, guestName } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Room code is required" }, { status: 400 });
    }

    // Find room
    const room = await prisma.episodeRoom.findUnique({
      where: { code: code.toUpperCase() },
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

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Create participant
    const participant = await prisma.episodeRoomParticipant.create({
      data: {
        roomId: room.id,
        guestName: guestName || "Invitado",
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      code: room.code,
      participantId: participant.id,
      episodeId: room.episodeId,
      episode: room.episode,
    });
  } catch (error: any) {
    console.error("Join episode room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

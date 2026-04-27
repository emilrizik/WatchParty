import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code, guestName } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 }
      );
    }

    const participantName = guestName?.trim() || "Invitado";

    // Find room
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        video: true,
        participants: {
          where: { isActive: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!room.isActive) {
      return NextResponse.json(
        { error: "Room is not active" },
        { status: 400 }
      );
    }

    // Add as new participant
    const participant = await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        guestName: participantName,
      },
    });

    return NextResponse.json({
      ...room,
      participantId: participant.id,
    });
  } catch (error: any) {
    console.error("Join room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

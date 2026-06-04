import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cleanupVideoRoomPresence, upsertVideoGuestParticipant } from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code, guestName, guestSessionId } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 }
      );
    }

    const participantName = guestName?.trim() || "Invitado";

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        video: true,
      },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const activeParticipants = await cleanupVideoRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const participant = await upsertVideoGuestParticipant({
      roomId: room.id,
      guestName: participantName,
      guestSessionId,
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

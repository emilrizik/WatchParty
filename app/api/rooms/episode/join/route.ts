import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cleanupEpisodeRoomPresence, upsertEpisodeGuestParticipant } from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code, guestName, guestSessionId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Room code is required" }, { status: 400 });
    }

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

    const activeParticipants = await cleanupEpisodeRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const participant = await upsertEpisodeGuestParticipant({
      roomId: room.id,
      guestName: guestName?.trim() || "Invitado",
      guestSessionId,
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

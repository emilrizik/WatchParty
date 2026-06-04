import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after");
    const participantId = searchParams.get("participantId");

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

    const messages = await prisma.episodeRoomMessage.findMany({
      where: {
        roomId: room.id,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json(messages);
  } catch (error: any) {
    console.error("Get episode messages error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { message, guestName, participantId } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const room = await prisma.episodeRoom.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, isActive: true },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (participantId) {
      const active = await touchEpisodeParticipant(room.id, participantId);
      if (!active) {
        return NextResponse.json(
          { error: "Participant not active in room" },
          { status: 409 }
        );
      }
    }

    const activeParticipants = await cleanupEpisodeRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const newMessage = await prisma.episodeRoomMessage.create({
      data: {
        roomId: room.id,
        guestName: guestName?.trim() || "Invitado",
        message: message.trim().slice(0, 500),
      },
    });

    return NextResponse.json(newMessage);
  } catch (error: any) {
    console.error("Send episode message error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

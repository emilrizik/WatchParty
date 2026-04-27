import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET messages for an episode room
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after");

    const room = await prisma.episodeRoom.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });

    if (!room) {
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

// POST send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { message, guestName } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const room = await prisma.episodeRoom.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const newMessage = await prisma.episodeRoomMessage.create({
      data: {
        roomId: room.id,
        guestName: guestName || "Invitado",
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

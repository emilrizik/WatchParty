import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customAlphabet } from "nanoid";
import { upsertVideoGuestParticipant } from "@/lib/room-presence";

export const dynamic = "force-dynamic";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = nanoid();
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }

  throw new Error("Could not generate unique room code");
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, name, guestName, guestSessionId } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    const creatorName = guestName?.trim() || "Anónimo";

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const code = await generateUniqueCode();

    const room = await prisma.room.create({
      data: {
        code,
        name: name ?? `${video.title} - Watch Party`,
        videoId,
        createdByName: creatorName,
        isActive: true,
      },
    });

    const participant = await upsertVideoGuestParticipant({
      roomId: room.id,
      guestName: creatorName,
      guestSessionId,
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const shareLink = `${baseUrl}/join/${room.code}`;

    return NextResponse.json(
      {
        ...room,
        participantId: participant.id,
        shareLink,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

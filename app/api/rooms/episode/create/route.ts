import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { episodeId, name, guestName } = await req.json();

    if (!episodeId) {
      return NextResponse.json({ error: "episodeId is required" }, { status: 400 });
    }

    const creatorName = guestName?.trim() || "Anónimo";

    // Check if episode exists
    const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    // Generate unique room code
    let code = nanoid();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.episodeRoom.findUnique({ where: { code } });
      if (!existing) break;
      code = nanoid();
      attempts++;
    }

    // Create room
    const room = await prisma.episodeRoom.create({
      data: {
        code,
        name: name || `Watch Party`,
        episodeId,
        createdByName: creatorName,
      },
      include: {
        episode: true,
        participants: true,
      },
    });

    // Add creator as participant
    const participant = await prisma.episodeRoomParticipant.create({
      data: {
        roomId: room.id,
        guestName: creatorName,
      },
    });

    // Generate shareable link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const shareLink = `${baseUrl}/join/${room.code}`;

    return NextResponse.json({
      ...room,
      participantId: participant.id,
      shareLink,
    });
  } catch (error: any) {
    console.error("Create episode room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

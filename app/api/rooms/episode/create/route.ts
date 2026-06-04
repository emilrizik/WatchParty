import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customAlphabet } from "nanoid";
import { upsertEpisodeGuestParticipant } from "@/lib/room-presence";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export const dynamic = "force-dynamic";

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = nanoid();
    const existing = await prisma.episodeRoom.findUnique({ where: { code } });
    if (!existing) return code;
  }

  throw new Error("Could not generate unique room code");
}

export async function POST(req: NextRequest) {
  try {
    const { episodeId, name, guestName, guestSessionId } = await req.json();

    if (!episodeId) {
      return NextResponse.json({ error: "episodeId is required" }, { status: 400 });
    }

    const creatorName = guestName?.trim() || "Anónimo";

    const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const code = await generateUniqueCode();

    const room = await prisma.episodeRoom.create({
      data: {
        code,
        name: name || `Watch Party`,
        episodeId,
        createdByName: creatorName,
        isActive: true,
      },
    });

    const participant = await upsertEpisodeGuestParticipant({
      roomId: room.id,
      guestName: creatorName,
      guestSessionId,
    });

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customAlphabet } from "nanoid";

export const dynamic = "force-dynamic";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

export async function POST(req: NextRequest) {
  try {
    const { videoId, name, guestName } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    const creatorName = guestName?.trim() || "Anónimo";

    // Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Generate unique code
    const code = nanoid();

    // Create room
    const room = await prisma.room.create({
      data: {
        code,
        name: name ?? `${video.title} - Watch Party`,
        videoId,
        createdByName: creatorName,
      },
      include: {
        video: true,
        participants: true,
      },
    });

    // Automatically add creator as participant
    const participant = await prisma.roomParticipant.create({
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
    }, { status: 201 });
  } catch (error: any) {
    console.error("Create room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

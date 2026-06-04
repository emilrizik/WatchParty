import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import {
  cleanupVideoRoomPresence,
  touchVideoParticipant,
} from "@/lib/room-presence";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const participantId = req.nextUrl.searchParams.get("participantId");

    const room = await prisma.room.findUnique({
      where: { code: code?.toUpperCase() },
      select: { id: true, isActive: true },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (participantId) {
      await touchVideoParticipant(room.id, participantId);
    }

    const activeParticipants = await cleanupVideoRoomPresence(room.id);
    if (activeParticipants === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const hydratedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        video: {
          include: {
            category: true,
          },
        },
        participants: {
          where: { isActive: true },
          select: {
            id: true,
            guestName: true,
            joinedAt: true,
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
      },
    });

    if (!hydratedRoom || !hydratedRoom.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const videoUrl = await getFileUrl(
      hydratedRoom.video.cloud_storage_path,
      hydratedRoom.video.isPublic
    );
    const thumbnailUrl = hydratedRoom.video.thumbnail_path
      ? await getFileUrl(
          hydratedRoom.video.thumbnail_path,
          hydratedRoom.video.thumbnailIsPublic
        )
      : null;

    return NextResponse.json({
      ...hydratedRoom,
      video: {
        ...hydratedRoom.video,
        videoUrl,
        thumbnailUrl,
      },
    });
  } catch (error: any) {
    console.error("Get room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

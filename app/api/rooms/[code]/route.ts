import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const room = await prisma.room.findUnique({
      where: { code: code?.toUpperCase() },
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

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Generate video URL
    const videoUrl = await getFileUrl(
      room.video.cloud_storage_path,
      room.video.isPublic
    );
    const thumbnailUrl = room.video.thumbnail_path
      ? await getFileUrl(
          room.video.thumbnail_path,
          room.video.thumbnailIsPublic
        )
      : null;

    return NextResponse.json({
      ...room,
      video: {
        ...room.video,
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

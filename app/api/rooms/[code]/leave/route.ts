import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { participantId } = await req.json();

    if (!participantId) {
      return NextResponse.json({ error: "Participant ID required" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Mark participant as inactive
    await prisma.roomParticipant.updateMany({
      where: {
        id: participantId,
        roomId: room.id,
      },
      data: {
        isActive: false,
      },
    });

    // Check if any active participants remain
    const activeParticipants = await prisma.roomParticipant.count({
      where: {
        roomId: room.id,
        isActive: true,
      },
    });

    // If no active participants, mark room as inactive
    if (activeParticipants === 0) {
      await prisma.room.update({
        where: { id: room.id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ message: "Left room successfully" });
  } catch (error: any) {
    console.error("Leave room error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

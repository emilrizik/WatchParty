import { prisma } from "@/lib/db";

const ROOM_PRESENCE_TIMEOUT_MS = Number(
  process.env.ROOM_PRESENCE_TIMEOUT_MS ?? 45_000
);

export function getRoomPresenceCutoff() {
  return new Date(Date.now() - ROOM_PRESENCE_TIMEOUT_MS);
}

async function finalizeVideoRoomState(roomId: string) {
  const activeCount = await prisma.roomParticipant.count({
    where: {
      roomId,
      isActive: true,
      lastSeenAt: { gte: getRoomPresenceCutoff() },
    },
  });

  await prisma.room.update({
    where: { id: roomId },
    data: { isActive: activeCount > 0 },
  });

  return activeCount;
}

async function finalizeEpisodeRoomState(roomId: string) {
  const activeCount = await prisma.episodeRoomParticipant.count({
    where: {
      roomId,
      isActive: true,
      lastSeenAt: { gte: getRoomPresenceCutoff() },
    },
  });

  await prisma.episodeRoom.update({
    where: { id: roomId },
    data: { isActive: activeCount > 0 },
  });

  return activeCount;
}

export async function cleanupVideoRoomPresence(roomId: string) {
  await prisma.roomParticipant.updateMany({
    where: {
      roomId,
      isActive: true,
      lastSeenAt: { lt: getRoomPresenceCutoff() },
    },
    data: { isActive: false },
  });

  return finalizeVideoRoomState(roomId);
}

export async function cleanupEpisodeRoomPresence(roomId: string) {
  await prisma.episodeRoomParticipant.updateMany({
    where: {
      roomId,
      isActive: true,
      lastSeenAt: { lt: getRoomPresenceCutoff() },
    },
    data: { isActive: false },
  });

  return finalizeEpisodeRoomState(roomId);
}

export async function touchVideoParticipant(roomId: string, participantId?: string | null) {
  if (!participantId) return false;

  const result = await prisma.roomParticipant.updateMany({
    where: {
      id: participantId,
      roomId,
      isActive: true,
    },
    data: { lastSeenAt: new Date() },
  });

  return result.count > 0;
}

export async function touchEpisodeParticipant(roomId: string, participantId?: string | null) {
  if (!participantId) return false;

  const result = await prisma.episodeRoomParticipant.updateMany({
    where: {
      id: participantId,
      roomId,
      isActive: true,
    },
    data: { lastSeenAt: new Date() },
  });

  return result.count > 0;
}


type UpsertGuestParticipantArgs = {
  roomId: string;
  guestName?: string | null;
  guestSessionId?: string | null;
};

export async function upsertVideoGuestParticipant({ roomId, guestName, guestSessionId }: UpsertGuestParticipantArgs) {
  const normalizedName = guestName?.trim() || "Invitado";

  if (!guestSessionId) {
    return prisma.roomParticipant.create({
      data: {
        roomId,
        guestName: normalizedName,
        lastSeenAt: new Date(),
      },
    });
  }

  const existing = await prisma.roomParticipant.findFirst({
    where: { roomId, guestSessionId },
    orderBy: { joinedAt: "desc" },
  });

  if (existing) {
    return prisma.roomParticipant.update({
      where: { id: existing.id },
      data: {
        guestName: normalizedName,
        guestSessionId,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  return prisma.roomParticipant.create({
    data: {
      roomId,
      guestName: normalizedName,
      guestSessionId,
      lastSeenAt: new Date(),
    },
  });
}

export async function upsertEpisodeGuestParticipant({ roomId, guestName, guestSessionId }: UpsertGuestParticipantArgs) {
  const normalizedName = guestName?.trim() || "Invitado";

  if (!guestSessionId) {
    return prisma.episodeRoomParticipant.create({
      data: {
        roomId,
        guestName: normalizedName,
        lastSeenAt: new Date(),
      },
    });
  }

  const existing = await prisma.episodeRoomParticipant.findFirst({
    where: { roomId, guestSessionId },
    orderBy: { joinedAt: "desc" },
  });

  if (existing) {
    return prisma.episodeRoomParticipant.update({
      where: { id: existing.id },
      data: {
        guestName: normalizedName,
        guestSessionId,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  return prisma.episodeRoomParticipant.create({
    data: {
      roomId,
      guestName: normalizedName,
      guestSessionId,
      lastSeenAt: new Date(),
    },
  });
}

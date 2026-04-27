export interface StoredParticipant {
  id: string;
  name: string;
}

const getRoomStorageKey = (roomCode: string) => `room_${roomCode.toUpperCase()}_participant`;

export function readStoredParticipant(roomCode: string): StoredParticipant | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(getRoomStorageKey(roomCode));
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<StoredParticipant>;
    if (typeof parsed?.id !== "string" || typeof parsed?.name !== "string") {
      window.localStorage.removeItem(getRoomStorageKey(roomCode));
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
    };
  } catch (error) {
    console.error("Error reading room participant from localStorage:", error);
    window.localStorage.removeItem(getRoomStorageKey(roomCode));
    return null;
  }
}

export function writeStoredParticipant(roomCode: string, participant: StoredParticipant) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getRoomStorageKey(roomCode),
      JSON.stringify(participant)
    );
  } catch (error) {
    console.error("Error writing room participant to localStorage:", error);
  }
}

export function removeStoredParticipant(roomCode: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getRoomStorageKey(roomCode));
  } catch (error) {
    console.error("Error removing room participant from localStorage:", error);
  }
}

export type StoredRoomParticipant = {
  id: string;
  name: string;
};

export function getStoredRoomParticipant(code: string): StoredRoomParticipant | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`room_${code.toUpperCase()}_participant`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string") {
      window.localStorage.removeItem(`room_${code.toUpperCase()}_participant`);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(`room_${code.toUpperCase()}_participant`);
    return null;
  }
}

export function setStoredRoomParticipant(code: string, participant: StoredRoomParticipant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `room_${code.toUpperCase()}_participant`,
    JSON.stringify(participant)
  );
}

export function clearStoredRoomParticipant(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`room_${code.toUpperCase()}_participant`);
}

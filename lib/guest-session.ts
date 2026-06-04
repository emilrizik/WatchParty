const GUEST_SESSION_KEY = "watchparty_guest_session_id";
const GUEST_NAME_KEY = "watchparty_guest_name";

function createGuestSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateGuestSessionId() {
  if (typeof window === "undefined") return null;

  let sessionId = window.localStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = createGuestSessionId();
    window.localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function getStoredGuestName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(GUEST_NAME_KEY) ?? "";
}

export function setStoredGuestName(name: string) {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed) return;
  window.localStorage.setItem(GUEST_NAME_KEY, trimmed);
}

import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const ADMIN_COOKIE = "watchparty_admin";

export function getAdminCode() {
  return process.env.ADMIN_CODE || "rizik";
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "1";
}

export function isAdminRequest(req: NextRequest) {
  return req.cookies.get(ADMIN_COOKIE)?.value === "1";
}

export function getAdminCookieName() {
  return ADMIN_COOKIE;
}

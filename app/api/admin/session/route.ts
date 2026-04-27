import { NextRequest, NextResponse } from "next/server";
import { getAdminCode, getAdminCookieName, isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function shouldUseSecureCookie(req: NextRequest) {
  const protocol = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const hostname = req.nextUrl.hostname;
  return protocol === "https" && hostname !== "localhost" && hostname !== "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || code !== getAdminCode()) {
      return NextResponse.json({ error: "Codigo invalido" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(getAdminCookieName(), "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(req),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ success: true });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(getAdminCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: 0,
  });
  return res;
}

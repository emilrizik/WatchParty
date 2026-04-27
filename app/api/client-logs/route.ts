import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    console.error("[client-log]", {
      at: new Date().toISOString(),
      ...payload,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[client-log-error]", error);
    return NextResponse.json(
      { error: error?.message ?? "Invalid log payload" },
      { status: 400 }
    );
  }
}

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function resolveUploadPath(rawPath: string) {
  const normalized = rawPath.replace(/^\/+/, "").replace(/^uploads\//, "");
  return path.join(getUploadDir(), normalized);
}

export async function PUT(req: NextRequest) {
  try {
    const targetPath = req.nextUrl.searchParams.get("path");
    if (!targetPath) {
      return NextResponse.json({ error: "path query param is required" }, { status: 400 });
    }

    const fullPath = resolveUploadPath(targetPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(await req.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    return NextResponse.json({ success: true, path: targetPath });
  } catch (error: any) {
    console.error("Local upload error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

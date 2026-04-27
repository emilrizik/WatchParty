import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export async function PUT(req: NextRequest) {
  try {
    const filePath = req.nextUrl.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    const sanitized = filePath.replace(/\.\./g, "").replace(/^uploads\//, "");
    const fullPath = path.join(getUploadDir(), sanitized);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    return NextResponse.json({ success: true, path: filePath });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}

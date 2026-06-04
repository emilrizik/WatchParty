import { NextRequest, NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/s3";
import { resolveAdminWriterUserId } from "@/lib/admin-write-access";

export async function POST(req: NextRequest) {
  try {
    const writerUserId = await resolveAdminWriterUserId();
    if (!writerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, contentType, isPublic } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    const result = await generatePresignedUploadUrl(
      fileName,
      contentType,
      isPublic ?? true
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Upload presigned URL error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

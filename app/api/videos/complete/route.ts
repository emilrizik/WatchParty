import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAdminWriterUserId } from "@/lib/admin-write-access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const writerUserId = await resolveAdminWriterUserId();
    if (!writerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      title,
      description,
      cloud_storage_path,
      isPublic,
      thumbnail_path,
      thumbnailIsPublic,
      duration,
      categoryId,
    } = await req.json();

    if (!title || !cloud_storage_path) {
      return NextResponse.json(
        { error: "title and cloud_storage_path are required" },
        { status: 400 }
      );
    }

    const video = await prisma.video.create({
      data: {
        title,
        description: description ?? null,
        cloud_storage_path,
        isPublic: isPublic ?? true,
        thumbnail_path: thumbnail_path ?? null,
        thumbnailIsPublic: thumbnailIsPublic ?? true,
        duration: duration ?? null,
        categoryId: categoryId ?? null,
        uploadedById: writerUserId,
        hlsStatus: "pending",
      },
      include: {
        category: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const baseUrl = process.env.INTERNAL_APP_URL || process.env.NEXTAUTH_URL || "http://127.0.0.1:3001";

    fetch(`${baseUrl}/api/convert-hls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id, internalKey: process.env.NEXTAUTH_SECRET }),
    }).catch(console.error);

    if (!thumbnail_path) {
      fetch(`${baseUrl}/api/generate-thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, internalKey: process.env.NEXTAUTH_SECRET }),
      }).catch(console.error);
    }

    return NextResponse.json(video, { status: 201 });
  } catch (error: any) {
    console.error("Complete video upload error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { deleteFile, getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

// GET single video (public access)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({
      where: { id },
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

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const videoUrl = await getFileUrl(
      video.cloud_storage_path,
      video.isPublic
    );
    const thumbnailUrl = video.thumbnail_path
      ? await getFileUrl(video.thumbnail_path, video.thumbnailIsPublic)
      : null;

    return NextResponse.json({
      ...video,
      videoUrl,
      thumbnailUrl,
    });
  } catch (error: any) {
    console.error("Get video error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await deleteFile(video.cloud_storage_path);
    if (video.thumbnail_path) {
      await deleteFile(video.thumbnail_path);
    }
    if (video.hlsPath) {
      await deleteFile(video.hlsPath);
    }

    await prisma.video.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete video error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

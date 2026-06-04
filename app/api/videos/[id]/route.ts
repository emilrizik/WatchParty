import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFile, getFileUrl } from "@/lib/s3";
import { resolveAdminWriterUserId } from "@/lib/admin-write-access";

export const dynamic = "force-dynamic";

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

    const videoUrl = await getFileUrl(video.cloud_storage_path, video.isPublic);
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const writerUserId = await resolveAdminWriterUserId();
    if (!writerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
    if (body.thumbnail_path !== undefined) data.thumbnail_path = body.thumbnail_path || null;
    if (body.thumbnailIsPublic !== undefined) data.thumbnailIsPublic = Boolean(body.thumbnailIsPublic);

    const updated = await prisma.video.update({
      where: { id },
      data,
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

    const videoUrl = await getFileUrl(updated.cloud_storage_path, updated.isPublic);
    const thumbnailUrl = updated.thumbnail_path
      ? await getFileUrl(updated.thumbnail_path, updated.thumbnailIsPublic)
      : null;

    return NextResponse.json({ ...updated, videoUrl, thumbnailUrl });
  } catch (error: any) {
    console.error("Update video error:", error);
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
    const writerUserId = await resolveAdminWriterUserId();
    if (!writerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const video = await prisma.video.findUnique({ where: { id } });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const mediaPaths = [video.cloud_storage_path, video.thumbnail_path, video.hlsPath].filter(Boolean) as string[];

    await prisma.video.delete({ where: { id } });
    await Promise.allSettled(mediaPaths.map((mediaPath) => deleteFile(mediaPath)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete video error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: {
        season: {
          include: {
            series: true,
            episodes: {
              orderBy: { number: "asc" },
            },
          },
        },
      },
    });

    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const videoUrl = await getFileUrl(episode.cloud_storage_path, episode.isPublic);
    const thumbnailUrl = episode.thumbnail_path
      ? await getFileUrl(episode.thumbnail_path, episode.thumbnailIsPublic)
      : null;

    return NextResponse.json({ ...episode, videoUrl, thumbnailUrl });
  } catch (error: any) {
    console.error("Get episode error:", error);
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
    if (body.thumbnail_path !== undefined) data.thumbnail_path = body.thumbnail_path || null;
    if (body.thumbnailIsPublic !== undefined) data.thumbnailIsPublic = Boolean(body.thumbnailIsPublic);

    const updated = await prisma.episode.update({
      where: { id },
      data,
      include: {
        season: {
          include: {
            series: true,
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
    console.error("Update episode error:", error);
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
    const episode = await prisma.episode.findUnique({ where: { id } });

    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const mediaPaths = [episode.cloud_storage_path, episode.thumbnail_path, episode.hlsPath].filter(Boolean) as string[];

    await prisma.episode.delete({ where: { id } });
    await Promise.allSettled(mediaPaths.map((mediaPath) => deleteFile(mediaPath)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete episode error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

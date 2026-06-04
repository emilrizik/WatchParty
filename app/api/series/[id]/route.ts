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
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        category: true,
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        seasons: {
          include: {
            episodes: {
              orderBy: { number: "asc" },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });

    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const thumbnailUrl = series.thumbnail_path
      ? await getFileUrl(series.thumbnail_path, series.thumbnailIsPublic)
      : null;

    const seasonsWithUrls = await Promise.all(
      series.seasons.map(async (season) => {
        const episodesWithUrls = await Promise.all(
          season.episodes.map(async (ep) => {
            const videoUrl = await getFileUrl(ep.cloud_storage_path, ep.isPublic);
            const epThumbnailUrl = ep.thumbnail_path
              ? await getFileUrl(ep.thumbnail_path, ep.thumbnailIsPublic)
              : null;
            return { ...ep, videoUrl, thumbnailUrl: epThumbnailUrl };
          })
        );
        return { ...season, episodes: episodesWithUrls };
      })
    );

    return NextResponse.json({ ...series, thumbnailUrl, seasons: seasonsWithUrls });
  } catch (error: any) {
    console.error("Get series error:", error);
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

    const updated = await prisma.series.update({
      where: { id },
      data,
      include: {
        category: true,
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        seasons: {
          include: {
            episodes: {
              orderBy: { number: "asc" },
            },
          },
          orderBy: { number: "asc" },
        },
      },
    });

    const thumbnailUrl = updated.thumbnail_path
      ? await getFileUrl(updated.thumbnail_path, updated.thumbnailIsPublic)
      : null;

    return NextResponse.json({ ...updated, thumbnailUrl });
  } catch (error: any) {
    console.error("Update series error:", error);
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
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            episodes: true,
          },
        },
      },
    });

    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const mediaPaths = [
      series.thumbnail_path,
      ...series.seasons.flatMap((season) =>
        season.episodes.flatMap((episode) => [episode.cloud_storage_path, episode.thumbnail_path, episode.hlsPath])
      ),
    ].filter(Boolean) as string[];

    await prisma.series.delete({ where: { id } });
    await Promise.allSettled(mediaPaths.map((mediaPath) => deleteFile(mediaPath)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete series error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

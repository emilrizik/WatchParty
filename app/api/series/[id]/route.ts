import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { deleteFile, getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

// GET single series with all seasons and episodes
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
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { number: 'asc' },
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

// DELETE series
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminRequest(req)) {
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

    if (series.thumbnail_path) {
      await deleteFile(series.thumbnail_path);
    }

    for (const season of series.seasons) {
      for (const episode of season.episodes) {
        await deleteFile(episode.cloud_storage_path);
        if (episode.thumbnail_path) {
          await deleteFile(episode.thumbnail_path);
        }
        if (episode.hlsPath) {
          await deleteFile(episode.hlsPath);
        }
      }
    }

    await prisma.series.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete series error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

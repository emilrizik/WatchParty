import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

// GET single series with all seasons and episodes
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

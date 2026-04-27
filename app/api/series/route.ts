import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

// GET all series - Public endpoint
export async function GET(req: NextRequest) {
  try {
    // Public endpoint - no auth required
    const series = await prisma.series.findMany({
      include: {
        category: true,
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        seasons: {
          include: {
            episodes: true,
          },
          orderBy: { number: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const seriesWithUrls = await Promise.all(
      series.map(async (s) => {
        const thumbnailUrl = s.thumbnail_path
          ? await getFileUrl(s.thumbnail_path, s.thumbnailIsPublic)
          : null;

        const seasonsWithUrls = await Promise.all(
          s.seasons.map(async (season) => {
            const episodesWithUrls = await Promise.all(
              season.episodes.map(async (ep) => {
                const videoUrl = await getFileUrl(ep.cloud_storage_path, ep.isPublic);
                const epThumbnailUrl = ep.thumbnail_path
                  ? await getFileUrl(ep.thumbnail_path, ep.thumbnailIsPublic)
                  : null;
                return { 
                  ...ep, 
                  videoUrl, 
                  thumbnailUrl: epThumbnailUrl,
                  episodeNumber: ep.number  // Map number to episodeNumber
                };
              })
            );
            return { 
              ...season, 
              seasonNumber: season.number,  // Map number to seasonNumber
              episodes: episodesWithUrls 
            };
          })
        );

        return { ...s, thumbnailUrl, seasons: seasonsWithUrls };
      })
    );

    return NextResponse.json(seriesWithUrls);
  } catch (error: any) {
    console.error("Get series error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

// POST create new series
export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, categoryId, thumbnail_path, thumbnailIsPublic } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const adminUser = await prisma.user.findFirst({
      where: { isAdmin: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "No admin user configured" },
        { status: 500 }
      );
    }

    const series = await prisma.series.create({
      data: {
        title,
        description,
        categoryId: categoryId || null,
        thumbnail_path,
        thumbnailIsPublic: thumbnailIsPublic ?? true,
        uploadedById: adminUser.id,
      },
    });

    return NextResponse.json(series);
  } catch (error: any) {
    console.error("Create series error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

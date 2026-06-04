import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySlug = searchParams.get("slug");

    if (!categorySlug) {
      return NextResponse.json(
        { error: "Category slug is required" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const videos = await prisma.video.findMany({
      where: {
        categoryId: category.id,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    const videosWithUrls = await Promise.all(
      videos.map(async (video) => {
        const videoUrl = await getFileUrl(
          video.cloud_storage_path,
          video.isPublic
        );
        const thumbnailUrl = video.thumbnail_path
          ? await getFileUrl(video.thumbnail_path, video.thumbnailIsPublic)
          : null;

        return {
          ...video,
          videoUrl,
          thumbnailUrl,
        };
      })
    );

    return NextResponse.json({
      category,
      videos: videosWithUrls,
    });
  } catch (error: any) {
    console.error("Get videos by category error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

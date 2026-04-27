import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Public endpoint - no auth required
    const videos = await prisma.video.findMany({
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

    // Generate URLs for videos and thumbnails
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

    return NextResponse.json(videosWithUrls);
  } catch (error: any) {
    console.error("Get videos error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

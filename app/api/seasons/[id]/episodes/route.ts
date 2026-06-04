import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { resolveAdminWriterUserId } from "@/lib/admin-write-access";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const writerUserId = await resolveAdminWriterUserId();
    if (!writerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: seasonId } = await params;
    const {
      number,
      title,
      description,
      cloud_storage_path,
      isPublic,
      thumbnail_path,
      thumbnailIsPublic,
      duration,
    } = await req.json();

    if (!number || !title || !cloud_storage_path) {
      return NextResponse.json(
        { error: "Number, title, and video file are required" },
        { status: 400 }
      );
    }

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    const episode = await prisma.episode.create({
      data: {
        seasonId,
        number: parseInt(number),
        title,
        description,
        cloud_storage_path,
        isPublic: isPublic ?? true,
        thumbnail_path: thumbnail_path ?? null,
        thumbnailIsPublic: thumbnailIsPublic ?? true,
        duration,
        hlsStatus: "pending",
      },
    });

    const baseUrl = process.env.INTERNAL_APP_URL || process.env.NEXTAUTH_URL || "http://127.0.0.1:3001";

    fetch(`${baseUrl}/api/convert-hls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: episode.id, internalKey: process.env.NEXTAUTH_SECRET }),
    }).catch(console.error);

    if (!thumbnail_path) {
      fetch(`${baseUrl}/api/generate-thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, internalKey: process.env.NEXTAUTH_SECRET }),
      }).catch(console.error);
    }

    return NextResponse.json(episode);
  } catch (error: any) {
    console.error("Create episode error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;
    const episodes = await prisma.episode.findMany({
      where: { seasonId },
      orderBy: { number: "asc" },
    });

    const episodesWithUrls = await Promise.all(
      episodes.map(async (ep) => {
        const videoUrl = await getFileUrl(ep.cloud_storage_path, ep.isPublic);
        const thumbnailUrl = ep.thumbnail_path
          ? await getFileUrl(ep.thumbnail_path, ep.thumbnailIsPublic)
          : null;
        return { ...ep, videoUrl, thumbnailUrl };
      })
    );

    return NextResponse.json(episodesWithUrls);
  } catch (error: any) {
    console.error("Get episodes error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

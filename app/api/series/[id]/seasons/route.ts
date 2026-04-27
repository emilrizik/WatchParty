import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const seasons = await prisma.season.findMany({
      where: { seriesId: id },
      include: {
        episodes: {
          orderBy: { number: "asc" },
        },
      },
      orderBy: { number: "asc" },
    });

    return NextResponse.json(seasons);
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json(
      { error: "Error al obtener temporadas" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { number } = body;

    // Verify series exists
    const series = await prisma.series.findUnique({
      where: { id },
    });

    if (!series) {
      return NextResponse.json(
        { error: "Serie no encontrada" },
        { status: 404 }
      );
    }

    // If no number provided, get the next available number
    let seasonNumber = number;
    if (!seasonNumber) {
      const lastSeason = await prisma.season.findFirst({
        where: { seriesId: id },
        orderBy: { number: "desc" },
      });
      seasonNumber = (lastSeason?.number || 0) + 1;
    }

    // Check if season number already exists
    const existingSeason = await prisma.season.findFirst({
      where: {
        seriesId: id,
        number: seasonNumber,
      },
    });

    if (existingSeason) {
      return NextResponse.json(
        { error: `La temporada ${seasonNumber} ya existe` },
        { status: 400 }
      );
    }

    const season = await prisma.season.create({
      data: {
        number: seasonNumber,
        seriesId: id,
      },
      include: {
        episodes: true,
      },
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    console.error("Error creating season:", error);
    return NextResponse.json(
      { error: "Error al crear temporada" },
      { status: 500 }
    );
  }
}

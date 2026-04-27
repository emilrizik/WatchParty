import { NextRequest, NextResponse } from "next/server";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

// Endpoint proxy para que el VPS pueda obtener URLs de multimedia
// El VPS llama a este endpoint con el cloud_storage_path y recibe la URL firmada
export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get("path");
    const isPublic = req.nextUrl.searchParams.get("public") === "true";
    
    // Validar API key simple para seguridad
    const apiKey = req.headers.get("x-media-key");
    const expectedKey = process.env.MEDIA_PROXY_KEY || process.env.NEXTAUTH_SECRET;
    
    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (!path) {
      return NextResponse.json({ error: "path parameter required" }, { status: 400 });
    }
    
    const url = await getFileUrl(path, isPublic);
    
    return NextResponse.json({ url }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'x-media-key, Content-Type',
      }
    });
  } catch (error: any) {
    console.error("Media URL proxy error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'x-media-key, Content-Type',
    },
  });
}

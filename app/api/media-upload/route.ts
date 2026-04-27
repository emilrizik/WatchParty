import { NextRequest, NextResponse } from "next/server";
import { generatePresignedUploadUrl, initiateMultipartUpload, getPresignedUrlForPart, completeMultipartUpload } from "@/lib/s3";

export const dynamic = "force-dynamic";

// Endpoint proxy para que el VPS pueda subir archivos al mismo S3
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-media-key");
    const expectedKey = process.env.MEDIA_PROXY_KEY || process.env.NEXTAUTH_SECRET;
    
    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const { action } = body;
    
    if (action === "presign-upload") {
      const { fileName, contentType, isPublic } = body;
      const result = await generatePresignedUploadUrl(fileName, contentType, isPublic);
      return NextResponse.json(result, { headers: corsHeaders });
    }
    
    if (action === "initiate-multipart") {
      const { fileName, isPublic } = body;
      const result = await initiateMultipartUpload(fileName, isPublic);
      return NextResponse.json(result, { headers: corsHeaders });
    }
    
    if (action === "presign-part") {
      const { cloud_storage_path, uploadId, partNumber } = body;
      const url = await getPresignedUrlForPart(cloud_storage_path, uploadId, partNumber);
      return NextResponse.json({ url }, { headers: corsHeaders });
    }
    
    if (action === "complete-multipart") {
      const { cloud_storage_path, uploadId, parts } = body;
      await completeMultipartUpload(cloud_storage_path, uploadId, parts);
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Media upload proxy error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'x-media-key, Content-Type',
};

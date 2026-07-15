import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const creatorName = formData.get("creatorName") as string || "unnamed";
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check if file is a PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size should be less than 10MB" }, { status: 400 });
    }

    const r2 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const sanitizedCreatorName = (creatorName || "unnamed")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 64) || "unnamed";

    const key = `talent-contracts/${sanitizedCreatorName}/${uuidv4()}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      })
    );

    const downloadUrl = `${process.env.R2_PUBLIC_BASE}/${key}`;

    return NextResponse.json({
      message: "Contract uploaded successfully",
      downloadUrl,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Error uploading contract:", error);
    return NextResponse.json(
      { error: "Failed to upload contract" },
      { status: 500 },
    );
  }
}

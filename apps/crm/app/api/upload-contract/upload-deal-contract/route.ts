import { getTokens } from "next-firebase-auth-edge";
import { authConfig } from "@/config/server-config";
import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminApp } from "@/app/firebase";
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const tokens = await getTokens(cookies(), authConfig);
  const db = getFirestore(getFirebaseAdminApp());

  if (!tokens) {
    return NextResponse.json(
      { error: "Unauthenticated user" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const dealId = formData.get("dealId") as string || "unnamed";
    
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

    const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_STORAGE_BUCKET!);
    const timestamp = Date.now();
    const fileName = file.name;
    const filePath = `deals/${dealId}/contracts/${fileName}`;
    const firebaseFile = bucket.file(filePath);
    const downloadToken = uuidv4();

    const buffer = await file.arrayBuffer();
    await firebaseFile.save(Buffer.from(buffer), {
      metadata: {
        contentType: "application/pdf",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const bucketName = process.env.NEXT_PUBLIC_STORAGE_BUCKET!;
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      filePath,
    )}?alt=media&token=${downloadToken}`;

    return NextResponse.json({
      message: "Deal contract uploaded successfully",
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

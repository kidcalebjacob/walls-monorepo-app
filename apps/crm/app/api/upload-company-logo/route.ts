import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadCompanyLogoToR2 } from "@/lib/upload-company-logo-r2";

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
    const image = formData.get("file") as File;
    const companyIdRaw = formData.get("companyId");
    const companyId =
      typeof companyIdRaw === "string" && companyIdRaw.trim() !== ""
        ? companyIdRaw.trim()
        : null;

    if (!image) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json({ error: "No companyId provided" }, { status: 400 });
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      console.error("Company lookup error:", companyError);
      return NextResponse.json({ error: "Failed to load company" }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { downloadUrl, message } = await uploadCompanyLogoToR2(image, companyId);

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        logo_url: downloadUrl,
        fallback_logo_url: downloadUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    if (updateError) {
      console.error("Company logo URL update error:", updateError);
      return NextResponse.json({ error: "Failed to save company logo URL" }, { status: 500 });
    }

    return NextResponse.json({ message, downloadUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg === "Unauthenticated"
        ? 401
        : msg.includes("File must") || msg.includes("File size") || msg.includes("Missing company id")
          ? 400
          : 500;

    console.error("Company logo upload error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}

import { createAdminClient as createClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    // Fetch business with onboarding progress summary
    const { data: business, error: businessError } = await supabase
      .from("company")
      .select(`
        *,
        onboarding:onboarding_progress(*)
      `)
      .eq("id", id)
      .single();

    if (businessError) {
      return NextResponse.json({ error: businessError.message }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error: any) {
    console.error(`Error fetching business ${id}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: settings, error } = await supabase
      .from("integration_settings")
      .select("*")
      .ilike("key", "google_%");

    if (error) throw error;
    
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || !key.startsWith("google_")) {
      return NextResponse.json({ error: "Invalid key. Must start with google_" }, { status: 400 });
    }

    const { error } = await supabase
      .from("integration_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

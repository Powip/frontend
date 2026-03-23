import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = await createClient();

  try {
    // 1. Ejecutar auto-detección antes de devolver resultados
    await supabase.rpc("update_onboarding_progress", { p_business_id: id });

    // 2. Obtener progreso
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error fetching onboarding progress:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

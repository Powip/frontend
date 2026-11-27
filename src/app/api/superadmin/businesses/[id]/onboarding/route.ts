import { createAdminClient as createClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import { INITIAL_ONBOARDING_STEPS } from "@/lib/superadminOnboardingSteps";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/superadmin/businesses/:id/onboarding
 * Crea los pasos iniciales de onboarding que falten para la empresa (no duplica).
 * FEAT-23 T16: reemplaza el insert directo con la anon key desde LeadActivationFlow.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "business_id inválido" }, { status: 400 });
  }

  try {
    const supabase = createClient();

    const { data: existing, error: readError } = await supabase
      .from("onboarding_progress")
      .select("step_code")
      .eq("business_id", id);
    if (readError) throw readError;

    const have = new Set((existing ?? []).map((r: { step_code: string }) => r.step_code));
    const rows = INITIAL_ONBOARDING_STEPS.filter((step) => !have.has(step)).map((step) => ({
      business_id: id,
      step_code: step,
      completed: false,
      completion_pct: 0,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("onboarding_progress").insert(rows);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ created: rows.length });
  } catch (err: any) {
    console.error("Error creating onboarding steps:", err);
    return NextResponse.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

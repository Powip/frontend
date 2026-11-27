import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

/**
 * GET /api/superadmin/onboarding?business_ids=a,b,c
 * Progreso de onboarding de varias empresas a la vez (tabla de Postventa).
 * FEAT-23 T16: reemplaza la lectura directa con la anon key desde el navegador.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("business_ids") ?? "";
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)))].slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select("*")
      .in("business_id", ids);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error("Error fetching onboarding progress (batch):", err);
    return NextResponse.json({ error: err?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

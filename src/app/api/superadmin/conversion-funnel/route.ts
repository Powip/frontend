import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Leads del mes
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth);

    // 2. Prospectos (Contactados o más allá)
    const { count: prospects } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth)
      .neq("pipeline_stage", "nuevo");

    // 3. Cerrados (Activados como negocio)
    const { count: closed } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth)
      .eq("pipeline_stage", "cerrado");

    // 4. Clientes Activos (Al menos 1 pedido en el mes)
    const { data: activeOrderBusinesses } = await supabase
      .from("orderHeader")
      .select("company_id")
      .gte("created_at", startOfMonth);
    
    const uniqueActiveBusinesses = new Set(activeOrderBusinesses?.map(o => o.company_id)).size;

    return NextResponse.json({
      leads: totalLeads || 0,
      prospects: prospects || 0,
      closed: closed || 0,
      active: uniqueActiveBusinesses || 0,
    });
  } catch (err: any) {
    console.error("Error fetching conversion funnel:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

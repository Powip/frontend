import { createRouteClient } from "@/utils/supabase/api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createRouteClient(request);

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    const startDate = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDate = to || now.toISOString();

    // 1. Leads del mes
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // 2. Prospectos (Contactados o más allá)
    const { count: prospects } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .neq("pipeline_stage", "nuevo");

    // 3. Cerrados (Activados como negocio)
    const { count: closed } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .eq("pipeline_stage", "cerrado");

    // 4. Clientes Activos (Al menos 1 pedido en el mes)
    const { data: activeOrders } = await supabase
      .from("orderHeader")
      .select("storeId")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const storeIds = Array.from(new Set(activeOrders?.map(o => o.storeId).filter(Boolean)));
    let uniqueActiveBusinesses = 0;
    
    if (storeIds.length > 0) {
      const { data: activeStores } = await supabase
        .from("stores")
        .select("company_id")
        .in("id", storeIds);
        
      uniqueActiveBusinesses = new Set(activeStores?.map(s => s.company_id).filter(Boolean)).size;
    }

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

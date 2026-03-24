import { createRouteClient } from "@/utils/supabase/api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createRouteClient(request);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    // 1. Leads of the month
    const { count: leadsCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth);

    const totalLeads = leadsCount || 0;

    // 2. Contact Rate
    // COUNT(contactados + avanzadas) / COUNT(total_periodo)
    const { count: contactedOrMoreCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth)
      .not("pipeline_stage", "in", '("nuevo","perdido")');

    // 3. Demo Rate (Completed)
    // COUNT(demo_agendada + demo_realizada + ...)
    const { count: demoOrMoreCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth)
      .in("pipeline_stage", ["demo_agendada", "demo_realizada", "evaluacion", "cerrado"]);

    // 4. Close Rate
    const { count: closedCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth)
      .eq("pipeline_stage", "cerrado");

    let avgCycleTimeDays = 0;
    try {
      // 1. Duración del Ciclo de Ventas y Win Rate
      const { data: cycles, error } = await supabase
        .from("pipeline_history")
        .select(`
          created_at,
          company:company_id(created_at)
        `)
        .eq("stage", "cierre_ganado")
        .gte("created_at", startOfMonth);

      if (error) {
        console.warn("Error fetching pipeline_history (table may not exist):", error.message);
      }

      // Safe fallback if cycles is null
      const safeCycles = cycles || [];
      const validCycles = safeCycles.filter((c: any) => c.company && c.company.created_at);
      const totalDays = validCycles.reduce((acc: number, c: any) => {
        const start = new Date(c.created_at);
        const end = new Date(c.company.created_at);
        return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgCycleTimeDays = totalDays / (validCycles.length || 1);
    } catch (error) {
      console.error("Error calculating cycle time from pipeline_history:", error);
      // avgCycleTimeDays remains 0 as initialized
    }

    // 6. Leads uncontacted > 24h
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: uncontacted24hCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("pipeline_stage", "nuevo")
      .lt("created_at", twentyFourHoursAgo);

    // 7. Leads at risk (> 7d in stage)
    const { count: atRiskCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("pipeline_stage", "in", '("cerrado","perdido")')
      .gt("days_in_stage", 7);

    // 8. MRR Generated (Sum of plan prices)
    const { data: mrrLeads } = await supabase
      .from("leads")
      .select("plan_interest")
      .gte("created_at", startOfMonth)
      .eq("pipeline_stage", "cerrado");

    const PLAN_MRR: Record<string, number> = {
      basic: 299,
      standard: 499,
      full: 799,
      enterprise: 1299,
    };

    const mrrGenerated = (mrrLeads || []).reduce((acc, l) => {
      return acc + (PLAN_MRR[l.plan_interest?.toLowerCase() || ''] || 0);
    }, 0);

    return NextResponse.json({
      leads_this_month: totalLeads,
      contact_count: contactedOrMoreCount || 0,
      contact_rate: (totalLeads > 0) ? ((contactedOrMoreCount || 0) / totalLeads) * 100 : 0,
      demo_count: demoOrMoreCount || 0,
      demo_rate: (contactedOrMoreCount && contactedOrMoreCount > 0) ? ((demoOrMoreCount || 0) / contactedOrMoreCount) * 100 : 0,
      close_rate: (totalLeads > 0) ? ((closedCount || 0) / totalLeads) * 100 : 0,
      avg_cycle_time_days: parseFloat(avgCycleTimeDays.toFixed(1)),
      uncontacted_24h: uncontacted24hCount || 0,
      at_risk_7d: atRiskCount || 0,
      mrr_generated: mrrGenerated,
      targets: {
        contact: { meta: 80, alert: 70 },
        demo: { meta: 60, alert: 50 },
        close: { meta: 12, alert: 8 },
        cycle: { meta: 21, alert: 30 },
        uncontacted: { meta: 0, alert: 5 },
        risk: { meta: 5, alert: 10 }
      }
    });
  } catch (error: any) {
    console.error("Error calculating pipeline summary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

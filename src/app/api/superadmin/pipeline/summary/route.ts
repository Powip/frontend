import { createRouteClient } from "@/utils/supabase/api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createRouteClient(request);
    
    const now = new Date();
    // Current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    // Previous month
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // 1. All leads (Simplified to basic data first for stability)
    const { data: allLeads, error } = await supabase
      .from("leads")
      .select("id, pipeline_stage, assigned_to, created_at");

    if (error) {
      console.error("[Pipeline Summary] DB Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leads = allLeads || [];
    
    // Current month leads
    const currentMonthLeads = leads.filter(l => l.created_at >= startOfMonth);
    const previousMonthLeads = leads.filter(l => l.created_at >= startOfPreviousMonth && l.created_at <= endOfPreviousMonth);

    // 2. Leads grouped by the 11 states
    const statesCount: Record<string, number> = {
      nuevo: 0,
      contactado: 0,
      respondio: 0,
      demo_pendiente: 0,
      demo_agendada: 0,
      demo_realizada: 0,
      pendiente_decision: 0,
      pendiente_pago: 0,
      pago_recibido: 0,
      cerrado: 0,
      perdido: 0,
      cancelado: 0, 
    };

    leads.forEach(lead => {
      const stage = lead.pipeline_stage || "nuevo";
      if (statesCount[stage] !== undefined) {
        statesCount[stage]++;
      } else {
        statesCount[stage] = 1;
      }
    });

    // 3. Effectiveness calculate (Altas Concretadas / Leads Contactados) * 100
    const contactedLeads = leads.filter(l => l.pipeline_stage && l.pipeline_stage !== "nuevo").length;
    const closedLeads = leads.filter(l => l.pipeline_stage === "cerrado" || l.pipeline_stage === "pago_recibido").length;
    
    // MoM Closed Leads
    const closedThisMonth = currentMonthLeads.filter(l => l.pipeline_stage === "cerrado" || l.pipeline_stage === "pago_recibido").length;
    const closedPreviousMonth = previousMonthLeads.filter(l => l.pipeline_stage === "cerrado" || l.pipeline_stage === "pago_recibido").length;

    const effectiveness = contactedLeads > 0 ? (closedLeads / contactedLeads) * 100 : 0;

    // 4. Salesperson Breakdown
    const salespersonMap: Record<string, { salesperson: string, managed_leads: number, closed_leads: number }> = {};
    
    leads.forEach(lead => {
      const sp = lead.assigned_to || "No asignado";
      if (!salespersonMap[sp]) {
        salespersonMap[sp] = { salesperson: sp, managed_leads: 0, closed_leads: 0 };
      }
      
      if (lead.pipeline_stage !== "nuevo") {
         salespersonMap[sp].managed_leads++;
      }
      
      if (lead.pipeline_stage === "cerrado" || lead.pipeline_stage === "pago_recibido") {
        salespersonMap[sp].closed_leads++;
      }
    });

    const salespersonBreakdown = Object.values(salespersonMap).sort((a, b) => b.closed_leads - a.closed_leads);

    return NextResponse.json({
      leads_this_month: currentMonthLeads.length,
      leads_previous_month: previousMonthLeads.length,
      closed_this_month: closedThisMonth,
      closed_previous_month: closedPreviousMonth,
      effectiveness: parseFloat(effectiveness.toFixed(1)),
      states_count: statesCount,
      salesperson_breakdown: salespersonBreakdown,
      contact_count: contactedLeads,
      close_rate: effectiveness,
      closed_count: closedLeads,
    });
  } catch (error: any) {
    console.error("Error calculating pipeline summary:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

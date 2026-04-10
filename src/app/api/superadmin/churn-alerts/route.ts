import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: atRiskLeads, error } = await supabase
      .from("leads")
      .select("*")
      .neq("pipeline_stage", "cerrado")
      .lt("updated_at", cutoffDate.toISOString())
      .limit(50);

    if (error) {
      console.error("[Churn Alerts] DB Error:", error);
      // Return empty alerts instead of 500 for UI stability
      return NextResponse.json({ alerts: [], total: 0 });
    }

    return NextResponse.json({
      alerts: (atRiskLeads || []).map(lead => ({
        id: lead.id,
        name: lead.contact_name,
        business: lead.business_name,
        last_activity: lead.updated_at,
        days_inactive: Math.floor((new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
        stage: lead.pipeline_stage,
        assigned_to: lead.assigned_to
      })),
      total: (atRiskLeads || []).length
    });
  } catch (err: any) {
    console.error("Error fetching churn alerts:", err);
    return NextResponse.json({ alerts: [], total: 0 });
  }
}

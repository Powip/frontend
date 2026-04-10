import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Try the real churn_alerts table first
    const { data: realAlerts, error: alertsError } = await supabase
      .from("churn_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!alertsError && realAlerts && realAlerts.length > 0) {
      return NextResponse.json({
        alerts: realAlerts,
        total: realAlerts.length
      });
    }

    // 2. Fallback: generate alerts from stale leads if churn_alerts table is empty or doesn't exist
    if (alertsError) {
      console.warn("[Churn Alerts] churn_alerts table error, falling back to leads:", alertsError.message);
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: atRiskLeads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .neq("pipeline_stage", "cerrado")
      .neq("pipeline_stage", "perdido")
      .lt("updated_at", cutoffDate.toISOString())
      .limit(50);

    if (leadsError) {
      console.error("[Churn Alerts] Leads fallback error:", leadsError);
      return NextResponse.json({ alerts: [], total: 0 });
    }

    // Map leads into the ChurnAlert shape that the frontend component expects
    const alerts = (atRiskLeads || []).map(lead => {
      const daysInactive = Math.floor(
        (new Date().getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      let severity: 'low' | 'medium' | 'high' = 'low';
      if (daysInactive > 14) severity = 'high';
      else if (daysInactive > 7) severity = 'medium';

      return {
        id: lead.id,
        business_id: lead.id, // Use lead id as reference
        alert_type: daysInactive > 14 ? 'no_login' : 'low_usage',
        severity,
        details: `Lead "${lead.contact_name}" (${lead.business_name || 'Sin empresa'}) lleva ${daysInactive} días sin actividad. Etapa actual: ${lead.pipeline_stage || 'nuevo'}.`,
        created_at: lead.updated_at,
        company: {
          name: lead.business_name || lead.contact_name,
          phone: lead.phone_whatsapp,
        }
      };
    });

    return NextResponse.json({
      alerts,
      total: alerts.length
    });
  } catch (err: any) {
    console.error("Error fetching churn alerts:", err);
    return NextResponse.json({ alerts: [], total: 0 });
  }
}

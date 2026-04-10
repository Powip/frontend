import { createRouteClient } from "@/utils/supabase/api";
import { NextResponse } from "next/server";
import axios from "axios";

const API_COMPANY = process.env.NEXT_PUBLIC_API_COMPANY;

export async function GET(request: Request) {
  try {
    const supabase = await createRouteClient(request);
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    // 1. Fetch leads that might be at risk (e.g. status !== 'cerrado' AND updated_at < now - days)
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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}

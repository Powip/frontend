import { createRouteClient } from "@/utils/supabase/api";
import { NextResponse } from "next/server";
import axios from "axios";

const API_COMPANY = process.env.NEXT_PUBLIC_API_COMPANY;
const API_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;

export async function GET(request: Request) {
  try {
    const supabase = await createRouteClient(request);
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 });
    }

    const config = {
      headers: { Authorization: authHeader }
    };

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    const startDate = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDate = to || now.toISOString();

    // 1. Leads del mes (Public Schema)
    const { count: totalLeads, error: err1 } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (err1) throw err1;

    // 2. Prospectos (Public Schema)
    const { count: prospects, error: err2 } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .neq("pipeline_stage", "nuevo");

    if (err2) throw err2;

    // 3. Cerrados (Public Schema)
    const { count: closed, error: err3 } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .eq("pipeline_stage", "cerrado");

    if (err3) throw err3;

    // 4. Clientes Activos (Fetch via Microservices for cross-schema data)
    let activeCount = 0;
    
    try {
      if (API_COMPANY) {
        const companiesRes = await axios.get(`${API_COMPANY}/company`, config);
        const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
        
        // Count companies that are active (this matches saas-metrics logic)
        activeCount = companies.filter((c: any) => 
          c.is_active || c.status?.toUpperCase() === 'ACTIVE'
        ).length;
      }
    } catch (apiErr) {
      console.warn("Falling back for active count due to API error:", apiErr);
      // If API fails, we could use the 'closed' count as a conservative estimate
      activeCount = closed || 0;
    }

    return NextResponse.json({
      leads: totalLeads || 0,
      prospects: prospects || 0,
      closed: closed || 0,
      active: activeCount || 0,
    });
  } catch (err: any) {
    console.error("Error fetching conversion funnel:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


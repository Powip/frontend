import { createAdminClient as createClient } from '@/utils/supabase/admin';
import { NextResponse } from "next/server";
import axios from "axios";

const API_COMPANY = process.env.NEXT_PUBLIC_API_COMPANY;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const authHeader = request.headers.get("Authorization");

    const config = authHeader
      ? { headers: { Authorization: authHeader }, timeout: 5000 }
      : { timeout: 5000 };

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    const startDate = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDate = to || now.toISOString();

    // 1. Leads del mes (Public Schema)
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // 2. Prospectos (Public Schema)
    const { count: prospects } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .neq("pipeline_stage", "nuevo");

    // 3. Cerrados (Public Schema)
    const { count: closed } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .eq("pipeline_stage", "cerrado");

    // 4. Clientes Activos (Fetch via Microservices for cross-schema data)
    let activeCount = 0;
    
    try {
      if (API_COMPANY && authHeader) {
        const companiesRes = await axios.get(`${API_COMPANY}/company`, config);
        const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
        activeCount = companies.filter((c: any) => 
          c.is_active || c.status?.toUpperCase() === 'ACTIVE'
        ).length;
      }
    } catch (apiErr) {
      console.warn("[Conversion Funnel] API fallback:", (apiErr as any)?.message);
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
    return NextResponse.json({ leads: 0, prospects: 0, closed: 0, active: 0 });
  }
}

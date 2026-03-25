import { createRouteClient } from "@/utils/supabase/api";
import { NextResponse } from "next/server";
import axios from "axios";

const API_COMPANY = process.env.NEXT_PUBLIC_API_COMPANY;
const API_AUTH = process.env.NEXT_PUBLIC_API_USERS?.replace("/api/v1", "");

export async function GET(request: Request) {
  const supabase = createRouteClient(request);
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "No authorization header" }, { status: 401 });
  }

  const config = {
    headers: { Authorization: authHeader }
  };

  try {
    // 1. Refresh alerts via RPC
    await supabase.rpc("generate_churn_alerts");

    // 2. Fetch data in parallel
    const [alertsRes, companiesRes, usersRes] = await Promise.allSettled([
      supabase
        .from("churn_alerts")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      axios.get(`${API_COMPANY}/company`, config),
      API_AUTH ? axios.get(`${API_AUTH}/api/v1/auth/users`, config) : Promise.resolve({ data: [] })
    ]);

    // Logging errors
    if (alertsRes.status === 'rejected') console.error("DB alerts fetch failure:", alertsRes.reason);
    if (companiesRes.status === 'rejected') console.error("MS-COMPANY fetch failure:", companiesRes.reason?.message);
    if (usersRes.status === 'rejected') console.error("MS-AUTH fetch failure:", (usersRes as any).reason?.message);

    // Handle results safely
    const alerts = alertsRes.status === 'fulfilled' ? (alertsRes.value.data || []) : [];
    const companies = companiesRes.status === 'fulfilled' ? (companiesRes.value.data || []) : [];
    const users = (usersRes.status === 'fulfilled' && (usersRes.value as any).data) ? (usersRes.value as any).data : [];

    // Create maps for efficient lookup
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const companyMap = new Map(companies.map((c: any) => [c.id, c]));

    // 3. Map company and user details to alerts in-memory
    const enrichedAlerts = alerts.map((alert: any) => {
      const company = companyMap.get(alert.business_id) as any;
      const user = company ? userMap.get(company.user_id) as any : null;

      return {
        ...alert,
        company: company ? {
          name: company.name,
          plan: company.plan || "N/A",
          price: company.price || 0,
          phone: company.phone || company.billing_phone || "No registrado",
          email: company.billing_email,
          lastSignInAt: user?.lastSignInAt || null
        } : { name: "Empresa desconocida", plan: "N/A", price: 0 }
      };
    });

    return NextResponse.json(enrichedAlerts);
  } catch (err: any) {
    console.error("Error fetching churn alerts via aggregation:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

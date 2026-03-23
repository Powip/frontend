import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  try {
    // Primero, ejecutamos el refresh de alertas (simulando el cron job para la demo)
    await supabase.rpc("generate_churn_alerts");

    const { data, error } = await supabase
      .from("churn_alerts")
      .select(`
        *,
        company:business_id (name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error fetching churn alerts:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

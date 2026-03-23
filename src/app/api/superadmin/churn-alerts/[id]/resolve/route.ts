import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const { note } = await request.json();
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("churn_alerts")
      .update({
        status: "resolved",
        resolution_note: note,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error resolving churn alert:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

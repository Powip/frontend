import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string, step_code: string } }
) {
  const { id, step_code } = params;
  const { completed } = await request.json();
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("onboarding_progress")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("business_id", id)
      .eq("step_code", step_code)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error updating onboarding step:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

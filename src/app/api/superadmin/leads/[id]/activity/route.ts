import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { id } = params;

  try {
    const body = await request.json();
    const { activity_type, description, performed_by, metadata } = body;

    if (!activity_type || !description) {
      return NextResponse.json({ error: "activity_type and description are required" }, { status: 400 });
    }

    const { data: activity, error } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: id,
        activity_type,
        description,
        performed_by,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Activity logged successfully", data: activity });
  } catch (error: any) {
    console.error(`Error logging activity for lead ${id}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { id } = params;

  try {
    // Fetch lead with its activities using a join-like approach
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        activities:lead_activities(*)
      `)
      .eq("id", id)
      .single();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 404 });
    }

    // Sort activities by date descending
    if (lead.activities) {
      lead.activities.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return NextResponse.json(lead);
  } catch (error: any) {
    console.error(`Error fetching lead ${id}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

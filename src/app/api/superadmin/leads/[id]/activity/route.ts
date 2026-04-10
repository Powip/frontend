import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    const body = await request.json();
    const { activity_type, description, performed_by, metadata } = body;

    if (!activity_type || !description) {
      return NextResponse.json({ error: "activity_type and description are required" }, { status: 400 });
    }

    // 1. Get current user for attribution
    const { data: { user } } = await supabase.auth.getUser();
    
    // 2. Check if lead exists in main leads table (required for foreign key)
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", id)
      .single();

    if (!existingLead) {
      // 3. Try to migrate from landing leads
      const { data: landingLead } = await supabase
        .from("landing_leads")
        .select("*")
        .eq("id", id)
        .single();

      if (landingLead) {
        await supabase.from("leads").insert({
          id: landingLead.id,
          contact_name: landingLead.full_name,
          business_name: landingLead.company,
          phone_whatsapp: landingLead.phone,
          email: landingLead.email,
          source: 'landing',
          observations: landingLead.message,
          created_at: landingLead.created_at
        });
      } else {
        return NextResponse.json({ error: "Lead not found in any source" }, { status: 404 });
      }
    }

    // 4. Log activity
    const { data: activity, error } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: id,
        activity_type,
        description,
        performed_by: performed_by || user?.id, // Use UUID from body or current user
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


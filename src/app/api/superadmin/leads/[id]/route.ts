import { createAdminClient as createClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

// Helper to normalize landing lead to lead format
function normalizeLandingLead(landingLead: any) {
  return {
    ...landingLead,
    contact_name: landingLead.full_name,
    business_name: landingLead.company,
    phone_whatsapp: landingLead.phone,
    source: 'landing',
    pipeline_stage: 'nuevo',
    is_landing: true,
    activities: []
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    // 1. Try Main Leads table
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        activities:lead_activities(*)
      `)
      .eq("id", id)
      .single();

    if (!leadError && lead) {
      if (lead.activities) {
        lead.activities.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      return NextResponse.json(lead);
    }

    // 2. Try Landing Leads table if not found in main
    const { data: landingLead, error: landingError } = await supabase
      .from("landing_leads")
      .select("*")
      .eq("id", id)
      .single();

    if (landingError || !landingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(normalizeLandingLead(landingLead));
  } catch (error: any) {
    console.error(`Error fetching lead ${id}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    // Try deleting from both (silent if not exists)
    await Promise.all([
      supabase.from("leads").delete().eq("id", id),
      supabase.from("landing_leads").delete().eq("id", id)
    ]);

    return NextResponse.json({ message: "Lead deleted successfully" });
  } catch (error: any) {
    console.error(`Error deleting lead ${id}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  try {
    // 1. Check if it exists in main leads
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", id)
      .single();

    if (!existingLead) {
      // 2. If not, check if it's a landing lead that needs migration
      const { data: landingLead } = await supabase
        .from("landing_leads")
        .select("*")
        .eq("id", id)
        .single();

      if (landingLead) {
        // AUTO-MIGRATE: Create in leads table before updating
        const { error: migrationError } = await supabase
          .from("leads")
          .insert({
            id: landingLead.id,
            contact_name: landingLead.full_name,
            business_name: landingLead.company,
            phone_whatsapp: landingLead.phone,
            email: landingLead.email,
            source: 'landing',
            observations: landingLead.message,
            created_at: landingLead.created_at,
            imported_from_sheet: false
          });

        if (migrationError) {
          console.error("Migration error:", migrationError);
          return NextResponse.json({ error: "Failed to migrate landing lead to CRM" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
    }

    // 3. Perform the update on the leads table
    const { data, error } = await supabase
      .from("leads")
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error updating lead ${id}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  try {
    const { id } = await params;
    const body = await request.json();
    const { new_stage, old_stage, performed_by } = body;

    if (!new_stage) {
      return NextResponse.json({ error: 'new_stage is required' }, { status: 400 });
    }

    // 1. Check if lead exists in main table
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingLead) {
      // 2. Check in landing_leads and migrate if found
      const { data: landingLead } = await supabase
        .from('landing_leads')
        .select('*')
        .eq('id', id)
        .single();

      if (landingLead) {
        // Migrate to leads table
        await supabase.from('leads').insert({
          id: landingLead.id,
          contact_name: landingLead.full_name,
          business_name: landingLead.company,
          phone_whatsapp: landingLead.phone,
          email: landingLead.email,
          source: 'landing',
          observations: landingLead.message,
          created_at: landingLead.created_at,
          pipeline_stage: new_stage // Use the new stage directly
        });
      } else {
        return NextResponse.json({ error: 'Lead not found in any source' }, { status: 404 });
      }
    }

    // 3. Update lead stage in leads table
    const { data: lead, error: updateError } = await supabase
      .from('leads')
      .update({ 
        pipeline_stage: new_stage,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. Log activity
    await supabase.from('lead_activities').insert({
      lead_id: id,
      activity_type: 'status_change',
      old_stage: old_stage,
      new_stage: new_stage,
      description: `Stage changed from ${old_stage} to ${new_stage}`,
      performed_by: performed_by
    });

    return NextResponse.json({ message: 'Stage updated successfully', data: lead });
  } catch (error: any) {
    console.error('Error updating lead stage:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncLeadToGoogleSheets } from '@/lib/integrations/google-sheets';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  try {
    const { id } = params;
    const body = await request.json();
    const { new_stage, old_stage, performed_by } = body;

    if (!new_stage) {
      return NextResponse.json({ error: 'new_stage is required' }, { status: 400 });
    }

    // Update lead stage
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

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: id,
      activity_type: 'status_change',
      old_stage: old_stage,
      new_stage: new_stage,
      description: `Stage changed from ${old_stage} to ${new_stage}`,
      performed_by: performed_by // Optional, could be null if not provided
    });

    // 3. Trigger Google Sheets Sync (Architecture)
    if (lead.sheet_row_id) {
       await syncLeadToGoogleSheets(id, new_stage);
    }

    return NextResponse.json({ message: 'Stage updated successfully', data: lead });
  } catch (error: any) {
    console.error('Error updating lead stage:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

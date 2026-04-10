import { NextResponse } from 'next/server';
import { createAdminClient as createClient } from '@/utils/supabase/admin';

export async function PATCH(request: Request) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { ids, data, performed_by } = body;

    // data can be { pipeline_stage: 'contactado', assigned_to: 'Vendedor 1' }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'data is required to update' }, { status: 400 });
    }

    // Update leads
    const { data: updatedLeads, error: updateError } = await supabase
      .from('leads')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .select();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log activities for all
    const activities = ids.map((id: string) => {
      let description = 'Mass update applied.';
      if (data.pipeline_stage) description = `Stage changed to ${data.pipeline_stage} (Mass Update)`;
      else if (data.assigned_to) description = `Assigned to ${data.assigned_to} (Mass Update)`;
      
      return {
        lead_id: id,
        activity_type: data.pipeline_stage ? 'status_change' : 'system',
        new_stage: data.pipeline_stage,
        description,
        performed_by: performed_by || 'Superadmin'
      };
    });

    await supabase.from('lead_activities').insert(activities);

    // If stage is pago_recibido or cerrado, auto-create activations 
    // This replicates the frontend behavior.
    if (data.pipeline_stage === 'pago_recibido' || data.pipeline_stage === 'cerrado') {
      const { data: existingActivations } = await supabase
        .from('lead_activations')
        .select('lead_id')
        .in('lead_id', ids);
      
      const existingIds = new Set(existingActivations?.map(a => a.lead_id) || []);
      
      const newActivations = updatedLeads
        .filter(lead => !existingIds.has(lead.id))
        .map(lead => ({
          lead_id: lead.id,
          status: 'pendiente',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

      if (newActivations.length > 0) {
         await supabase.from('lead_activations').insert(newActivations);
      }
    }

    return NextResponse.json({ message: 'Leads updated successfully', data: updatedLeads });
  } catch (error: any) {
    console.error('Error updating leads in bulk:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const body = await request.json();

  try {
    const { data, error } = await supabase
      .from('lead_activations')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`*, lead:leads(id, contact_name, business_name)`)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If status changed to alta_completa, create postventa record
    if (body.activation_status === 'alta_completa' || body.activation_status === 'activo') {
      // Check if postventa already exists
      const { data: existingPV } = await supabase
        .from('lead_postventa')
        .select('id')
        .eq('lead_id', data.lead_id)
        .limit(1);

      if (!existingPV || existingPV.length === 0) {
        await supabase
          .from('lead_postventa')
          .insert({
            lead_id: data.lead_id,
            activation_id: data.id,
            business_name: data.business_name || data.lead?.business_name,
            activation_date: data.activation_date || new Date().toISOString(),
            client_status: 'onboarding',
            assigned_to: data.assigned_to,
          });

        // Log activity
        await supabase.from('lead_activities').insert({
          lead_id: data.lead_id,
          activity_type: 'status_change',
          description: 'Lead completó alta y fue movido a Postventa / Acompañamiento',
        });
      }
    }

    // Log activity for status change
    if (body.activation_status) {
      await supabase.from('lead_activities').insert({
        lead_id: data.lead_id,
        activity_type: 'status_change',
        description: `Estado de activación cambiado a: ${body.activation_status.replace(/_/g, ' ')}`,
      });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error(`Error updating activation ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

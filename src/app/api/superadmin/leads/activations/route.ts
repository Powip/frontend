import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  const supabase = await createRouteClient(request);

  try {
    const { data, error } = await supabase
      .from('lead_activations')
      .select(`
        *,
        lead:leads(id, contact_name, business_name, phone_whatsapp, email, source, pipeline_stage, plan_interest, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching activations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createRouteClient(request);

  try {
    const body = await request.json();
    const { lead_id, business_name, contact_name, plan, assigned_to, observations } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    // Check if activation already exists for this lead
    const { data: existing } = await supabase
      .from('lead_activations')
      .select('id')
      .eq('lead_id', lead_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Activation already exists for this lead' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('lead_activations')
      .insert({
        lead_id,
        business_name,
        contact_name,
        plan,
        payment_received_at: new Date().toISOString(),
        activation_status: 'pendiente_alta',
        assigned_to,
        observations,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id,
      activity_type: 'status_change',
      description: 'Lead movido a fase de Activación / Alta',
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating activation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

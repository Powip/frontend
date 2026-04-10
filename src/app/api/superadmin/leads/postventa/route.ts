import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  try {
    const supabase = await createRouteClient(request);

    const { data, error } = await supabase
      .from('lead_postventa')
      .select(`
        *,
        lead:leads(contact_name, business_name, phone_whatsapp, email),
        activation:lead_activations(activation_date, plan)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Postventa API] DB Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching postventa leads:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

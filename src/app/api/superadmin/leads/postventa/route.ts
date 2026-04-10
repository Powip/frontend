import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  const supabase = createRouteClient(request);

  try {
    const { data, error } = await supabase
      .from('lead_postventa')
      .select(`
        *,
        lead:leads(id, contact_name, business_name, phone_whatsapp, email, source, created_at),
        activation:lead_activations(id, plan, activation_date, activation_status)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching postventa:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createAdminClient as createClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

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
      // Table might not exist yet - return empty data instead of 500
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching postventa leads:', error);
    return NextResponse.json({ data: [] });
  }
}

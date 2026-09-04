import { NextResponse } from 'next/server';
import { createAdminClient as createClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('lead_postventa')
      .select(`
        *,
        lead:leads(contact_name, business_name, phone_whatsapp, email),
        activation:lead_activations(activation_date, plan)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Postventa API] DB Error:', error);
      // Table might not exist yet - return empty data instead of 500
      return NextResponse.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching postventa leads:', error);
    return NextResponse.json({ data: [], pagination: { page: 1, limit: 500, total: 0, total_pages: 0 } });
  }
}

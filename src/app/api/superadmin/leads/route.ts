import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  const supabase = createRouteClient(request);
  const { searchParams } = new URL(request.url);

  const stage = searchParams.get('stage');
  const source = searchParams.get('source');
  const assignedTo = searchParams.get('assigned_to');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  try {
    // Auto-sync: import any landing_leads that don't yet exist in leads (by email)
    const { data: landingLeads } = await supabase
      .from('landing_leads')
      .select('*');

    if (landingLeads && landingLeads.length > 0) {
      for (const ll of landingLeads) {
        // Check if this email already exists in leads
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .ilike('email', ll.email)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from('leads').insert({
            contact_name: ll.full_name,
            business_name: ll.company,
            phone_whatsapp: ll.phone,
            email: ll.email,
            source: 'landing',
            pipeline_stage: 'nuevo',
            plan_interest: 'basic',
            created_at: ll.created_at,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    // Now fetch all leads
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' });

    // Filters
    if (stage) query = query.eq('pipeline_stage', stage);
    if (source) query = query.eq('source', source);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    
    // Search (Simple name or business search)
    if (search) {
      query = query.or(`contact_name.ilike.%${search}%,business_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

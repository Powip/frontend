import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  const supabase = await createRouteClient(request);
  const { searchParams } = new URL(request.url);

  const stage = searchParams.get('stage');
  const source = searchParams.get('source');
  const assignedTo = searchParams.get('assigned_to');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '200');
  const offset = (page - 1) * limit;

  try {
    // 1. Fetch all leads (Simplified: removed synchronous landing_leads import for stability)
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' });

    // Filters
    if (stage) query = query.eq('pipeline_stage', stage);
    if (source) query = query.eq('source', source);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    
    // Search
    if (search) {
      query = query.or(`contact_name.ilike.%${search}%,business_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Leads API] DB Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('[Leads API] Crash:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createRouteClient(request);
  try {
    const body = await request.json();
    const {
      contact_name,
      business_name,
      phone_whatsapp,
      email,
      source
    } = body;


    if (!contact_name || !phone_whatsapp) {
      return NextResponse.json(
        { error: 'Name and Phone are required' },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        contact_name,
        business_name,
        phone_whatsapp,
        email,
        source: source || 'otro',
        pipeline_stage: 'nuevo',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log Activity
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'other',
      description: 'Lead creado manualmente',
    });

    return NextResponse.json(
      { message: 'Lead created successfully', data: lead },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error in lead creation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

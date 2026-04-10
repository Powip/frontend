import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  try {
    const supabase = await createRouteClient(request);
    const { searchParams } = new URL(request.url);

    const stage = searchParams.get('stage');
    const source = searchParams.get('source');
    const assignedTo = searchParams.get('assigned_to');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '500'); // Larger limit for merging
    const offset = (page - 1) * limit;

    // 1. Fetch from 'leads' table
    let leadsQuery = supabase.from('leads').select('*');
    if (stage) leadsQuery = leadsQuery.eq('pipeline_stage', stage);
    if (source) leadsQuery = leadsQuery.eq('source', source);
    if (assignedTo) leadsQuery = leadsQuery.eq('assigned_to', assignedTo);
    if (search) {
      leadsQuery = leadsQuery.or(`contact_name.ilike.%${search}%,business_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: leadsData, error: leadsError } = await leadsQuery.order('created_at', { ascending: false });

    if (leadsError) {
      console.error('[Leads API] Leads DB Error:', leadsError);
      return NextResponse.json({ data: [], error: leadsError.message }, { status: 200 }); // Return empty for stability
    }

    // 2. Fetch from 'landing_leads' table
    // Only fetch from landing_leads if filters are compatible (source=landing or no source, and stage=nuevo or no stage)
    let landingData: any[] = [];
    const isSourceCompatible = !source || source.toLowerCase() === 'landing';
    const isStageCompatible = !stage || stage.toLowerCase() === 'nuevo';
    const isAssignedCompatible = !assignedTo; // landing leads usually don't have assigned_to yet

    if (isSourceCompatible && isStageCompatible && isAssignedCompatible) {
      let landingQuery = supabase.from('landing_leads').select('*');
      if (search) {
        landingQuery = landingQuery.or(`full_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data: lData, error: lError } = await landingQuery.order('created_at', { ascending: false });
      if (!lError) landingData = lData || [];
    }

    // 3. Normalize landing leads
    const normalizedLanding = landingData.map(l => ({
      ...l,
      contact_name: l.full_name,
      business_name: l.company,
      phone_whatsapp: l.phone,
      source: 'landing',
      pipeline_stage: 'nuevo',
      is_landing: true
    }));

    // 4. Merge and Deduplicate by Phone
    const combinedLeads = [...(leadsData || []), ...normalizedLanding];
    const uniqueLeadsMap = new Map();

    combinedLeads.forEach(lead => {
      const phone = lead.phone_whatsapp || lead.phone;
      if (!phone) {
        uniqueLeadsMap.set(lead.id, lead); // Use ID if no phone
        return;
      }

      const existing = uniqueLeadsMap.get(phone);
      if (!existing) {
        uniqueLeadsMap.set(phone, lead);
      } else {
        // Preference: keep the one from the 'leads' table (usually richer data) or the most recent
        const isFromLeadsTable = !lead.is_landing;
        if (isFromLeadsTable || new Date(lead.created_at) > new Date(existing.created_at)) {
          uniqueLeadsMap.set(phone, lead);
        }
      }
    });

    const finalLeads = Array.from(uniqueLeadsMap.values())
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 5. Apply Pagination in-memory
    const paginatedLeads = finalLeads.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedLeads,
      pagination: {
        page,
        limit,
        total: finalLeads.length,
        total_pages: Math.ceil(finalLeads.length / limit)
      }
    });
  } catch (error: any) {
    console.error('[Leads API] Crash:', error);
    return NextResponse.json({ data: [], error: 'Internal Server Error' }, { status: 200 }); // Graceful recovery
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createRouteClient(request);
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

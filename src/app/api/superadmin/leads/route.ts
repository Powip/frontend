import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const stage = searchParams.get('stage');
  const source = searchParams.get('source');
  const assignedTo = searchParams.get('assigned_to');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' });

    // Filters
    if (stage) query = query.eq('pipeline_stage', stage);
    if (source) query = query.eq('source', source);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    
    // Search (Simple name or business search)
    if (search) {
      query = query.or(`contact_name.ilike.%${search}%,business_name.ilike.%${search}%`);
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

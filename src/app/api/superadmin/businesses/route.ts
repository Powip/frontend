import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get('search');
  const plan = searchParams.get('plan');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('company')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Filters
    if (plan) query = query.eq('plan', plan);
    
    // Search
    if (search) {
      query = query.ilike('name', `%${search}%`);
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
    console.error('Error fetching businesses:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createRouteClient(request);
  const { id } = await params;
  const body = await request.json();

  try {
    const { data, error } = await supabase
      .from('lead_postventa')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    if (body.client_status) {
      await supabase.from('lead_activities').insert({
        lead_id: data.lead_id,
        activity_type: 'status_change',
        description: `Estado postventa cambiado a: ${body.client_status.replace(/_/g, ' ')}`,
      });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error(`Error updating postventa ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

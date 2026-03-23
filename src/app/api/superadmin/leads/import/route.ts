import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      contact_name,
      business_name,
      phone_whatsapp,
      email,
      source,
      pipeline_stage,
      plan_interest,
      sheet_row_id,
      imported_at
    } = body;

    if (!sheet_row_id) {
      return NextResponse.json(
        { error: 'sheet_row_id is required for upsert logic' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('leads')
      .upsert(
        {
          contact_name,
          business_name,
          phone_whatsapp,
          email,
          source,
          pipeline_stage,
          plan_interest,
          sheet_row_id,
          imported_from_sheet: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'sheet_row_id' }
      )
      .select();

    if (error) {
      console.error('Error importing lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Lead imported successfully', data },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error in lead import:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { createAdminClient as createClient } from '@/utils/supabase/admin';
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Consulta directa a la vista creada en Supabase
    const { data, error } = await supabase
      .from('v_radar_upsell')
      .select('*')
      .limit(limit);

    if (error) {
      console.error("[Radar Upsell] Error DB:", error);
      return NextResponse.json({ data: [] }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error("[Radar Upsell] Error Servidor:", error);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
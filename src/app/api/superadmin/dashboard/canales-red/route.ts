import { createAdminClient as createClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: canales, error } = await supabase
      .from('v_canales_re')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      canales: canales || [],
      oportunidad: {
        titulo: "Priorizar integración nativa con TikTok Shop",
        motivo: "El 21% de los negocios ya vende por TikTok sin integración directa."
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al obtener canales de red' },
      { status: 500 }
    );
  }
}
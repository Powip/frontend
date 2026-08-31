import { createAdminClient as createClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: segmentos, error } = await supabase
      .from('v_clientes_composicion')
      .select('segmento, count, pct');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ segmentos: segmentos || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al obtener composición de clientes' },
      { status: 500 }
    );
  }
}
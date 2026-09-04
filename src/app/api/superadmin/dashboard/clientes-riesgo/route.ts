import { createAdminClient as createClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Obtener el parámetro ?limit= de la URL (por defecto 10)
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Consultar la vista aplicando el límite dinámico
    const { data, error } = await supabase
      .from('v_clientes_riesgo')
      .select('empresaId, empresaNombre, motivo')
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error al consultar clientes en riesgo' },
      { status: 500 }
    );
  }
}
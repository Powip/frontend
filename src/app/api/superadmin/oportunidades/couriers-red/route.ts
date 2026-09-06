import { createAdminClient as createClient } from '@/utils/supabase/admin';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Consulta directa a la vista de métricas de transportadoras
    const { data, error } = await supabase
      .from('v_couriers_red')
      .select('*');

    if (error) {
      console.error("[Couriers Red] Error DB:", error);
      return NextResponse.json({ data: [] }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error("[Couriers Red] Error Servidor:", error);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
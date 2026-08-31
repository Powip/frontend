import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // Ajusta según tu cliente

export async function GET() {
  try {
    // 1. Consultar la vista SQL
    const { data: canales, error } = await supabase
      .from("v_canales_red")
      .select("*");

    if (error) throw error;

    // 2. Retornar los canales reales + oportunidad hardcodeada (temporal)
    return NextResponse.json({
      canales: canales || [],
      oportunidad: {
        titulo: "Priorizar integración nativa con TikTok Shop",
        motivo: "El 21% de los negocios ya vende por TikTok sin integración directa."
      }
    });
  } catch (err) {
    // Retornar fallback mock en caso de error
    return NextResponse.json(
      { error: "Error consultando canales" },
      { status: 500 }
    );
  }
}
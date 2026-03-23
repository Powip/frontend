import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const supabase = await createClient();

  try {
    // Llamar a la función transaccional RPC
    const { data, error } = await supabase.rpc("activate_lead_v3", {
      p_lead_id: id,
    });

    if (error) {
      console.error("Error en RPC activate_lead_v3:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error inesperado en activación:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

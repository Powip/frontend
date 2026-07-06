import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

function toNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
  console.log("[api/finanzas/table] START");

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  console.log("[api/finanzas/table] storeId:", storeId);

  if (!storeId) {
    console.warn("[api/finanzas/table] Missing storeId");
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
    console.log("[api/finanzas/table] Authorization header present");
  } else {
    console.log("[api/finanzas/table] No Authorization header");
  }

  const url = `${API_COURIER}/guide-liquidations/store/${storeId}/dashboard/table`;
  console.log("[api/finanzas/table] Fetching:", url);

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });
    console.log("[api/finanzas/table] Response:", res);

    console.log("[api/finanzas/table] Response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[api/finanzas/table] Error response:", text);
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();

    // Map chargeType to tipo
    const mapChargeTypeToTipo = (
      chargeType: string | null | undefined,
    ): string => {
      if (!chargeType) return "Courier cobra";
      if (chargeType === "CONTRA_ENTREGA") return "Courier cobra";
      if (chargeType === "PREPAGADO") return "Prepagado";
      if (chargeType === "CORTESIA") return "Negocio cobra";
      return chargeType;
    };

    // Normalize score
    const normalizeScore = (score: string | null | undefined): string => {
      if (!score) return "Confiable";
      if (score === "PROBLEMATICO" || score === "Problemático")
        return "Problemático";
      if (score === "CONFIABLE" || score === "Confiable") return "Confiable";
      return score;
    };

    // Normalize estado
    const normalizeEstado = (estado: string | null | undefined): string => {
      if (!estado) return "Pendiente";
      const upper = estado.toUpperCase();
      if (upper === "PENDIENTE") return "Pendiente";
      if (upper === "PARCIAL") return "Parcial";
      if (upper === "LIQUIDADO") return "Liquidado";
      if (upper === "VENCIDO") return "Vencido";
      if (upper === "SIN_COD") return "Sin COD";
      return estado;
    };

    const normalized = Array.isArray(data)
      ? data.map((row: any, index: number) => {
          const mapped = {
            ...row,
            courier: row.courierName ?? row.courier ?? "—",
            score: normalizeScore(row.courierScore ?? row.score),
            tipo: row.tipo ?? mapChargeTypeToTipo(row.chargeType),
            estado: normalizeEstado(row.estado),
            codBruto: toNum(row.codBruto),
            adelantos: toNum(row.adelantos),
            codNeto: toNum(row.codNeto),
            costos: toNum(row.costos),
            neto: toNum(row.neto),
            pedidosCount: toNum(row.pedidosCount ?? row.pedidos),
            pedidosEnAgencia: toNum(row.pedidosEnAgencia),
            pedidosConAlerta: toNum(row.pedidosConAlerta),
            pedidosReasignados: toNum(row.pedidosReasignados),
            diasPendiente: toNum(row.diasPendiente ?? row.dias),
            diasMaximo: toNum(row.diasMaximo),
          };

          // Log de una sola fila para no spamear
          if (index === 0) {
            console.log("[api/finanzas/table] First normalized row:", mapped);
          }

          return mapped;
        })
      : data;

    console.log("[api/finanzas/table] DONE");

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error("[api/finanzas/table] Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

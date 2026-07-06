import { NextRequest, NextResponse } from "next/server";

const API_COURIER = (process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:8083").replace(/\/$/, "") + "/courier";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(
      `${API_COURIER}/guide-liquidations/store/${storeId}/dashboard/courier-performance`,
      { headers, cache: "no-store" },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    console.log("courier performance: ", data);

    // Normalize fields to match what the frontend LiquidacionesCourierTab component expects
    const normalized = Array.isArray(data)
      ? data.map((item: any) => {
          const pendingCodVal = Number(
            item.pendingCod ?? item.codPendiente ?? item.codPend ?? 0,
          );
          const overdueGuidesVal = Number(item.overdueGuides ?? 0);
          const totalGuiasVal = Number(
            item.totalGuides ?? item.totalGuias ?? item.guias ?? 0,
          );

          // Derive and normalize status: "Sin COD", "Vencido", "Pendiente"
          let status = "Pendiente";
          if (item.status) {
            status = item.status;
          } else if (item.estadoActual) {
            status = item.estadoActual;
          } else if (pendingCodVal === 0) {
            status = "Sin COD";
          } else if (overdueGuidesVal > 0) {
            status = "Vencido";
          }

          if (status === "SIN_COD") status = "Sin COD";
          else if (status === "VENCIDO") status = "Vencido";
          else if (status === "PENDIENTE") status = "Pendiente";

          // Derive and normalize score: "Problemático", "Confiable"
          let score = "Confiable";
          if (item.score === "PROBLEMATICO" || item.score === "Problemático") {
            score = "Problemático";
          } else if (item.score === "CONFIABLE" || item.score === "Confiable") {
            score = "Confiable";
          } else if (overdueGuidesVal > 0) {
            score = "Problemático";
          }

          // Map weeklyData: backend returns weeklyPerformance with settled/pending
          const rawWeekly =
            item.weeklyPerformance ??
            item.rendicionUltimas8Semanas ??
            item.weeklyData ??
            [];
          const weeklyData = Array.isArray(rawWeekly)
            ? rawWeekly.map((w: any) => ({
                week: w.week ?? w.semana ?? "",
                rendido: Number(w.settled ?? w.rendido ?? 0),
                pendiente: Number(w.pending ?? w.pendiente ?? 0),
              }))
            : [];

          return {
            ...item,
            name: item.courierName ?? item.nombre ?? item.name ?? "Courier",
            score,
            status,
            description: item.description ?? `${totalGuiasVal} guías este mes`,
            avgRenditionDays: Number(
              item.avgSettlementDays ??
                item.avgRenditionDays ??
                item.promedioRendicionDias ??
                0,
            ),
            codPendiente: pendingCodVal,
            enAgencia: Number(item.enAgencia ?? item.enAgenciaCantidad ?? 0),
            totalGuias: totalGuiasVal,
            weeklyData,
          };
        })
      : data;

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error("[api/finanzas/courier-performance]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

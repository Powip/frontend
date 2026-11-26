"use client";

/**
 * Inversión publicitaria (FEAT-34: P1, P5, P8).
 *
 * - Los cocientes de publicidad (costo por pedido, publicidad por entregado, venta ÷ publicidad, costo por tienda y
 *   canal) solo salen con días cerrados: si el periodo llega a hoy (o pasa de hoy), los componentes del módulo de
 *   publicidad reciben el rango cortado en ayer (`hastaAyer`) y se avisa. Con «Hoy» no queda ningún día cerrado: se
 *   pasa el periodo tal cual y se explica por qué los cocientes quedan pendientes.
 * - Al no pedir días que no pasaron, «Faltan N días» ya no cuenta días futuros.
 * - El registro manual del navegador queda (la Fase 3 lo retira) pero rotulado y montado solo si se abre: antes se
 *   montaba escondido y bajaba pedidos igual.
 * - Respeta `?from=&to=` en la URL (enlaces desde otras pantallas).
 */

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AdvertisingAssignedSpendV11 } from "@/components/advertising/AdvertisingAssignedSpendV11";
import { AdvertisingLivePanel } from "@/components/advertising/AdvertisingLivePanel";
import { advertisingPeriodFromParams } from "@/components/advertising/advertising-period";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { Aviso, claseBotonSecundario, PanelSkeleton } from "../_components/ui";
import { etiquetaPeriodo, hastaAyer, hoyLima } from "../_lib/periodo";

const ManualAdvertisingPage = dynamic(() => import("./ManualAdvertisingPage"), {
  loading: () => <PanelSkeleton variant="tabla" label="registro manual" />,
});

const ROTULO_REGISTRO_MANUAL = "Registro manual: se guarda solo en este navegador y no entra en los cálculos";

/** El registro manual se monta recién cuando se pide verlo (antes se montaba escondido y bajaba pedidos). */
function RegistroManual() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs font-semibold text-pc-warn">{ROTULO_REGISTRO_MANUAL}.</p>
      {abierto ? (
        <ManualAdvertisingPage />
      ) : (
        <button type="button" className={claseBotonSecundario} onClick={() => setAbierto(true)}>
          Ver registros manuales
        </button>
      )}
    </div>
  );
}

function AdvertisingPageContent() {
  const { auth } = useAuth();
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [ready, setReady] = useState(false);
  const storeIds = useMemo(
    () => auth?.company?.stores?.map((store) => store.id) ?? [],
    [auth?.company?.stores],
  );

  useEffect(() => {
    const period = advertisingPeriodFromParams(new URLSearchParams(queryString));
    if (period) setPeriod(period.from, period.to);
    setReady(true);
  }, [queryString, setPeriod]);

  if (!ready) return <PanelSkeleton variant="kpis" label="periodo de inversión" />;

  const cerrado = hastaAyer(fromDate, toDate, hoyLima());
  const rango = cerrado ?? { desde: fromDate, hasta: toDate };
  const recortado = cerrado !== null && cerrado.hasta !== toDate;

  return (
    <div className="space-y-3.5">
      {recortado && (
        <Aviso tono="info" titulo={`Publicidad hasta ayer: ${etiquetaPeriodo(rango.desde, rango.hasta)}`}>
          El consumo de hoy todavía es provisional (Meta y TikTok lo corrigen durante el día) y el costo por pedido, la
          publicidad por entregado y la venta ÷ publicidad solo se calculan con días cerrados. Por eso esta pestaña
          llega hasta ayer.
        </Aviso>
      )}
      {cerrado === null && (
        <Aviso tono="info" titulo="Los cocientes quedan pendientes en este periodo">
          El periodo elegido todavía no tiene días cerrados: el consumo de hoy es provisional y el costo por pedido, la
          publicidad por entregado y la venta ÷ publicidad solo se calculan con días cerrados. Para verlos, elige un
          periodo que termine ayer o antes (por ejemplo, «Mes anterior»).
        </Aviso>
      )}
      <AdvertisingAssignedSpendV11 from={rango.desde} to={rango.hasta} />
      <AdvertisingLivePanel
        key={`${auth?.user.id}:${auth?.company?.id}`}
        companyId={auth?.company?.id}
        actorId={auth?.user.id}
        token={auth?.accessToken}
        companyName={auth?.company?.name ?? "Mi empresa"}
        from={rango.desde}
        to={rango.hasta}
        storeIds={storeIds}
        manualContent={<RegistroManual />}
      />
    </div>
  );
}

export default function AdvertisingPage() {
  return (
    <Suspense fallback={<PanelSkeleton variant="kpis" label="inversión publicitaria" />}>
      <AdvertisingPageContent />
    </Suspense>
  );
}

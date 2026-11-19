"use client";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useGeneralMaterials, useScript } from "@/hooks/useCrmContent";
import ContentAdminGate from "./ContentAdminGate";
import { ContentError, ContentLoading } from "./ContentStatus";
import GuionEditor from "./GuionEditor";
import GuionMaterialList from "./GuionMaterialList";
import GuionReads from "./GuionReads";
import GuionSheetsManager from "./GuionSheetsManager";

function GuionBody() {
  const { auth } = useAuth();
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const script = useScript(isAdmin);
  const general = useGeneralMaterials(isAdmin);

  return (
    <div className="space-y-4">
      {script.isLoading && <ContentLoading label="Cargando guion…" />}
      {script.isError && <ContentError error={script.error} onRetry={() => script.refetch()} />}
      {script.data && <GuionEditor key={script.data.version} script={script.data} />}
      <GuionReads enabled={isAdmin} />

      <section aria-labelledby="guion-material" className="space-y-3 rounded-md border bg-card p-4">
        <div>
          <h2 id="guion-material" className="text-base font-semibold">
            Material del negocio
          </h2>
          <p className="text-sm text-muted-foreground">
            Catálogo, métodos de pago y políticas: enlaces que las vendedoras copian al chat desde «Respuestas».
          </p>
        </div>
        {general.isLoading && <ContentLoading />}
        {general.isError && <ContentError error={general.error} onRetry={() => general.refetch()} />}
        {general.data && <GuionMaterialList items={general.data} label="Material del negocio" />}
      </section>

      <GuionSheetsManager />
    </div>
  );
}

export default function GuionView() {
  return (
    <ContentAdminGate>
      <GuionBody />
    </ContentAdminGate>
  );
}

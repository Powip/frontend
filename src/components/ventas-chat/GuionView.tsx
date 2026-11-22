"use client";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useGeneralMaterials, useScript } from "@/hooks/useCrmContent";
import ContentAdminGate from "./ContentAdminGate";
import { ContentError, ContentLoading } from "./ContentStatus";
import GuionEditor from "./GuionEditor";
import GuionMaterialList from "./GuionMaterialList";
import GuionPlaybook from "./GuionPlaybook";
import GuionReads from "./GuionReads";
import GuionSheetsManager from "./GuionSheetsManager";

function GuionBody() {
  const { isAdmin } = useCrmMe();
  const script = useScript(isAdmin);
  const general = useGeneralMaterials(isAdmin);
  const payments = general.data?.filter((m) => m.payment) ?? [];
  const others = general.data?.filter((m) => !m.payment) ?? [];

  return (
    <div className="space-y-4">
      {script.isLoading && <ContentLoading label="Cargando guion…" />}
      {script.isError && <ContentError error={script.error} onRetry={() => script.refetch()} />}
      {script.data && <GuionEditor key={script.data.version} script={script.data} />}
      {script.data && <GuionPlaybook script={script.data} editable={isAdmin} />}
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
        {general.data && (
          <>
            <GuionMaterialList items={others} label="Material del negocio" />
            <div className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-semibold">Métodos de pago</h3>
              <p className="text-xs text-muted-foreground">
                Yape, Plin, cuentas o POWIP Link. Pau los usa para responder «¿cómo pago?».
              </p>
              <GuionMaterialList items={payments} label="Métodos de pago" payment />
            </div>
          </>
        )}
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

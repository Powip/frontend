import FinanzasCobranzaTab from "../_components/FinanzasCobranzaTab";

export default function CobranzaFinanzasPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <FinanzasCobranzaTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Finanzas</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Pagos manuales pendientes de confirmar: Yape directo, Plin, Pago Link, Efectivo y Transferencia.
      </p>
    </div>
  );
}

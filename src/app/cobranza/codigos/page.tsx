import CodigosEntregaTab from "../_components/CodigosEntregaTab";

export default function CobranzaCodigosPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <CodigosEntregaTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Códigos de entrega</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Control de entregas pagadas con Mercado Pago. El código se genera y activa solo cuando el pedido está pagado.
      </p>
    </div>
  );
}

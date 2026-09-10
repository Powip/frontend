import MercadoPagoTab from "../_components/MercadoPagoTab";

export default function CobranzaMercadoPagoPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <MercadoPagoTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Mercado Pago</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Conexión de tu cuenta — cobranza, catálogo y upsell entran automáticamente con split 99.5% / 0.5%.
      </p>
    </div>
  );
}

import GuiasCourierTab from "../_components/GuiasCourierTab";

export default function CobranzaGuiasPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <GuiasCourierTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Guías &amp; Courier</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Agrupa pedidos, asigna courier y regístralos con Shalom. Al registrar la guía nace el link del repartidor y
        arranca el tracking.
      </p>
    </div>
  );
}

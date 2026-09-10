import MapaFlotaTab from "../_components/MapaFlotaTab";

export default function CobranzaFlotaPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <MapaFlotaTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Mapa de flota</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Ubicación en vivo de tus motorizados en ruta — vista privada del negocio.
      </p>
    </div>
  );
}

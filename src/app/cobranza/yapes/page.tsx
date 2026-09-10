import ValidarYapesTab from "../_components/ValidarYapesTab";

export default function CobranzaYapesPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <ValidarYapesTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Validar Yapes</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Comprobantes de Yape directo por verificar — exclusivo del negocio, Powip no interviene.
      </p>
    </div>
  );
}

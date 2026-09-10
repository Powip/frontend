import NotificacionesTab from "../_components/NotificacionesTab";

export default function CobranzaNotificacionesPage() {
  return (
    <div className="space-y-4">
      <PageHeader />
      <NotificacionesTab />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Notificaciones automáticas</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        WhatsApp al cliente en cada cambio de estado del pago y del envío.
      </p>
    </div>
  );
}

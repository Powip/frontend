/**
 * Layout compartido por las pantallas de Cobranza (Guías & Courier, Mapa de
 * flota, Códigos de entrega, Validar Yapes, Finanzas, Notificaciones,
 * Mercado Pago). Mismo contenedor que src/app/operaciones/layout.tsx: sin él,
 * AppContainer no aplica ningún padding lateral al contenido.
 */
export default function CobranzaLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full px-4 py-4 md:px-6 md:py-6 space-y-4">{children}</div>;
}

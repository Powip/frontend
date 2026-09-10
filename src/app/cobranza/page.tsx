import { redirect } from "next/navigation";

// Cobranza vive como sub-ítems propios en el sidebar (Guías & Courier, Mapa
// de flota, Códigos de entrega, Validar Yapes, Finanzas, Notificaciones,
// Mercado Pago) en vez de tabs dentro de una sola página. La raíz redirige
// al primero para que un link directo a /cobranza no caiga en blanco.
export default function CobranzaRootRedirect() {
  redirect("/cobranza/guias");
}

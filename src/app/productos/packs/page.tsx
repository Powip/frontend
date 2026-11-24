import { redirect } from "next/navigation";

// FEAT-32 M4 (spec §3.1): los packs se gestionan en Comercial › Packs y promociones, pestaña Packs.
export default function PacksRedirect() {
  redirect("/packs-promos?tab=packs");
}

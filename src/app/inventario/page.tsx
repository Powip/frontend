import { redirect } from "next/navigation";

// El módulo tiene una ruta por pestaña (mockup vistainv.html). /inventario abre el stock.
export default function InventarioPage() {
  redirect("/inventario/stock");
}

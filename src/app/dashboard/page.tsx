import { redirect } from "next/navigation";

// El dashboard principal es el Panel de Control v5 (FEAT-29). Las vistas viejas
// siguen en src/components/dashboard por si hay que volver atrás.
export default function DashboardPage() {
  redirect("/panel-control");
}

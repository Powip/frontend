import type { Metadata } from "next";
import { DashboardPageContent } from "./_components/dashboard-page-content";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Métricas generales del programa de partners de Powip.",
};

export default function PartnersAdminDashboardPage() {
  return <DashboardPageContent />;
}

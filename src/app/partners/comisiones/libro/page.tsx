import type { Metadata } from "next";
import { FinancialLedgerPageContent } from "./_components/financial-ledger-page-content";

export const metadata: Metadata = {
  title: "Libro de comisiones",
  description: "Movimientos contables auditables. No confirma liquidaciones ni pagos.",
};
export default function Page() {
  return <FinancialLedgerPageContent />;
}

import type { Metadata } from "next";
import { AdminFinancialLedgerPageContent } from "./_components/admin-financial-ledger-page-content";

export const metadata: Metadata = {
  title: "Libro financiero del partner",
  description:
    "Lectura administrativa de movimientos y saldo contable; no confirma liquidaciones ni pagos.",
};

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  return <AdminFinancialLedgerPageContent partnerId={partnerId} />;
}

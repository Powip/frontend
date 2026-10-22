export type CommercialReportOrder = {
  commercialStage?: "LEAD" | "SALE" | null;
};

/** Explicit Leads never enter sales/dispatch aggregates. NULL preserves historical coverage. */
export function isCommercialSale(order: unknown): boolean {
  return (
    order !== null &&
    typeof order === "object" &&
    (order as CommercialReportOrder).commercialStage !== "LEAD"
  );
}

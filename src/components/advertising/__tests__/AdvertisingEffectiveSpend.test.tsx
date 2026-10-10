import { render, screen } from "@testing-library/react";
import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";
import { AdvertisingEffectiveSpend } from "../AdvertisingEffectiveSpend";

const effective = (): EffectiveAdvertisingSpendWire => ({
  scope: "company",
  from: "2026-10-01",
  to: "2026-10-02",
  rows: [],
  totals: [
    {
      currency: "PEN",
      amount: "110.01",
      importedAmount: "100.005",
      fallbackAmount: "0",
      additionalAmount: "10.005",
      coverage: "partial",
      missingAccountDays: 1,
      provisional: false,
    },
  ],
  pendingManualCount: 1,
  representedManualCount: 1,
  excludedManualCount: 1,
  conflictedManualIds: [],
});

describe("canonical advertising consumption", () => {
  it("displays the authoritative total and separates reviewed sources", () => {
    render(
      <AdvertisingEffectiveSpend
        effective={effective()}
        from="2026-10-01"
        to="2026-10-02"
        showLink
      />,
    );
    expect(screen.getByText(/110.01/)).toBeVisible();
    expect(screen.getByText("Importación parcial")).toBeVisible();
    expect(screen.getByText(/1 registro manual por revisar/)).toBeVisible();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/administracion/pauta?from=2026-10-01&to=2026-10-02",
    );
  });
  it("keeps an unknown imported amount distinct from confirmed zero and separate currencies", () => {
    const data = effective();
    data.totals[0].amount = "0";
    data.totals[0].importedAmount = null;
    data.totals.push({ ...data.totals[0], currency: "USD", amount: "35" });
    render(<AdvertisingEffectiveSpend effective={data} from="2026-10-01" to="2026-10-02" />);
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);
    expect(screen.getByText("PEN")).toBeVisible();
    expect(screen.getByText("USD")).toBeVisible();
    expect(screen.queryByText(/145.01/)).not.toBeInTheDocument();
  });
  it("hides data when the response belongs to another period or contains numeric coercion", () => {
    const { rerender } = render(
      <AdvertisingEffectiveSpend effective={effective()} from="2026-10-03" to="2026-10-04" />,
    );
    expect(screen.queryByText(/110.01/)).not.toBeInTheDocument();
    const data = effective();
    data.totals[0].amount = 0 as unknown as string;
    rerender(<AdvertisingEffectiveSpend effective={data} from="2026-10-01" to="2026-10-02" />);
    expect(screen.getByText(/No pudimos leer/)).toBeVisible();
  });
});

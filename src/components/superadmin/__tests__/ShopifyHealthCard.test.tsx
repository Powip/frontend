/**
 * Tests: ShopifyHealthContent (components/superadmin/ShopifyHealthCard.tsx)
 * 1. Todo en cero → "Todo OK" y sin tablas.
 * 2. Con tiendas y pedidos con problemas → contadores, filas y etiquetas en español.
 * 3. DLQ sin dato → "DLQ: sin dato".
 */
import { render, screen, within } from "@testing-library/react";
import { ShopifyHealthContent } from "../ShopifyHealthCard";
import type { ShopifyHealthReport } from "@/hooks/useShopifyHealth";

const empty: ShopifyHealthReport = {
  generatedAt: "2026-10-09T15:00:00.000Z",
  lastAuditAt: "2026-10-09T14:00:00.000Z",
  summary: { ok: 16, error: 0, token_revocado: 0, plan_impago: 0, desinstalada: 0, dlq: 0, retrying: 0, openIssues: 0 },
  shops: [],
  issues: [],
};

describe("ShopifyHealthContent", () => {
  it("todo en cero muestra Todo OK y ninguna tabla", () => {
    render(<ShopifyHealthContent report={empty} />);
    expect(screen.getByText("Todo OK")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra tiendas y pedidos con problemas", () => {
    render(
      <ShopifyHealthContent
        report={{
          ...empty,
          summary: { ...empty.summary, token_revocado: 1, openIssues: 1, dlq: 2 },
          shops: [
            {
              shopUrl: "qnexpe-z9.myshopify.com",
              companyId: "c1",
              healthStatus: "token_revocado",
              lastSuccessAt: null,
              lastError: "HTTP 401",
              lastErrorAt: "2026-10-09T10:00:00.000Z",
              needsReauthorization: false,
            },
          ],
          issues: [
            {
              shopUrl: "zgkik1-yi.myshopify.com",
              orderName: "#8455",
              orderNumber: "ORD-150448",
              type: "pago_distinto",
              detail: "Shopify: cobrado S/100.00 · Powip: registrado S/0.00",
              detectedAt: "2026-10-09T13:00:00.000Z",
            },
          ],
        }}
      />,
    );
    expect(screen.queryByText("Todo OK")).not.toBeInTheDocument();
    expect(screen.getByText("DLQ: 2")).toBeInTheDocument();
    const [shopsTable, issuesTable] = screen.getAllByRole("table");
    expect(within(shopsTable).getByText("qnexpe-z9")).toBeInTheDocument();
    expect(within(shopsTable).getByText("Token revocado")).toBeInTheDocument();
    expect(within(shopsTable).getByText("HTTP 401")).toBeInTheDocument();
    expect(within(issuesTable).getByText("#8455")).toBeInTheDocument();
    expect(within(issuesTable).getByText("ORD-150448")).toBeInTheDocument();
    expect(within(issuesTable).getByText("Pago distinto")).toBeInTheDocument();
  });

  it("tienda ok con permiso faltante muestra el aviso", () => {
    render(
      <ShopifyHealthContent
        report={{
          ...empty,
          shops: [
            {
              shopUrl: "a.myshopify.com",
              companyId: "c1",
              healthStatus: "ok",
              lastSuccessAt: "2026-10-09T14:55:00.000Z",
              lastError: null,
              lastErrorAt: null,
              needsReauthorization: true,
            },
          ],
        }}
      />,
    );
    expect(screen.queryByText("Todo OK")).not.toBeInTheDocument();
    expect(screen.getByText("OK · falta un permiso")).toBeInTheDocument();
  });

  it("DLQ sin dato", () => {
    render(<ShopifyHealthContent report={{ ...empty, summary: { ...empty.summary, dlq: null, retrying: null } }} />);
    expect(screen.getByText("DLQ: sin dato")).toBeInTheDocument();
  });
});

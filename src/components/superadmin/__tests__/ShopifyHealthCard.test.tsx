/**
 * Tests: ShopifyHealthContent (components/superadmin/ShopifyHealthCard.tsx)
 * 1. Todo en cero → "Todo OK" y sin tablas.
 * 2. Con tiendas y pedidos con problemas → contadores, filas y etiquetas en español.
 * 3. DLQ sin dato → "DLQ: sin dato".
 * 4. Sin dato de la DLQ no hay "Todo OK".
 * 5. Pedidos en reintento → "Reintentando: N".
 * 6. Último chequeo de más de 2 h → "atrasado".
 * 7. Tiendas que fallaron en el último chequeo.
 * 8. Problemas iguales sin número de pedido no repiten la key.
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

  it("sin dato de la DLQ no dice Todo OK", () => {
    render(<ShopifyHealthContent report={{ ...empty, summary: { ...empty.summary, dlq: null, retrying: null } }} />);
    expect(screen.queryByText("Todo OK")).not.toBeInTheDocument();
    expect(screen.getByText("DLQ: sin dato")).toBeInTheDocument();
  });

  it("muestra los pedidos en reintento", () => {
    render(<ShopifyHealthContent report={{ ...empty, summary: { ...empty.summary, retrying: 3 } }} />);
    expect(screen.getByText("Reintentando: 3")).toBeInTheDocument();
    expect(screen.getByText("Todo OK")).toBeInTheDocument();
  });

  it("chequeo de más de 2 h → atrasado y sin Todo OK", () => {
    render(<ShopifyHealthContent report={{ ...empty, lastAuditAt: "2026-10-09T12:30:00.000Z" }} />);
    expect(screen.queryByText("Todo OK")).not.toBeInTheDocument();
    expect(screen.getByText(/atrasado/)).toBeInTheDocument();
  });

  it("tiendas que fallaron en el último chequeo", () => {
    render(<ShopifyHealthContent report={{ ...empty, lastAuditFailedShops: 2 }} />);
    expect(screen.queryByText("Todo OK")).not.toBeInTheDocument();
    expect(screen.getByText(/2 tiendas fallaron/)).toBeInTheDocument();
  });

  it("dos problemas iguales sin número de pedido no repiten la key", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const issue = {
      shopUrl: "a.myshopify.com",
      orderName: null,
      orderNumber: null,
      type: "falta_en_powip",
      detail: "d",
      detectedAt: "2026-10-09T13:00:00.000Z",
    };
    render(
      <ShopifyHealthContent
        report={{
          ...empty,
          summary: { ...empty.summary, openIssues: 2 },
          issues: [
            { ...issue, id: "u1" },
            { ...issue, id: "u2" },
          ],
        }}
      />,
    );
    expect(spy.mock.calls.some((c) => String(c[0]).includes("same key"))).toBe(false);
    spy.mockRestore();
  });
});

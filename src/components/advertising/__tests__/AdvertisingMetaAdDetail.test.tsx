import { fireEvent, render, screen, within } from "@testing-library/react";
import { useAdvertisingMetaAd } from "@/hooks/useAdvertisingMeta";
import type { MetaAdDetailResponse } from "@/services/advertisingMetaService";
import { AdvertisingMetaAdDetail } from "../AdvertisingMetaAdDetail";

jest.mock("@/hooks/useAdvertisingMeta", () => ({ useAdvertisingMetaAd: jest.fn() }));
const read = jest.mocked(useAdvertisingMetaAd);
function data(): MetaAdDetailResponse {
  const coverage = {
    status: "partial" as const,
    coveredDays: 1,
    totalDays: 2,
    provisionalDays: 1,
    lastSuccessfulAt: null,
    lastErrorCode: null,
  };
  return {
    source: "meta",
    from: "2026-10-01",
    to: "2026-10-02",
    attribution: { windows: ["7d_click", "1d_view"], reportTime: "impression", source: "meta" },
    capabilities: {
      canRead: true,
      canSync: false,
      canManageAds: false,
      reason: "ADS_MANAGEMENT_NOT_GRANTED",
    },
    account: {
      id: "account",
      externalId: "123",
      name: "Cuenta",
      currency: "PEN",
      timeZone: "America/Lima",
      enabled: true,
      catalogUpdatedAt: null,
      manageUrl: "https://unsafe.example.test",
      coverage,
      historyImport: null,
    },
    row: {
      id: "456",
      name: "Anuncio",
      accountId: "account",
      campaignId: "789",
      adsetId: "987",
      level: "ad",
      status: null,
      effectiveStatus: null,
      objective: null,
      currency: "PEN",
      timeZone: "America/Lima",
      insights: {
        spend: "0",
        impressions: "0",
        clicks: null,
        actions: [
          { actionType: "purchase", value: "1" },
          { actionType: "omni_purchase", value: "1" },
          { actionType: "unmapped_technical_event", value: "99" },
        ],
        coverage,
      },
    },
    daily: [
      {
        date: "2026-10-01",
        spend: null,
        impressions: null,
        clicks: null,
        actions: null,
        provisional: false,
        coverage: "pending",
      },
      {
        date: "2026-10-02",
        spend: "0",
        impressions: "0",
        clicks: "0",
        actions: [],
        provisional: true,
        coverage: "complete",
      },
    ],
  };
}

function mockDetail(detail: MetaAdDetailResponse) {
  read.mockReturnValue({ data: detail, isError: false } as unknown as ReturnType<
    typeof useAdvertisingMetaAd
  >);
}

it("prioritizes conversion metrics and keeps human secondary information collapsed", () => {
  const detail = data();
  mockDetail(detail);
  render(
    <AdvertisingMetaAdDetail
      token="token"
      actorId="actor"
      companyId="company"
      from={detail.from}
      to={detail.to}
      selected={detail.row}
      onClose={jest.fn()}
    />,
  );
  expect(read).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: "account",
      adId: "456",
      actorId: "actor",
      companyId: "company",
    }),
  );
  const metrics = within(screen.getByLabelText("Resultados del anuncio"));
  expect(metrics.getByText("Costo por conversación")).toBeVisible();
  expect(metrics.getByText("Conversaciones")).toBeVisible();
  expect(metrics.getAllByText("No disponible")).toHaveLength(2);
  expect(metrics.getByText(/0\.00/)).toBeVisible();
  expect(screen.getByText("Impresiones")).not.toBeVisible();
  expect(screen.getByText("Compras")).not.toBeVisible();
  expect(screen.queryByText("unmapped_technical_event")).not.toBeInTheDocument();
  expect(screen.queryByText(/ID 456|Campaña 789|Conjunto 987/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Pausar anuncio" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cambiar presupuesto" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Abrir Meta Ads Manager/ })).toHaveAttribute(
    "href",
    "https://adsmanager.facebook.com/adsmanager/manage/ads?act=123",
  );
  expect(screen.getByText(/Atribución de 7 días por clic y 1 día por vista/)).toBeVisible();
  fireEvent.click(screen.getByText("Más información"));
  expect(screen.getByText("Compras")).toBeVisible();
  expect(screen.getByText("Compras omnicanal")).toBeVisible();
  expect(screen.getByText(/no son pedidos entregados ni cobros de Powip/)).toBeVisible();
  expect(screen.getByText("Último estado registrado")).toBeVisible();
  expect(screen.queryByText("omni_purchase")).not.toBeInTheDocument();
});

it("keeps the selected web conversion and its daily cost separate from message and general purchase events", () => {
  const detail = data();
  detail.row.insights.resultMetrics = {
    messages: { count: "20", costPerResult: "3.25", status: "complete" },
    webPurchases: { count: "2", costPerResult: "32.50", status: "complete" },
  };
  detail.daily[0].resultMetrics = {
    messages: { count: "20", costPerResult: "3.25", status: "complete" },
    webPurchases: { count: "2", costPerResult: "32.50", status: "complete" },
  };
  detail.daily[1].resultMetrics = {
    messages: { count: "0", costPerResult: null, status: "complete" },
    webPurchases: { count: "0", costPerResult: null, status: "complete" },
  };
  mockDetail(detail);
  render(
    <AdvertisingMetaAdDetail
      token="token"
      actorId="actor"
      companyId="company"
      from={detail.from}
      to={detail.to}
      selected={detail.row}
      resultType="webPurchases"
      onClose={jest.fn()}
    />,
  );
  const metrics = within(screen.getByLabelText("Resultados del anuncio"));
  expect(metrics.getByText("Costo por compra")).toBeVisible();
  expect(metrics.getByText(/32\.50/)).toBeVisible();
  expect(metrics.getByText("2")).toBeVisible();
  expect(metrics.getByText(/0\.00/)).toBeVisible();
  expect(screen.getAllByText("Completo")[0]).toBeVisible();
  expect(screen.queryByText(/3\.25/)).not.toBeInTheDocument();
  expect(screen.getByText(/Compras en el sitio web/)).toBeVisible();
  const table = screen.getByRole("table", { name: "Resultados diarios del anuncio" });
  expect(within(table).getByRole("columnheader", { name: "Costo por compra" })).toBeVisible();
  expect(within(table).getByRole("columnheader", { name: "Compras por web" })).toBeVisible();
  expect(within(table).getByText("—")).toBeVisible();
  expect(within(table).getByText("Sin resultados")).toBeVisible();
  expect(
    within(table).queryByRole("columnheader", { name: "Impresiones" }),
  ).not.toBeInTheDocument();
  const mobile = within(screen.getByRole("list", { name: "Resultados diarios en móvil" }));
  expect(mobile.getByText(/32\.50/)).toBeVisible();
  expect(mobile.getByText("—")).toBeVisible();
  expect(mobile.getByText("Sin resultados")).toBeVisible();
  expect(
    screen
      .getByText("Detalle diario")
      .compareDocumentPosition(screen.getByText("Más información")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(read).toHaveBeenLastCalledWith(
    expect.objectContaining({ accountId: "account", adId: "456" }),
  );
});

it("shows a known partial count without presenting a complete cost or a guessed reason", () => {
  const detail = data();
  detail.row.insights.resultMetrics = {
    messages: { count: "2", costPerResult: null, status: "partial" },
    webPurchases: { count: null, costPerResult: null, status: "unknown" },
  };
  detail.daily[0].resultMetrics = {
    messages: { count: "2", costPerResult: null, status: "partial" },
    webPurchases: { count: null, costPerResult: null, status: "unknown" },
  };
  mockDetail(detail);
  render(
    <AdvertisingMetaAdDetail
      token="token"
      actorId="actor"
      companyId="company"
      from={detail.from}
      to={detail.to}
      selected={detail.row}
      onClose={jest.fn()}
    />,
  );
  const metrics = within(screen.getByLabelText("Resultados del anuncio"));
  expect(metrics.getByText("2")).toBeVisible();
  expect(metrics.getByText("No disponible")).toBeVisible();
  const daily = within(screen.getByRole("table", { name: "Resultados diarios del anuncio" }));
  expect(daily.getByText("Parcial")).toBeVisible();
  expect(daily.getByText("2")).toBeVisible();
  expect(screen.queryByText("Meta no reportó conversaciones")).not.toBeInTheDocument();
});

it("distinguishes confirmed zero results from unknown conversion data", () => {
  const detail = data();
  detail.row.insights.resultMetrics = {
    messages: { count: "0", costPerResult: null, status: "complete" },
    webPurchases: { count: null, costPerResult: null, status: "unknown" },
  };
  mockDetail(detail);
  const props = {
    token: "token",
    actorId: "actor",
    companyId: "company",
    from: detail.from,
    to: detail.to,
    selected: detail.row,
    onClose: jest.fn(),
  };
  const { rerender } = render(<AdvertisingMetaAdDetail {...props} />);
  const metrics = within(screen.getByLabelText("Resultados del anuncio"));
  expect(metrics.getByText("—")).toBeVisible();
  expect(metrics.getByText("0")).toBeVisible();
  expect(screen.getByText("Sin resultados")).toBeVisible();
  rerender(<AdvertisingMetaAdDetail {...props} resultType="webPurchases" />);
  expect(metrics.getAllByText("No disponible")).toHaveLength(2);
  expect(screen.queryByText("Sin resultados")).not.toBeInTheDocument();
  expect(metrics.queryByText("—")).not.toBeInTheDocument();
});

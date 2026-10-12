import { render, screen, within } from "@testing-library/react";
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

it("shows Meta events independently, preserves daily unknown/zero and keeps mutations disabled", () => {
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
  expect(screen.getByText("Compras")).toBeVisible();
  expect(screen.getByText("Último estado registrado:")).toBeVisible();
  expect(screen.getByText("Compras omnicanal")).toBeVisible();
  expect(screen.getByText(/no son pedidos entregados ni cobros de Powip/)).toBeVisible();
  expect(screen.getAllByText("No disponible")).toHaveLength(10);
  expect(screen.getByText("Pendientes")).toBeVisible();
  expect(screen.getByText("Provisionales")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pausar anuncio" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cambiar presupuesto" })).toBeDisabled();
  expect(screen.getByRole("link", { name: /Abrir Meta Ads Manager/ })).toHaveAttribute(
    "href",
    "https://adsmanager.facebook.com/adsmanager/manage/ads?act=123",
  );
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
  expect(screen.getAllByText(/32\.50/)).toHaveLength(2);
  expect(screen.queryByText(/3\.25/)).not.toBeInTheDocument();
  expect(screen.getByText("Compras en el sitio web")).toBeVisible();
  const table = screen.getByRole("table", { name: "Resultados diarios del anuncio" });
  expect(within(table).getByRole("columnheader", { name: "Compras por web" })).toBeVisible();
  expect(within(table).getByText("—")).toBeVisible();
  expect(read).toHaveBeenLastCalledWith(
    expect.objectContaining({ accountId: "account", adId: "456" }),
  );
});

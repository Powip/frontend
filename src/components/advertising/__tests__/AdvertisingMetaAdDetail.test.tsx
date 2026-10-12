import { render, screen } from "@testing-library/react";
import { useAdvertisingMetaAd } from "@/hooks/useAdvertisingMeta";
import type { MetaAdDetailResponse } from "@/services/advertisingMetaService";
import { AdvertisingMetaAdDetail } from "../AdvertisingMetaAdDetail";

jest.mock("@/hooks/useAdvertisingMeta", () => ({ useAdvertisingMetaAd: jest.fn() }));
const read = jest.mocked(useAdvertisingMetaAd);
it("shows Meta events independently, preserves daily unknown/zero and keeps mutations disabled", () => {
  const coverage = {
    status: "partial" as const,
    coveredDays: 1,
    totalDays: 2,
    provisionalDays: 1,
    lastSuccessfulAt: null,
    lastErrorCode: null,
  };
  const detail: MetaAdDetailResponse = {
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
  read.mockReturnValue({ data: detail, isError: false } as unknown as ReturnType<
    typeof useAdvertisingMetaAd
  >);
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
  expect(screen.getAllByText("No disponible")).toHaveLength(4);
  expect(screen.getByText("Pendientes")).toBeVisible();
  expect(screen.getByText("Provisionales")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pausar anuncio" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cambiar presupuesto" })).toBeDisabled();
  expect(screen.getByRole("link", { name: /Abrir Meta Ads Manager/ })).toHaveAttribute(
    "href",
    "https://adsmanager.facebook.com/adsmanager/manage/ads?act=123",
  );
});

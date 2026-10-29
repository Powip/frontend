import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AdvertisingOrderDetail,
  AdvertisingOrdersResponse,
} from "@/services/advertisingOrdersService";
import {
  reviewAdvertisingOrderAttribution,
  reviewAdvertisingOrderFinance,
} from "@/services/advertisingOrdersService";
import { AdvertisingOrdersPanel } from "../AdvertisingOrdersPanel";

const mockSet = jest.fn();
const mockInvalidate = jest.fn().mockResolvedValue(undefined);
let mockCanManage = true;
const mockRefetch = jest.fn().mockResolvedValue({ data: undefined });
const row = {
  id: "order",
  orderNumber: "ORD-1",
  status: "ENTREGADO",
  storeId: "store",
  createdAt: "2026-10-01T12:00:00Z",
  deliveredAt: null,
  paidAt: null,
  currency: "PEN",
  revenue: "100.00",
  paidRevenue: "0.00",
  zone: null,
  costs: {
    version: 0,
    productCost: null,
    shippingCost: null,
    channelFee: null,
    paymentFee: null,
    otherCost: null,
    complete: false,
    missing: ["productCost", "shippingCost", "channelFee", "paymentFee", "otherCost"],
    total: null,
    contributionBeforeAds: null,
  },
  attribution: {
    version: 0,
    adId: null,
    accountId: null,
    adName: null,
    source: "unattributed",
    originalReferencePresent: true,
    currency: null,
    timeZone: null,
  },
} as AdvertisingOrderDetail["row"];
const detail = () =>
  ({
    source: "powip-orders",
    row,
    capabilities: { reconcile: mockCanManage },
    attributionHistory: [],
    financeHistory: [],
  }) as AdvertisingOrderDetail;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: mockSet, invalidateQueries: mockInvalidate }),
}));
jest.mock("@/hooks/useAdvertisingOrders", () => ({
  useAdvertisingOrders: () => ({
    data: {
      source: "powip-orders",
      rows: [row],
      total: 1,
      page: 1,
      limit: 50,
      capabilities: { reconcile: mockCanManage },
      quality: { unattributedCount: 1, incompleteCostCount: 1 },
    } as AdvertisingOrdersResponse,
    isPending: false,
    isFetching: false,
    error: null,
    refetch: mockRefetch,
  }),
  useAdvertisingOrderDetail: (_identity: unknown, id: string | null) => ({
    data: id ? detail() : undefined,
    isPending: false,
    isFetching: false,
    error: null,
    refetch: mockRefetch,
  }),
}));
jest.mock("@/hooks/useAdvertisingMeta", () => ({
  useAdvertisingMetaCatalog: () => ({
    data: { accounts: [], rows: [], pagination: { total: 0, hasMore: false } },
    error: null,
    isFetching: false,
    isAccessDenied: false,
  }),
}));
jest.mock("@/services/advertisingOrdersService", () => ({
  reviewAdvertisingOrderAttribution: jest.fn(),
  reviewAdvertisingOrderFinance: jest.fn(),
}));
const props = {
  token: "test-token",
  companyId: "company",
  actorId: "actor",
  from: "2026-10-01",
  to: "2026-10-10",
};
beforeEach(() => {
  mockCanManage = true;
  jest.clearAllMocks();
  jest.mocked(reviewAdvertisingOrderFinance).mockImplementation(async () => detail());
  jest.mocked(reviewAdvertisingOrderAttribution).mockImplementation(async () => detail());
});

it("offers no mutation controls for read-only finance access", async () => {
  mockCanManage = false;
  const user = userEvent.setup();
  render(<AdvertisingOrdersPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Ver pedido" }));
  expect(screen.queryByRole("button", { name: "Guardar atribución" })).not.toBeInTheDocument();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Costos" }));
  expect(screen.queryByRole("button", { name: "Guardar costos" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Productos")).toBeDisabled();
});
it("sends unknown costs as null and an explicit zero as zero", async () => {
  const user = userEvent.setup();
  render(<AdvertisingOrdersPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Ver pedido" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Costos" }));
  await user.type(screen.getByLabelText("Productos"), "0");
  await user.type(screen.getByLabelText("Motivo de la revisión"), "Costo de producto confirmado");
  await user.click(screen.getByRole("button", { name: "Guardar costos" }));
  expect(reviewAdvertisingOrderFinance).toHaveBeenCalledWith("test-token", "company", "order", {
    expectedVersion: 0,
    currency: "PEN",
    productCost: "0",
    shippingCost: null,
    channelFee: null,
    paymentFee: null,
    otherCost: null,
    reason: "Costo de producto confirmado",
  });
  expect(await screen.findByText("Costos guardados.")).toBeInTheDocument();
  expect(mockInvalidate).toHaveBeenCalledWith({
    queryKey: ["ads-v22", "actor", "company"],
  });
});
it("blocks a stale review until the user reloads it", async () => {
  jest
    .mocked(reviewAdvertisingOrderFinance)
    .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });
  const user = userEvent.setup();
  render(<AdvertisingOrdersPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Ver pedido" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Costos" }));
  await user.type(screen.getByLabelText("Motivo de la revisión"), "Costos revisados con evidencia");
  await user.click(screen.getByRole("button", { name: "Guardar costos" }));
  expect(await screen.findByRole("button", { name: "Recargar pedido" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar costos" })).toBeDisabled();
  expect(reviewAdvertisingOrderFinance).toHaveBeenCalledTimes(1);
});
it("blocks negative or overly precise amounts before writing", async () => {
  const user = userEvent.setup();
  render(<AdvertisingOrdersPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Ver pedido" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Costos" }));
  await user.type(screen.getByLabelText("Productos"), "-1.001");
  await user.type(screen.getByLabelText("Motivo de la revisión"), "Costos revisados con evidencia");
  expect(screen.getByRole("button", { name: "Guardar costos" })).toBeDisabled();
  expect(reviewAdvertisingOrderFinance).not.toHaveBeenCalled();
});

/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Ventas › pasar pedidos a «En envío» con un adelanto sin aprobar.
 *
 * Un Yape registrado pero sin aprobar (pago PENDING) no resta del cobro: si el pedido pasa a
 * «En envío», el courier cobrará el total. La página avisa antes, tanto en el cambio de estado
 * de una fila como en el cambio masivo, y solo ejecuta el cambio si se confirma.
 */

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: jest.requireMock("axios") }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scopeKey: "company-1:business:store-1", storeIds: ["store-1"] }) }));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/ventas",
}));
jest.mock("@/services/atencionClienteService", () => ({
  enviarPedidoALima: jest.fn(),
  reassignSeller: jest.fn(),
}));
jest.mock("@/hooks/useBusinessOrders", () => ({ useBusinessOrders: jest.fn() }));
jest.mock("@/hooks/useBusinessSalesPage", () => ({ useBusinessSalesPage: jest.fn() }));
jest.mock("@/services/businessSalesService", () => ({ getBusinessSalesExport: jest.fn() }));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({
  useBusinessOrdersCount: () => ({ count: 0, loading: false, error: false, retry: jest.fn(), refetch: jest.fn() }),
}));
jest.mock("@/lib/peruDate", () => ({ ...jest.requireActual("@/lib/peruDate"), todayInPeru: () => "2026-11-13" }));
jest.mock("@/components/modals/CustomerServiceModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ImportSalesModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CreateGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));

/**
 * Radix Select → <select> nativo (Radix no se puede manejar en jsdom). Recorre los hijos en busca
 * de los SelectItem (cualquier elemento con `value` de texto) y los vuelve <option>.
 */
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const collect = (node: unknown, out: string[]) => {
    React.Children.forEach(node, (child: unknown) => {
      if (!React.isValidElement(child)) return;
      const props = (child as { props: { value?: unknown; children?: unknown } }).props;
      if (typeof props.value === "string") out.push(props.value);
      else if (props.children) collect(props.children, out);
    });
  };
  const Select = ({ value, onValueChange, disabled, children }: {
    value?: string; onValueChange?: (v: string) => void; disabled?: boolean; children?: React.ReactNode;
  }) => {
    const values: string[] = [];
    collect(children, values);
    return (
      <select value={value ?? ""} disabled={disabled} onChange={(e) => onValueChange?.(e.target.value)}>
        {!value && <option value="" />}
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  };
  const Nothing = () => null;
  return {
    __esModule: true, Select, SelectContent: Nothing, SelectItem: Nothing, SelectTrigger: Nothing,
    SelectValue: Nothing, SelectSeparator: Nothing, SelectGroup: Nothing, SelectLabel: Nothing,
    SelectScrollUpButton: Nothing, SelectScrollDownButton: Nothing,
  };
});

import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessSalesPage } from "@/hooks/useBusinessSalesPage";
import type { OrderHeader } from "@/interfaces/IOrder";
import VentasPage from "../page";

const order = (status: string, payments: unknown[]) => ({
  id: "o-1",
  orderNumber: "ORD-001",
  customer: { id: "c-1", fullName: "Cliente 1", phoneNumber: "999111222" },
  deliveryType: "DOMICILIO",
  courier: "Shalom",
  grandTotal: "179.00",
  status,
  salesRegion: "PROVINCIA",
  items: [],
  payments,
  created_at: "2026-11-12T15:00:00.000Z",
  updated_at: "2026-11-12T15:00:00.000Z",
}) as unknown as OrderHeader;

const YAPE_PENDIENTE = { id: "p-1", amount: "20.00", status: "PENDING", paymentMethod: "YAPE" };

function renderWith(sale: OrderHeader) {
  jest.mocked(useBusinessOrders).mockReturnValue({
    orders: [sale], loading: false, error: false, retry: jest.fn(), refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrders>);
  jest.mocked(useBusinessSalesPage).mockReturnValue({
    data: {
      data: [sale], total: 1, page: 1, totalPages: 1,
      counts: { pendientes: 1, anuladas: 0, todas: 1, pendientesAntiguos: 0 },
      kpis: { pendientes: 1, anuladas: 0, amounts: [] },
      metadata: { products: [] },
    },
    isFetching: false, isError: false, isDebouncing: false, refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessSalesPage>);
  return render(<VentasPage />);
}

const optionValues = (select: HTMLElement) => [...(select as HTMLSelectElement).options].map((o) => o.value);
const rowOf = async () => (await screen.findByText("ORD-001")).closest("tr") as HTMLElement;
/** Selector de estado de la fila: el único <select> dentro de la fila que ofrece «En envío». */
const rowStatusSelect = async () =>
  within(await rowOf()).getAllByRole("combobox").find((el) => optionValues(el).includes("EN_ENVIO")) as HTMLElement;
/** Selector del cambio masivo: está fuera de la tabla y ofrece «En envío». */
const bulkStatusSelect = () =>
  screen.getAllByRole("combobox").find((el) => !el.closest("tr") && optionValues(el).includes("EN_ENVIO")) as HTMLElement;
const patchCalls = () => jest.mocked(axios.patch).mock.calls;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(axios.patch).mockResolvedValue({ data: {} });
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
});

describe("VentasPage — adelanto sin aprobar al pasar a «En envío»", () => {
  it("cambio de estado de una fila: avisa y NO cambia el estado hasta confirmar", async () => {
    renderWith(order("PREPARADO", [YAPE_PENDIENTE]));

    fireEvent.change(await rowStatusSelect(), { target: { value: "EN_ENVIO" } });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Si lo pasas a «En envío»");
    expect(dialog).toHaveTextContent("ORD-001");
    expect(dialog).toHaveTextContent("adelanto S/ 20.00");
    expect(dialog).toHaveTextContent("cobrará S/ 179.00");
    expect(patchCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Pasar a En envío igual/ }));

    await waitFor(() => expect(patchCalls().length).toBeGreaterThan(0));
    expect(String(patchCalls()[0][0])).toContain("o-1");
    expect(patchCalls()[0][1]).toMatchObject({ status: "EN_ENVIO" });
  });

  it("cancelar el aviso deja el pedido como estaba", async () => {
    renderWith(order("PREPARADO", [YAPE_PENDIENTE]));
    fireEvent.change(await rowStatusSelect(), { target: { value: "EN_ENVIO" } });

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(patchCalls()).toHaveLength(0);
  });

  it("cambio masivo: avisa con los pedidos afectados y solo cambia al confirmar", async () => {
    renderWith(order("PREPARADO", [YAPE_PENDIENTE]));
    fireEvent.click(within(await rowOf()).getByRole("checkbox"));

    await act(async () => { fireEvent.change(bulkStatusSelect(), { target: { value: "EN_ENVIO" } }); });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Si lo pasas a «En envío»");
    expect(dialog).toHaveTextContent("ORD-001");
    expect(patchCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Pasar a En envío igual/ }));

    await waitFor(() => expect(patchCalls().some(([url]) => String(url).includes("bulk-status"))).toBe(true));
  });

  it("sin adelanto pendiente el cambio de estado se hace directo, sin aviso", async () => {
    renderWith(order("PREPARADO", [{ ...YAPE_PENDIENTE, status: "PAID" }]));

    fireEvent.change(await rowStatusSelect(), { target: { value: "EN_ENVIO" } });

    await waitFor(() => expect(patchCalls().length).toBeGreaterThan(0));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("un estado que no entrega al courier (Llamado) no avisa aunque haya adelanto pendiente", async () => {
    renderWith(order("PREPARADO", [YAPE_PENDIENTE]));
    const select = within(await rowOf()).getAllByRole("combobox").find((el) => optionValues(el).includes("LLAMADO")) as HTMLElement;

    fireEvent.change(select, { target: { value: "LLAMADO" } });

    await waitFor(() => expect(patchCalls().length).toBeGreaterThan(0));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

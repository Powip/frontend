/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: RegistrarVentaPage en modo edición, llegando desde la revisión de
 * "Generar guía" de Por Despachar (`?orderId=…&returnTo=…`) para cambiar el
 * tipo de entrega de un pedido configurado como retiro en tienda.
 *
 * Comportamiento verificado:
 * 1. Se muestra el tipo de entrega actual y, al pasar a DOMICILIO, el form
 *    exige "Método de envío" (validación existente) antes de habilitar
 *    "Actualizar venta".
 * 2. Guardado correcto: un único PUT /order-header/:id con el nuevo
 *    deliveryType y luego `router.replace(returnTo + "&updated=<id>")` (sin
 *    abrir el recibo). Mientras guarda muestra "Procesando..." y no permite
 *    un segundo envío.
 * 3. Guardado fallido: error claro con el mensaje del backend, no se
 *    navega, no hay toast de éxito y lo editado sigue para reintentar.
 * 4. Un `returnTo` externo se ignora (no hay open redirect).
 * 5. "Volver" sin guardar apunta al `returnTo` SIN `updated`: Por Despachar
 *    restaura la selección pero no reabre la revisión ni anuncia cambios.
 *
 * Mocks: mismo set que page.test.tsx (axiosAuth, AuthContext, Select nativo,
 * ProductSearchMatrix/CartLines/SuggestionsPanel, recibo), con
 * `useSearchParams`/`useRouter` configurables por test.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/registrar-venta",
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(),
  createClient: jest.fn(),
  updateClient: jest.fn(),
}));

jest.mock("@/services/promos.service", () => ({
  listVolumePromos: jest.fn().mockResolvedValue([]),
  createVolumePromo: jest.fn(),
  updatePromo: jest.fn(),
  deletePromo: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const React = require("react");

  function extractText(node: unknown): string {
    if (node === null || node === undefined) return "";
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (typeof node === "boolean") return "";
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (typeof node === "object" && node !== null && "props" in node) {
      const el = node as { props: { children?: unknown } };
      return extractText(el.props.children);
    }
    return "";
  }

  const Select = ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
    disabled?: boolean;
  }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(
      children,
      (child: React.ReactElement<{ children?: React.ReactNode }>) => {
        if (!child || !child.props) return;
        if (child.props.children) {
          React.Children.forEach(
            child.props.children,
            (
              item: React.ReactElement<{
                value?: string;
                children?: React.ReactNode;
              }>,
            ) => {
              if (item && item.props && item.props.value !== undefined) {
                options.push({
                  value: item.props.value,
                  label: extractText(item.props.children),
                });
              }
            },
          );
        }
      },
    );
    return (
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const Pass = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  );

  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue,
  };
});

jest.mock("@/components/modals/orderReceiptModal", () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div>Recibo abierto</div> : null,
}));

jest.mock("@/components/registrar-venta/ProductSearchMatrix", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/registrar-venta/CartLines", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({
  __esModule: true,
  default: () => null,
}));

// ── Imports bajo prueba (después de los mocks) ──────────────────────────────

import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import RegistrarVentaPage from "../page";

const mockedAxiosAuth = axiosAuth as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  put: jest.Mock;
};
const mockToast = toast as jest.Mocked<typeof toast>;
const mockUseAuth = jest.mocked(useAuth);

// `crypto.randomUUID` no existe en este jsdom y la precarga del carrito lo
// usa (mismo work-around que page.test.tsx).
type PatchTarget = { randomUUID?: () => string };
let patchedCryptoTarget: PatchTarget | null = null;
beforeAll(() => {
  const cryptoObj = globalThis.crypto as (Crypto & PatchTarget) | undefined;
  if (!cryptoObj) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { randomUUID: () => "test-uuid" },
    });
    patchedCryptoTarget = globalThis.crypto as unknown as PatchTarget;
    return;
  }
  if (typeof cryptoObj.randomUUID !== "function") {
    Object.defineProperty(cryptoObj, "randomUUID", {
      configurable: true,
      writable: true,
      value: () => "test-uuid",
    });
    patchedCryptoTarget = cryptoObj;
  }
});
afterAll(() => {
  if (patchedCryptoTarget) {
    Reflect.deleteProperty(patchedCryptoTarget, "randomUUID");
    patchedCryptoTarget = null;
  }
});

const ORDER_ID = "order-1";
const RETURN_TO = `/operaciones/pedidos?tab=despachar&sel=${ORDER_ID},order-2&day=2026-10-05`;

const ORDER = {
  id: ORDER_ID,
  orderNumber: "ORD-0001",
  orderType: "VENTA",
  status: "PREPARADO",
  salesChannel: "WHATSAPP",
  closingChannel: "WHATSAPP",
  deliveryType: "RETIRO_TIENDA",
  salesRegion: "LIMA",
  courier: null,
  notes: "",
  shippingTotal: 0,
  taxMode: "AUTOMATICO",
  callStatus: null,
  callbackAt: null,
  customer: {
    id: "client-1",
    companyId: "company-1",
    fullName: "Cliente Test",
    phoneNumber: "900000000",
    clientType: "TRADICIONAL",
    province: "Lima",
    city: "Lima",
    district: "Miraflores",
    address: "Calle Test 1",
    isActive: true,
  },
  items: [
    {
      productVariantId: "var-1",
      productName: "Producto Test",
      sku: "SKU-1",
      attributes: {},
      quantity: 1,
      unitPrice: 89,
      discountAmount: 0,
      imageUrl: null,
    },
  ],
  payments: [
    {
      id: "pay-1",
      status: "PAID",
      paymentMethod: "EFECTIVO",
      amount: 89,
      created_at: "2026-10-01T10:00:00.000Z",
    },
  ],
};

const MOCK_AUTH = {
  auth: {
    user: { id: "user-1", name: "Op", surname: "Test", role: "ADMIN", permissions: [] },
    company: { id: "company-1", name: "Empresa Test", stores: [] },
    accessToken: "fake-token",
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: "store-1",
  setSelectedStore: jest.fn(),
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams({ orderId: ORDER_ID, returnTo: RETURN_TO });
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockedAxiosAuth.get.mockImplementation((url: string) => {
    if (url.endsWith(`/order-header/${ORDER_ID}`))
      return Promise.resolve({ data: ORDER });
    if (url.includes("/couriers/company/"))
      return Promise.resolve({
        data: [{ id: "c-1", name: "Courier Uno", companyId: "company-1" }],
      });
    return Promise.resolve({ data: [] });
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function fieldByLabel(labelText: RegExp): HTMLElement {
  const label = screen.getByText((_content: string, element: Element | null) => {
    return (
      !!element &&
      element.tagName === "LABEL" &&
      labelText.test(element.textContent ?? "")
    );
  });
  return label.parentElement as HTMLElement;
}

const deliveryTypeSelect = () =>
  within(fieldByLabel(/tipo de entrega/i)).getByRole("combobox") as HTMLSelectElement;

async function renderLoaded() {
  render(<RegistrarVentaPage />);
  await waitFor(() => expect(deliveryTypeSelect().value).toBe("RETIRO_TIENDA"));
}

async function switchToDomicilio() {
  const user = userEvent.setup();
  await user.selectOptions(deliveryTypeSelect(), "DOMICILIO");
  const submit = screen.getByRole("button", { name: /actualizar venta/i });
  // Validación existente: DOMICILIO exige método de envío.
  expect(submit).toBeDisabled();
  await user.selectOptions(
    within(fieldByLabel(/método de envío/i)).getByRole("combobox"),
    "Courier Uno",
  );
  await waitFor(() => expect(submit).toBeEnabled());
  return { user, submit };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RegistrarVentaPage — editar tipo de entrega desde la revisión de guía", () => {
  it("muestra el tipo de entrega actual, solo opciones soportadas y el aviso de retorno", async () => {
    await renderLoaded();

    const options = Array.from(deliveryTypeSelect().options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(options).toEqual(["RETIRO_TIENDA", "DOMICILIO"]);
    expect(
      screen.getByText(/al guardar volverás a por despachar/i),
    ).toBeInTheDocument();
  });

  it("guardado correcto: un solo PUT con el nuevo tipo de entrega, progreso mientras guarda y vuelve al returnTo", async () => {
    let resolvePut: (v: unknown) => void = () => {};
    mockedAxiosAuth.put.mockReturnValue(
      new Promise((resolve) => {
        resolvePut = resolve;
      }),
    );
    await renderLoaded();
    const { user, submit } = await switchToDomicilio();

    await user.click(submit);
    // Progreso visible y sin doble envío mientras el PUT está en vuelo.
    const busy = await screen.findByRole("button", { name: /procesando/i });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(mockedAxiosAuth.put).toHaveBeenCalledTimes(1);

    resolvePut({ data: {} });

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(`${RETURN_TO}&updated=${ORDER_ID}`),
    );
    expect(mockPush).not.toHaveBeenCalled();
    const [url, payload] = mockedAxiosAuth.put.mock.calls[0];
    expect(url).toMatch(new RegExp(`/order-header/${ORDER_ID}$`));
    expect(payload).toEqual(
      expect.objectContaining({
        deliveryType: "DOMICILIO",
        courier: "Courier Uno",
        status: "PREPARADO",
      }),
    );
    expect(screen.queryByText("Recibo abierto")).not.toBeInTheDocument();
  });

  it("guardado fallido: error claro, no navega y conserva lo editado para reintentar", async () => {
    mockedAxiosAuth.put.mockRejectedValue({
      response: { data: { message: "Courier inválido" } },
    });
    await renderLoaded();
    const { user, submit } = await switchToDomicilio();

    await user.click(submit);

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /no se pudo actualizar la venta: courier inválido.*tus cambios siguen/i,
        ),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(deliveryTypeSelect().value).toBe("DOMICILIO");
    expect(
      screen.getByRole("button", { name: /actualizar venta/i }),
    ).toBeEnabled();
  });

  it("ignora un returnTo externo y mantiene el flujo normal (recibo)", async () => {
    mockSearchParams = new URLSearchParams({
      orderId: ORDER_ID,
      returnTo: "//evil.example.com",
    });
    mockedAxiosAuth.put.mockResolvedValue({ data: {} });
    await renderLoaded();
    expect(
      screen.queryByText(/al guardar volverás a por despachar/i),
    ).not.toBeInTheDocument();
    const { user, submit } = await switchToDomicilio();

    await user.click(submit);

    await screen.findByText("Recibo abierto");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("'Volver' sin guardar lleva al returnTo sin marca de guardado (no reabre la revisión ni anuncia éxito)", async () => {
    await renderLoaded();
    const user = userEvent.setup();
    await user.selectOptions(deliveryTypeSelect(), "DOMICILIO");

    const back = screen.getByRole("link", { name: /volver/i });
    expect(back).toHaveAttribute("href", RETURN_TO);
    expect(back.getAttribute("href")).not.toMatch(/updated=/);
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});

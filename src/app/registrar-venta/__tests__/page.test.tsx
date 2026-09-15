/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: RegistrarVentaPage (app/registrar-venta/page.tsx)
 *
 * FIX aprobacion-pagos-solo-finanzas (ver
 * docs/features/FIX-aprobacion-pagos-solo-finanzas/spec.md): al crear una
 * venta nueva con adelanto + comprobante, ya NO se llama a
 * `PATCH .../payments/:id/approve` después de subir el comprobante
 * (`upload-proof`) — el pago queda PENDING hasta que Finanzas lo apruebe a
 * mano. Antes (FEAT-18 + fix 334cba8) ese PATCH /approve se disparaba
 * automáticamente.
 *
 * Comportamiento verificado:
 * 1. Con adelanto > 0 y comprobante adjunto: se sube el comprobante
 *    (`PATCH .../upload-proof`) pero NUNCA se llama a
 *    `PATCH .../approve`, y el toast de éxito avisa que el adelanto quedó
 *    pendiente de aprobación en Finanzas.
 * 2. Sin comprobante (con o sin adelanto): el toast de éxito es el genérico
 *    "Venta registrada" y no se hace ningún PATCH de pagos.
 *
 * Esta página es enorme (cliente, catálogo, packs, pagos, envío) y monta
 * varios subsistemas reales. Para mantener el test enfocado en el flujo de
 * pago se mockean:
 * - `@/lib/axiosAuth` (todas las llamadas HTTP del flujo de creación).
 * - `@/contexts/AuthContext` (useAuth) — company/store/inventories fijos;
 *   `inventories: []` evita que se dispare una búsqueda real de productos
 *   (`searchInventoryItems`) contra `selectedInventory`.
 * - `@/services/clients.service` — se simula un cliente YA encontrado
 *   (`fetchClientByPhone` resuelve un cliente) para no tener que completar
 *   a mano el formulario de cliente nuevo (con sus Combobox de ubigeo).
 *   `updateClient` también se mockea resuelto por si algún test edita el
 *   formulario de cliente y dispara la rama de `updateClient` en
 *   `handleConfirmSale` (ver describe de regresión de `hasClientChanges` más
 *   abajo).
 * - `@/services/promos.service` — usado por `PacksProvider`;
 *   `listVolumePromos` resuelve `[]` para que `usePacksEngine` no interfiera
 *   con el submit (`packsEngine.pvsOpen` se mantiene `null`).
 * - `@/components/ui/select` — mock de `<select>` nativo (mismo patrón que
 *   `PaymentVerificationModal.test.tsx`), porque el Select real de Radix no
 *   es interactuable en jsdom sin polyfills de pointer capture.
 * - `@/components/registrar-venta/ProductSearchMatrix` — se reemplaza por un
 *   botón que agrega 1 producto fijo al carrito vía `onAddVariant`; el
 *   buscador/matriz real no es parte de lo que se prueba acá.
 * - `@/components/registrar-venta/CartLines` y `SuggestionsPanel` — no
 *   aportan a `canSubmit` (que depende del estado `cart`, no de estos
 *   componentes) y se mockean a `null` para reducir superficie.
 * - `@/components/modals/orderReceiptModal` — se abre tras un submit
 *   exitoso; se mockea a `null` porque no es parte de este flujo.
 *
 * Work-arounds jsdom:
 * - `crypto.randomUUID` no existe en el jsdom de este proyecto y `addToCart`
 *   lo usa para el `id` del `CartItem` — se parchea para todo el archivo
 *   (mismo patrón que `packs-promos/__tests__/page.test.tsx`).
 * - El input de comprobante (`<input type="file" className="hidden">`) se
 *   abre en producción vía un `onClick` en un div que llama a `.click()` en
 *   el input — `userEvent.upload()` hace un click real por debajo y ese
 *   click falla/no aplica sobre un input `display:none`. Se dispara
 *   `fireEvent.change` directo sobre el input (patrón documentado de
 *   Testing Library para file inputs ocultos por diseño).
 * - Los `<Label>` de este formulario son hermanos de sus inputs/Select, no
 *   están asociados vía `htmlFor`/`id` — `getByLabelText` no los encuentra.
 *   Se usa un helper `fieldByLabel` que ubica el `<label>` por texto y
 *   escala al contenedor (`within`) para aislar el control asociado.
 */

import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
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
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/registrar-venta",
  useSearchParams: () => new URLSearchParams(),
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
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
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
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>;
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  );

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

jest.mock("@/components/modals/orderReceiptModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/registrar-venta/ProductSearchMatrix", () => ({
  __esModule: true,
  default: ({
    onAddVariant,
  }: {
    onAddVariant: (item: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onAddVariant({
          inventoryItemId: "inv-1",
          variantId: "var-1",
          productName: "Producto Test",
          sku: "SKU-1",
          price: 100,
          availableStock: 10,
          physicalStock: 10,
        })
      }
    >
      Agregar producto de test
    </button>
  ),
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
import {
  fetchClientByPhone,
  updateClient,
} from "@/services/clients.service";
import RegistrarVentaPage from "../page";
import type { Client } from "@/interfaces/ICliente";

process.env.NEXT_PUBLIC_API_VENTAS = "http://ventas";

const mockedAxiosAuth = axiosAuth as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  put: jest.Mock;
};
const mockToast = toast as jest.Mocked<typeof toast>;
const mockUseAuth = jest.mocked(useAuth);
const mockFetchClientByPhone = fetchClientByPhone as jest.Mock;
const mockUpdateClient = updateClient as jest.Mock;

// `crypto.randomUUID` no existe en el jsdom de jest-environment-jsdom 29 y
// `addToCart` lo usa para el `id` del CartItem. Se parchea solo para este
// archivo (mismo patrón que packs-promos/__tests__/page.test.tsx).
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

const FOUND_CLIENT: Client = {
  id: "client-1",
  companyId: "company-1",
  fullName: "Juan Pérez",
  phoneNumber: "999888777",
  clientType: "TRADICIONAL",
  province: "Lima",
  city: "Lima",
  district: "Miraflores",
  address: "Av. Test 123",
  isActive: true,
};

const MOCK_AUTH = {
  auth: {
    user: {
      id: "user-1",
      name: "Vendedora",
      surname: "Test",
      email: "vendedora@powip.com",
      role: "ADMIN",
      permissions: [],
    },
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
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockedAxiosAuth.get.mockResolvedValue({ data: [] });
  mockFetchClientByPhone.mockResolvedValue(FOUND_CLIENT);
  mockUpdateClient.mockResolvedValue(FOUND_CLIENT);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Ubica un <label> por su texto y devuelve su contenedor (div hermano del
 *  control), para poder escalar con `within(...)` — los Label de este form no
 *  están asociados a su control vía htmlFor/id. */
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

/** Completa lo mínimo indispensable para que `canSubmit` sea true, sin tocar
 *  adelanto/comprobante (eso lo decide cada test). */
async function fillCommonRequiredFields() {
  // Cliente: se busca por teléfono y se usa el cliente ya encontrado (evita
  // completar a mano el formulario de cliente nuevo).
  const phoneInput = screen.getByPlaceholderText("Número de teléfono");
  await userEvent.type(phoneInput, `${FOUND_CLIENT.phoneNumber}{Enter}`);
  await screen.findByText(/cliente encontrado/i);

  // Producto: 1 unidad agregada desde el stub de ProductSearchMatrix.
  await userEvent.click(
    screen.getByRole("button", { name: /agregar producto de test/i }),
  );

  // Método de pago (obligatorio siempre, más allá del monto del adelanto).
  await userEvent.selectOptions(
    within(fieldByLabel(/método de pago/i)).getByRole("combobox"),
    "EFECTIVO",
  );

  // Canal de venta / canal de cierre (obligatorios).
  await userEvent.selectOptions(
    within(fieldByLabel(/canal de venta/i)).getByRole("combobox"),
    "WHATSAPP",
  );
  await userEvent.selectOptions(
    within(fieldByLabel(/canal de cierre/i)).getByRole("combobox"),
    "WHATSAPP",
  );

  // Tipo de entrega: "Retiro en tienda" satisface hasValidDelivery sin
  // necesitar elegir un courier (el Select de "Método de envío" solo
  // aparece si el tipo de entrega es DOMICILIO).
  await userEvent.selectOptions(
    within(fieldByLabel(/tipo de entrega/i)).getByRole("combobox"),
    "RETIRO_TIENDA",
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RegistrarVentaPage — creación de venta con adelanto (FIX aprobacion-pagos-solo-finanzas)", () => {
  it("con comprobante adjunto: sube el comprobante pero NUNCA llama a /approve, y el toast avisa que queda pendiente de Finanzas", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-123", payments: [{ id: "payment-123" }] },
    });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });

    const { container } = render(<RegistrarVentaPage />);

    await fillCommonRequiredFields();

    // Adelanto de pago > 0.
    const advanceInput = within(
      fieldByLabel(/adelanto de pago/i),
    ).getByRole("textbox");
    await userEvent.type(advanceInput, "50");

    // Comprobante: el input real está oculto (className="hidden") y se abre
    // en producción vía un div con onClick que llama a .click() sobre el
    // input — se dispara el change directo (ver comentario de cabecera).
    const proofFile = new File(["comprobante"], "comprobante.png", {
      type: "image/png",
    });
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [proofFile] } });

    const confirmButton = screen.getByRole("button", {
      name: /confirmar venta/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
      expect.stringContaining("/order-header"),
      expect.objectContaining({
        payments: [
          expect.objectContaining({ paymentMethod: "EFECTIVO", amount: 50 }),
        ],
      }),
    );

    await waitFor(() =>
      expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
        expect.stringContaining("payment-123/upload-proof"),
        expect.anything(),
        expect.anything(),
      ),
    );

    // El pago queda PENDING: nunca se llama al endpoint de aprobación desde
    // este flujo (antes del fix, esto se disparaba automáticamente).
    const approveCalls = mockedAxiosAuth.patch.mock.calls.filter(([url]) =>
      String(url).includes("/approve"),
    );
    expect(approveCalls).toHaveLength(0);

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        "Venta registrada. El adelanto quedó pendiente de aprobación en Finanzas.",
      ),
    );
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("sin comprobante adjunto: toast simple \"Venta registrada\" y ningún PATCH de pagos (ni upload-proof ni approve)", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-456", payments: [] },
    });

    render(<RegistrarVentaPage />);

    await fillCommonRequiredFields();

    const confirmButton = screen.getByRole("button", {
      name: /confirmar venta/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("con adelanto > 0 pero sin comprobante adjunto: toast simple \"Venta registrada\" y ningún PATCH de pagos (ni upload-proof ni approve)", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-789", payments: [{ id: "payment-789" }] },
    });

    render(<RegistrarVentaPage />);

    await fillCommonRequiredFields();

    // Adelanto de pago > 0, sin adjuntar ningún comprobante — el bloque de
    // subida se salta por `paymentProofFile` nulo, sin importar el monto.
    const advanceInput = within(
      fieldByLabel(/adelanto de pago/i),
    ).getByRole("textbox");
    await userEvent.type(advanceInput, "50");

    const confirmButton = screen.getByRole("button", {
      name: /confirmar venta/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

describe("RegistrarVentaPage — hasClientChanges (fix orden de claves province/department)", () => {
  // Bug corregido: `hasClientChanges` comparaba `JSON.stringify(clientForm)`
  // contra un objeto con las claves `province`/`department` en orden
  // invertido respecto a como las arma el efecto que sincroniza `clientForm`
  // desde `clientFound`. Como `JSON.stringify` es sensible al orden de
  // inserción de claves, la comparación daba `true` (¡había "cambios"!)
  // SIEMPRE que había un cliente encontrado, aunque no se hubiera editado
  // nada, disparando un `updateClient()` innecesario en cada venta a un
  // cliente existente.

  it("cliente encontrado sin editar ningún campo: NO llama a updateClient al confirmar la venta", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-no-changes", payments: [] },
    });

    render(<RegistrarVentaPage />);

    await fillCommonRequiredFields();

    const confirmButton = screen.getByRole("button", {
      name: /confirmar venta/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );

    // Con el bug, este mock se llamaba igual aunque no se hubiera tocado el
    // formulario de cliente.
    expect(mockUpdateClient).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  // Timeout extendido (default 5000ms): esta página es pesada de renderizar y
  // el clear+type sobre el input de dirección suma ~6.7s en la suite
  // completa — no es un hang, es el costo real de montar el formulario.
  it("cliente encontrado editando la dirección: SÍ llama a updateClient al confirmar la venta", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-with-changes", payments: [] },
    });

    render(<RegistrarVentaPage />);

    await fillCommonRequiredFields();

    const addressInput = screen.getByPlaceholderText("Dirección exacta");
    await userEvent.clear(addressInput);
    await userEvent.type(addressInput, "Av. Nueva 456");

    const confirmButton = screen.getByRole("button", {
      name: /confirmar venta/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() =>
      expect(mockUpdateClient).toHaveBeenCalledWith(
        FOUND_CLIENT.id,
        expect.objectContaining({ address: "Av. Nueva 456" }),
      ),
    );

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );
    expect(mockToast.error).not.toHaveBeenCalled();
  }, 15000);
});

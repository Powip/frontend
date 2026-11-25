/**
 * Tests: «Reglas de inventario» en Tiendas y almacenes (FEAT-24 H2-F).
 *
 * 1. Carga los días de liberación y el picking (con el aviso de las etiquetas).
 * 2. Un admin cambia y guarda; vacío = nunca (null).
 * 3. Días fuera de 1..365 no se guardan.
 * 4. Un 400 del servidor se muestra.
 * 5. Quien no es admin solo lee.
 * 6. FEAT-24 H3: las reglas de compras (afecta al IGV y compra directa a courier).
 * 7. FEAT-24 H13: días de cobertura objetivo (1..365, 30 por defecto; solo se mandan si cambiaron).
 * 8. FEAT-24 H5-L: días de aviso de vencimiento (igual: 1..365, 30 por defecto; solo el Administrador).
 * 9. FEAT-24 C-D3: control de stock flexible (por defecto) / estricto, con su línea de ayuda; se manda en el PUT.
 * 10. FEAT-24 C-D4: vencimiento «Por defecto de Powip (N días | nunca)» = null, «Nunca» = 0, «N días».
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getInventoryRules, saveInventoryRules } from "@/services/warehousesService";
import InventoryRulesSection from "../InventoryRulesSection";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/warehousesService", () => ({
  getInventoryRules: jest.fn(),
  saveInventoryRules: jest.fn(),
}));

const mockGet = jest.mocked(getInventoryRules);
const mockSave = jest.mocked(saveInventoryRules);
const DAYS = "Días para liberar las reservas";

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InventoryRulesSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({
    releaseAfterDays: 7,
    pickingRequired: false,
    igvAffected: true,
    allowPurchaseToCourier: false,
    stockControl: "flexible",
    defaultReleaseAfterDays: 30,
  });
});

describe("Reglas de inventario (FEAT-24 H2-F)", () => {
  it("muestra lo guardado y el aviso de las etiquetas junto al picking", async () => {
    loginAs("ADMIN");
    renderSection();
    expect(await screen.findByLabelText(DAYS)).toHaveValue("7");
    expect(screen.getByRole("radio", { name: "Después de" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Por defecto de Powip (30 días)" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Flexible/ })).toBeChecked();
    expect(screen.getByText(/Permite registrar salidas que dejan el stock en negativo, con confirmación/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Exigir picking con escaneo" })).not.toBeChecked();
    expect(screen.getByText(/muy pocos productos tienen código impreso/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
  });

  it("un admin deja la liberación en «Nunca» (0), prende el picking y guarda", async () => {
    loginAs("OWNER");
    const user = userEvent.setup();
    mockSave.mockResolvedValue({ releaseAfterDays: 0, pickingRequired: true, igvAffected: true, allowPurchaseToCourier: false, stockControl: "flexible", defaultReleaseAfterDays: 30 });
    renderSection();
    await screen.findByLabelText(DAYS);
    await user.click(screen.getByRole("radio", { name: "Nunca" }));
    await user.click(screen.getByRole("switch", { name: "Exigir picking con escaneo" }));
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        releaseAfterDays: 0,
        pickingRequired: true,
        stockControl: "flexible",
        igvAffected: true,
        allowPurchaseToCourier: false,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reglas de inventario guardadas"));
    expect(screen.getByRole("radio", { name: "Nunca" })).toBeChecked();
    expect(screen.getByLabelText(DAYS)).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Exigir picking con escaneo" })).toBeChecked();
  });

  it("«Por defecto de Powip» manda null y muestra lo que vale hoy (FEAT-24 C-D4)", async () => {
    loginAs("ADMINISTRADOR");
    const user = userEvent.setup();
    mockSave.mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl: "flexible", defaultReleaseAfterDays: 30 });
    renderSection();
    await screen.findByLabelText(DAYS);
    await user.click(screen.getByRole("radio", { name: "Por defecto de Powip (30 días)" }));
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ releaseAfterDays: null })));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Por defecto de Powip (30 días)" })).toBeChecked());
  });

  it("sin valor por defecto en el servidor, «Por defecto de Powip (nunca)» viene marcado si no se fijó nada", async () => {
    loginAs("ADMINISTRADOR");
    mockGet.mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl: "flexible", defaultReleaseAfterDays: null });
    renderSection();
    expect(await screen.findByRole("radio", { name: "Por defecto de Powip (nunca)" })).toBeChecked();
    expect(screen.getByLabelText(DAYS)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
  });

  it("control de stock: pasar a Estricto cambia la ayuda y se manda en el PUT (FEAT-24 C-D3)", async () => {
    loginAs("ADMINISTRADOR");
    const user = userEvent.setup();
    mockSave.mockResolvedValue({ releaseAfterDays: 7, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl: "estricto", defaultReleaseAfterDays: 30 });
    renderSection();
    await user.click(await screen.findByRole("radio", { name: "Estricto" }));
    expect(screen.getByText("No permite salidas por debajo de 0 ni trasladar más que el disponible.")).toBeInTheDocument();
    expect(screen.queryByText(/Permite registrar salidas que dejan el stock en negativo/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        releaseAfterDays: 7,
        pickingRequired: false,
        stockControl: "estricto",
        igvAffected: true,
        allowPurchaseToCourier: false,
      }),
    );
    await waitFor(() => expect(screen.getByRole("radio", { name: "Estricto" })).toBeChecked());
    // Volver a lo guardado no deja nada por guardar.
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
  });

  it("no guarda días fuera de 1..365 ni vacíos con «Después de»", async () => {
    loginAs("ADMIN");
    const user = userEvent.setup();
    renderSection();
    const days = await screen.findByLabelText(DAYS);
    await user.clear(days);
    expect(screen.getByText("Escribe cuántos días (de 1 a 365).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
    await user.type(days, "400");
    expect(screen.getByText(/Los días van de 1 a 365/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
    await user.clear(days);
    await user.type(days, "30");
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeEnabled();
  });

  it("escribir días desde «Por defecto» pasa a «Después de»", async () => {
    loginAs("ADMIN");
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl: "flexible", defaultReleaseAfterDays: 30 });
    renderSection();
    const days = await screen.findByLabelText(DAYS);
    await user.type(days, "15");
    expect(screen.getByRole("radio", { name: "Después de" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ releaseAfterDays: 15 })));
  });

  it("muestra el 400 del servidor", async () => {
    loginAs("ADMIN");
    const user = userEvent.setup();
    mockSave.mockRejectedValue({ response: { status: 400, data: { message: ["Los días para liberar una reserva van de 1 a 365 (o vacío = nunca)."] } } });
    renderSection();
    const days = await screen.findByLabelText(DAYS);
    await user.clear(days);
    await user.type(days, "10");
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Los días para liberar una reserva van de 1 a 365");
    expect(toast.error).toHaveBeenCalled();
  });

  it("quien no es admin solo lee", async () => {
    loginAs("OPERACIONES");
    mockGet.mockResolvedValue({ releaseAfterDays: null, pickingRequired: true, igvAffected: false, allowPurchaseToCourier: true, stockControl: "estricto", defaultReleaseAfterDays: 30 });
    renderSection();
    const days = await screen.findByLabelText(DAYS);
    expect(days).toBeDisabled();
    expect(days).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Por defecto de Powip (30 días)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Por defecto de Powip (30 días)" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Estricto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Estricto" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Exigir picking con escaneo" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Exigir picking con escaneo" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "La empresa está afecta al IGV" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "La empresa está afecta al IGV" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Permitir compras directas a un almacén courier" })).toBeChecked();
    expect(screen.getByText("Solo un administrador puede cambiar estas reglas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar reglas de inventario" })).not.toBeInTheDocument();
  });

  it("si la carga falla, avisa y deja reintentar", async () => {
    loginAs("ADMIN");
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce({ response: { status: 503, data: { message: "Servicio no disponible" } } });
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText(DAYS)).toHaveValue("7");
  });

  it("un admin apaga el IGV y permite comprar directo a courier (FEAT-24 H3)", async () => {
    loginAs("ADMINISTRADOR");
    const user = userEvent.setup();
    mockSave.mockResolvedValue({ releaseAfterDays: 7, pickingRequired: false, igvAffected: false, allowPurchaseToCourier: true });
    renderSection();
    const igv = await screen.findByRole("switch", { name: "La empresa está afecta al IGV" });
    expect(igv).toBeChecked();
    await user.click(igv);
    await user.click(screen.getByRole("switch", { name: "Permitir compras directas a un almacén courier" }));
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        releaseAfterDays: 7,
        pickingRequired: false,
        stockControl: "flexible",
        igvAffected: false,
        allowPurchaseToCourier: true,
      }),
    );
  });

  it("días de cobertura objetivo: muestra el guardado, valida 1..365 y lo manda solo si cambió (FEAT-24 H13)", async () => {
    loginAs("ADMINISTRADOR");
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ releaseAfterDays: 7, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, defaultCoverageDays: 21 });
    mockSave.mockResolvedValue({ releaseAfterDays: 7, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, defaultCoverageDays: 45 });
    renderSection();
    const coverage = await screen.findByLabelText("Días de cobertura objetivo");
    expect(coverage).toHaveValue("21");
    await user.clear(coverage);
    await user.type(coverage, "400");
    expect(screen.getByText("Escribe un número entero de 1 a 365.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
    await user.clear(coverage);
    await user.type(coverage, "45");
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        releaseAfterDays: 7,
        pickingRequired: false,
        stockControl: "flexible",
        igvAffected: true,
        allowPurchaseToCourier: false,
        defaultCoverageDays: 45,
      }),
    );
    await waitFor(() => expect(screen.getByLabelText("Días de cobertura objetivo")).toHaveValue("45"));
  });

  it("días de aviso de vencimiento: valida 1..365 y lo manda solo si cambió (FEAT-24 H5-L)", async () => {
    loginAs("ADMINISTRADOR");
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ releaseAfterDays: 7, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, expiryAlertDays: 45 });
    mockSave.mockResolvedValue({ releaseAfterDays: 7, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, expiryAlertDays: 60 });
    renderSection();
    const alertDays = await screen.findByLabelText("Días de aviso de vencimiento");
    expect(alertDays).toHaveValue("45");
    await user.clear(alertDays);
    await user.type(alertDays, "0");
    expect(screen.getByText("Escribe un número entero de 1 a 365.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas de inventario" })).toBeDisabled();
    await user.clear(alertDays);
    await user.type(alertDays, "60");
    await user.click(screen.getByRole("button", { name: "Guardar reglas de inventario" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({
        releaseAfterDays: 7,
        pickingRequired: false,
        stockControl: "flexible",
        igvAffected: true,
        allowPurchaseToCourier: false,
        expiryAlertDays: 60,
      }),
    );
  });

  it("los días de aviso de vencimiento: 30 por defecto y Operaciones no los edita (FEAT-24 H5-L)", async () => {
    loginAs("OPERACIONES");
    renderSection();
    const alertDays = await screen.findByLabelText("Días de aviso de vencimiento");
    expect(alertDays).toHaveValue("30");
    expect(alertDays).toBeDisabled();
  });

  it("sin el dato en el servidor muestra 30 y quien no es admin no lo edita (FEAT-24 H13)", async () => {
    loginAs("OPERACIONES");
    renderSection();
    const coverage = await screen.findByLabelText("Días de cobertura objetivo");
    expect(coverage).toHaveValue("30");
    expect(coverage).toBeDisabled();
  });
});

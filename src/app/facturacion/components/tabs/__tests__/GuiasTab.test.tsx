/**
 * Tests: Facturación › Guías de remisión, real (FEAT-24 H12).
 *
 * 1. La lista muestra el estado SUNAT con su código y descripción, y las descargas que tiene cada guía.
 * 2. Consultar el estado (SENT) y reenviar (PENDING) llaman a ms-sunat y refrescan la lista.
 * 3. Descargas: XML y CDR de ms-sunat; PDF armado en el navegador, con QR si SUNAT la aceptó.
 * 4. Filtros por estado, motivo y fechas (una fecha «desde» posterior a «hasta» no consulta).
 * 5. Aviso de modo de pruebas y botón de emitir bloqueado sin conexión con SUNAT.
 * 6. Emitir desde un pedido: el selector ofrece solo pedidos preparados o en camino.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  downloadDespatchAdviceCdrApi,
  downloadDespatchAdviceXmlApi,
  getGreSettingsApi,
  listDespatchAdvicesApi,
  refreshDespatchAdviceStatusApi,
  sendDespatchAdviceApi,
} from "@/features/sunat/despatch-advice/api/despatch-advice.api";
import type { DespatchAdvice, GreSettings } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { downloadFile } from "@/utils/http/download-file";
import { GuiasTab } from "../GuiasTab";

const mockDownloadPdf = jest.fn();
const mockToDataURL = jest.fn();

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1" } } }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => mockDownloadPdf }));
jest.mock("@/utils/http/download-file", () => ({ downloadFile: jest.fn() }));
jest.mock("qrcode", () => ({ __esModule: true, default: { toDataURL: (...args: unknown[]) => mockToDataURL(...args) }, toDataURL: (...args: unknown[]) => mockToDataURL(...args) }));
jest.mock("@/components/gre/GreIssueDialog", () => ({
  __esModule: true,
  default: ({ source }: { source: { orderId?: string } }) => <div data-testid="gre-issue-dialog">{source.orderId}</div>,
}));
jest.mock("@/features/sunat/despatch-advice/api/despatch-advice.api", () => ({
  downloadDespatchAdviceCdrApi: jest.fn(),
  downloadDespatchAdviceXmlApi: jest.fn(),
  getGreSettingsApi: jest.fn(),
  listAllDespatchAdvicesApi: jest.fn(),
  listDespatchAdvicesApi: jest.fn(),
  refreshDespatchAdviceStatusApi: jest.fn(),
  sendDespatchAdviceApi: jest.fn(),
}));

const SETTINGS: GreSettings = {
  sunatConnection: "SUNAT_PRODUCTION",
  enabledForCompany: true,
  profiles: [
    {
      sunatProfileId: "p-1",
      ruc: "20111111111",
      razonSocial: "ACME S.A.C.",
      isDefault: true,
      isActive: true,
      configured: true,
      clientId: "cid",
      series: "T001",
      nextCorrelative: 9,
      updatedAt: null,
    },
  ],
};

const PAYLOAD: DespatchAdvice["payload"] = {
  transferReason: "01",
  transportMode: "01",
  transferStartDate: "2026-11-18",
  grossWeightKg: 1.5,
  packageCount: 1,
  recipient: { identityDocumentType: "1", identityDocumentNumber: "45678912", name: "María Pérez" },
  origin: { ubigeo: "150101", address: "Jr. Puno 890", establishmentCode: "0001" },
  destination: { ubigeo: "150122", address: "Av. Larco 123" },
  carrier: { ruc: "20100070970", name: "Olva Courier S.A.C." },
  items: [{ description: "Polo", quantity: 2, unitCode: "NIU", code: "POLO-M" }],
};

function advice(number: string, overrides: Partial<DespatchAdvice> = {}): DespatchAdvice {
  return {
    id: `id-${number}`,
    sunatProfileId: "p-1",
    rucIssuer: "20111111111",
    documentType: "09",
    series: "T001",
    correlative: number.slice(5),
    number,
    issueDate: "2026-11-18",
    issueTime: "10:00:00",
    transferReason: "01",
    transportMode: "01",
    externalReference: "ORD-1001",
    status: "ACCEPTED",
    ticket: "tk",
    ticketReceivedAt: null,
    sunatCode: "0",
    sunatDescription: "Aceptada",
    observations: [],
    qrUrl: null,
    hasSignedXml: true,
    hasCdr: true,
    sendAttempts: 1,
    lastError: null,
    payload: PAYLOAD,
    createdAt: "2026-11-18T15:00:00Z",
    updatedAt: "2026-11-18T15:00:00Z",
    ...overrides,
  };
}

const ACCEPTED = advice("T001-00000001", { qrUrl: "https://e-factura.sunat.gob.pe/qr?x=1" });
const REJECTED = advice("T001-00000002", { status: "REJECTED", sunatCode: "2554", sunatDescription: "Documento del destinatario inválido", hasCdr: true });
const PENDING = advice("T001-00000003", { status: "PENDING", ticket: null, hasCdr: false, lastError: "connect ETIMEDOUT" });
const SENT = advice("T001-00000004", { status: "SENT", hasCdr: false, sunatCode: null, sunatDescription: null });

const ROWS = [
  { sale: { id: "o-1", orderNumber: "ORD-1001", status: "PREPARADO", customer: { fullName: "María Pérez", district: "Miraflores" } } },
  { sale: { id: "o-2", orderNumber: "ORD-1002", status: "PENDIENTE", customer: { fullName: "Luis Rojas", district: "Surco" } } },
] as unknown as TaxDocumentRow[];

/** Emisor que la página pasa: el RUC elegido en «RUC emisor» (o el único RUC). */
const ISSUER = { ruc: "20111111111", razonSocial: "ACME S.A.C.", direccion: "Av. Arequipa 100, Lima" };

function setup(props: { issuer?: typeof ISSUER } = { issuer: ISSUER }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GuiasTab comprobanteRows={ROWS} issuer={props.issuer} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const row = (number: string) => screen.findByTestId(`gre-${number}`);
const lastListQuery = () => jest.mocked(listDespatchAdvicesApi).mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getGreSettingsApi).mockResolvedValue(SETTINGS);
  jest.mocked(listDespatchAdvicesApi).mockResolvedValue({ items: [ACCEPTED, REJECTED, PENDING, SENT], total: 4, page: 1, pageSize: 20 });
  mockToDataURL.mockResolvedValue("data:image/png;base64,QR");
});

describe("GuiasTab", () => {
  it("muestra el estado SUNAT con su código y las descargas que tiene cada guía", async () => {
    setup();
    const accepted = await row("T001-00000001");
    expect(within(accepted).getByText("Aceptada")).toBeInTheDocument();
    expect(within(accepted).getByRole("button", { name: "XML de T001-00000001" })).toBeInTheDocument();
    expect(within(accepted).getByRole("button", { name: "CDR de T001-00000001" })).toBeInTheDocument();
    expect(within(accepted).queryByRole("button", { name: /Reenviar/ })).not.toBeInTheDocument();

    const rejected = await row("T001-00000002");
    expect(within(rejected).getByText("Rechazada")).toBeInTheDocument();
    expect(within(rejected).getByText("Código 2554: Documento del destinatario inválido")).toBeInTheDocument();
    expect(within(rejected).queryByRole("button", { name: /Reenviar/ })).not.toBeInTheDocument();

    const pending = await row("T001-00000003");
    expect(within(pending).getByText("Pendiente de envío")).toBeInTheDocument();
    expect(within(pending).getByText(/SUNAT no respondió/)).toBeInTheDocument();
    expect(within(pending).queryByRole("button", { name: /CDR de/ })).not.toBeInTheDocument();

    const sent = await row("T001-00000004");
    expect(within(sent).getByText("Enviada a SUNAT")).toBeInTheDocument();
    expect(within(sent).getByRole("button", { name: /Consultar estado/ })).toBeInTheDocument();
    expect(screen.queryByTestId("gre-mode-banner")).not.toBeInTheDocument();
  });

  it("consulta el estado de una guía enviada y reenvía una pendiente", async () => {
    jest.mocked(refreshDespatchAdviceStatusApi).mockResolvedValue({ ...SENT, status: "ACCEPTED" });
    jest.mocked(sendDespatchAdviceApi).mockResolvedValue({ ...PENDING, status: "SENT" });
    const user = setup();

    await user.click(within(await row("T001-00000004")).getByRole("button", { name: /Consultar estado/ }));
    await waitFor(() => expect(refreshDespatchAdviceStatusApi).toHaveBeenCalledWith("id-T001-00000004"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("T001-00000004: aceptada"));

    const calls = jest.mocked(listDespatchAdvicesApi).mock.calls.length;
    await user.click(within(await row("T001-00000003")).getByRole("button", { name: /Reenviar/ }));
    await waitFor(() => expect(sendDespatchAdviceApi).toHaveBeenCalledWith("id-T001-00000003"));
    await waitFor(() => expect(jest.mocked(listDespatchAdvicesApi).mock.calls.length).toBeGreaterThan(calls));
  });

  it("si el reenvío vuelve a fallar lo explica", async () => {
    jest.mocked(sendDespatchAdviceApi).mockResolvedValue({ ...PENDING, lastError: "invalid_client" });
    const user = setup();
    await user.click(within(await row("T001-00000003")).getByRole("button", { name: /Reenviar/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/T001-00000003 sigue pendiente\. SUNAT no aceptó las credenciales GRE/)));
  });

  it("descarga el XML y el CDR de ms-sunat y arma el PDF con QR", async () => {
    const xml = new Blob(["<xml/>"]);
    const cdr = new Blob(["zip"]);
    jest.mocked(downloadDespatchAdviceXmlApi).mockResolvedValue({ blob: xml, filename: "20111111111-09-T001-00000001.xml" });
    jest.mocked(downloadDespatchAdviceCdrApi).mockResolvedValue({ blob: cdr, filename: null as unknown as string });
    const user = setup();
    const accepted = await row("T001-00000001");

    await user.click(within(accepted).getByRole("button", { name: "XML de T001-00000001" }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith({ blob: xml, filename: "20111111111-09-T001-00000001.xml" }));

    await user.click(within(accepted).getByRole("button", { name: "CDR de T001-00000001" }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith({ blob: cdr, filename: "20111111111-09-T001-00000001.zip" }));

    await user.click(within(accepted).getByRole("button", { name: "PDF de T001-00000001" }));
    await waitFor(() => expect(mockDownloadPdf).toHaveBeenCalledTimes(1));
    expect(mockToDataURL).toHaveBeenCalledWith("https://e-factura.sunat.gob.pe/qr?x=1", expect.anything());
    const spec = mockDownloadPdf.mock.calls[0][0];
    expect(spec).toMatchObject({ title: "Guía de remisión remitente", number: "T001-00000001", fileName: "GRE-20111111111-T001-00000001" });
    expect(spec.image).toEqual(expect.objectContaining({ dataUrl: "data:image/png;base64,QR" }));
    expect(spec.meta).toEqual(expect.arrayContaining([["Emisor", "ACME S.A.C. · RUC 20111111111"]]));
    // El encabezado va a nombre del emisor elegido: RUC, razón social y dirección.
    expect(spec.issuer).toEqual({ name: "ACME S.A.C.", ruc: "20111111111", address: "Av. Arequipa 100, Lima" });
  });

  it("sin ningún RUC activo no imprime la guía y lo avisa", async () => {
    const user = setup({});
    await user.click(within(await row("T001-00000001")).getByRole("button", { name: "PDF de T001-00000001" }));
    expect(toast.error).toHaveBeenCalledWith("Agrega un RUC emisor en la pestaña Emisores (RUC) para imprimir la guía");
    expect(mockDownloadPdf).not.toHaveBeenCalled();
  });

  it("no imprime una guía de otro RUC con el encabezado del RUC elegido", async () => {
    const user = setup({ issuer: { ruc: "20222222222", razonSocial: "SEGUNDA E.I.R.L.", direccion: "Jr. Lampa 1" } });
    await user.click(within(await row("T001-00000001")).getByRole("button", { name: "PDF de T001-00000001" }));
    expect(toast.error).toHaveBeenCalledWith("La guía T001-00000001 es del RUC 20111111111. Para imprimirla, elige ese RUC en el filtro «RUC emisor».");
    expect(mockDownloadPdf).not.toHaveBeenCalled();
  });

  it("el PDF de una guía no aceptada avisa que no sirve para trasladar y no lleva QR", async () => {
    const user = setup();
    await user.click(within(await row("T001-00000002")).getByRole("button", { name: "PDF de T001-00000002" }));
    await waitFor(() => expect(mockDownloadPdf).toHaveBeenCalledTimes(1));
    const spec = mockDownloadPdf.mock.calls[0][0];
    expect(spec.note).toMatch(/Sin validez para trasladar mercadería/);
    expect(spec.image).toBeUndefined();
  });

  it("filtra por estado, motivo y fechas", async () => {
    const user = setup();
    await row("T001-00000001");
    expect(lastListQuery()).toEqual({ page: 1, pageSize: 20 });

    await user.selectOptions(screen.getByLabelText("Estado"), "REJECTED");
    await waitFor(() => expect(lastListQuery()).toEqual({ status: "REJECTED", page: 1, pageSize: 20 }));

    await user.selectOptions(screen.getByLabelText("Motivo"), "04");
    await waitFor(() => expect(lastListQuery()).toEqual({ status: "REJECTED", transferReason: "04", page: 1, pageSize: 20 }));

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-10" } });
    await waitFor(() => expect(lastListQuery()).toMatchObject({ dateFrom: "2026-11-10" }));
    const calls = jest.mocked(listDespatchAdvicesApi).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-01" } });
    expect(await screen.findByText("La fecha «desde» no puede ser posterior a «hasta».")).toBeInTheDocument();
    expect(jest.mocked(listDespatchAdvicesApi).mock.calls.length).toBe(calls);
  });

  it("sin conexión con SUNAT muestra el aviso de la empresa piloto y no deja emitir", async () => {
    jest.mocked(getGreSettingsApi).mockResolvedValue({ ...SETTINGS, sunatConnection: "NOT_CONFIGURED" });
    setup();
    expect(await screen.findByTestId("gre-mode-banner")).toHaveTextContent("modo de pruebas");
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("se habilita con la empresa piloto");
    expect(screen.getByRole("button", { name: /Emitir guía de remisión/ })).toBeDisabled();
  });

  it("con SUNAT producción y la empresa no habilitada lo avisa y bloquea emitir y reenviar", async () => {
    jest.mocked(getGreSettingsApi).mockResolvedValue({ ...SETTINGS, enabledForCompany: false });
    setup();
    expect(await screen.findByTestId("gre-mode-banner")).toHaveTextContent("La guía de remisión electrónica todavía no está habilitada para tu empresa.");
    const issue = screen.getByRole("button", { name: /Emitir guía de remisión/ });
    expect(issue).toBeDisabled();
    expect(issue).toHaveAttribute("title", "La guía de remisión electrónica todavía no está habilitada para tu empresa.");
    expect(within(await row("T001-00000003")).getByRole("button", { name: /Reenviar/ })).toBeDisabled();
  });

  it("si ms-sunat responde 403 GRE_NO_HABILITADA al reenviar, muestra su motivo", async () => {
    jest.mocked(sendDespatchAdviceApi).mockRejectedValue({ response: { status: 403, data: { code: "GRE_NO_HABILITADA" } } });
    const user = setup();
    await user.click(within(await row("T001-00000003")).getByRole("button", { name: /Reenviar/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La guía de remisión electrónica todavía no está habilitada para tu empresa."));
  });

  it("con SUNAT pero sin credenciales avisa que faltan", async () => {
    jest.mocked(getGreSettingsApi).mockResolvedValue({ ...SETTINGS, profiles: [{ ...SETTINGS.profiles[0], configured: false }] });
    setup();
    expect(await screen.findByTestId("gre-mode-banner")).toHaveTextContent("Falta configurar las credenciales GRE.");
    expect(screen.getByRole("button", { name: /Emitir guía de remisión/ })).toBeDisabled();
  });

  it("emite desde un pedido preparado: el selector no ofrece pedidos sin preparar", async () => {
    const user = setup();
    const issue = screen.getByRole("button", { name: /Emitir guía de remisión/ });
    await waitFor(() => expect(issue).toBeEnabled());
    await user.click(issue);

    const picker = await screen.findByRole("dialog");
    expect(within(picker).queryByText("ORD-1002")).not.toBeInTheDocument();
    await user.click(within(picker).getByText("ORD-1001"));
    expect(await screen.findByTestId("gre-issue-dialog")).toHaveTextContent("o-1");
  });
});

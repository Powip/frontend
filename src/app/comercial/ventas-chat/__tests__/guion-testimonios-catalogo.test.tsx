import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import GuionTestimonies from "@/components/ventas-chat/GuionTestimonies";
import GuionCatalogBox from "@/components/ventas-chat/GuionCatalogBox";
import * as svc from "@/services/crmBlockDKService";
import { resetCrmMeCache } from "@/hooks/useCrmMe";
import type { Testimony } from "@/types/crmBlockDK";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { role: "ADMIN" }, accessToken: "t" } }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (r: string) => r === "ADMIN",
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmBlockDKService", () => ({
  listTestimonies: jest.fn(),
  proposeTestimony: jest.fn(),
  reviewMaterial: jest.fn(),
  getCatalogSettings: jest.fn(),
  saveCatalogSettings: jest.fn(),
  saveAttributionDays: jest.fn(),
  getCatalogAttribution: jest.fn(),
  generateCatalogPdf: jest.fn(),
}));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  listSheets: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  getCrmMe: jest.fn(),
}));

const s = svc as jest.Mocked<typeof svc>;
const crm = jest.requireMock("@/services/crmService") as { getCrmMe: jest.Mock };

const testimony = (over: Partial<Testimony> = {}): Testimony => ({
  id: "t1",
  sheetId: "s1",
  sheetName: "Box Dúo",
  title: "Foto de Ana · Lima",
  url: "https://x.pe/ana.jpg",
  status: "pending",
  proposedByName: "Joel",
  reviewedByName: null,
  createdAt: "2026-11-24T10:00:00.000Z",
  ...over,
});

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  resetCrmMeCache();
  crm.getCrmMe.mockResolvedValue({ level: "admin", stores: [{ id: "st", name: "KUNCA", isActive: true }], phoneMasked: false });
  s.getCatalogSettings.mockResolvedValue({ attributionDays: 7, showSoldOut: false, pdfGeneratedAt: null, updatedByName: null });
  s.getCatalogAttribution.mockResolvedValue({
    days: 7,
    since: "2026-11-01T05:00:00.000Z",
    orders: 23,
    billed: 3120,
    bySeller: 14,
    withoutSeller: 9,
    sellers: [],
  });
});

describe("K4 · testimonios por aprobar", () => {
  it("muestra los pendientes y aprueba con el toast del mockup", async () => {
    s.listTestimonies.mockResolvedValue({ items: [testimony()], pending: 1 });
    s.reviewMaterial.mockResolvedValue({ ...testimony(), status: "published" });
    wrap(<GuionTestimonies />);
    expect(await screen.findByText("1 testimonio por aprobar")).toBeInTheDocument();
    expect(s.listTestimonies).toHaveBeenCalledWith("pending");
    fireEvent.click(await screen.findByRole("button", { name: /Aprobar/ }));
    await waitFor(() => expect(s.reviewMaterial).toHaveBeenCalledWith("t1", "published"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aprobado · ya está en Testimonios de Box Dúo"));
  });

  it("rechaza con «Rechazado · no se publica»", async () => {
    s.listTestimonies.mockResolvedValue({ items: [testimony(), testimony({ id: "t2" })], pending: 2 });
    s.reviewMaterial.mockResolvedValue({ ...testimony(), status: "rejected" });
    wrap(<GuionTestimonies />);
    expect(await screen.findByText("2 testimonios por aprobar")).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: "Rechazar" }))[0]);
    await waitFor(() => expect(s.reviewMaterial).toHaveBeenCalledWith("t1", "rejected"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rechazado · no se publica"));
  });

  it("filtra por Publicados y Rechazados", async () => {
    s.listTestimonies.mockResolvedValue({ items: [], pending: 0 });
    wrap(<GuionTestimonies />);
    fireEvent.click(await screen.findByRole("tab", { name: "Publicados" }));
    await waitFor(() => expect(s.listTestimonies).toHaveBeenCalledWith("published"));
    fireEvent.click(screen.getByRole("tab", { name: "Rechazados" }));
    await waitFor(() => expect(s.listTestimonies).toHaveBeenCalledWith("rejected"));
    expect(await screen.findByText("No hay testimonios rechazados.")).toBeInTheDocument();
  });
});

describe("K5 · catálogo", () => {
  it("muestra las ventas atribuidas y guarda los días en los ajustes del CRM", async () => {
    s.saveAttributionDays.mockResolvedValue(undefined);
    wrap(<GuionCatalogBox />);
    expect(await screen.findByText("Catálogo POWIP Link · gratis")).toBeInTheDocument();
    expect(await screen.findByText("23")).toBeInTheDocument();
    const input = screen.getByLabelText("Días de atribución");
    await waitFor(() => expect(input).toHaveValue(7));
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.blur(input);
    await waitFor(() => expect(s.saveAttributionDays).toHaveBeenCalledWith(10));
  });

  it("no guarda días fuera de 1–30", async () => {
    wrap(<GuionCatalogBox />);
    const input = await screen.findByLabelText("Días de atribución");
    await waitFor(() => expect(input).toHaveValue(7));
    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.blur(input);
    expect(s.saveAttributionDays).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Los días van de 1 a 30");
  });

  it("enciende «Mostrar agotados»", async () => {
    s.saveCatalogSettings.mockResolvedValue({ attributionDays: 7, showSoldOut: true, pdfGeneratedAt: null, updatedByName: null });
    wrap(<GuionCatalogBox />);
    const sw = await screen.findByRole("switch", { name: "Mostrar agotados" });
    await waitFor(() => expect(sw).not.toBeDisabled());
    fireEvent.click(sw);
    await waitFor(() => expect(s.saveCatalogSettings).toHaveBeenCalledWith({ showSoldOut: true }));
  });

  it("regenera el Catálogo PDF con el toast del mockup", async () => {
    const createObjectURL = jest.fn(() => "blob:pdf");
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    s.generateCatalogPdf.mockResolvedValue(new Blob(["%PDF-"], { type: "application/pdf" }));
    wrap(<GuionCatalogBox />);
    fireEvent.click(await screen.findByRole("button", { name: /Catálogo PDF/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Regenerar/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Catálogo PDF regenerado con precios y stock de hoy"));
    expect(await screen.findByTitle("Vista previa del catálogo PDF")).toBeInTheDocument();
  });
});

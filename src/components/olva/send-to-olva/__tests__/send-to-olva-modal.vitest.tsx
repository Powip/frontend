import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaStandardSize } from "@/features/olva/olva-catalog/mappers/to-olva-standard-size";
import { buildOlvaStandardSizesResponse } from "@/features/olva/olva-catalog/test-utils/olva-catalog.fixtures";
import { OLVA_SHIPMENT_STATUSES } from "@/features/olva/shared/constants/olva-enums.constants";
import SendToOlvaModal from "../SendToOlvaModal";
import {
  buildAgency,
  buildBulkResult,
  buildGuide,
  buildHeadquarter,
  buildOrderDetail,
  buildSenderProfile,
  buildShipmentSummary,
  buildUbigeos,
  COMPANY_ID,
  GUIDE_ID,
} from "../test-utils/send-to-olva.fixtures";

const services = vi.hoisted(() => ({
  getOlvaShipments: vi.fn(),
  getOlvaShipment: vi.fn(),
  regenerateOlvaShipmentPaymentLink: vi.fn(),
  getOlvaUbigeos: vi.fn(),
  bulkCreateOlvaShipments: vi.fn(),
  getOlvaShipmentLabel: vi.fn(),
  getOlvaHeadquarters: vi.fn(),
  getOlvaStandardSizes: vi.fn(),
  getOlvaArticleCategories: vi.fn(),
  getOlvaAgencyDepartments: vi.fn(),
  getOlvaAgencyProvinces: vi.fn(),
  getOlvaAgencyDistricts: vi.fn(),
  getOlvaAgencies: vi.fn(),
  getOlvaAgency: vi.fn(),
  getOlvaSenderProfiles: vi.fn(),
  calculateOlvaQuote: vi.fn(),
  getOlvaPerson: vi.fn(),
}));

vi.mock("@/features/olva/olva-shipment/services/olva-shipment.service", () => ({
  getOlvaShipments: services.getOlvaShipments,
  getOlvaShipment: services.getOlvaShipment,
  regenerateOlvaShipmentPaymentLink: services.regenerateOlvaShipmentPaymentLink,
  bulkCreateOlvaShipments: services.bulkCreateOlvaShipments,
  getOlvaShipmentLabel: services.getOlvaShipmentLabel,
}));
vi.mock("@/features/olva/olva-catalog/services/olva-catalog.service", () => ({
  getOlvaHeadquarters: services.getOlvaHeadquarters,
  getOlvaStandardSizes: services.getOlvaStandardSizes,
  getOlvaArticleCategories: services.getOlvaArticleCategories,
  getOlvaUbigeos: services.getOlvaUbigeos,
}));
vi.mock("@/features/olva/olva-agency/services/olva-agency.service", () => ({
  getOlvaAgencyDepartments: services.getOlvaAgencyDepartments,
  getOlvaAgencyProvinces: services.getOlvaAgencyProvinces,
  getOlvaAgencyDistricts: services.getOlvaAgencyDistricts,
  getOlvaAgencies: services.getOlvaAgencies,
  getOlvaAgency: services.getOlvaAgency,
}));
vi.mock("@/features/olva/olva-sender-profile/services/olva-sender-profile.service", () => ({
  getOlvaSenderProfiles: services.getOlvaSenderProfiles,
}));
vi.mock("@/features/olva/olva-quote/services/olva-quote.service", () => ({
  calculateOlvaQuote: services.calculateOlvaQuote,
}));
vi.mock("@/features/olva/olva-person/services/olva-person.service", () => ({
  getOlvaPerson: services.getOlvaPerson,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "token",
      user: { id: "user-1" },
      company: { id: "company-1", name: "Mi Empresa" },
    },
  }),
}));
vi.mock("@/lib/axiosAuth", () => ({ default: {} }));
vi.mock("@/utils/printShippingGuide", () => ({ printShippingGuide: vi.fn() }));
vi.mock("@/utils/printOrderLabel", () => ({ printOrderLabelsBatch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
// These tests cover the online flows (home delivery, card), so they run with online payment on
vi.mock("../constants/send-to-olva.constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../constants/send-to-olva.constants")>()),
  SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE: true,
}));

const AGENCY_OPTION = "Agencia Lima Centro — Jr. de la Unión 100";
const firstOrder = buildOrderDetail();
const secondOrder = buildOrderDetail({
  id: "order-2",
  orderNumber: "PED-1002",
  customer: { ...firstOrder.customer, fullName: "Ana Ruiz", dni: "87654321" },
});

function renderModal(orders = [firstOrder]) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SendToOlvaModal
        open
        orders={orders}
        guideId={GUIDE_ID}
        companyId={COMPANY_ID}
        guide={buildGuide()}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </QueryClientProvider>,
  );

  return { onClose, onSuccess, user: userEvent.setup({ delay: null }) };
}

async function choosePayer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("combobox", { name: /Quién paga/ }));
  await user.click(await screen.findByRole("option", { name: "Pago en tienda" }));
}

async function chooseAgency(user: ReturnType<typeof userEvent.setup>, position: number) {
  // A combobox takes its name from the author, not from its text, so it is found by that text.
  // The place is guessed level by level (department, province, district), each one a request.
  const triggers = await screen.findAllByText("Elige una agencia", {}, { timeout: 5000 });

  await user.click(triggers[position]);

  // Agencies already chosen in other cards show the same label: the open list is the last one
  const options = await screen.findAllByText(AGENCY_OPTION);

  await user.click(options[options.length - 1]);
}

describe("SendToOlvaModal", () => {
  beforeEach(() => {
    const division = (name: string) => [{ name, agencyCount: 5 }];

    services.getOlvaShipments.mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
    });
    services.getOlvaHeadquarters.mockResolvedValue([buildHeadquarter()]);
    services.getOlvaStandardSizes.mockResolvedValue(
      buildOlvaStandardSizesResponse().map(toOlvaStandardSize),
    );
    services.getOlvaArticleCategories.mockResolvedValue([]);
    services.getOlvaUbigeos.mockResolvedValue(buildUbigeos());
    services.getOlvaSenderProfiles.mockResolvedValue([buildSenderProfile()]);
    services.getOlvaAgencyDepartments.mockResolvedValue(division("LIMA"));
    services.getOlvaAgencyProvinces.mockResolvedValue(division("LIMA"));
    services.getOlvaAgencyDistricts.mockResolvedValue(division("MIRAFLORES"));
    services.getOlvaAgencies.mockResolvedValue([buildAgency()]);
    services.getOlvaAgency.mockResolvedValue(buildAgency());
    services.calculateOlvaQuote.mockResolvedValue({
      amount: 12.5,
      currency: "PEN",
      excessWeightKg: 0,
      deliveryType: "O",
    });
    services.bulkCreateOlvaShipments.mockResolvedValue(
      buildBulkResult([{ key: "order-1", status: "created" }]),
    );
  });

  it("leaves out the orders that already have an active shipment", async () => {
    services.getOlvaShipments.mockResolvedValue({
      items: [buildShipmentSummary("order-1")],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    });

    renderModal();

    expect(
      await screen.findByText("Todos los pedidos seleccionados ya tienen un envío activo en Olva."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar/ })).not.toBeInTheDocument();
  });

  it("shows a card per order, starting from the customer's address", async () => {
    renderModal([firstOrder, secondOrder]);

    expect(await screen.findByText("Pedido PED-1001")).toBeInTheDocument();
    expect(screen.getByText("Pedido PED-1002")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Juan Pérez")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("999888777")).toHaveLength(2);
    // The customer's place is found in Olva's agencies, so the agency list is already loaded.
    // It is guessed level by level (department, province, district), each one a request, so on a
    // slow machine it takes longer than waitFor's default 1s.
    await waitFor(
      () =>
        expect(services.getOlvaAgencies).toHaveBeenCalledWith(
          expect.objectContaining({ department: "LIMA", province: "LIMA", district: "MIRAFLORES" }),
        ),
      { timeout: 5000 },
    );
    expect(services.getOlvaAgencies).toHaveBeenCalledWith(
      expect.objectContaining({ department: "LIMA", province: "LIMA", district: "MIRAFLORES" }),
    );
  });

  it("asks who pays before it lets the lot go", async () => {
    renderModal();

    expect(
      await screen.findByText("Elige quién paga el envío para continuar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar 1 envío en Olva" })).toBeDisabled();
  });

  it("points at what is missing instead of sending an incomplete order", async () => {
    const { user } = renderModal();

    await choosePayer(user);
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    expect(await screen.findByText("Elige la agencia de destino")).toBeInTheDocument();
    expect(services.bulkCreateOlvaShipments).not.toHaveBeenCalled();
  });

  it("shows the live cost of an order once its agency is chosen", async () => {
    const { user } = renderModal();

    await choosePayer(user);
    await chooseAgency(user, 0);

    expect(await screen.findByText(/Costo estimado:/)).toBeInTheDocument();
    expect(await screen.findByText(/Total estimado:/)).toBeInTheDocument();
    expect(services.calculateOlvaQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        originUbigeo: "150122",
        destinationUbigeo: "150101",
        deliveryType: "O",
        // 1 kg on automatic: the smallest size that supports it is S (30×20×15 cm, up to 2 kg)
        shipmentType: 2,
        weightKg: 1,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
      }),
    );
  });

  it("does not register a weight that no Olva size supports", async () => {
    const { user } = renderModal();

    await choosePayer(user);
    await chooseAgency(user, 0);

    const weight = screen.getByLabelText("Peso (kg)");

    await user.clear(weight);
    await user.type(weight, "6");
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    expect(await screen.findByText("Olva admite hasta 5 kg por paquete.")).toBeInTheDocument();
    expect(services.bulkCreateOlvaShipments).not.toHaveBeenCalled();
  });

  it("registers the lot and shows what Olva answered for each order", async () => {
    const { user, onSuccess } = renderModal();

    await choosePayer(user);
    await chooseAgency(user, 0);
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    await waitFor(() => expect(services.bulkCreateOlvaShipments).toHaveBeenCalledTimes(1));
    expect(services.bulkCreateOlvaShipments.mock.calls[0][0].items).toEqual([
      expect.objectContaining({
        itemKey: "order-1",
        origin: { headquarterId: "12" },
        destination: expect.objectContaining({ agencyCode: "LIM01" }),
        recipient: expect.objectContaining({ documentNumber: "12345678", fullName: "Juan Pérez" }),
        package: expect.objectContaining({ weightKg: 1, declaredValue: 120.5 }),
        whoPays: "STORE",
        externalRef: { orderId: "order-1", guideId: GUIDE_ID },
      }),
    ]);

    expect(await screen.findByRole("button", { name: /Rótulo Olva/ })).toBeInTheDocument();
    expect(screen.getByText("Pedido PED-1001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Imprimir etiquetas/ })).toBeEnabled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("lets the user fix and resend only the orders Olva rejected", async () => {
    services.bulkCreateOlvaShipments.mockResolvedValueOnce(
      buildBulkResult([
        { key: "order-1", status: "created" },
        { key: "order-2", status: "failed" },
      ]),
    );

    const { user } = renderModal([firstOrder, secondOrder]);

    await choosePayer(user);
    await chooseAgency(user, 0);
    await chooseAgency(user, 0); // the first trigger now shows the choice, so the next one is first again
    await user.click(screen.getByRole("button", { name: "Registrar 2 envíos en Olva" }));

    await user.click(await screen.findByRole("button", { name: "Corregir y reintentar (1)" }));

    // Only the rejected order is back in the form, with the reason it failed
    expect(await screen.findByText("Pedido PED-1002")).toBeInTheDocument();
    expect(screen.queryByText("Pedido PED-1001")).not.toBeInTheDocument();
    expect(screen.getByText("Rechazado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar 1 envío en Olva" })).toBeEnabled();
  });

  it("never offers to resend an order that Olva registered but could not be saved", async () => {
    services.bulkCreateOlvaShipments.mockResolvedValueOnce(
      buildBulkResult([{ key: "order-1", status: "registered_not_saved" }]),
    );

    const { user } = renderModal();

    await choosePayer(user);
    await chooseAgency(user, 0);
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText(/No lo envíes de nuevo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir y reintentar/ })).not.toBeInTheDocument();
  });

  it("keeps the form as it was when the whole call fails", async () => {
    services.bulkCreateOlvaShipments.mockRejectedValueOnce(new Error("timeout"));

    const { user } = renderModal();

    await choosePayer(user);
    await chooseAgency(user, 0);
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    await waitFor(() => expect(services.bulkCreateOlvaShipments).toHaveBeenCalled());

    expect(await screen.findByRole("button", { name: "Registrar 1 envío en Olva" })).toBeEnabled();
    expect(screen.getByDisplayValue("Juan Pérez")).toBeInTheDocument();
  });

  it("closes without sending anything on cancel", async () => {
    const { user, onClose } = renderModal();

    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    expect(services.bulkCreateOlvaShipments).not.toHaveBeenCalled();
  });
});

describe("SendToOlvaModal home delivery", () => {
  // The customer lives in San Isidro, a district of the ubigeo catalog that is not the origin's
  const homeOrder = buildOrderDetail({
    customer: { ...firstOrder.customer, district: "San Isidro" },
  });

  beforeEach(() => {
    services.getOlvaShipments.mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
    });
    services.getOlvaHeadquarters.mockResolvedValue([buildHeadquarter()]);
    services.getOlvaStandardSizes.mockResolvedValue(
      buildOlvaStandardSizesResponse().map(toOlvaStandardSize),
    );
    services.getOlvaArticleCategories.mockResolvedValue([]);
    services.getOlvaUbigeos.mockResolvedValue(buildUbigeos());
    services.getOlvaSenderProfiles.mockResolvedValue([buildSenderProfile()]);
    services.getOlvaAgencyDepartments.mockResolvedValue([{ name: "LIMA", agencyCount: 5 }]);
    services.getOlvaAgencyProvinces.mockResolvedValue([{ name: "LIMA", agencyCount: 5 }]);
    services.getOlvaAgencyDistricts.mockResolvedValue([{ name: "MIRAFLORES", agencyCount: 5 }]);
    services.getOlvaAgencies.mockResolvedValue([buildAgency()]);
    services.getOlvaAgency.mockResolvedValue(buildAgency());
    services.calculateOlvaQuote.mockResolvedValue({
      amount: 18,
      currency: "PEN",
      excessWeightKg: 0,
      deliveryType: "D",
    });
    services.bulkCreateOlvaShipments.mockResolvedValue(
      buildBulkResult([{ key: "order-1", status: "created" }]),
    );
  });

  async function chooseHomeDelivery(user: ReturnType<typeof userEvent.setup>, position = 0) {
    const selects = await screen.findAllByRole("combobox", { name: "Tipo de entrega" });

    await user.click(selects[position]);
    await user.click(await screen.findByRole("option", { name: "Entrega a domicilio" }));
  }

  it("asks for the district instead of an agency, guessed from the customer's address", async () => {
    const { user } = renderModal([homeOrder]);

    await chooseHomeDelivery(user);

    expect(await screen.findByText("Distrito de entrega")).toBeInTheDocument();
    expect(await screen.findByText("SAN ISIDRO")).toBeInTheDocument();
    expect(screen.queryByText("Agencia de destino")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/PIN de recojo/)).not.toBeInTheDocument();
    // Home deliveries are paid online with their own method: the lot has no payer to ask for
    expect(screen.queryByRole("combobox", { name: /Quién paga/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Todo el lote es entrega a domicilio/)).toBeInTheDocument();
  });

  it("prices a home delivery from the district, without looking up an agency", async () => {
    const { user } = renderModal([homeOrder]);

    await chooseHomeDelivery(user);

    expect(await screen.findByText(/Costo estimado:/)).toBeInTheDocument();
    expect(services.calculateOlvaQuote).toHaveBeenCalledWith(
      expect.objectContaining({ destinationUbigeo: "150131", deliveryType: "D" }),
    );
    expect(services.getOlvaAgency).not.toHaveBeenCalled();
  });

  it("points at the reference when it is missing", async () => {
    const { user } = renderModal([homeOrder]);

    await chooseHomeDelivery(user);
    await screen.findByText("SAN ISIDRO");
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    expect(
      await screen.findByText(/La referencia es obligatoria para entrega a domicilio/),
    ).toBeInTheDocument();
    expect(services.bulkCreateOlvaShipments).not.toHaveBeenCalled();
  });

  it("registers a home delivery with its ubigeo, address and reference, paid online by card", async () => {
    const { user } = renderModal([homeOrder]);

    await chooseHomeDelivery(user);
    await screen.findByText("SAN ISIDRO");
    await user.type(screen.getByLabelText(/Referencia/), "Frente al parque");
    await user.click(screen.getByRole("button", { name: "Registrar 1 envío en Olva" }));

    await waitFor(() => expect(services.bulkCreateOlvaShipments).toHaveBeenCalledTimes(1));

    const [item] = services.bulkCreateOlvaShipments.mock.calls[0][0].items;

    expect(item).toMatchObject({
      deliveryType: "D",
      whoPays: "ONLINE",
      paymentMethod: "niubiz",
      destination: {
        ubigeoCode: "150131",
        address: "Av. Larco 123",
        reference: "Frente al parque",
      },
    });
    expect(item.destination).not.toHaveProperty("agencyCode");
    expect(item).not.toHaveProperty("pin");
  });

  it("mixes pickup and home delivery in one lot: the payer only governs the pickup", async () => {
    const { user } = renderModal([homeOrder, secondOrder]);

    await chooseHomeDelivery(user, 1);
    await choosePayer(user);
    await chooseAgency(user, 0);
    await user.type(await screen.findByLabelText(/Referencia/), "Frente al parque");
    await user.click(screen.getByRole("button", { name: "Registrar 2 envíos en Olva" }));

    await waitFor(() => expect(services.bulkCreateOlvaShipments).toHaveBeenCalledTimes(1));

    const [pickup, home] = services.bulkCreateOlvaShipments.mock.calls[0][0].items;

    expect(pickup).toMatchObject({
      deliveryType: "O",
      whoPays: "STORE",
      destination: { agencyCode: "LIM01" },
    });
    expect(home).toMatchObject({ deliveryType: "D", whoPays: "ONLINE", paymentMethod: "niubiz" });
  });
});

// Keeps the import used while the status constant documents which shipments hold an order
void OLVA_SHIPMENT_STATUSES;

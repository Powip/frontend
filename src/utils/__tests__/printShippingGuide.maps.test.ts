import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { printShippingGuide } from "../printShippingGuide";

/**
 * Guía de salida (documento que se imprime para el courier desde "Detalles de
 * Guía") — el enlace de Google Maps va bajo la dirección de su pedido, con la
 * URL completa y escapada.
 */
jest.mock("../printOrderLabel", () => ({ generateBarcode: () => "" }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const MAPS_URL =
  "https://www.google.com/maps/place/Av.+Arequipa+100/@-12.07,-77.03,17z/data=!3m1?entry=ttu&g_ep=EgoyMDI2";

function order(n: number, googleMapsUrl?: string | null): OrderDetail {
  return {
    id: `o-${n}`,
    orderNumber: `PED-00${n}`,
    status: "EN_ENVIO",
    grandTotal: 50,
    customer: {
      fullName: `Cliente ${n}`,
      phoneNumber: "999111222",
      district: "Lince",
      address: `Calle ${n}`,
      googleMapsUrl,
    },
    payments: [],
    items: [],
  } as unknown as OrderDetail;
}

function printAndCapture(orders: OrderDetail[]): Document {
  let html = "";
  const fakeWindow = {
    document: { write: (c: string) => (html = c), close: jest.fn() },
    focus: jest.fn(),
    print: jest.fn(),
  };
  jest.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
  printShippingGuide(
    {
      guideNumber: "G-1",
      courierName: "Olva",
      deliveryZones: [],
      status: "CREADA",
      created_at: "2026-09-01T15:00:00.000Z",
    },
    orders,
  );
  return new DOMParser().parseFromString(html, "text/html");
}

function addrCellOf(doc: Document, orderNumber: string): Element {
  const row = Array.from(doc.querySelectorAll("tbody tr")).find((tr) =>
    tr.textContent?.includes(orderNumber),
  );
  const cell = row?.querySelector("td.addr");
  if (!cell) throw new Error(`Sin fila para ${orderNumber}`);
  return cell;
}

describe("printShippingGuide — Google Maps", () => {
  it("incluye la URL completa en la celda de dirección del pedido correspondiente", () => {
    const doc = printAndCapture([order(1, MAPS_URL), order(2)]);

    const addr1 = addrCellOf(doc, "PED-001");
    const link = addr1.querySelector(".maps a");
    expect(addr1.textContent).toContain("Calle 1");
    expect(addr1.querySelector(".maps")?.textContent).toContain("Google Maps:");
    expect(link?.getAttribute("href")).toBe(MAPS_URL);
    expect(link?.textContent).toBe(MAPS_URL);

    const addr2 = addrCellOf(doc, "PED-002");
    expect(addr2.querySelector(".maps")).toBeNull();
    expect(addr2.textContent).not.toMatch(/undefined|null|Google Maps/);
  });

  it("parte la URL para que no desborde la celda", () => {
    const doc = printAndCapture([order(1, MAPS_URL)]);
    const css = doc.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/\.addr \.maps\{[^}]*word-break:break-all/);
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { FormProvider, type UseFormReturn, useForm } from "react-hook-form";

import type { Order } from "@/features/sales/models/order";
import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import { createSunatDocumentsSchema } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import { buildSunatDocumentFromSale } from "@/features/sunat/sunat-document/utils/build-sunat-document-from-sale";
import { GiftChoicePanel } from "../GiftChoicePanel";
import { ItemsEditTable } from "../ItemsEditTable";
import { ZeroValueLinesAlert } from "../ZeroValueLinesAlert";

/** Lo que se edita DENTRO de la ventana «Emitir comprobante». */

function sale(
  items: { sku: string; quantity: number; unitPrice: number }[],
  extra: Partial<Order> = {},
): Order {
  return {
    id: "order-1",
    taxMode: "AUTOMATICO",
    shippingTotal: 0,
    discountTotal: 0,
    customer: { fullName: "Cliente Prueba", documentType: "DNI", documentNumber: "12345678" },
    items: items.map((item, index) => ({
      id: `item-${index}`,
      productName: item.sku,
      discountAmount: 0,
      ...item,
    })),
    ...extra,
  } as unknown as Order;
}

const crema = { sku: "CREMA", quantity: 1, unitPrice: 100 };

let form: UseFormReturn<CreateSunatDocumentsFormValues>;

function Window({ order, children }: { order: Order; children?: ReactNode }) {
  form = useForm<CreateSunatDocumentsFormValues>({
    defaultValues: { documents: [buildSunatDocumentFromSale(order)] },
  });

  return (
    <FormProvider {...form}>
      <GiftChoicePanel />
      <ItemsEditTable />
      <ZeroValueLinesAlert />
      {children}
    </FormProvider>
  );
}

const items = () => form.getValues("documents.0.items");
const totals = () => form.getValues("documents.0.totals");
const panel = () => screen.queryByRole("region", { name: "Regalos del pedido" });
const discount = (name = "CREMA") => screen.getByLabelText(`Descuento de ${name}`);
const price = (name = "CREMA") => screen.getByLabelText(`Precio unitario de ${name}`);
const aparte = () => screen.getByRole("radio", { name: /Regalo aparte/ });
const promocion = () => screen.queryByRole("radio", { name: /Regalo de promoción/ });
const normalPrice = (name = "CREMA") => screen.getByLabelText(`Precio normal de ${name}`);
const alertText = () => screen.queryByRole("alert")?.textContent ?? "";

function type(input: HTMLElement, ...steps: string[]) {
  fireEvent.focus(input);
  for (const value of steps) {
    fireEvent.change(input, { target: { value } });
  }
}

describe("descuento del 100% escrito en la ventana (caso ORD-161155)", () => {
  it("aparece el panel de regalos y el mensaje rojo puede decir «elige arriba»", () => {
    render(<Window order={sale([crema])} />);
    expect(panel()).not.toBeInTheDocument();

    type(discount(), "100");

    expect(panel()).toBeInTheDocument();
    expect(aparte()).toBeInTheDocument();
    expect(promocion()).not.toBeInTheDocument(); // solo regalo: únicamente 13
    expect(alertText()).toContain("elige arriba");
  });

  it("teclear «1», «10», «100» no cambia lo escrito ni quita el foco", () => {
    render(<Window order={sale([crema])} />);
    const input = discount();
    input.focus();

    type(input, "1");
    expect(panel()).not.toBeInTheDocument();
    type(input, "10");
    expect(panel()).not.toBeInTheDocument();
    type(input, "100");

    expect(panel()).toBeInTheDocument();
    expect(discount()).toBe(input);
    expect(input).toHaveValue(100);
    expect(input).toHaveFocus();
    expect(items()[0]).toMatchObject({ unitPrice: 100, discountAmount: 100 });
  });

  it("precio normal sugerido con IGV: venta sin IGV, 100 sin IGV = 118.00", () => {
    render(<Window order={sale([crema])} />);
    type(discount(), "100");
    fireEvent.click(aparte());

    expect(normalPrice()).toHaveValue(118);
    expect(items()[0]).toMatchObject({ taxType: "13", unitPrice: 0, discountAmount: 0 });
    expect(totals()).toMatchObject({ discountTotal: 0, grandTotal: 0 });
    expect(alertText()).toBe("");
    expect(createSunatDocumentsSchema.safeParse(form.getValues()).success).toBe(true);
  });

  it("precio normal sugerido: venta con IGV incluido, S/ 100 sigue siendo 100.00", () => {
    render(<Window order={sale([crema], { taxMode: "INCLUIDO" })} />);
    type(discount(), "84.75"); // lo que la pantalla muestra como precio sin IGV
    fireEvent.click(aparte());

    expect(normalPrice()).toHaveValue(100);
  });

  it("quitar el descuento hace desaparecer el panel y la línea vuelve a lo normal", () => {
    render(<Window order={sale([crema])} />);
    type(discount(), "100");
    type(discount(), "5");

    expect(panel()).not.toBeInTheDocument();
    expect(items()[0]).toMatchObject({ taxType: "10", unitPrice: 100, discountAmount: 5 });
    expect(totals()).toMatchObject({ subtotal: 95, grandTotal: 112.1 });
  });

  it("elegir y quitar la elección no corrompe valores ni totales", () => {
    render(<Window order={sale([crema])} />);
    type(discount(), "100");
    fireEvent.blur(discount());

    for (let round = 0; round < 2; round += 1) {
      fireEvent.click(aparte());
      expect(aparte()).toHaveAttribute("aria-checked", "true");
      fireEvent.click(aparte()); // tocar la opción marcada la quita
      expect(aparte()).toHaveAttribute("aria-checked", "false");
    }

    expect(items()[0]).toMatchObject({ taxType: "10", unitPrice: 100, discountAmount: 100 });
    expect(discount()).toHaveValue(100);
    expect(price()).toHaveValue(100);
    expect(totals()).toMatchObject({ discountTotal: 100, grandTotal: 0 });
  });

  it("el precio normal escrito a mano no se pierde al quitar y volver a elegir", () => {
    render(<Window order={sale([crema])} />);
    type(discount(), "100");
    fireEvent.click(aparte());
    type(normalPrice(), "1", "15", "150");
    fireEvent.click(aparte());
    fireEvent.click(aparte());

    expect(normalPrice()).toHaveValue(150);
  });
});

describe("precio 0 escrito en la ventana", () => {
  it("sugiere el precio que traía la venta, no un valor a medio borrar", () => {
    render(<Window order={sale([crema])} />);
    type(price(), "10", "1", "", "0");
    fireEvent.click(aparte());

    expect(normalPrice()).toHaveValue(118);
  });

  it("volver a poner precio hace desaparecer el panel", () => {
    render(<Window order={sale([crema])} />);
    type(price(), "0");
    expect(panel()).toBeInTheDocument();

    type(price(), "8", "80");

    expect(panel()).not.toBeInTheDocument();
    expect(totals()).toMatchObject({ grandTotal: 94.4 });
  });
});

describe("ítem agregado en la ventana", () => {
  it("en 0 ofrece 31 y 13, pide el precio normal y con precio desaparece", () => {
    render(<Window order={sale([crema])} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar ítem" }));

    expect(promocion()).toBeInTheDocument();
    fireEvent.click(aparte());
    expect(normalPrice("Nuevo ítem")).toHaveValue(null);
    expect(alertText()).toContain("precio normal");
    expect(alertText()).not.toContain("elige arriba");

    fireEvent.click(aparte());
    type(price("Nuevo ítem"), "20");
    expect(panel()).not.toBeInTheDocument();
  });

  it("si se quita la compra, la promoción (31) ya no vale y se pide elegir", () => {
    render(<Window order={sale([crema, { sku: "GORRA", quantity: 1, unitPrice: 30 }])} />);
    type(discount("GORRA"), "30");
    fireEvent.click(promocion() as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Quitar CREMA" }));

    expect(promocion()).not.toBeInTheDocument();
    expect(aparte()).toHaveAttribute("aria-checked", "false");
    expect(alertText()).toContain("elige arriba");

    fireEvent.click(aparte());
    expect(items()[0].taxType).toBe("13");
    expect(alertText()).toBe("");
  });
});

describe("el envío nunca es regalo", () => {
  it("envío en 0: sin panel y el mensaje rojo no dice «elige arriba»", () => {
    render(<Window order={sale([crema], { shippingTotal: 10 } as Partial<Order>)} />);
    type(price("Servicio de entrega"), "0");

    expect(panel()).not.toBeInTheDocument();
    expect(alertText()).toContain("Servicio de entrega");
    expect(alertText()).not.toContain("elige arriba");
  });
});

describe("la unidad del descuento", () => {
  it("la tabla dice que es un monto en soles sin IGV", () => {
    render(<Window order={sale([crema])} />);

    expect(screen.getByRole("columnheader", { name: /Descuento/ })).toHaveTextContent(
      "Descuento (S/ sin IGV)",
    );
  });
});

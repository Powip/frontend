import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import type { OrderHeader } from "@/interfaces/IOrder";
import { ShippingCostCell } from "../ShippingCostCell";

const mockedPatch = axios.patch as unknown as jest.Mock;
const mockedToast = toast as unknown as { error: jest.Mock; success: jest.Mock };

// La API devuelve los decimales como string ("15.00"), no como number.
function orderWithCost(carrierShippingCost: OrderHeader["carrierShippingCost"]) {
  return { id: "o-1", orderNumber: "PED-1", carrierShippingCost } as unknown as OrderHeader;
}

function setup(carrierShippingCost: OrderHeader["carrierShippingCost"]) {
  const onSaved = jest.fn();
  render(
    <table>
      <tbody>
        <tr>
          <ShippingCostCell order={orderWithCost(carrierShippingCost)} onSaved={onSaved} />
        </tr>
      </tbody>
    </table>,
  );
  const input = screen.getByRole("textbox", { name: /costo de envío del pedido PED-1/i }) as HTMLInputElement;
  return { input, onSaved, user: userEvent.setup() };
}

beforeEach(() => {
  mockedPatch.mockReset();
  mockedPatch.mockResolvedValue({ data: {} });
  mockedToast.error.mockReset();
  mockedToast.success.mockReset();
});

describe("ShippingCostCell", () => {
  it("muestra el costo guardado con 2 decimales aunque la API lo mande como string", () => {
    const { input } = setup("15");
    expect(input.value).toBe("15.00");
  });

  it("deja la celda vacía cuando el pedido no tiene costo (0)", () => {
    const { input } = setup(0);
    expect(input.value).toBe("");
  });

  it("guarda el monto tipeado como NÚMERO y acepta la coma decimal", async () => {
    const { input, onSaved, user } = setup(0);

    await user.type(input, "12,5");
    await user.tab();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("o-1", { carrierShippingCost: 12.5 }));
    expect(mockedPatch).toHaveBeenCalledTimes(1);
    expect(mockedPatch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/o-1$/), {
      carrierShippingCost: 12.5,
    });
    expect(mockedToast.success).toHaveBeenCalled();
    expect(input.value).toBe("12.50");
  });

  it("guarda con Enter sin tener que salir del campo", async () => {
    const { input, onSaved, user } = setup(0);

    await user.type(input, "8{Enter}");

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("o-1", { carrierShippingCost: 8 }));
    expect(mockedPatch).toHaveBeenCalledTimes(1);
  });

  it("vaciar un costo ya cargado lo vuelve a dejar en 0", async () => {
    const { input, onSaved, user } = setup("15.00");

    await user.clear(input);
    await user.tab();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("o-1", { carrierShippingCost: 0 }));
    expect(mockedPatch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/o-1$/), {
      carrierShippingCost: 0,
    });
  });

  it("no llama a la API si el valor no cambió", async () => {
    const { input, onSaved, user } = setup("15.00");

    await user.click(input);
    await user.tab();

    expect(mockedPatch).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each([
    ["texto", "abc"],
    ["negativo", "-5"],
    ["miles con coma (se leería como 1,2)", "1,200"],
    ["más de 2 decimales", "12.345"],
  ])("rechaza un monto inválido (%s): no guarda, avisa y restaura el valor", async (_caso, typed) => {
    const { input, onSaved, user } = setup("15.00");

    await user.clear(input);
    await user.type(input, typed);
    await user.tab();

    expect(mockedPatch).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("15.00");
  });

  it("si el servidor falla, avisa, no actualiza la tabla y restaura el valor anterior", async () => {
    mockedPatch.mockRejectedValueOnce(new Error("500"));
    const { input, onSaved, user } = setup("15.00");

    await user.clear(input);
    await user.type(input, "20");
    await user.tab();

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockedToast.success).not.toHaveBeenCalled();
    expect(input.value).toBe("15.00");
  });
});

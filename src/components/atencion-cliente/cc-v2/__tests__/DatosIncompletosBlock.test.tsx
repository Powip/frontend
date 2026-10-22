import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DatosIncompletosBlock } from "../DatosIncompletosBlock";
import { updateDatosClienteCC } from "@/services/atencionClienteService";

jest.mock("@/services/atencionClienteService", () => ({
  updateDatosClienteCC: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const customer = {
  province: "Lima",
  city: "Lima",
  district: "Miraflores",
  address: "Av. Larco 123",
};
const baseProps = {
  orderId: "order-1",
  dniCliente: "45678912",
  customer,
  onDatosCompletos: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

test("permite corregir y guardar el DNI importado aunque ya tenga ocho dígitos", async () => {
  jest.mocked(updateDatosClienteCC).mockResolvedValue({} as never);
  render(<DatosIncompletosBlock {...baseProps} />);

  fireEvent.click(screen.getByRole("button", { name: "Editar DNI y dirección" }));
  fireEvent.change(screen.getByLabelText("DNI del cliente"), {
    target: { value: "46789123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar Datos" }));

  await waitFor(() => expect(updateDatosClienteCC).toHaveBeenCalledWith("order-1", {
    dniCliente: "46789123",
    ...customer,
  }));
  expect(baseProps.onDatosCompletos).toHaveBeenCalledTimes(1);
});

test("conserva el borrador si el cliente vuelve a renderizarse con los mismos datos", () => {
  const { rerender } = render(<DatosIncompletosBlock {...baseProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar DNI y dirección" }));
  fireEvent.change(screen.getByLabelText("DNI del cliente"), {
    target: { value: "46789123" },
  });

  rerender(<DatosIncompletosBlock {...baseProps} customer={{ ...customer }} />);

  expect(screen.getByLabelText("DNI del cliente")).toHaveValue("46789123");
});

test("actualiza los campos y su validación al cambiar el pedido o sus datos", () => {
  const { rerender } = render(<DatosIncompletosBlock {...baseProps} />);
  rerender(<DatosIncompletosBlock {...baseProps} orderId="order-2" dniCliente={null} />);
  expect(screen.getByLabelText("DNI del cliente")).toHaveValue("");

  fireEvent.change(screen.getByLabelText("DNI del cliente"), {
    target: { value: "46789123" },
  });
  rerender(<DatosIncompletosBlock {...baseProps} orderId="order-2" dniCliente="48912345" />);
  fireEvent.click(screen.getByRole("button", { name: "Editar DNI y dirección" }));
  expect(screen.getByLabelText("DNI del cliente")).toHaveValue("48912345");
});

test.each(["00000000", "12345678"])("permite corregir el DNI genérico %s y evita guardarlo como válido", (dniCliente) => {
  render(<DatosIncompletosBlock {...baseProps} dniCliente={dniCliente} />);

  expect(screen.getByLabelText("DNI del cliente")).toHaveValue(dniCliente);
  expect(screen.getByText("Ingresa un DNI válido")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Completá todos los campos para continuar" })).toBeDisabled();
  expect(updateDatosClienteCC).not.toHaveBeenCalled();
});

test("permite ingresar un DNI sin campos de dirección cuando no hay cliente cargado", async () => {
  jest.mocked(updateDatosClienteCC).mockResolvedValue({} as never);
  render(<DatosIncompletosBlock {...baseProps} customer={null} dniCliente={null} />);

  fireEvent.change(screen.getByLabelText("DNI del cliente"), {
    target: { value: "46789123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar Datos" }));

  await waitFor(() => expect(updateDatosClienteCC).toHaveBeenCalledWith("order-1", {
    dniCliente: "46789123",
  }));
});

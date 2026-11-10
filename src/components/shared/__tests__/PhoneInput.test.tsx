import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhoneInput } from "../PhoneInput";

const onChange = jest.fn();

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneInput
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

const country = () => screen.getByLabelText("Código de país") as HTMLSelectElement;
const number = () => screen.getByPlaceholderText(/Número de teléfono|\+código y número/) as HTMLInputElement;

beforeEach(() => onChange.mockClear());

describe("PhoneInput", () => {
  it("Perú (+51) es el país por defecto", () => {
    render(<Harness />);
    expect(country().value).toBe("51");
  });

  it("un celular peruano se emite igual que siempre: 9 dígitos sin prefijo", () => {
    render(<Harness />);
    fireEvent.change(number(), { target: { value: "999 888 777" } });
    expect(onChange).toHaveBeenLastCalledWith("999888777");
    expect(number().value).toBe("999888777");
  });

  it("al elegir otro país el número se emite en formato internacional", () => {
    render(<Harness />);
    fireEvent.change(country(), { target: { value: "54" } });
    fireEvent.change(number(), { target: { value: "9 11 2345-6789" } });
    expect(onChange).toHaveBeenLastCalledWith("+5491123456789");
    expect(country().value).toBe("54");
  });

  it.each([
    ["1", "(415) 555-2671", "+14155552671"],
    ["34", "612 345 678", "+34612345678"],
    ["57", "300 1234567", "+573001234567"],
    ["56", "9 8765 4321", "+56987654321"],
  ])("país +%s con %s emite %s", (dial, typed, expected) => {
    render(<Harness />);
    fireEvent.change(country(), { target: { value: dial } });
    fireEvent.change(number(), { target: { value: typed } });
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it("pegar un número completo con + detecta el país", () => {
    render(<Harness />);
    fireEvent.change(number(), { target: { value: "+34 612 345 678" } });
    expect(onChange).toHaveBeenLastCalledWith("+34612345678");
    expect(country().value).toBe("34");
    expect(number().value).toBe("612345678");
  });

  it("muestra un valor guardado: extranjero con su país y peruano con 51 sin el prefijo", () => {
    const view = render(<Harness initial="+14155552671" />);
    expect(country().value).toBe("1");
    expect(number().value).toBe("4155552671");
    view.unmount();
    render(<Harness initial="51999888777" />);
    expect(country().value).toBe("51");
    expect(number().value).toBe("999888777");
  });

  it("cambiar de país con un número ya escrito conserva el número", () => {
    render(<Harness initial="999888777" />);
    fireEvent.change(country(), { target: { value: "54" } });
    expect(onChange).toHaveBeenLastCalledWith("+54999888777");
  });

  it("un código que no está en la lista se escribe con + en 'Otro'", () => {
    render(<Harness />);
    fireEvent.change(country(), { target: { value: "" } });
    fireEvent.change(number(), { target: { value: "+998 90 123 45 67" } });
    expect(onChange).toHaveBeenLastCalledWith("+998901234567");
    expect(country().value).toBe("");
  });

  it("vaciar el campo emite cadena vacía", () => {
    render(<Harness initial="+14155552671" />);
    fireEvent.change(number(), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("no deja teclear letras", () => {
    render(<Harness />);
    fireEvent.change(number(), { target: { value: "abc" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

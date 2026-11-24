import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import LiveDeliveryForm from "../LiveDeliveryForm";
import type { LiveDelivery, StoreDeliveryOption } from "../types";

const baths: StoreDeliveryOption = {
  id: "shalom-247",
  enabled: true,
  type: "AGENCY",
  courier: "SHALOM",
  department: "Cajamarca",
  province: "Cajamarca",
  district: "Los Baños Del Inca",
  agencyId: "247",
  agency: "Baños del Inca",
  address: "JR. CAHUIDE N° 242",
  price: 10,
};
const city: StoreDeliveryOption = {
  ...baths,
  id: "shalom-12",
  agencyId: "12",
  agency: "Cajamarca centro",
  district: "Cajamarca",
  address: "Av. Independencia N° 787",
};
const destination: LiveDelivery = {
  type: "AGENCY",
  courier: "SHALOM",
  department: "Cajamarca",
  province: "Cajamarca",
  district: "Los Baños Del Inca",
  agencyId: "247",
  agency: "Baños del Inca",
};

function Form({
  initial = destination,
  options = [baths, city],
  onDelivery = jest.fn(),
}: {
  initial?: LiveDelivery;
  options?: StoreDeliveryOption[];
  onDelivery?: (delivery: LiveDelivery) => void;
}) {
  const [delivery, setDelivery] = useState(initial);
  return (
    <LiveDeliveryForm
      delivery={delivery}
      receipt={{ type: "BOLETA" }}
      options={options}
      total={234}
      name="Comprador de prueba"
      onDelivery={(value) => {
        setDelivery(value);
        onDelivery(value);
      }}
      onReceipt={jest.fn()}
    />
  );
}

/** A8: el ubigeo se elige buscando en un combobox (escribir y tocar la opción). */
function pick(label: string, option: string) {
  const box = screen.getByRole("combobox", { name: label });
  fireEvent.change(box, { target: { value: option } });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

test("only offers agencies for the selected district and province-wide coverage", () => {
  render(
    <Form
      options={[
        { ...baths, department: " Cajamarca ", district: " LOS BANOS DEL INCA " },
        city,
        { ...city, id: "provincial", agencyId: "all", agency: "Toda la provincia", district: "" },
        { ...baths, id: "disabled", agencyId: "off", agency: "Deshabilitada", enabled: false },
        { ...baths, id: "olva", agencyId: "other", agency: "Otro courier", courier: "OLVA" },
        { ...baths, id: "chota", agencyId: "chota", agency: "Otra provincia", province: "Chota" },
      ]}
    />,
  );
  const agency = screen.getByLabelText("Agencia");
  expect(
    within(agency)
      .getAllByRole("option")
      .map((option) => option.textContent?.replace(/\s/g, " ")),
  ).toEqual(["Elige la agencia", "Baños del Inca · S/ 10.00", "Toda la provincia · S/ 10.00"]);
  expect(agency).toHaveValue("247");
});

test("changing district clears the old agency and address before choosing a new one", () => {
  const onDelivery = jest.fn();
  render(<Form onDelivery={onDelivery} />);
  expect(screen.getByText(/JR\. CAHUIDE/)).toBeInTheDocument();
  pick("Distrito", "Cajamarca");
  expect(onDelivery).toHaveBeenLastCalledWith(
    expect.objectContaining({ district: "Cajamarca", agencyId: "", agency: "" }),
  );
  expect(screen.getByLabelText("Agencia")).toHaveValue("");
  expect(screen.queryByText(/JR\. CAHUIDE/)).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /Baños del Inca ·/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Agencia"), { target: { value: "12" } });
  expect(onDelivery).toHaveBeenLastCalledWith(
    expect.objectContaining({ district: "Cajamarca", agencyId: "12", agency: "Cajamarca centro" }),
  );
});

test("waits for a district and explains when it has no enabled agency", () => {
  render(<Form initial={{ ...destination, district: "", agencyId: "", agency: "" }} />);
  expect(screen.getByLabelText("Agencia")).toBeDisabled();
  pick("Distrito", "Namora");
  expect(screen.getByText(/no tiene agencias habilitadas.*en este distrito/)).toBeInTheDocument();
  expect(within(screen.getByLabelText("Agencia")).getAllByRole("option")).toHaveLength(1);
});

test("ubigeo fields are searchable comboboxes and choosing a level clears the ones below (A8)", () => {
  const onDelivery = jest.fn();
  render(<Form onDelivery={onDelivery} />);
  const district = screen.getByRole("combobox", { name: "Distrito" });
  expect(district).toHaveValue("Los Baños Del Inca");
  fireEvent.change(screen.getByRole("combobox", { name: "Departamento" }), { target: { value: "junín" } });
  expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Junin",
  ]);
  fireEvent.click(screen.getByRole("option", { name: "Junin" }));
  expect(onDelivery).toHaveBeenLastCalledWith(
    expect.objectContaining({ department: "Junin", province: "", district: "", agencyId: "" }),
  );
  expect(screen.getByRole("combobox", { name: "Provincia" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Distrito" })).toBeDisabled();
  pick("Provincia", "Huancayo");
  expect(screen.getByRole("combobox", { name: "Distrito" })).toBeEnabled();
  pick("Distrito", "Chilca");
  expect(onDelivery).toHaveBeenLastCalledWith(
    expect.objectContaining({ department: "Junin", province: "Huancayo", district: "Chilca", type: "AGENCY" }),
  );
});

test("Lima and Callao offer home or agency; the rest of the country only agency (A8)", () => {
  render(<Form initial={{ type: "AGENCY", courier: "SHALOM" }} options={[]} />);
  pick("Departamento", "Lima");
  pick("Provincia", "Lima");
  expect(screen.getByRole("radio", { name: /A domicilio/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /agencia/i })).not.toBeChecked();
  pick("Departamento", "Callao");
  pick("Provincia", "Callao");
  expect(screen.getByRole("radio", { name: /A domicilio/ })).toBeInTheDocument();
  pick("Departamento", "Arequipa");
  pick("Provincia", "Arequipa");
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(
    screen.getByText("Para Arequipa el envío es a una agencia: eliges el courier y la agencia donde recoges."),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Dirección")).not.toBeInTheDocument();
});

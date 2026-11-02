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
  fireEvent.change(screen.getByLabelText("Distrito"), { target: { value: "Cajamarca" } });
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
  fireEvent.change(screen.getByLabelText("Distrito"), { target: { value: "Namora" } });
  expect(screen.getByText(/no tiene agencias habilitadas.*en este distrito/)).toBeInTheDocument();
  expect(within(screen.getByLabelText("Agencia")).getAllByRole("option")).toHaveLength(1);
});

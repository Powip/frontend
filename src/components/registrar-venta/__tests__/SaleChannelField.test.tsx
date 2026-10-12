import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SalesChannel } from "@/enum/Order.enum";
import type { SaleSalesChannel } from "@/services/saleContextService";
import { hasSaleChannelSelection, SaleChannelField } from "../SaleChannelField";

jest.mock("@/components/ui/select", () => {
  function Select({ value, disabled, onValueChange, children }: {
    value?: string;
    disabled?: boolean;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) {
    return (
      <select aria-label="Canal de venta" value={value} disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}>
        <option value="">Seleccionar canal de venta</option>
        {children}
      </select>
    );
  }
  function SelectContent({ children }: { children: ReactNode }) { return <>{children}</>; }
  function SelectItem({ value, children }: { value: string; children: ReactNode }) {
    return <option value={value}>{children}</option>;
  }
  function SelectTrigger() { return null; }
  function SelectValue() { return null; }
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

const channel: SaleSalesChannel = {
  id: "channel-a",
  storeId: "store-a",
  type: "WHATSAPP",
  label: "WhatsApp Centro",
  identifier: "+51999999999",
  externalId: null,
  isActive: true,
};
it("exige una instancia de la tienda cuando hay canales configurados", () => {
  expect(
    hasSaleChannelSelection({ channels: [channel], legacyType: "WHATSAPP", editing: false }),
  ).toBe(false);
  expect(
    hasSaleChannelSelection({ channels: [channel], selectedId: "foreign", editing: false }),
  ).toBe(false);
  expect(
    hasSaleChannelSelection({ channels: [channel], selectedId: channel.id, editing: false }),
  ).toBe(true);
  expect(
    hasSaleChannelSelection({
      channels: [{ ...channel, isActive: false }],
      selectedId: channel.id,
      editing: false,
    }),
  ).toBe(false);
});
it("permite canales habituales sin configuración personalizada y conserva canal fijo histórico", () => {
  expect(hasSaleChannelSelection({ channels: [], legacyType: "WHATSAPP", editing: false })).toBe(
    true,
  );
  expect(hasSaleChannelSelection({ channels: [], fixedId: channel.id, editing: true })).toBe(true);
  render(
    <SaleChannelField
      channels={[]}
      legacyChannels={["WHATSAPP"]}
      fixedId={channel.id}
      valueType="WHATSAPP"
      editing
      onChange={jest.fn()}
    />,
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByText("El canal registrado se conserva.")).toBeInTheDocument();
});

it("mantiene usable una venta nueva sin canales personalizados y no asigna un canal automáticamente", () => {
  const onChange = jest.fn();
  const props = { channels: [], legacyChannels: ["WHATSAPP", "WEB"], editing: false, onChange };
  const { rerender } = render(<SaleChannelField {...props} />);
  const field = screen.getByRole("combobox", { name: "Canal de venta" });
  expect(field).toHaveValue("");
  expect(field).not.toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByText(/Canal sin identificar/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "personalizarlos para esta tienda." }))
    .toHaveAttribute("href", "/configuracion/tiendas");
  expect(hasSaleChannelSelection({ channels: [], editing: false })).toBe(false);

  fireEvent.change(field, { target: { value: "legacy:WHATSAPP" } });
  expect(onChange).toHaveBeenCalledWith(undefined, SalesChannel.WHATSAPP);
  rerender(<SaleChannelField {...props} valueType="WHATSAPP" />);
  expect(field).toHaveValue("legacy:WHATSAPP");
  expect(hasSaleChannelSelection({ channels: [], legacyType: "WHATSAPP", editing: false }))
    .toBe(true);
});

it("ofrece sólo canales configurados para ventas nuevas y conserva su identidad al elegir", () => {
  const onChange = jest.fn();
  render(<SaleChannelField channels={[channel]} legacyChannels={["WHATSAPP", "WEB"]}
    editing={false} onChange={onChange} />);
  expect(screen.queryByRole("option", { name: "WEB" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: channel.id } });
  expect(onChange).toHaveBeenCalledWith(channel.id, SalesChannel.WHATSAPP);
});

it("conserva el canal identificado histórico aunque ya no aparezca entre los canales activos", () => {
  const onChange = jest.fn();
  render(<SaleChannelField channels={[channel]} legacyChannels={["WHATSAPP"]}
    fixedId="archived-channel" valueType="WEB" editing onChange={onChange} />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByText("WEB · registrado")).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  expect(hasSaleChannelSelection({ channels: [channel], fixedId: "archived-channel", editing: true }))
    .toBe(true);
});

it("preserva el tipo de una venta histórica sin identificar hasta que el usuario confirme otro canal", () => {
  const onChange = jest.fn();
  render(<SaleChannelField channels={[channel]} legacyChannels={["WEB"]}
    valueType="WEB" editing onChange={onChange} />);
  expect(screen.getByRole("combobox")).toHaveValue("legacy:WEB");
  expect(screen.getByRole("option", { name: "WEB · anterior sin identificar" })).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  expect(hasSaleChannelSelection({ channels: [channel], legacyType: "WEB", editing: true })).toBe(true);
});

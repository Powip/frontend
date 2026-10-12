import { render, screen } from "@testing-library/react";
import type { SaleSalesChannel } from "@/services/saleContextService";
import { hasSaleChannelSelection, SaleChannelField } from "../SaleChannelField";

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
it("permite tipo legado sólo como origen sin identificar y conserva canal fijo histórico", () => {
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

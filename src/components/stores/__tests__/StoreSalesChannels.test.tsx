import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import type { StoreSalesChannel } from "@/services/storeChannelsService";
import {
  createStoreSalesChannel,
  deactivateStoreSalesChannel,
  fetchStoreSalesChannels,
  updateStorePresentation,
  updateStoreSalesChannel,
} from "@/services/storeChannelsService";
import StoreSalesChannels from "../StoreSalesChannels";

jest.mock("@/services/storeChannelsService", () => ({
  ...jest.requireActual("@/services/storeChannelsService"),
  fetchStoreSalesChannels: jest.fn(),
  createStoreSalesChannel: jest.fn(),
  updateStoreSalesChannel: jest.fn(),
  deactivateStoreSalesChannel: jest.fn(),
  updateStorePresentation: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
const shop = { id: "shop-a", name: "LIVII", color: "#7C3AED" };
const secondShop = { id: "shop-b", name: "KUNCA", color: "#0891B2" };
const legacy = {
  id: "old-store",
  name: "Tienda de Corporación",
  is_legacy: true,
};
const channel: StoreSalesChannel = {
  id: "channel-a",
  storeId: shop.id,
  type: "WHATSAPP",
  label: "WhatsApp ventas",
  identifier: "+51987111222",
  normalizedIdentifier: "+51987111222",
  externalId: null,
  isActive: true,
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.HTMLElement.prototype.hasPointerCapture = jest.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = jest.fn();
  if (!window.PointerEvent) window.PointerEvent = MouseEvent as typeof PointerEvent;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchStoreSalesChannels).mockResolvedValue([channel]);
  jest.mocked(createStoreSalesChannel).mockResolvedValue(channel);
  jest.mocked(updateStoreSalesChannel).mockResolvedValue(channel);
  jest.mocked(deactivateStoreSalesChannel).mockResolvedValue({ ...channel, isActive: false });
});
const show = (props: Partial<React.ComponentProps<typeof StoreSalesChannels>> = {}) =>
  render(
    <StoreSalesChannels stores={[shop, legacy]} canManage onColorChange={jest.fn()} {...props} />,
  );

describe("Canales comerciales por tienda", () => {
  it("excludes the inherited store without inventing a new historical origin", async () => {
    show();
    expect(await screen.findByText(channel.label)).toBeInTheDocument();
    expect(screen.queryByText(legacy.name)).not.toBeInTheDocument();
    expect(fetchStoreSalesChannels).toHaveBeenCalledWith(shop.id, expect.any(AbortSignal));
  });
  it("hides mutation controls when the UI has no manage capability", async () => {
    show({ canManage: false });
    await screen.findByText(channel.label);
    expect(screen.queryByRole("button", { name: "Agregar canal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Color en Publicidad")).toBeDisabled();
  });
  it("validates the country code and creates only in the selected store", async () => {
    show();
    const user = userEvent.setup();
    await screen.findByText(channel.label);
    await user.click(screen.getByRole("button", { name: "Agregar canal" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre del canal"), "Ventas nuevas");
    await user.type(within(dialog).getByLabelText("Número de WhatsApp"), "987111222");
    await user.click(within(dialog).getByRole("button", { name: "Agregar canal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("+ y código de país");
    expect(createStoreSalesChannel).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText("Número de WhatsApp"));
    await user.type(within(dialog).getByLabelText("Número de WhatsApp"), "+51 987 111 222");
    await user.click(within(dialog).getByRole("button", { name: "Agregar canal" }));
    await waitFor(() =>
      expect(createStoreSalesChannel).toHaveBeenCalledWith(shop.id, {
        type: "WHATSAPP",
        label: "Ventas nuevas",
        identifier: "+51 987 111 222",
        externalId: "",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("renames without offering to change the immutable destination", async () => {
    show();
    const user = userEvent.setup();
    await screen.findByText(channel.label);
    await user.click(screen.getByRole("button", { name: `Editar nombre de ${channel.label}` }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Para cambiar el teléfono/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Número de WhatsApp")).not.toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Nombre del canal"));
    await user.type(within(dialog).getByLabelText("Nombre del canal"), "WhatsApp principal");
    await user.click(within(dialog).getByRole("button", { name: "Guardar nombre" }));
    await waitFor(() =>
      expect(updateStoreSalesChannel).toHaveBeenCalledWith(shop.id, channel.id, {
        label: "WhatsApp principal",
      }),
    );
  });
  it("preserves history when deactivating and allows reactivation", async () => {
    show();
    const user = userEvent.setup();
    await screen.findByText(channel.label);
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Se conserva el historial");
    expect(deactivateStoreSalesChannel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Desactivar canal" }));
    await screen.findByText("Inactivo");
    expect(deactivateStoreSalesChannel).toHaveBeenCalledWith(shop.id, channel.id);
    await user.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() =>
      expect(updateStoreSalesChannel).toHaveBeenCalledWith(shop.id, channel.id, { isActive: true }),
    );
  });
  it("does not silently turn a failed load into an empty channel list", async () => {
    jest
      .mocked(fetchStoreSalesChannels)
      .mockRejectedValueOnce(new Error("private detail"))
      .mockResolvedValueOnce([]);
    show();
    const user = userEvent.setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar");
    expect(screen.queryByText("Aún no hay canales en esta tienda.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Aún no hay canales en esta tienda.")).toBeInTheDocument();
  });
  it("cancels a previous store fetch and ignores its late response", async () => {
    let resolveOld: (channels: StoreSalesChannel[]) => void = () => undefined;
    const old = new Promise<StoreSalesChannel[]>((resolve) => {
      resolveOld = resolve;
    });
    const otherChannel = {
      ...channel,
      id: "channel-b",
      storeId: secondShop.id,
      label: "Ventas KUNCA",
    };
    jest
      .mocked(fetchStoreSalesChannels)
      .mockReturnValueOnce(old)
      .mockResolvedValueOnce([otherChannel]);
    show({ stores: [shop, secondShop, legacy], initialStoreId: shop.id });
    const user = userEvent.setup();
    await waitFor(() => expect(fetchStoreSalesChannels).toHaveBeenCalled());
    const oldSignal = jest.mocked(fetchStoreSalesChannels).mock.calls[0][1];
    await user.click(screen.getByRole("combobox", { name: "Tienda" }));
    await user.click(screen.getByRole("option", { name: secondShop.name }));
    expect(await screen.findByText("Ventas KUNCA")).toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => resolveOld([channel]));
    expect(screen.queryByText(channel.label)).not.toBeInTheDocument();
  });
  it("does not use a foreign deep link as a store assignment", () => {
    show({ stores: [shop, secondShop], initialStoreId: "foreign-store" });
    expect(screen.getByText("Elige la tienda que quieres configurar.")).toBeInTheDocument();
    expect(fetchStoreSalesChannels).not.toHaveBeenCalled();
  });
  it("saves color through the protected store presentation endpoint", async () => {
    const changed = jest.fn();
    jest
      .mocked(updateStorePresentation)
      .mockResolvedValue({ id: shop.id, color: "#0891B2", is_legacy: false });
    show({ onColorChange: changed });
    const user = userEvent.setup();
    await screen.findByText(channel.label);
    fireEvent.change(screen.getByLabelText("Color en Publicidad"), {
      target: { value: "#0891b2" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar color" }));
    await waitFor(() => expect(updateStorePresentation).toHaveBeenCalledWith(shop.id, "#0891b2"));
    expect(changed).toHaveBeenCalledWith(shop.id, "#0891B2");
  });
  it("keeps the channel active if server authorization refuses the change", async () => {
    jest.mocked(deactivateStoreSalesChannel).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: "private" } },
    });
    show();
    const user = userEvent.setup();
    await screen.findByText(channel.label);
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await user.click(screen.getByRole("button", { name: "Desactivar canal" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Necesitas permiso para configurar esta tienda."),
    );
    expect(screen.queryByText("Inactivo")).not.toBeInTheDocument();
  });
});

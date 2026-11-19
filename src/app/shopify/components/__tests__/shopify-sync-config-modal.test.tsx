/**
 * FEAT-24 SEC (sec5): la sincronización inicial (`POST /shopify/confirm-sync/:tienda`) va con la sesión (axiosAuth),
 * que agrega el token vigente y lo renueva; ya no arma el `Bearer` a mano (con la sesión vencida iba `Bearer undefined`).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import axiosAuth from "@/lib/axiosAuth";
import { ShopifySyncConfigModal } from "../shopify-sync-config-modal";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const renderModal = () =>
  render(
    <ShopifySyncConfigModal
      isOpen
      onClose={jest.fn()}
      shopUrl="uno.myshopify.com"
      companyId="company-a"
      storeId="store-a"
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe("ShopifySyncConfigModal", () => {
  it("lanza la sincronización con axiosAuth, sin cabecera armada a mano", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
    renderModal();

    await userEvent.setup().click(screen.getByRole("button", { name: "Iniciar sincronizacion" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const [url, body, config] = jest.mocked(axiosAuth.post).mock.calls[0];
    expect(url).toMatch(/\/shopify\/confirm-sync\/uno\.myshopify\.com$/);
    expect(body).toEqual(expect.objectContaining({ companyId: "company-a", storeId: "store-a" }));
    expect(config).toBeUndefined();
  });

  it("si no es administrador de la empresa de la tienda (403), lo dice", async () => {
    jest.mocked(axiosAuth.post).mockRejectedValue({ response: { status: 403 } });
    renderModal();

    await userEvent.setup().click(screen.getByRole("button", { name: "Iniciar sincronizacion" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Solo un administrador de la empresa puede sincronizar con Shopify."),
    );
  });

  // FEAT-24 SEC (sec6b): antes iba siempre la primera tienda de la empresa. Ahora va la vinculada a la tienda de
  // Shopify y, si no hay vínculo, la que elige el usuario entre las de su empresa.
  describe("tienda de Powip", () => {
    const STORES = [
      { id: "store-a", name: "Tienda A" },
      { id: "store-b", name: "Tienda B" },
    ];
    const renderUnlinked = (storeOptions: { id: string; name: string }[]) =>
      render(
        <ShopifySyncConfigModal
          isOpen
          onClose={jest.fn()}
          shopUrl="uno.myshopify.com"
          companyId="company-a"
          storeId=""
          storeOptions={storeOptions}
        />,
      );
    const startButton = () => screen.getByRole("button", { name: "Iniciar sincronizacion" });

    it("con tienda vinculada no pide elegir y manda esa", async () => {
      jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
      render(
        <ShopifySyncConfigModal
          isOpen
          onClose={jest.fn()}
          shopUrl="uno.myshopify.com"
          companyId="company-a"
          storeId="store-b"
          storeOptions={STORES}
        />,
      );

      expect(screen.queryByLabelText("Tienda de Powip")).not.toBeInTheDocument();
      await userEvent.setup().click(startButton());

      await waitFor(() => expect(axiosAuth.post).toHaveBeenCalled());
      expect(jest.mocked(axiosAuth.post).mock.calls[0][1]).toEqual(expect.objectContaining({ storeId: "store-b" }));
    });

    it("sin vínculo y con varias tiendas, hay que elegir una (no va la primera)", async () => {
      jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
      renderUnlinked(STORES);
      const user = userEvent.setup();

      expect(startButton()).toBeDisabled();
      await user.selectOptions(screen.getByLabelText("Tienda de Powip"), "store-b");
      await user.click(startButton());

      await waitFor(() => expect(axiosAuth.post).toHaveBeenCalled());
      expect(jest.mocked(axiosAuth.post).mock.calls[0][1]).toEqual(expect.objectContaining({ storeId: "store-b" }));
    });

    it("sin vínculo y con una sola tienda, queda elegida", async () => {
      jest.mocked(axiosAuth.post).mockResolvedValue({ data: {} });
      renderUnlinked([STORES[0]]);

      expect(screen.getByLabelText("Tienda de Powip")).toHaveValue("store-a");
      await userEvent.setup().click(startButton());

      await waitFor(() => expect(axiosAuth.post).toHaveBeenCalled());
      expect(jest.mocked(axiosAuth.post).mock.calls[0][1]).toEqual(expect.objectContaining({ storeId: "store-a" }));
    });

    it("sin vínculo y sin tiendas en la empresa, no se puede sincronizar", () => {
      renderUnlinked([]);

      expect(screen.getByText(/tu empresa no tiene tiendas en powip/i)).toBeInTheDocument();
      expect(startButton()).toBeDisabled();
      expect(axiosAuth.post).not.toHaveBeenCalled();
    });
  });
});

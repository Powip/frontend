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
});

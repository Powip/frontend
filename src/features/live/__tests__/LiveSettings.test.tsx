import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "sonner";
import LiveConfigPanel from "../LiveConfigPanel";
import LiveCopyButton from "../LiveCopyButton";
import LivePaymentSettings from "../LivePaymentSettings";
import { copyLiveText } from "../liveCopy";
import { getLiveYapeConfig, updateLiveYapeConfig } from "../liveService";
import type { LiveConfig } from "../types";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../liveCopy", () => ({ copyLiveText: jest.fn() }));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveYapeConfig: jest.fn(),
  updateLiveYapeConfig: jest.fn(),
}));

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => jest.clearAllMocks());

const config: LiveConfig = {
  enabled: false,
  allowBuyNow: true,
  allowReservations: true,
  reservationMinutes: 15,
  maxReservedUnits: 5,
  allowAccumulation: false,
  combineShipping: false,
  homeShipping: null,
  agencyShipping: null,
  reminderEnabled: false,
  showBackLink: false,
  allowSellerLive: false,
  closePolicy: "END_OF_DAY",
  liveUrl: "",
  hideSoldOut: true,
  slug: "kunca",
};
const renderConfig = (onSave = jest.fn().mockResolvedValue(true)) => {
  render(
    <LiveConfigPanel
      config={config}
      readiness={{ ready: true, checks: [] }}
      canManage
      busy={false}
      onConsole={jest.fn()}
      onSave={onSave}
    />,
  );
  return onSave;
};
const minutes = () => screen.getByLabelText("Minutos para pagar");

describe("Configuración del catálogo (FEAT-33 A1/B4)", () => {
  test("nothing to save until something changes; Descartar restores the saved values", () => {
    renderConfig();
    const [save] = screen.getAllByRole("button", {
      name: "Guardar configuración",
    });
    expect(save).toBeDisabled();
    expect(screen.queryByText("● Cambios sin guardar")).not.toBeInTheDocument();
    fireEvent.change(minutes(), { target: { value: "20" } });
    expect(save).toBeEnabled();
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
    expect(
      screen.getByText("Tienes cambios sin guardar en el catálogo"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(minutes()).toHaveValue("15");
    expect(screen.queryByText("● Cambios sin guardar")).not.toBeInTheDocument();
  });

  test("shows the error under the field and saves nothing", () => {
    const onSave = renderConfig();
    fireEvent.change(minutes(), { target: { value: "4" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Guardar configuración" })[0],
    );
    expect(minutes()).toHaveAccessibleDescription(/Entre 5 y 120 minutos\./);
    expect(minutes()).toHaveAttribute("aria-invalid", "true");
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Revisa los campos marcados");
  });

  test("sends only what changed and then shows the save time", async () => {
    const onSave = renderConfig();
    fireEvent.change(minutes(), { target: { value: "20" } });
    fireEvent.click(
      screen.getByRole("switch", { name: /Ocultar variantes sin stock/ }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Guardar configuración" })[0],
    );
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        reservationMinutes: 20,
        hideSoldOut: false,
      }),
    );
    expect(
      await screen.findByText(/^✓ Guardado \d{1,2}:\d{2} [ap]\. m\.$/),
    ).toBeInTheDocument();
  });

  test("a failed save keeps the edits", async () => {
    renderConfig(jest.fn().mockResolvedValue(false));
    fireEvent.change(minutes(), { target: { value: "20" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Guardar configuración" })[0],
    );
    await waitFor(() => expect(minutes()).toHaveValue("20"));
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
  });

  test("A12: the catalog name shows the same link POWIP shares, and follows what you type", () => {
    renderConfig();
    expect(screen.getByText("localhost/live/kunca")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("kunca"), { target: { value: "kunca-live" } });
    expect(screen.getByText("localhost/live/kunca-live")).toBeInTheDocument();
    expect(screen.queryByText(/powip\.lat/)).not.toBeInTheDocument();
  });

  test("suggests 15 minutes under the field", () => {
    renderConfig();
    expect(minutes()).toHaveAccessibleDescription(/Sugerido 15/);
  });
});

describe("Apariencia del catálogo (FEAT-33 B5)", () => {
  beforeAll(() => {
    URL.createObjectURL = jest.fn(() => "blob:logo-preview");
    URL.revokeObjectURL = jest.fn();
  });
  const renderLook = (saved: Partial<LiveConfig> = {}) => {
    const onSave = jest.fn().mockResolvedValue(true);
    const onLogo = jest.fn().mockResolvedValue(true);
    render(
      <LiveConfigPanel
        config={{ ...config, ...saved }}
        storeName="Kunca"
        readiness={{ ready: true, checks: [] }}
        canManage
        busy={false}
        onConsole={jest.fn()}
        onSave={onSave}
        onLogo={onLogo}
      />,
    );
    return { onSave, onLogo, preview: screen.getByTestId("look-preview") };
  };
  const save = () =>
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar configuración" })[0]);
  const logoInput = () => screen.getByLabelText("Subir logo");
  const pick = (file: File) => fireEvent.change(logoInput(), { target: { files: [file] } });

  test("theme, color and name show in the preview at once and save with the rest", async () => {
    const { onSave, preview } = renderLook();
    expect(within(preview).getByText("Kunca")).toBeInTheDocument();
    expect(within(preview).getByText("KU")).toBeInTheDocument();
    expect(preview).toHaveAttribute("data-theme", "dark");
    fireEvent.click(screen.getByRole("button", { name: "Claro" }));
    fireEvent.click(screen.getByRole("button", { name: "Rosa" }));
    fireEvent.change(screen.getByLabelText("Nombre que ve el cliente"), {
      target: { value: "Kunca Store" },
    });
    expect(within(preview).getByText("Kunca Store")).toBeInTheDocument();
    expect(within(preview).getByText("KS")).toBeInTheDocument();
    expect(preview).toHaveAttribute("data-theme", "light");
    expect(preview.style.getPropertyValue("--acc")).toBe("#f37ea3");
    expect(screen.getByRole("button", { name: "Rosa" })).toHaveAttribute("aria-pressed", "true");
    save();
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        appearance: { theme: "light", color: "#f37ea3", displayName: "Kunca Store" },
      }),
    );
  });

  test("any other color can be chosen", async () => {
    const { onSave, preview } = renderLook();
    fireEvent.change(screen.getByLabelText("Otro color"), { target: { value: "#123abc" } });
    expect(preview.style.getPropertyValue("--acc")).toBe("#123abc");
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ appearance: { color: "#123abc" } }));
  });

  test("a color that cannot be read on the background says how it is shown", () => {
    const { preview } = renderLook();
    fireEvent.click(screen.getByRole("button", { name: "Negro" }));
    expect(screen.getByText(/casi no se ve sobre fondo oscuro/)).toBeInTheDocument();
    expect(preview.style.getPropertyValue("--acc")).toBe("#f1f4f7");
    fireEvent.click(screen.getByRole("button", { name: "Claro" }));
    expect(screen.queryByText(/casi no se ve/)).not.toBeInTheDocument();
  });

  test("the logo is checked before uploading and saved together with the rest", async () => {
    const { onSave, onLogo, preview } = renderLook();
    pick(new File(["gif"], "logo.gif", { type: "image/gif" }));
    expect(screen.getByText("El logo debe ser PNG, JPG, WebP o SVG.")).toBeInTheDocument();
    pick(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" }));
    expect(screen.getByText("El logo debe pesar como máximo 2 MB.")).toBeInTheDocument();
    const logo = new File(["png"], "logo.png", { type: "image/png" });
    pick(logo);
    expect(screen.queryByText(/El logo debe/)).not.toBeInTheDocument();
    expect(within(preview).getByRole("img", { name: "Logo de Kunca" })).toHaveAttribute(
      "src",
      "blob:logo-preview",
    );
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
    save();
    await waitFor(() => expect(onLogo).toHaveBeenCalledWith(logo));
    expect(onSave).not.toHaveBeenCalled();
  });

  test("Quitar takes the saved logo out on save and Descartar brings it back", async () => {
    const { onLogo, preview } = renderLook({
      appearance: { logoUrl: "https://storage.test/logo.png" },
    });
    expect(within(preview).getByRole("img", { name: "Logo de Kunca" })).toHaveAttribute(
      "src",
      "https://storage.test/logo.png",
    );
    fireEvent.click(screen.getByRole("button", { name: "Quitar logo" }));
    expect(within(preview).queryByRole("img")).not.toBeInTheDocument();
    expect(within(preview).getByText("KU")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Descartar" })[0]);
    expect(within(preview).getByRole("img", { name: "Logo de Kunca" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar logo" }));
    save();
    await waitFor(() => expect(onLogo).toHaveBeenCalledWith(null));
  });
});

describe("Yape del negocio (FEAT-33 A1)", () => {
  const saved = {
    enabled: true,
    phone: "912345678",
    holder: "Kunca SAC",
    qrUrl: null,
    reviewHours: 24,
  };
  const renderYape = async () => {
    (getLiveYapeConfig as jest.Mock).mockResolvedValue({ config: saved });
    render(<LivePaymentSettings storeId="store" canManage />);
    return screen.findByLabelText("Número Yape");
  };

  test("an invalid number shows its error under the field and is not sent", async () => {
    const phone = await renderYape();
    fireEvent.change(phone, { target: { value: "812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar Yape" }));
    expect(phone).toHaveAccessibleDescription(
      /Número de 9 dígitos que empiece con 9\./,
    );
    expect(updateLiveYapeConfig).not.toHaveBeenCalled();
  });

  test("accepts +51 with spaces, saves the 9 digits and shows the save time", async () => {
    (updateLiveYapeConfig as jest.Mock).mockImplementation(
      async (_store, input) => ({
        config: { ...input, qrUrl: null },
      }),
    );
    const phone = await renderYape();
    expect(screen.getByRole("button", { name: "Guardar Yape" })).toBeDisabled();
    fireEvent.change(phone, { target: { value: "+51 987 654 321" } });
    expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar Yape" }));
    await waitFor(() =>
      expect(updateLiveYapeConfig).toHaveBeenCalledWith("store", {
        enabled: true,
        phone: "987654321",
        holder: "Kunca SAC",
        reviewHours: 24,
      }),
    );
    expect(await screen.findByText(/^✓ Guardado /)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      "✓ Yape guardado · el catálogo ya muestra 987 654 321",
    );
  });

  test("Descartar brings back the saved Yape", async () => {
    const phone = await renderYape();
    fireEvent.change(phone, { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(phone).toHaveValue("912345678");
  });
});

describe("Copiar link (FEAT-33 A2)", () => {
  test("the button says «✓ Copiado» for 2 seconds and shows a notice", async () => {
    jest.useFakeTimers();
    (copyLiveText as jest.Mock).mockResolvedValue("copied");
    render(
      <LiveCopyButton
        text="https://kunca.test/live?a=ana"
        label="Copiar link"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(
      await screen.findByRole("button", { name: "✓ Copiado" }),
    ).toBeInTheDocument();
    expect(copyLiveText).toHaveBeenCalledWith("https://kunca.test/live?a=ana");
    expect(toast.success).toHaveBeenCalledWith("✓ Copiado");
    await act(async () => jest.advanceTimersByTime(2000));
    expect(
      screen.getByRole("button", { name: "Copiar link" }),
    ).toBeInTheDocument();
    jest.useRealTimers();
  });

  test("when the browser cannot copy, shows the link selected to copy by hand", async () => {
    (copyLiveText as jest.Mock).mockResolvedValue("manual");
    render(
      <LiveCopyButton text="https://kunca.test/live" label="Copiar link" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    const field = await screen.findByLabelText("Texto para copiar");
    expect(field).toHaveValue("https://kunca.test/live");
    await waitFor(() => expect(field).toHaveFocus());
    expect(toast.error).toHaveBeenCalledWith(
      "No se pudo copiar. Mantén presionado el link para copiarlo.",
    );
  });
});

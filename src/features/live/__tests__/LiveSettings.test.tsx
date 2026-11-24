import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
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

  test("suggests 15 minutes under the field", () => {
    renderConfig();
    expect(minutes()).toHaveAccessibleDescription(/Sugerido 15/);
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

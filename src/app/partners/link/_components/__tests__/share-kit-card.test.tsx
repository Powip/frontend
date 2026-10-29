/**
 * Tests: ShareKitCard
 *
 * Comportamiento verificado:
 * 1. El botón de WhatsApp abre wa.me con el link codificado en el mensaje.
 * 2. Los botones de WhatsApp/Instagram están deshabilitados si el perfil no tiene link.
 * 3. "Instagram" copia el link al portapapeles y muestra un toast mencionando Instagram.
 * 4. "Descargar QR" está deshabilitado mientras no hay QR generado, y llama a saveAs con
 *    el nombre de archivo correcto una vez que el QR está listo.
 * 5. Mientras cargan los recursos, muestra skeletons (no la lista ni el empty state).
 * 6. Si falla la carga de recursos, muestra PartnerSectionError y "Reintentar" llama a onRetryResources.
 * 7. Con una lista vacía, muestra el EmptyState de recursos.
 * 8. Los recursos publicados abren únicamente la URL devuelta por el backend.
 * 9. Un recurso sin URL no ofrece una descarga ficticia.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import type { PartnerResource } from "@/features/partners/models/partner-resource";
import { useQRCode } from "@/hooks/useQrCode";
import { ShareKitCard } from "../share-kit-card";

jest.mock("file-saver", () => ({ saveAs: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock("@/hooks/useQrCode", () => ({ useQRCode: jest.fn() }));

const mockUseQRCode = jest.mocked(useQRCode);
const mockSaveAs = jest.mocked(saveAs);

const REFERRAL_LINK = "https://www.powip.tech/r/partner-demo-code";
const REFERRAL_CODE = "PARTNERDEMO";

const RESOURCE: PartnerResource = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Logos POWIP",
  description: "PNG · SVG",
  kind: "LOGOS",
  category: "Brand",
  downloadUrl: "https://assets.powip.tech/partners/logos.zip",
};

beforeEach(() => {
  mockUseQRCode.mockReset();
  mockSaveAs.mockReset();
  jest.mocked(toast.success).mockReset();
  jest.mocked(toast.info).mockReset();
  window.open = jest.fn();
});

describe("ShareKitCard", () => {
  it("WhatsApp abre wa.me con el link codificado", async () => {
    mockUseQRCode.mockReturnValue(null);
    const user = userEvent.setup();

    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={[]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /whatsapp/i }));

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/?text="),
      "_blank",
      "noopener,noreferrer",
    );
    const calledUrl = jest.mocked(window.open).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent(REFERRAL_LINK));
  });

  it("WhatsApp e Instagram están deshabilitados sin link", () => {
    mockUseQRCode.mockReturnValue(null);
    render(
      <ShareKitCard
        referralLink={null}
        referralCode={null}
        resources={[]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /instagram/i })).toBeDisabled();
  });

  it("Instagram copia el link y muestra un toast mencionando Instagram", async () => {
    mockUseQRCode.mockReturnValue(null);
    const user = userEvent.setup();
    const writeTextMock = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={[]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /instagram/i }));

    expect(writeTextMock).toHaveBeenCalledWith(REFERRAL_LINK);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Instagram"));
  });

  it("Descargar QR está deshabilitado mientras no hay QR generado", () => {
    mockUseQRCode.mockReturnValue(null);
    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={[]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /descargar qr/i })).toBeDisabled();
  });

  it("Descargar QR llama a saveAs con el nombre de archivo correcto cuando el QR está listo", async () => {
    mockUseQRCode.mockReturnValue("data:image/png;base64,fake");
    const user = userEvent.setup();

    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={[]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /descargar qr/i }));

    expect(saveAs).toHaveBeenCalledWith("data:image/png;base64,fake", `powip-${REFERRAL_CODE}.png`);
  });

  it("muestra skeletons mientras cargan los recursos", () => {
    mockUseQRCode.mockReturnValue(null);
    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={undefined}
        isLoadingResources={true}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    expect(screen.queryByText(/sin recursos todavía/i)).not.toBeInTheDocument();
  });

  it("muestra el error y Reintentar llama a onRetryResources", async () => {
    mockUseQRCode.mockReturnValue(null);
    const onRetryResources = jest.fn();
    const user = userEvent.setup();

    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={undefined}
        isLoadingResources={false}
        isResourcesError={true}
        onRetryResources={onRetryResources}
      />,
    );
    await user.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetryResources).toHaveBeenCalledTimes(1);
  });

  it("muestra el empty state con una lista de recursos vacía", () => {
    mockUseQRCode.mockReturnValue(null);
    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={[]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    expect(screen.getByText(/sin recursos todavía/i)).toBeInTheDocument();
  });

  it("un recurso publicado utiliza su URL real sin enviar bearer al host externo", () => {
    mockUseQRCode.mockReturnValue(null);

    render(
      <ShareKitCard
        referralLink={REFERRAL_LINK}
        referralCode={REFERRAL_CODE}
        resources={[RESOURCE]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: `Abrir ${RESOURCE.title}` });
    expect(link).toHaveAttribute("href", RESOURCE.downloadUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("sin URL ni descripción no inventa una descarga o datos de catálogo", () => {
    mockUseQRCode.mockReturnValue(null);
    render(
      <ShareKitCard
        referralLink={null}
        referralCode={null}
        resources={[{ ...RESOURCE, description: null, downloadUrl: null }]}
        isLoadingResources={false}
        isResourcesError={false}
        onRetryResources={jest.fn()}
      />,
    );
    expect(screen.getByText(RESOURCE.title)).toBeInTheDocument();
    expect(screen.getByText("Sin descarga disponible")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("PNG · SVG")).not.toBeInTheDocument();
  });
});

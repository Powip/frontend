import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaSenderProfile } from "@/features/olva/olva-sender-profile/mappers/to-olva-sender-profile";
import { buildBusinessError } from "@/features/olva/olva-sender-profile/test-utils/axios-error";
import { buildOlvaSenderProfileList } from "@/features/olva/olva-sender-profile/test-utils/olva-sender-profile.fixtures";
import { OlvaSenderProfilesSection } from "../_components/olva-sender-profiles-section";

const {
  createOlvaSenderProfile,
  getOlvaSenderProfiles,
  setDefaultOlvaSenderProfile,
  archiveOlvaSenderProfile,
} = vi.hoisted(() => ({
  createOlvaSenderProfile: vi.fn(),
  getOlvaSenderProfiles: vi.fn(),
  setDefaultOlvaSenderProfile: vi.fn(),
  archiveOlvaSenderProfile: vi.fn(),
}));

// The section also mounts the create dialog, which needs `createOlvaSenderProfile` to exist
vi.mock("@/features/olva/olva-sender-profile/services/olva-sender-profile.service", () => ({
  createOlvaSenderProfile,
  getOlvaSenderProfiles,
  setDefaultOlvaSenderProfile,
  archiveOlvaSenderProfile,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const [defaultProfile, secondProfile] = buildOlvaSenderProfileList().map(toOlvaSenderProfile);

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <OlvaSenderProfilesSection />
    </QueryClientProvider>,
  );

  return { user: userEvent.setup({ delay: null }) };
}

describe("OlvaSenderProfilesSection actions", () => {
  beforeEach(() => {
    getOlvaSenderProfiles.mockResolvedValue([defaultProfile, secondProfile]);
    setDefaultOlvaSenderProfile.mockResolvedValue({ ...secondProfile, isDefault: true });
    archiveOlvaSenderProfile.mockResolvedValue(undefined);
  });

  it("offers set-default and delete only on the non-default profile", async () => {
    renderSection();

    await screen.findByText("Tienda Miraflores");

    expect(screen.getAllByRole("button", { name: /Hacer predeterminado/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Eliminar/ })).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Hacer predeterminado: Almacén principal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Eliminar: Almacén principal" }),
    ).not.toBeInTheDocument();
  });

  it("sets the chosen profile as the default", async () => {
    const { user } = renderSection();

    await user.click(
      await screen.findByRole("button", { name: "Hacer predeterminado: Tienda Miraflores" }),
    );

    await waitFor(() => expect(setDefaultOlvaSenderProfile).toHaveBeenCalled());
    expect(setDefaultOlvaSenderProfile.mock.calls[0][0]).toBe("sender-profile-002");
  });

  it("asks for confirmation before deleting and does not call the API on cancel", async () => {
    const { user } = renderSection();

    await user.click(await screen.findByRole("button", { name: "Eliminar: Tienda Miraflores" }));

    const dialog = within(await screen.findByRole("alertdialog"));
    expect(archiveOlvaSenderProfile).not.toHaveBeenCalled();

    await user.click(dialog.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(archiveOlvaSenderProfile).not.toHaveBeenCalled();
  });

  it("archives the profile after confirming and closes the dialog", async () => {
    const { user } = renderSection();

    await user.click(await screen.findByRole("button", { name: "Eliminar: Tienda Miraflores" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() => expect(archiveOlvaSenderProfile).toHaveBeenCalled());
    expect(archiveOlvaSenderProfile.mock.calls[0][0]).toBe("sender-profile-002");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open when the backend refuses to delete", async () => {
    archiveOlvaSenderProfile.mockRejectedValue(
      buildBusinessError(409, "SENDER_PROFILE_CANNOT_ARCHIVE_DEFAULT"),
    );
    const { user } = renderSection();

    await user.click(await screen.findByRole("button", { name: "Eliminar: Tienda Miraflores" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() => expect(archiveOlvaSenderProfile).toHaveBeenCalled());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

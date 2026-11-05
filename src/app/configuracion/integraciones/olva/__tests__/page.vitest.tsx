import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OlvaIntegrationPage from "../page";

vi.mock("../_components/olva-sender-profiles-section", () => ({
  OlvaSenderProfilesSection: () => <div data-testid="sender-profiles-section" />,
}));

describe("OlvaIntegrationPage", () => {
  it("links back to the main integrations page", () => {
    render(<OlvaIntegrationPage />);

    expect(screen.getByRole("link", { name: "Integraciones" })).toHaveAttribute(
      "href",
      "/configuracion/integraciones",
    );
  });

  it("renders the title and the sender profiles section", () => {
    render(<OlvaIntegrationPage />);

    expect(screen.getByRole("heading", { name: "Integración Olva" })).toBeInTheDocument();
    expect(screen.getByTestId("sender-profiles-section")).toBeInTheDocument();
  });
});

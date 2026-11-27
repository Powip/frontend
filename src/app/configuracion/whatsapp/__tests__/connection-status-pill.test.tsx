import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useViewedStore, ViewedStoreProvider } from "../_components/viewed-store-context";
import { WhatsAppConnectionStatusPill } from "../_components/WhatsAppConnectionStatusPill";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    selectedStoreId: "store-coex",
    auth: {
      accessToken: "token",
      company: {
        stores: [
          { id: "store-coex", name: "A" },
          { id: "store-api", name: "B" },
        ],
      },
    },
  }),
}));

jest.mock("@/services/whatsappService", () => ({
  getWhatsAppStatus: jest.fn(async (_token: string, storeId: string) => ({
    state: "connected",
    displayLabel:
      storeId === "store-api" ? "Conectado · API oficial" : "Conectado · API + app Business",
  })),
}));

function Selector() {
  const [, setViewedStoreId] = useViewedStore();
  return (
    <>
      <button type="button" onClick={() => setViewedStoreId("store-api")}>
        ver B
      </button>
      <button type="button" onClick={() => setViewedStoreId(null)}>
        salir
      </button>
    </>
  );
}

describe("header connection pill", () => {
  it("shows the type of the store the tab is looking at, then goes back to the global store", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ViewedStoreProvider>
          <WhatsAppConnectionStatusPill />
          <Selector />
        </ViewedStoreProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Conectado · API + app Business")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "ver B" }));
    expect(await screen.findByText("Conectado · API oficial")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "salir" }));
    expect(await screen.findByText("Conectado · API + app Business")).toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  AdvertisingStoreFilterProvider,
  useAdvertisingStoreFilter,
} from "../../AdvertisingStoreFilterContext";

const stores = [
  { id: "kunca", name: "KUNCA" },
  { id: "livii", name: "LIVII" },
];
function Reader() {
  const { storeId, setStoreId } = useAdvertisingStoreFilter();
  return (
    <>
      <output aria-label="Tienda seleccionada">{storeId}</output>
      <button onClick={() => setStoreId("livii")}>Ver LIVII</button>
    </>
  );
}

it("uses the linked store rather than the global default and preserves the date and other filters", () => {
  window.history.replaceState(
    {},
    "",
    "/publicidad?storeId=all&from=2026-10-17&to=2026-10-23&channel=web",
  );
  render(
    <AdvertisingStoreFilterProvider stores={stores} initialStoreId="kunca">
      <Reader />
    </AdvertisingStoreFilterProvider>,
  );
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("all");
  fireEvent.click(screen.getByRole("button", { name: "Ver LIVII" }));
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("livii");
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    storeId: "livii",
    from: "2026-10-17",
    to: "2026-10-23",
    channel: "web",
  });
});

it("restores the default when browser history returns to a URL without a store filter", () => {
  window.history.replaceState({}, "", "/publicidad?storeId=livii");
  render(
    <AdvertisingStoreFilterProvider stores={stores} initialStoreId="kunca">
      <Reader />
    </AdvertisingStoreFilterProvider>,
  );
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("livii");
  act(() => {
    window.history.replaceState({}, "", "/publicidad");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("kunca");
});

it("keeps business reports on all stores after old links, history or saved-store changes", () => {
  window.history.replaceState({}, "", "/publicidad?storeId=kunca&from=2026-10-17");
  render(
    <AdvertisingStoreFilterProvider businessScope stores={stores} initialStoreId="kunca">
      <Reader />
    </AdvertisingStoreFilterProvider>,
  );
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("all");
  fireEvent.click(screen.getByRole("button", { name: "Ver LIVII" }));
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("all");
  expect(new URLSearchParams(window.location.search).get("storeId")).toBe("all");
  act(() => {
    window.history.replaceState({}, "", "/publicidad?storeId=livii");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByLabelText("Tienda seleccionada")).toHaveTextContent("all");
});

import { render, screen, within } from "@testing-library/react";
import { AdvertisingDataNotice } from "../DataNotice";

it("keeps the primary data limitation visible and groups unique details accessibly", () => {
  render(<AdvertisingDataNotice messages={["Meta tiene una actualización pendiente.", "Falta asignar una tienda.", "Falta asignar una tienda.", ""]} action={<a href="/publicidad/configuracion">Revisar</a>} />);
  const notice = screen.getByRole("status", { name: "Estado de datos" });
  expect(within(notice).getByText("Meta tiene una actualización pendiente.")).toBeVisible();
  expect(within(notice).getByRole("link", { name: "Revisar" })).toHaveAttribute("href", "/publicidad/configuracion");
  const details = notice.querySelector("details")!;
  expect(details).not.toHaveAttribute("open");
  expect(details.querySelector("summary")).toHaveTextContent("Ver 1 detalle");
  expect(within(details).getAllByRole("listitem", { hidden: true })).toHaveLength(1);
  expect(details).toHaveTextContent("Falta asignar una tienda.");
});

it("does not show an empty warning", () => {
  const { container } = render(<AdvertisingDataNotice messages={[]} />);
  expect(container).toBeEmptyDOMElement();
});

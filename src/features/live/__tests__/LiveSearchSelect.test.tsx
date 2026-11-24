import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import LiveSearchSelect from "../LiveSearchSelect";

/** FEAT-33 A8: el ubigeo del comprador se busca escribiendo, sin importar tildes ni mayúsculas. */
const departments = ["Amazonas", "Apurimac", "Junin", "La Libertad", "Lima", "Callao"];
function Field({ onChange = jest.fn(), initial = "" }: { onChange?: jest.Mock; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <LiveSearchSelect
      label="Departamento"
      placeholder="Elige tu departamento"
      options={departments}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}
const input = () => screen.getByRole("combobox", { name: "Departamento" });

test("filters while typing, ignoring accents and capitals", () => {
  render(<Field />);
  fireEvent.change(input(), { target: { value: "junín" } });
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Junin"]);
  fireEvent.change(input(), { target: { value: "LI" } });
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["La Libertad", "Lima"]);
});

test("choosing an option with the mouse sets it and closes the list", () => {
  const onChange = jest.fn();
  render(<Field onChange={onChange} />);
  fireEvent.change(input(), { target: { value: "lim" } });
  fireEvent.click(screen.getByRole("option", { name: "Lima" }));
  expect(onChange).toHaveBeenCalledWith("Lima");
  expect(input()).toHaveValue("Lima");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("works with the keyboard: arrows, Enter and Escape", () => {
  const onChange = jest.fn();
  render(<Field onChange={onChange} initial="Amazonas" />);
  fireEvent.focus(input());
  expect(input()).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(input(), { key: "ArrowDown" });
  fireEvent.keyDown(input(), { key: "ArrowDown" });
  expect(input().getAttribute("aria-activedescendant")).toBe(
    screen.getByRole("option", { name: "Apurimac" }).id,
  );
  fireEvent.keyDown(input(), { key: "Enter" });
  expect(onChange).toHaveBeenLastCalledWith("Apurimac");
  fireEvent.change(input(), { target: { value: "xyz" } });
  expect(screen.getByText("No encontramos «xyz»")).toBeInTheDocument();
  fireEvent.keyDown(input(), { key: "Escape" });
  expect(input()).toHaveValue("Apurimac");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("leaving the field without choosing keeps the last chosen value", () => {
  const onChange = jest.fn();
  render(<Field onChange={onChange} initial="Lima" />);
  fireEvent.change(input(), { target: { value: "ama" } });
  fireEvent.blur(input());
  expect(input()).toHaveValue("Lima");
  expect(onChange).not.toHaveBeenCalled();
});

test("an exact match typed and confirmed with Enter is chosen", () => {
  const onChange = jest.fn();
  render(<Field onChange={onChange} />);
  fireEvent.change(input(), { target: { value: "callao" } });
  fireEvent.keyDown(input(), { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith("Callao");
});

test("disabled until the previous level is chosen", () => {
  render(
    <LiveSearchSelect label="Provincia" placeholder="Elige primero el departamento" options={[]} value="" disabled onChange={jest.fn()} />,
  );
  expect(screen.getByRole("combobox", { name: "Provincia" })).toBeDisabled();
});

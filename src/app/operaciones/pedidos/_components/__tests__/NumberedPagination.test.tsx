import { fireEvent, render, screen } from "@testing-library/react";
import { NumberedPagination, buildPageItems } from "../NumberedPagination";

describe("buildPageItems", () => {
  it("con pocas páginas las muestra todas", () => {
    expect(buildPageItems(1, 1)).toEqual([1]);
    expect(buildPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("al inicio: 1 2 3 4 … N", () => {
    expect(buildPageItems(1, 8)).toEqual([1, 2, 3, 4, "gap-end", 8]);
    expect(buildPageItems(3, 20)).toEqual([1, 2, 3, 4, "gap-end", 20]);
  });

  it("en el medio: 1 … c-1 c c+1 … N", () => {
    expect(buildPageItems(10, 20)).toEqual([1, "gap-start", 9, 10, 11, "gap-end", 20]);
  });

  it("al final: 1 … N-3 N-2 N-1 N", () => {
    expect(buildPageItems(20, 20)).toEqual([1, "gap-start", 17, 18, 19, 20]);
    expect(buildPageItems(18, 20)).toEqual([1, "gap-start", 17, 18, 19, 20]);
  });

  it("nunca repite ni se salta páginas alrededor de la actual", () => {
    for (let total = 8; total <= 30; total++) {
      for (let current = 1; current <= total; current++) {
        const numbers = buildPageItems(current, total).filter((item): item is number => typeof item === "number");
        expect(numbers).toContain(current);
        expect(numbers).toContain(1);
        expect(numbers).toContain(total);
        expect(new Set(numbers).size).toBe(numbers.length);
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
      }
    }
  });
});

describe("NumberedPagination", () => {
  const setup = (props: Partial<Parameters<typeof NumberedPagination>[0]> = {}) => {
    const onPageChange = jest.fn();
    render(<NumberedPagination currentPage={1} totalPages={8} totalItems={120} itemsPerPage={15} onPageChange={onPageChange} {...props} />);
    return onPageChange;
  };

  it("muestra el rango y el total", () => {
    setup({ currentPage: 2 });
    expect(screen.getByText("Mostrando 16 – 30 de 120 pedidos")).toBeInTheDocument();
  });

  it("la última página muestra solo lo que queda", () => {
    setup({ currentPage: 8, totalItems: 110 });
    expect(screen.getByText("Mostrando 106 – 110 de 110 pedidos")).toBeInTheDocument();
  });

  it("sin resultados muestra 0 – 0", () => {
    setup({ totalItems: 0, totalPages: 1 });
    expect(screen.getByText("Mostrando 0 – 0 de 0 pedidos")).toBeInTheDocument();
  });

  it("Anterior queda deshabilitado en la primera página y Siguiente en la última", () => {
    const { unmount } = render(<NumberedPagination currentPage={1} totalPages={3} totalItems={40} itemsPerPage={15} onPageChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeEnabled();
    unmount();
    render(<NumberedPagination currentPage={3} totalPages={3} totalItems={40} itemsPerPage={15} onPageChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });

  it("marca la página actual y navega a una, a la anterior y a la siguiente", () => {
    const onPageChange = setup({ currentPage: 4 });

    expect(screen.getByRole("button", { name: "Página 4" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Página 8" }));
    expect(onPageChange).toHaveBeenLastCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(onPageChange).toHaveBeenLastCalledWith(5);
  });

  it("muestra puntos suspensivos donde hay saltos", () => {
    setup({ currentPage: 10, totalPages: 20, totalItems: 300 });
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("mientras llega otra página no admite clics", () => {
    const onPageChange = setup({ disabled: true });
    expect(screen.getByRole("button", { name: "Página 2" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

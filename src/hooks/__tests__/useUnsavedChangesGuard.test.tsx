import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Page({ dirty }: { dirty: boolean }) {
  const { dialog } = useUnsavedChangesGuard(dirty);
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- el guardián intercepta cualquier <a> interno, también el que renderiza <Link> */}
      <a href="/productos" onClick={(event) => { event.preventDefault(); push("link-propio"); }}>Volver al catálogo</a>
      <a href="https://otra.com" onClick={(event) => event.preventDefault()}>Afuera</a>
      {dialog}
    </div>
  );
}

describe("useUnsavedChangesGuard (FEAT-32 M1)", () => {
  beforeEach(() => push.mockClear());

  it("sin cambios deja navegar", async () => {
    render(<Page dirty={false} />);
    await userEvent.click(screen.getByText("Volver al catálogo"));
    expect(push).toHaveBeenCalledWith("link-propio");
  });

  it("con cambios pregunta antes de salir por un link interno; «Seguir editando» se queda", async () => {
    const user = userEvent.setup();
    render(<Page dirty />);
    await user.click(screen.getByText("Volver al catálogo"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("Tienes cambios sin guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(push).not.toHaveBeenCalled();
    await user.click(screen.getByText("Volver al catálogo"));
    await user.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(push).toHaveBeenCalledWith("/productos");
  });

  it("los links a otro sitio no se interceptan; cerrar la pestaña del navegador avisa", async () => {
    render(<Page dirty />);
    await userEvent.click(screen.getByText("Afuera"));
    expect(screen.queryByText("Tienes cambios sin guardar")).not.toBeInTheDocument();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

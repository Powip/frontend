import { fireEvent, render, screen } from "@testing-library/react";
import LiveReadinessPanel, { getLiveOpeningStatus } from "../LiveReadinessPanel";
import type { LiveReadiness } from "../types";

type CheckCode = LiveReadiness["checks"][number]["code"];
const codes: CheckCode[] = ["YAPE", "PRODUCTS", "STOCK", "SHIPPING", "CUSTOMER_REVIEW"];
function readiness(missing: CheckCode[] = []): LiveReadiness {
  return {
    ready: missing.length === 0,
    checks: codes.map((code) => ({
      code,
      ready: !missing.includes(code),
      message: missing.includes(code) ? `Falta ${code}` : `Listo ${code}`,
    })),
  };
}
const props = {
  readiness: readiness(),
  purchasesEnabled: false,
  canManage: true,
  busy: false,
  onConfigure: jest.fn(),
  onProducts: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());

test.each([
  ["YAPE", "Yape", "Configurar Yape", "config"],
  ["PRODUCTS", "Productos y precios", "Agregar productos", "products"],
  ["STOCK", "Stock disponible", "Revisar stock", "products"],
  ["SHIPPING", "Envío", "Configurar envío", "config"],
] as const)("explains missing %s and opens the correct tab", (code, label, buttonLabel, action) => {
  render(<LiveReadinessPanel {...props} readiness={readiness([code])} />);
  expect(screen.getByRole("status")).toHaveTextContent(`Falta completar: ${label}.`);
  expect(screen.getByText(`Falta ${code}`)).toBeInTheDocument();
  expect(screen.getByText("3 de 4 requisitos listos")).toBeInTheDocument();
  const button = screen.getByRole("button", { name: buttonLabel });
  expect(document.getElementById(button.getAttribute("aria-describedby") || "")).toHaveTextContent(
    `Falta ${code}`,
  );
  fireEvent.click(button);
  expect(action === "config" ? props.onConfigure : props.onProducts).toHaveBeenCalledTimes(1);
  if (action === "config")
    expect(props.onConfigure).toHaveBeenCalledWith(code === "YAPE" ? "yape" : "shipping");
  expect(action === "config" ? props.onProducts : props.onConfigure).not.toHaveBeenCalled();
});

test("ready catalog with purchases off explains activation and saving", () => {
  render(<LiveReadinessPanel {...props} />);
  expect(screen.getByRole("heading", { name: "Catálogo preparado" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "activa Habilitar compras del live y guarda los cambios",
  );
  fireEvent.click(screen.getByRole("button", { name: "Ir a Configuración" }));
  expect(props.onConfigure).toHaveBeenCalledTimes(1);
  expect(props.onConfigure).toHaveBeenCalledWith("purchases");
  expect(props.onProducts).not.toHaveBeenCalled();
  expect(getLiveOpeningStatus(props).kind).toBe("enable-purchases");
});

test("ready catalog with purchases on gives the next opening actions", () => {
  render(<LiveReadinessPanel {...props} purchasesEnabled />);
  expect(screen.getByRole("heading", { name: "Listo para abrir" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Estoy en vivo o Abrir catálogo");
  expect(screen.getByText("4 de 4 requisitos listos")).toBeInTheDocument();
  expect(screen.queryByText("Listo CUSTOMER_REVIEW")).not.toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(getLiveOpeningStatus({ ...props, purchasesEnabled: true }).kind).toBe("ready");
});

test.each([undefined, { ready: false, checks: [] }])(
  "missing preparation data asks for refresh without inventing checks",
  (value) => {
    render(<LiveReadinessPanel {...props} readiness={value} />);
    expect(screen.getByRole("status")).toHaveTextContent("Pulsa Actualizar live");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/requisitos listos/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getLiveOpeningStatus({ ...props, readiness: value }).kind).toBe("checking");
  },
);

test("users without management capability see the required role and no write actions", () => {
  render(
    <LiveReadinessPanel {...props} canManage={false} readiness={readiness(["YAPE", "STOCK"])} />,
  );
  expect(screen.getByRole("heading", { name: "Se necesita un Administrador" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("El Administrador del negocio");
  expect(screen.getByText("Falta YAPE")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(getLiveOpeningStatus({ ...props, canManage: false }).actions).toEqual([]);
});

test("busy explains the wait and disables contextual configuration actions", () => {
  render(
    <LiveReadinessPanel
      {...props}
      busy
      readiness={readiness(["YAPE", "PRODUCTS", "STOCK", "SHIPPING"])}
    />,
  );
  expect(screen.getByRole("heading", { name: "Guardando cambios" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Espera a que termine el guardado");
  for (const button of screen.getAllByRole("button")) {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  }
  expect(props.onConfigure).not.toHaveBeenCalled();
  expect(props.onProducts).not.toHaveBeenCalled();
  expect(getLiveOpeningStatus({ ...props, busy: true }).actions).toEqual([]);
});

test("counts only actual returned merchant checks, without hiding an internal failed check", () => {
  const value: LiveReadiness = {
    ready: false,
    checks: [
      { code: "YAPE", ready: true, message: "Yape configurado" },
      {
        code: "CUSTOMER_REVIEW",
        ready: false,
        message: "La revisión de datos no está disponible.",
      },
    ],
  };
  render(<LiveReadinessPanel {...props} readiness={value} />);
  expect(screen.getByText("1 de 1 requisito listo")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText(/La revisión de datos no está disponible/)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Revisión de datos");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(getLiveOpeningStatus({ ...props, readiness: value }).kind).toBe("incomplete");
});

test("opening helper retains every failed reason and deduplicates tab actions", () => {
  const value = readiness(["YAPE", "PRODUCTS", "STOCK", "SHIPPING"]);
  const result = getLiveOpeningStatus({ ...props, readiness: value, purchasesEnabled: true });
  expect(result.kind).toBe("incomplete");
  expect(result.actions).toEqual(["config", "products"]);
  expect(result.message).toContain("Yape, Productos y precios, Stock disponible, Envío");
});

test("a failed check is still explained if the overall flag contradicts it", () => {
  const value = { ...readiness(["STOCK"]), ready: true };
  expect(getLiveOpeningStatus({ ...props, readiness: value, purchasesEnabled: true })).toEqual(
    expect.objectContaining({ kind: "incomplete", actions: ["products"] }),
  );
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { toast } from "sonner";
import CompleteBusinessPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { submitCompanyOnboardingQuestions } from "@/services/companyService";

type Auth = NonNullable<ReturnType<typeof useAuth>["auth"]>;
let mockSession: ReturnType<typeof useAuth>;
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const updateCompany = jest.fn();
const logout = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/services/companyService", () => ({ submitCompanyOnboardingQuestions: jest.fn() }));

const save = jest.mocked(submitCompanyOnboardingQuestions);
const savedProfile = {
  id: "company-a",
  onboarding_sales_channels: ["POS (Punto de venta)"],
  monthly_order_volume: "OVER_6000" as const,
};

function ownerSession(): Auth {
  return {
    accessToken: "session-fixture",
    exp: 0,
    user: { id: "owner-a", email: "owner@example.test", role: "ADMINISTRADOR", permissions: [], companyId: "company-a" },
    company: {
      id: "company-a", name: "Mi negocio", userId: "owner-a",
      stores: [{ id: "store-a", name: "Principal" }],
      sales_channels: ["Web LIVII"], closing_channels: ["WhatsApp"],
      phone: "999111222", cuit: "20123456789", billingAddress: "Lima",
      onboarding_sales_channels: null, monthly_order_volume: null,
    },
    subscription: null,
    access: { state: "OK", owner: true, deadline: null, firstChargeDate: null },
  };
}

function chooseAnswers() {
  fireEvent.click(screen.getByRole("checkbox", { name: "POS (Punto de venta)" }));
  fireEvent.click(screen.getByRole("radio", { name: "Más de 6,000" }));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession = { auth: ownerSession(), loading: false, updateCompany, logout } as unknown as ReturnType<typeof useAuth>;
  save.mockResolvedValue(savedProfile);
});

it("asks the owner once per company without reusing operational channel configuration", () => {
  render(<CompleteBusinessPage />);
  expect(screen.getByText(/Solo necesitas responder una vez por empresa/)).toBeVisible();
  expect(screen.getAllByRole("checkbox")).toHaveLength(11);
  expect(screen.getAllByRole("radio")).toHaveLength(4);
  for (const choice of [...screen.getAllByRole("checkbox"), ...screen.getAllByRole("radio")]) {
    expect(choice).not.toBeChecked();
  }
  expect(mockReplace).not.toHaveBeenCalled();
});

it("requires both answers before saving and lets the owner correct each error", () => {
  render(<CompleteBusinessPage />);
  submit();
  expect(screen.getByText("Selecciona al menos un canal de venta.")).toBeVisible();
  expect(screen.getByText("Selecciona cuántos pedidos despachas al mes.")).toBeVisible();
  expect(save).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("checkbox", { name: "POS (Punto de venta)" }));
  expect(screen.queryByText("Selecciona al menos un canal de venta.")).not.toBeInTheDocument();
  submit();
  expect(screen.getByText("Selecciona cuántos pedidos despachas al mes.")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "Más de 6,000" }));
  expect(screen.queryByText("Selecciona cuántos pedidos despachas al mes.")).not.toBeInTheDocument();
});

it("does not save a monthly range without a sales channel", () => {
  render(<CompleteBusinessPage />);
  fireEvent.click(screen.getByRole("radio", { name: "Hasta 1,000" }));
  submit();
  expect(screen.getByText("Selecciona al menos un canal de venta.")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("saves POS through the dedicated endpoint and merges only survey fields into the company", async () => {
  const existingCompany = mockSession.auth!.company!;
  save.mockResolvedValue({ ...savedProfile, name: "Unexpected name", stores: [], sales_channels: ["Unexpected channel"] } as typeof savedProfile);
  render(<CompleteBusinessPage />);
  chooseAnswers();
  submit();

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith("company-a", "session-fixture", {
    onboarding_sales_channels: ["POS (Punto de venta)"], monthly_order_volume: "OVER_6000",
  });
  expect(updateCompany).toHaveBeenCalledWith({
    ...existingCompany,
    onboarding_sales_channels: ["POS (Punto de venta)"], monthly_order_volume: "OVER_6000",
  });
  expect(toast.success).toHaveBeenCalledWith("Respuestas guardadas");
});

it("keeps failed saves on screen with the answers available for retry", async () => {
  save.mockRejectedValue(new Error("Failed request"));
  render(<CompleteBusinessPage />);
  chooseAnswers();
  submit();

  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(updateCompany).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox", { name: "POS (Punto de venta)" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Guardar y continuar" })).toBeEnabled();
});

it.each([
  { ...savedProfile, id: "foreign-company" },
  { ...savedProfile, onboarding_sales_channels: [] },
  { ...savedProfile, onboarding_sales_channels: ["unknown-platform"] },
  { ...savedProfile, monthly_order_volume: null },
])("rejects an unconfirmed or foreign save response: %p", async (profile) => {
  save.mockResolvedValue(profile as typeof savedProfile);
  render(<CompleteBusinessPage />);
  chooseAnswers();
  submit();

  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(updateCompany).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

it.each(["VENTAS", "OPERACIONES"])("normal staff with role %s cannot answer", (role) => {
  mockSession.auth!.user.id = "staff-a";
  mockSession.auth!.user.role = role;
  render(<CompleteBusinessPage />);
  expect(mockReplace).toHaveBeenCalledWith("/");
  expect(screen.queryByRole("button", { name: "Guardar y continuar" })).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it("lets a same-company administrator save one answer set for the business", async () => {
  mockSession.auth!.user.id = "admin-a";
  render(<CompleteBusinessPage />);
  expect(screen.getByRole("button", { name: "Guardar y continuar" })).toBeVisible();
  chooseAnswers();
  submit();

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  expect(save).toHaveBeenCalledWith("company-a", "session-fixture", {
    onboarding_sales_channels: ["POS (Punto de venta)"], monthly_order_volume: "OVER_6000",
  });
  expect(updateCompany).toHaveBeenCalledTimes(1);
});

it.each([
  ["ADMINISTRADOR", "another-company"],
  ["ADMINISTRADOR", null],
  ["ADMINISTRADOR", undefined],
  ["ADMIN", "company-a"],
  ["SUPERADMIN", "company-a"],
] as const)("denies non-owner role %s with membership %s", (role, companyId) => {
  mockSession.auth!.user = { ...mockSession.auth!.user, id: "non-owner", role, companyId };
  render(<CompleteBusinessPage />);
  expect(mockReplace).toHaveBeenCalledWith("/");
  expect(screen.queryByRole("button", { name: "Guardar y continuar" })).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it("lets the actual owner save without an admin role or company claim", async () => {
  mockSession.auth!.user.role = "USUARIO";
  mockSession.auth!.user.companyId = null;
  render(<CompleteBusinessPage />);
  chooseAnswers();
  submit();

  await waitFor(() => expect(updateCompany).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/");
});

it.each(["owner-a", "admin-a"])("does not ask respondent %s to resubmit after the company has answered", (userId) => {
  mockSession.auth!.user.id = userId;
  mockSession.auth!.company = { ...mockSession.auth!.company!, ...savedProfile };
  render(<CompleteBusinessPage />);
  expect(mockReplace).toHaveBeenCalledWith("/");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it("waits for session loading without redirecting or showing the form", () => {
  mockSession.loading = true;
  mockSession.auth = null;
  const { rerender } = render(<CompleteBusinessPage />);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

  mockSession.auth = ownerSession();
  mockSession.loading = false;
  rerender(<CompleteBusinessPage />);
  expect(screen.getByRole("button", { name: "Guardar y continuar" })).toBeVisible();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("disables the choices, submit and logout while the save is pending", async () => {
  let resolve!: (profile: typeof savedProfile) => void;
  save.mockImplementation(() => new Promise((done) => { resolve = done; }));
  render(<CompleteBusinessPage />);
  chooseAnswers();
  const form = screen.getByRole("button", { name: "Guardar y continuar" }).closest("form")!;
  submit();

  expect(screen.getByRole("button", { name: "Guardando respuestas..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "POS (Punto de venta)" })).toBeDisabled();
  expect(screen.getByRole("radio", { name: "Más de 6,000" })).toBeDisabled();
  fireEvent.submit(form);
  expect(save).toHaveBeenCalledTimes(1);

  await act(async () => resolve(savedProfile));
  expect(mockReplace).toHaveBeenCalledWith("/");
});

it.each(["logout", "company-switch", "unmount"])("ignores a save response after %s", async (change) => {
  let resolve!: (profile: typeof savedProfile) => void;
  save.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const view = render(<CompleteBusinessPage />);
  chooseAnswers();
  submit();

  if (change === "unmount") view.unmount();
  else {
    mockSession.auth = change === "logout" ? null : {
      ...ownerSession(),
      company: { ...ownerSession().company!, id: "company-b" },
    };
    view.rerender(<CompleteBusinessPage />);
  }
  mockReplace.mockClear();

  await act(async () => resolve(savedProfile));

  expect(updateCompany).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});

it("preserves the latest same-company configuration when a save finishes", async () => {
  let resolve!: (profile: typeof savedProfile) => void;
  save.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const view = render(<CompleteBusinessPage />);
  chooseAnswers();
  submit();
  const latestCompany = { ...mockSession.auth!.company!, sales_channels: ["Nueva tienda web"], phone: "999222333" };
  mockSession.auth = { ...mockSession.auth!, company: latestCompany };
  view.rerender(<CompleteBusinessPage />);

  await act(async () => resolve(savedProfile));

  expect(updateCompany).toHaveBeenCalledWith({
    ...latestCompany,
    onboarding_sales_channels: savedProfile.onboarding_sales_channels,
    monthly_order_volume: savedProfile.monthly_order_volume,
  });
});

it("allows the owner to sign out instead of completing the form", () => {
  render(<CompleteBusinessPage />);
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect(logout).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});

it("saves correctly after React StrictMode's effect cleanup and setup cycle", async () => {
  render(<StrictMode><CompleteBusinessPage /></StrictMode>);
  chooseAnswers();
  submit();

  await waitFor(() => expect(updateCompany).toHaveBeenCalledTimes(1));
  expect(mockReplace).toHaveBeenCalledWith("/");
  expect(toast.success).toHaveBeenCalledWith("Respuestas guardadas");
});

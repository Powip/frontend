import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import NewCompanyPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserCompany } from "@/services/companyService";

jest.mock("axios");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/companyService", () => ({ fetchUserCompany: jest.fn() }));

const mockUseAuth = jest.mocked(useAuth);
const mockedPost = axios.post as jest.Mock;
const mockedFetchCompany = jest.mocked(fetchUserCompany);

describe("NewCompanyPage (onboarding, FEAT-11)", () => {
  const updateCompany = jest.fn();
  const setSelectedStore = jest.fn();
  const refreshSession = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      auth: { accessToken: "jwt", user: { id: "u1", email: "a@t.pe" } },
      updateCompany,
      setSelectedStore,
      refreshSession,
    } as unknown as ReturnType<typeof useAuth>);
  });

  const fill = (id: string, value: string) =>
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });

  const continueToQuestions = () => {
    fill("companyName", "Mi Empresa SAC");
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  };
  const answerQuestionsAndContinue = () => {
    fireEvent.click(screen.getByRole("checkbox", { name: "WhatsApp conversacional" }));
    fireEvent.click(screen.getByRole("radio", { name: "2,000 a 6,000" }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  };
  const fillBilling = () => {
    fill("billingAddress", "Av. Larco 123");
    fill("phone", "+51 987 654 321");
    fill("email", "empresa@test.pe");
  };
  const renderBillingStep = () => {
    render(<NewCompanyPage />);
    continueToQuestions();
    answerQuestionsAndContinue();
    fillBilling();
  };

  it("no avanza al paso 2 sin nombre de empresa", () => {
    render(<NewCompanyPage />);
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText("Este campo es obligatorio.")).toBeInTheDocument();
    expect(document.getElementById("billingAddress")).toBeNull();
  });

  it("crea la empresa del usuario logueado, renueva la sesión y va al dashboard", async () => {
    mockedPost.mockResolvedValue({ status: 201 });
    mockedFetchCompany.mockResolvedValue({ id: "c1", name: "Mi Empresa", stores: [{ id: "s1", name: "Principal" }] } as never);

    renderBillingStep();
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toMatch(/\/company$/);
    expect((body as FormData).get("user_id")).toBe("u1");
    expect((body as FormData).get("name")).toBe("Mi Empresa SAC");
    expect((body as FormData).getAll("onboarding_sales_channels[]")).toEqual(["WhatsApp conversacional"]);
    expect((body as FormData).getAll("sales_channels[]")).toEqual([]);
    expect((body as FormData).get("monthly_order_volume")).toBe("FROM_2000_TO_6000");
    expect(config.headers.Authorization).toBe("Bearer jwt");
    expect(updateCompany).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
    expect(setSelectedStore).toHaveBeenCalledWith("s1");
    expect(refreshSession).toHaveBeenCalled();
  });

  it("si ms-company rechaza (sin suscripción pagada) muestra el motivo y no navega", async () => {
    const { toast } = jest.requireMock("sonner");
    mockedPost.mockRejectedValue({ response: { data: { message: "Debes tener una suscripción activa (plan pagado) para crear la empresa." } } });

    renderBillingStep();
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/suscripción activa/)));
    expect(push).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  describe("preguntas obligatorias de la operación", () => {
    beforeEach(() => {
      mockedPost.mockResolvedValue({ status: 201 });
      mockedFetchCompany.mockResolvedValue(null);
    });

    it("muestra las once plataformas, incluido POS, y cuatro rangos sin respuestas preseleccionadas", () => {
      render(<NewCompanyPage />);
      continueToQuestions();

      expect(screen.getAllByRole("checkbox")).toHaveLength(11);
      expect(screen.getAllByRole("radio")).toHaveLength(4);
      for (const choice of [...screen.getAllByRole("checkbox"), ...screen.getAllByRole("radio")]) {
        expect(choice).not.toBeChecked();
      }
      for (const label of [
        "Instagram conversacional", "WhatsApp conversacional", "Facebook conversacional",
        "Shopify con pasarela de pago", "Shopify contraentrega", "TikTok Live",
        "Mercado Libre", "Falabella", "Ripley", "POS (Punto de venta)", "Otras plataformas",
      ]) {
        expect(screen.getByRole("checkbox", { name: label })).toBeInTheDocument();
      }
      for (const label of ["Hasta 1,000", "1,000 a 2,000", "2,000 a 6,000", "Más de 6,000"]) {
        expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
      }

      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

      expect(screen.getByText("Selecciona al menos un canal de venta.")).toBeVisible();
      expect(screen.getByText("Selecciona cuántos pedidos despachas al mes.")).toBeVisible();
      expect(document.getElementById("billingAddress")).toBeNull();
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it("exige un rango aunque haya canales y elimina el error al elegirlo", () => {
      render(<NewCompanyPage />);
      continueToQuestions();
      fireEvent.click(screen.getByRole("checkbox", { name: "Mercado Libre" }));
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

      expect(screen.queryByText("Selecciona al menos un canal de venta.")).not.toBeInTheDocument();
      expect(screen.getByText("Selecciona cuántos pedidos despachas al mes.")).toBeVisible();
      expect(document.getElementById("billingAddress")).toBeNull();

      fireEvent.click(screen.getByRole("radio", { name: "Hasta 1,000" }));
      expect(screen.queryByText("Selecciona cuántos pedidos despachas al mes.")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
      expect(document.getElementById("billingAddress")).toBeInTheDocument();
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it("exige al menos un canal aunque ya haya un rango y permite corregirlo", () => {
      render(<NewCompanyPage />);
      continueToQuestions();
      fireEvent.click(screen.getByRole("radio", { name: "Hasta 1,000" }));
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

      expect(screen.getByText("Selecciona al menos un canal de venta.")).toBeVisible();
      expect(screen.queryByText("Selecciona cuántos pedidos despachas al mes.")).not.toBeInTheDocument();
      expect(document.getElementById("billingAddress")).toBeNull();

      fireEvent.click(screen.getByRole("checkbox", { name: "Otras plataformas" }));
      expect(screen.queryByText("Selecciona al menos un canal de venta.")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
      expect(document.getElementById("billingAddress")).toBeInTheDocument();
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it("permite varios canales sin duplicados y envía solo el rango final mediante multipart", async () => {
      render(<NewCompanyPage />);
      continueToQuestions();
      const instagram = screen.getByRole("checkbox", { name: "Instagram conversacional" });
      const whatsapp = screen.getByRole("checkbox", { name: "WhatsApp conversacional" });
      const tiktok = screen.getByRole("checkbox", { name: "TikTok Live" });
      fireEvent.click(instagram);
      fireEvent.click(whatsapp);
      expect(instagram).toBeChecked();
      expect(whatsapp).toBeChecked();
      fireEvent.click(instagram);
      expect(instagram).not.toBeChecked();
      fireEvent.click(instagram);
      fireEvent.click(tiktok);
      fireEvent.click(tiktok);
      expect(tiktok).not.toBeChecked();

      const previousRange = screen.getByRole("radio", { name: "1,000 a 2,000" });
      const finalRange = screen.getByRole("radio", { name: "Más de 6,000" });
      fireEvent.click(previousRange);
      fireEvent.click(finalRange);
      expect(previousRange).not.toBeChecked();
      expect(finalRange).toBeChecked();
      expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
      fillBilling();
      fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
      expect(mockedPost).toHaveBeenCalledTimes(1);
      const [url, body, config] = mockedPost.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
      expect(url).toMatch(/\/company$/);
      expect(body).toBeInstanceOf(FormData);
      expect(body.getAll("onboarding_sales_channels[]")).toEqual(["WhatsApp conversacional", "Instagram conversacional"]);
      expect(body.getAll("sales_channels[]")).toEqual([]);
      expect(body.get("sales_channels")).toBeNull();
      expect(body.getAll("monthly_order_volume")).toEqual(["OVER_6000"]);
      expect(config.headers).toEqual({ "Content-Type": "multipart/form-data", Authorization: "Bearer jwt" });
    });

    it("conserva las respuestas al volver desde facturación y desde el primer paso", () => {
      renderBillingStep();
      fireEvent.click(screen.getByRole("button", { name: /volver/i }));

      expect(screen.getByRole("checkbox", { name: "WhatsApp conversacional" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "2,000 a 6,000" })).toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: /volver/i }));
      expect(document.getElementById("companyName")).toHaveValue("Mi Empresa SAC");
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

      expect(screen.getByRole("checkbox", { name: "WhatsApp conversacional" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "2,000 a 6,000" })).toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
      expect(document.getElementById("billingAddress")).toHaveValue("Av. Larco 123");
      expect(document.getElementById("phone")).toHaveValue("+51 987 654 321");
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it("bloquea un submit directo cuando faltan las preguntas", () => {
      render(<NewCompanyPage />);
      continueToQuestions();
      const form = screen.getByRole("checkbox", { name: "Ripley" }).closest("form");
      fireEvent.submit(form as HTMLFormElement);

      expect(screen.getByText("Selecciona al menos un canal de venta.")).toBeVisible();
      expect(screen.getByText("Selecciona cuántos pedidos despachas al mes.")).toBeVisible();
      expect(mockedPost).not.toHaveBeenCalled();
      expect(mockedFetchCompany).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("no crea la empresa por Enter en un paso anterior aunque los datos estén completos", () => {
      renderBillingStep();
      fireEvent.click(screen.getByRole("button", { name: /volver/i }));
      const form = screen.getByRole("checkbox", { name: "Ripley" }).closest("form");
      fireEvent.submit(form as HTMLFormElement);

      expect(screen.getByRole("checkbox", { name: "WhatsApp conversacional" })).toBeChecked();
      expect(mockedPost).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("validación y corrección del RUC / CUIT", () => {
    const taxIdError = /Ingresa un RUC de 11 dígitos o un CUIT con formato/i;
    const submit = () => fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    beforeEach(() => {
      mockedPost.mockResolvedValue({ status: 201 });
      mockedFetchCompany.mockResolvedValue(null);
    });

    it.each([
      ["RUC de 11 dígitos", "20605417036", "20605417036"],
      ["CUIT con guiones", "20-60541703-6", "20-60541703-6"],
      ["RUC con espacios alrededor", " 20605417036 ", "20605417036"],
      ["CUIT con espacios alrededor", " 20-60541703-6 ", "20-60541703-6"],
      ["campo opcional vacío", "", ""],
      ["campo opcional con espacios", "   ", ""],
    ])("permite guardar %s y envía el valor sin espacios", async (_label, value, expected) => {
      renderBillingStep();
      fill("cuit", value);

      submit();

      await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
      expect(screen.queryByText(taxIdError)).not.toBeInTheDocument();
      expect(mockedPost).toHaveBeenCalledTimes(1);
      const body = mockedPost.mock.calls[0][1] as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get("cuit")).toBe(expected);
      expect(body.get("user_id")).toBe("u1");
      expect(body.get("name")).toBe("Mi Empresa SAC");
    });

    it.each([
      ["RUC", "20605417036"],
      ["CUIT", "20-60541703-6"],
      ["RUC con espacios", " 20605417036 "],
      ["campo vacío", ""],
      ["solo espacios", "   "],
    ])("quita el error inmediatamente al corregir a %s y conserva otros errores", (_label, corrected) => {
      renderBillingStep();
      fill("cuit", "20605");
      fill("phone", "");
      submit();
      expect(screen.getByText(taxIdError)).toBeVisible();
      expect(screen.getByText("Este campo es obligatorio.")).toBeVisible();
      expect(mockedPost).not.toHaveBeenCalled();

      fill("cuit", corrected);

      expect(screen.queryByText(taxIdError)).not.toBeInTheDocument();
      expect(screen.getByText("Este campo es obligatorio.")).toBeVisible();
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it("mantiene el error al editar un identificador que sigue incompleto y bloquea guardar", () => {
      renderBillingStep();
      fill("cuit", "20605");
      submit();
      expect(screen.getByText(taxIdError)).toBeVisible();

      fill("cuit", "2060541703");

      expect(screen.getByText(taxIdError)).toBeVisible();
      submit();
      expect(screen.getByText(taxIdError)).toBeVisible();
      expect(mockedPost).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it.each(["206054170360", "2060541703A", "20-6054170-36", "20605 417036"])(
      "rechaza el identificador inválido %s antes de enviar datos",
      (value) => {
        renderBillingStep();
        fill("cuit", value);

        submit();

        expect(screen.getByText(taxIdError)).toBeVisible();
        expect(mockedPost).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
      },
    );
  });
});

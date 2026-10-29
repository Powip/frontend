import axios from "axios";
import {
  createCompany,
  fetchCompanyById,
  fetchUserCompany,
  getAllCompanies,
  submitCompanyOnboardingQuestions,
  updateCompany,
} from "../companyService";
import type { MonthlyOrderVolume } from "@/lib/onboardingQuestions";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const baseUrl = "https://company.example.test";
const token = "company-session-token";
const authorized = { headers: { Authorization: `Bearer ${token}` } };
const company = { id: "company-a", name: "Negocio", user_id: "owner-a" };
const answers = {
  onboarding_sales_channels: ["WhatsApp conversacional", "TikTok Live"],
  monthly_order_volume: "FROM_2000_TO_6000" as const,
};

const readers = [
  {
    name: "the owner's company",
    path: "/company/user/owner-a",
    respond: (value: unknown) => value,
    read: async () => [await fetchUserCompany("owner-a", token)],
  },
  {
    name: "a company with its stores",
    path: "/company/company-a/with-stores",
    respond: (value: unknown) => value,
    read: async () => [await fetchCompanyById("company-a", token)],
  },
  {
    name: "the company list",
    path: "/company?includeStores=true",
    respond: (value: unknown) => [value],
    read: () => getAllCompanies(token),
  },
];

describe("company onboarding answers", () => {
  const previousBaseUrl = process.env.NEXT_PUBLIC_API_COMPANY;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NEXT_PUBLIC_API_COMPANY = baseUrl;
  });

  afterAll(() => {
    if (previousBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_COMPANY;
    else process.env.NEXT_PUBLIC_API_COMPANY = previousBaseUrl;
  });

  describe.each(readers)("reading $name", ({ path, respond, read }) => {
    it("authenticates the request and returns persisted answers alongside company data", async () => {
      jest.mocked(axios.get).mockResolvedValue({
        data: respond({
          ...company,
          ...answers,
          stores: [{ id: "store-a", name: "Principal" }],
          billing_address: "Dirección del negocio",
          sales_channels: ["Web LIVII", "WhatsApp"],
          closing_channels: ["WhatsApp"],
        }),
      });

      await expect(read()).resolves.toEqual([
        expect.objectContaining({
          id: company.id,
          name: company.name,
          userId: company.user_id,
          ...answers,
          stores: [{ id: "store-a", name: "Principal" }],
          billingAddress: "Dirección del negocio",
          sales_channels: ["Web LIVII", "WhatsApp"],
          closing_channels: ["WhatsApp"],
        }),
      ]);
      expect(axios.get).toHaveBeenCalledWith(`${baseUrl}${path}`, authorized);
    });

    it("keeps companies created before these questions readable", async () => {
      jest.mocked(axios.get).mockResolvedValue({ data: respond(company) });

      await expect(read()).resolves.toEqual([
        expect.objectContaining({
          id: company.id,
          sales_channels: undefined,
          onboarding_sales_channels: undefined,
          monthly_order_volume: undefined,
        }),
      ]);
    });

    it("accepts null survey fields without treating operational channels as answers", async () => {
      jest.mocked(axios.get).mockResolvedValue({
        data: respond({
          ...company,
          sales_channels: ["Shopify"],
          onboarding_sales_channels: null,
          monthly_order_volume: null,
        }),
      });

      await expect(read()).resolves.toEqual([
        expect.objectContaining({
          id: company.id,
          sales_channels: ["Shopify"],
          onboarding_sales_channels: null,
          monthly_order_volume: null,
        }),
      ]);
    });
  });

  it("creates the business with both answers and its existing billing fields", async () => {
    const response = { ...company, ...answers };
    jest.mocked(axios.post).mockResolvedValue({ data: response });

    await expect(
      createCompany(token, {
        name: company.name,
        userId: company.user_id,
        cuit: "20123456789",
        billingAddress: "Lima",
        phone: "999111222",
        billingEmail: "negocio@example.test",
        sales_channels: ["Web LIVII"],
        ...answers,
      }),
    ).resolves.toEqual(response);

    expect(axios.post).toHaveBeenCalledWith(
      `${baseUrl}/company`,
      {
        name: company.name,
        user_id: company.user_id,
        cuit: "20123456789",
        billing_address: "Lima",
        phone: "999111222",
        billing_email: "negocio@example.test",
        sales_channels: ["Web LIVII"],
        ...answers,
      },
      authorized,
    );
  });

  it("keeps legacy admin creation valid when onboarding answers are absent", async () => {
    jest.mocked(axios.post).mockResolvedValue({ data: company });

    await expect(
      createCompany(token, { name: company.name, userId: company.user_id }),
    ).resolves.toEqual(company);
    const [, payload, config] = jest.mocked(axios.post).mock.calls[0];
    expect(payload).toMatchObject({ name: company.name, user_id: company.user_id });
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty("sales_channels");
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty("onboarding_sales_channels");
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty("monthly_order_volume");
    expect(config).toEqual(authorized);
  });

  it.each<MonthlyOrderVolume>([
    "UP_TO_1000",
    "FROM_1000_TO_2000",
    "FROM_2000_TO_6000",
    "OVER_6000",
  ])("submits and returns the selected %s range through the dedicated endpoint", async (volume) => {
    const changedAnswers = { ...answers, monthly_order_volume: volume };
    const response = { ...company, ...changedAnswers };
    jest.mocked(axios.patch).mockResolvedValue({ data: response });

    await expect(
      submitCompanyOnboardingQuestions(company.id, token, changedAnswers),
    ).resolves.toEqual(response);
    expect(axios.patch).toHaveBeenCalledWith(
      `${baseUrl}/company/${company.id}/onboarding-questions`,
      changedAnswers,
      authorized,
    );
  });

  it("keeps survey fields out of generic updates while preserving operational channel edits", async () => {
    const values = { sales_channels: ["Web LIVII"], closing_channels: ["WhatsApp"], ...answers };
    jest.mocked(axios.patch).mockResolvedValue({ data: { ...company, ...values } });

    await updateCompany(company.id, token, values);

    const [url, payload, config] = jest.mocked(axios.patch).mock.calls[0];
    expect(url).toBe(`${baseUrl}/company/${company.id}`);
    expect(JSON.parse(JSON.stringify(payload))).toEqual({
      sales_channels: ["Web LIVII"],
      closing_channels: ["WhatsApp"],
    });
    expect(config).toEqual(authorized);
  });

  it("only submits survey answers and cannot overwrite operational channels or ownership", async () => {
    jest.mocked(axios.patch).mockResolvedValue({ data: { id: company.id, ...answers } });

    await submitCompanyOnboardingQuestions(company.id, token, {
      ...answers,
      sales_channels: ["Overwritten"],
      user_id: "different-owner",
      id: "different-company",
    } as typeof answers);

    expect(axios.patch).toHaveBeenCalledWith(
      `${baseUrl}/company/${company.id}/onboarding-questions`,
      answers,
      authorized,
    );
  });

  it("propagates failed survey saves so the collection screen cannot report success", async () => {
    const denied = new Error("No autorizado");
    jest.mocked(axios.patch).mockRejectedValue(denied);

    await expect(submitCompanyOnboardingQuestions(company.id, token, answers)).rejects.toBe(denied);
  });

  it("does not clear stored answers when another field is edited", async () => {
    jest.mocked(axios.patch).mockResolvedValue({ data: { ...company, ...answers } });

    await updateCompany(company.id, token, { name: "Nuevo nombre" });

    const [, payload, config] = jest.mocked(axios.patch).mock.calls[0];
    expect(JSON.parse(JSON.stringify(payload))).toEqual({ name: "Nuevo nombre" });
    expect(config).toEqual(authorized);
  });
});

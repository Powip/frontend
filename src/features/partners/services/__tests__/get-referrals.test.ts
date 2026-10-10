import { getPartnerReferralsApi } from "../../api/partner-referrals.api";
import { getReferrals } from "../get-referrals";

jest.mock("../../api/partner-referrals.api", () => ({
  getPartnerReferralsApi: jest.fn(),
}));

const mockGetPartnerReferralsApi = jest.mocked(getPartnerReferralsApi);

describe("getReferrals", () => {
  beforeEach(() => {
    mockGetPartnerReferralsApi.mockReset();
  });

  it("pide la primera página sin cursor por defecto", async () => {
    mockGetPartnerReferralsApi.mockResolvedValue({ items: [], nextCursor: null });

    await getReferrals();

    expect(mockGetPartnerReferralsApi).toHaveBeenCalledWith(null);
  });

  it("reenvía el cursor recibido", async () => {
    mockGetPartnerReferralsApi.mockResolvedValue({ items: [], nextCursor: null });

    await getReferrals("cursor-2");

    expect(mockGetPartnerReferralsApi).toHaveBeenCalledWith("cursor-2");
  });

  it("devuelve la página ya adaptada al modelo de la UI", async () => {
    mockGetPartnerReferralsApi.mockResolvedValue({
      items: [
        {
          id: "ref-1",
          businessLabel: "Zapatería A••••",
          origin: "LINK",
          state: "ACCOUNT_CREATED",
          capturedAt: "2026-09-24T15:00:00Z",
        },
      ],
      nextCursor: "cursor-2",
    });

    const page = await getReferrals();

    expect(page.nextCursor).toBe("cursor-2");
    expect(page.items[0]).toMatchObject({
      id: "ref-1",
      businessName: "Zapatería A••••",
      origin: "link",
      status: "cuenta_creada",
    });
  });
});

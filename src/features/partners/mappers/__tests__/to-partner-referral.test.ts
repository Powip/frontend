import type {
  PartnerReferralPageResponseDto,
  PartnerReferralResponseDto,
} from "../../dto/partner-referral-response.dto";
import {
  toPartnerReferral,
  toPartnerReferralPage,
  toReferralOrigin,
  toReferralStatus,
} from "../to-partner-referral";

const REFERRAL_DTO: PartnerReferralResponseDto = {
  id: "77777777-7777-4777-8777-777777777777",
  businessLabel: "Zapatería A••••",
  contactLabel: "an***@example.com",
  origin: "MANUAL",
  state: "UNDER_REVIEW",
  capturedAt: "2026-09-24T15:00:00Z",
  expiresAt: "2026-11-23T15:00:00Z",
  companyState: "PENDING",
  planLabel: "Standard",
};

describe("toReferralStatus", () => {
  test.each([
    ["CAPTURED", "registrado"],
    ["UNDER_REVIEW", "en_revision"],
    ["INVITATION_SENT", "correo_enviado"],
    ["ACCOUNT_CREATED", "cuenta_creada"],
    ["COMPANY_CREATED", "activo_sin_pago"],
    ["QUALIFYING_PAYMENT", "pagando"],
  ])('mapea el estado "%s" a "%s"', (state, expected) => {
    expect(toReferralStatus(state)).toBe(expected);
  });

  it.each(["EXPIRED", "REJECTED", "", "toString", "under_review"])(
    'un estado no contemplado ("%s") se mapea a "desconocido" sin inventar una etapa',
    (state) => {
      expect(toReferralStatus(state)).toBe("desconocido");
    },
  );
});

describe("toReferralOrigin", () => {
  test.each([
    ["LINK", "link"],
    ["CODE", "codigo"],
    ["MANUAL", "manual"],
  ] as const)('mapea el origen "%s" a "%s"', (origin, expected) => {
    expect(toReferralOrigin(origin)).toBe(expected);
  });
});

describe("toPartnerReferral", () => {
  it("adapta el item del contrato al modelo de la UI", () => {
    expect(toPartnerReferral(REFERRAL_DTO)).toEqual({
      id: "77777777-7777-4777-8777-777777777777",
      businessName: "Zapatería A••••",
      origin: "manual",
      status: "en_revision",
      registeredAt: "2026-09-24T15:00:00Z",
      planName: "Standard",
      firstMonthCommission: null,
      recurringCommission: null,
    });
  });

  it("deja planName en null cuando el backend no informa plan", () => {
    expect(toPartnerReferral({ ...REFERRAL_DTO, planLabel: null }).planName).toBeNull();

    const withoutPlan: PartnerReferralResponseDto = { ...REFERRAL_DTO };
    delete withoutPlan.planLabel;
    expect(toPartnerReferral(withoutPlan).planName).toBeNull();
  });

  it("nunca calcula comisiones: el listado de referidos no trae importes", () => {
    const result = toPartnerReferral({ ...REFERRAL_DTO, state: "QUALIFYING_PAYMENT" });

    expect(result.status).toBe("pagando");
    expect(result.firstMonthCommission).toBeNull();
    expect(result.recurringCommission).toBeNull();
  });
});

describe("toPartnerReferralPage", () => {
  it("mapea cada item y conserva nextCursor", () => {
    const dto: PartnerReferralPageResponseDto = {
      items: [REFERRAL_DTO, { ...REFERRAL_DTO, id: "otro", origin: "LINK", state: "CAPTURED" }],
      nextCursor: "cursor-2",
    };

    const page = toPartnerReferralPage(dto);

    expect(page.nextCursor).toBe("cursor-2");
    expect(page.items.map((item) => [item.id, item.origin, item.status])).toEqual([
      ["77777777-7777-4777-8777-777777777777", "manual", "en_revision"],
      ["otro", "link", "registrado"],
    ]);
  });

  it("una página vacía sin cursor queda como items [] y nextCursor null", () => {
    expect(toPartnerReferralPage({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});

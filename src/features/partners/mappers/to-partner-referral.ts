import type {
  PartnerReferralPageResponseDto,
  PartnerReferralResponseDto,
  ReferralOriginDto,
} from "../dto/partner-referral-response.dto";
import type { PartnerReferral } from "../models/partner-referral";
import type { PartnerReferralPage } from "../models/partner-referral-page";
import type { ReferralOrigin } from "../models/referral-origin.enum";
import type { ReferralStatus } from "../models/referral-status.enum";

const ORIGIN_BY_DTO: Record<ReferralOriginDto, ReferralOrigin> = {
  LINK: "link",
  CODE: "codigo",
  MANUAL: "manual",
};

const STATUS_BY_STATE = new Map<string, ReferralStatus>([
  ["CAPTURED", "registrado"],
  ["UNDER_REVIEW", "en_revision"],
  ["INVITATION_SENT", "correo_enviado"],
  ["ACCOUNT_CREATED", "cuenta_creada"],
  ["COMPANY_CREATED", "activo_sin_pago"],
  ["QUALIFYING_PAYMENT", "pagando"],
]);

export function toReferralOrigin(origin: ReferralOriginDto): ReferralOrigin {
  return ORIGIN_BY_DTO[origin];
}

export function toReferralStatus(state: string): ReferralStatus {
  return STATUS_BY_STATE.get(state) ?? "desconocido";
}

export function toPartnerReferral(dto: PartnerReferralResponseDto): PartnerReferral {
  return {
    id: dto.id,
    businessName: dto.businessLabel,
    origin: toReferralOrigin(dto.origin),
    status: toReferralStatus(dto.state),
    registeredAt: dto.capturedAt,
    planName: dto.planLabel ?? null,
    firstMonthCommission: null,
    recurringCommission: null,
  };
}

export function toPartnerReferralPage(dto: PartnerReferralPageResponseDto): PartnerReferralPage {
  return {
    items: dto.items.map(toPartnerReferral),
    nextCursor: dto.nextCursor ?? null,
  };
}

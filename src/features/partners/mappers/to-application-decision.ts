import type {
  ApproveApplicationResponseDto,
  RejectApplicationResponseDto,
} from "../dto/application-decision-response.dto";
import type { ApprovedApplication, RejectedApplication } from "../models/application-decision";

export function toApprovedApplication(dto: ApproveApplicationResponseDto): ApprovedApplication {
  return {
    applicationId: dto.applicationId,
    partnerId: dto.partnerId,
    partnerStatus: dto.status,
    code: dto.code,
  };
}

export function toRejectedApplication(dto: RejectApplicationResponseDto): RejectedApplication {
  return {
    applicationId: dto.applicationId,
    status: dto.status,
  };
}

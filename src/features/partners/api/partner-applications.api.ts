import axios from "axios";
import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import partnersMutationsClient from "./partners-mutations.client";
import type { AdminApplicationPageResponseDto } from "../dto/admin-application-response.dto";
import type { ApplicationDecisionRequestDto } from "../dto/application-decision-request.dto";
import type {
  ApproveApplicationResponseDto,
  RejectApplicationResponseDto,
} from "../dto/application-decision-response.dto";
import type { SubmitPartnerApplicationRequestDto } from "../dto/submit-partner-application-request.dto";
import type { SubmitPartnerApplicationResponseDto } from "../dto/submit-partner-application-response.dto";

export interface AdminApplicationsQueryDto {
  cursor: string | null;
  status: string | null;
}

export async function submitPartnerApplicationApi(
  requestDto: SubmitPartnerApplicationRequestDto,
  idempotencyKey: string,
): Promise<SubmitPartnerApplicationResponseDto> {
  const { data } = await axios.post<SubmitPartnerApplicationResponseDto>(
    `${API.partners}/applications`,
    requestDto,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );

  return data;
}

export async function getAdminApplicationsApi({
  cursor,
  status,
}: AdminApplicationsQueryDto): Promise<AdminApplicationPageResponseDto> {
  const params = {
    ...(cursor ? { cursor } : {}),
    ...(status ? { status } : {}),
  };
  const { data } = await axiosAuth.get<AdminApplicationPageResponseDto>(
    `${API.partners}/admin/applications`,
    { params: Object.keys(params).length > 0 ? params : undefined },
  );

  return data;
}

export async function approveAdminApplicationApi(
  applicationId: string,
  requestDto: ApplicationDecisionRequestDto,
  idempotencyKey: string,
  accessToken: string,
): Promise<ApproveApplicationResponseDto> {
  const { data } = await partnersMutationsClient.post<ApproveApplicationResponseDto>(
    `${API.partners}/admin/applications/${encodeURIComponent(applicationId)}/approve`,
    requestDto,
    { headers: { "Idempotency-Key": idempotencyKey, Authorization: `Bearer ${accessToken}` } },
  );

  return data;
}

export async function rejectAdminApplicationApi(
  applicationId: string,
  requestDto: ApplicationDecisionRequestDto,
  idempotencyKey: string,
  accessToken: string,
): Promise<RejectApplicationResponseDto> {
  const { data } = await partnersMutationsClient.post<RejectApplicationResponseDto>(
    `${API.partners}/admin/applications/${encodeURIComponent(applicationId)}/reject`,
    requestDto,
    { headers: { "Idempotency-Key": idempotencyKey, Authorization: `Bearer ${accessToken}` } },
  );

  return data;
}

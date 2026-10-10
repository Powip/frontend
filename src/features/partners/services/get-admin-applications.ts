import { getAdminApplicationsApi } from "../api/partner-applications.api";
import { toPartnerApplicationPage } from "../mappers/to-partner-application";
import type { PartnerApplicationPage } from "../models/partner-application-page";

export interface GetAdminApplicationsInput {
  cursor: string | null;
  status: string | null;
}

export async function getAdminApplications({
  cursor,
  status,
}: GetAdminApplicationsInput): Promise<PartnerApplicationPage> {
  const responseDto = await getAdminApplicationsApi({ cursor, status });

  return toPartnerApplicationPage(responseDto);
}

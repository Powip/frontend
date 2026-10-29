export interface ApproveApplicationResponseDto {
  applicationId: string;
  partnerId: string;
  status: string;
  code: string;
}

export interface RejectApplicationResponseDto {
  applicationId: string;
  status: string;
}

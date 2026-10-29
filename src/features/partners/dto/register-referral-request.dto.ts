export interface RegisterReferralRequestDto {
  businessName: string;
  email: string;
  phone?: string;
  planId?: string;
  note?: string;
}

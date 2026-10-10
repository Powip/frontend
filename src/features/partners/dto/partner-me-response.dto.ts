export interface PartnerMeResponseDto {
  id: string;
  status: string;
  displayName: string;
  country: string;
  currency: string;
  referralLink: string | null;
  referralCode: string | null;
  permissions: string[];
}

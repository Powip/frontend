export interface ReplaceSunatProfileCertificateRequestDto {
  certificate: File;
  certificatePassword: string;
}

/** What the mutation receives: the profile to update plus the new certificate. */
export interface ReplaceSunatProfileCertificateInput
  extends ReplaceSunatProfileCertificateRequestDto {
  id: string;
}

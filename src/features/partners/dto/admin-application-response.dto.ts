export interface AdminApplicationResponseDto {
  id: string;
  applicationReference: string;
  email: string;
  displayName: string;
  country: string;
  status: string;
  appliedAt: string;
}

export interface AdminApplicationPageResponseDto {
  items: AdminApplicationResponseDto[];
  nextCursor: string | null;
}

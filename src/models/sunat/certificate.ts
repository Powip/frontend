export interface Certificate {
  subject: string;
  serial: string;
  validFrom: Date;
  validUntil: Date;
}

import type { WhatsAppContractStatus } from "../enums/whatsapp.enums";

export interface WhatsAppContract {
  id: string;
  label: string;
  status: WhatsAppContractStatus;
  evidence: string | null;
}

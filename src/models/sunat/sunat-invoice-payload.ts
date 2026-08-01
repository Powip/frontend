import { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";

export interface SunatInvoicePayload extends CreateManualInvoiceInput {
  series: string;
  correlative: string;
  issueDate: string;
}

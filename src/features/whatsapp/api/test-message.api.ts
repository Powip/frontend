import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";

interface SendTemplateMessageResponseDto {
  status: string;
  message: string;
  data: { messageId: string };
}

// C-07 · POST /whatsapp/messages/template: envía una plantilla aprobada con la cuenta de la empresa.
export async function sendWhatsAppTestTemplate(body: {
  to: string;
  templateName: string;
  languageCode: string;
}): Promise<{ messageId: string }> {
  assertWhatsAppContractAvailable("testMessage");
  const { data } = await axiosAuth.post<SendTemplateMessageResponseDto>(
    `${API.integrations}/whatsapp/messages/template`,
    body,
  );
  return { messageId: data.data.messageId };
}

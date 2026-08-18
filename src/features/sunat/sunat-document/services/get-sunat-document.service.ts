import { getSunatDocumentApi } from "../api/sunat-document.api";
import { toSunatDocument } from "../mappers/to-sunat-document.mapper";
import type { SunatDocument } from "../models/sunat-document.model";

export async function getSunatDocument(id: string): Promise<SunatDocument> {
  const response = await getSunatDocumentApi(id);

  return toSunatDocument(response);
}

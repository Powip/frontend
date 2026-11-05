import { getOlvaPersonApi } from "../api/olva-person.api";
import { toOlvaPerson } from "../mappers/to-olva-person";
import type { OlvaPerson } from "../models/olva-person";
import type { OlvaPersonLookup } from "../models/olva-person-lookup";

export async function getOlvaPerson(lookup: OlvaPersonLookup): Promise<OlvaPerson> {
  return toOlvaPerson(await getOlvaPersonApi(lookup));
}

import type { ProgramCase } from "../models/program-case";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getProgramCases(): Promise<ProgramCase[]> {
  return unavailablePartnersFeature("Consultar casuística aprobada del programa");
}

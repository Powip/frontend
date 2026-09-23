import { PROGRAM_CASES_MOCK } from "../mocks/program-cases.mock";
import type { ProgramCase } from "../models/program-case";

export async function getProgramCases(): Promise<ProgramCase[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return PROGRAM_CASES_MOCK;
}

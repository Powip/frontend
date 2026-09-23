import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import type { ProgramCase } from "../models/program-case";
import { getProgramCases } from "../services/get-program-cases";

export function useProgramCases() {
  return useQuery<ProgramCase[], Error>({
    queryKey: partnersKeys.programCases(),
    queryFn: getProgramCases,
  });
}

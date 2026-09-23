export type ProgramCaseResultTone = "neutral" | "success" | "warning" | "danger";

export interface ProgramCase {
  id: string;
  title: string;
  description: string;
  result: string;
  resultTone: ProgramCaseResultTone;
}

import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";

/** Entrenamiento de Pau (solo administradores del CRM). */
const TRAININGS = `${API.crm}/crm/pau/trainings`;
/** El examen son 13 respuestas de la IA: puede tardar varios minutos. */
export const PAU_EXAM_TIMEOUT_MS = 10 * 60_000;

export type TrainingStatus = "draft" | "passed" | "failed" | "active" | "archived";

export type ExamCheck =
  | "one_question"
  | "ends_with_question"
  | "no_invented_price"
  | "no_invented_scarcity"
  | "no_cure_claim"
  | "no_markdown"
  | "no_prompt_leak"
  | "handoff";

export interface ExamCaseResult {
  caseId: string;
  title: string;
  answer: string;
  toolCalls: string[];
  checks: { check: ExamCheck; pass: boolean; detail?: string }[];
  pass: boolean;
  /** «No se pudo evaluar»: el proveedor falló en los 2 intentos. No cuenta como reprobado. */
  error?: string;
}

export interface ExamReport {
  passed: boolean;
  critical: { total: number; failed: number };
  /** Casos que no se pudieron evaluar (fallo del proveedor). Con alguno, el examen no aprueba. */
  unevaluated?: number;
  style: { total: number; passed: number; rate: number };
  cases: ExamCaseResult[];
  ranAt: string;
  model: string | null;
}

export interface PauTrainingVersion {
  id: string;
  version: number;
  status: TrainingStatus;
  methodologyVersion: string;
  contentHash: string;
  sources: {
    sheets: number;
    objections: number;
    scriptSteps: number;
    /** «own» = guion propio de la empresa; «methodology» = Pau usa el guion base. */
    scriptSource?: "own" | "methodology";
    /** Tiendas con guion propio. */
    storeScripts?: number;
    materials: number;
    policies: number;
    photos: number;
  };
  exam: ExamReport | null;
  createdByName: string | null;
  createdAt: string;
  examinedAt: string | null;
  activatedAt: string | null;
}

export interface PauTrainingOverview {
  methodology: { version: string; title: string; file: string; date: string; pages: number; sha256: string };
  active: PauTrainingVersion | null;
  outdated: boolean;
  examCases: { id: string; title: string; checks: ExamCheck[] }[];
  items: PauTrainingVersion[];
}

export async function getPauTrainings(): Promise<PauTrainingOverview> {
  return (await axiosAuth.get<PauTrainingOverview>(TRAININGS)).data;
}

export async function compilePauTraining(): Promise<PauTrainingVersion> {
  return (await axiosAuth.post<PauTrainingVersion>(TRAININGS)).data;
}

/** 409 `PAU_NO_PROVIDER` si la empresa no tiene proveedor de IA. */
export async function examPauTraining(id: string): Promise<PauTrainingVersion> {
  return (await axiosAuth.post<PauTrainingVersion>(`${TRAININGS}/${id}/exam`, undefined, { timeout: PAU_EXAM_TIMEOUT_MS }))
    .data;
}

/** 409 `TRAINING_NOT_PASSED` si la versión no aprobó el examen. */
export async function activatePauTraining(id: string): Promise<PauTrainingVersion> {
  return (await axiosAuth.post<PauTrainingVersion>(`${TRAININGS}/${id}/activate`)).data;
}

export async function deactivatePauTraining(): Promise<void> {
  await axiosAuth.delete(`${TRAININGS}/active`);
}

export async function getPauTrainingContent(id: string): Promise<{ version: number; content: string }> {
  return (await axiosAuth.get<{ version: number; content: string }>(`${TRAININGS}/${id}/content`)).data;
}

/** El JSONL va con el token del usuario: se baja como blob y se guarda desde el navegador. */
export async function downloadPauTrainingDataset(id: string, version: number): Promise<void> {
  const blob = (await axiosAuth.get<Blob>(`${TRAININGS}/${id}/dataset.jsonl`, { responseType: "blob" })).data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pau-entrenamiento-v${version}.jsonl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

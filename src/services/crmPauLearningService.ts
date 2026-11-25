import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";

/** Pau Aprende (mockup 152, P10): por aprobar, documentos del negocio y ya aprendido. */
const LEARNING = `${API.crm}/crm/pau/learning`;

export type PendingSource = "learning" | "objection";
export type PendingType = "Objeción" | "Respuesta ganadora" | "Documento del negocio" | "Pregunta sin respuesta";
export type PauDocStatus = "processing" | "proposed" | "learned" | "failed";

export interface PauPendingItem {
  id: string;
  source: PendingSource;
  type: PendingType;
  storeId: string | null;
  origin: string;
  question: string;
  answer: string | null;
  createdAt: string;
}

export interface PauDocument {
  id: string;
  name: string;
  storeId: string | null;
  status: PauDocStatus;
  error: string | null;
  pending: number;
  approved: number;
  createdAt: string;
}

export interface PauLearned {
  question: string;
  answer: string;
  storeId: string | null;
  by: string | null;
  at: string;
}

export interface PauLearningOverview {
  pending: PauPendingItem[];
  documents: PauDocument[];
  learned: PauLearned[];
}

/** Extensiones que acepta el servidor (el tipo real se revisa por los primeros bytes). */
export const PAU_DOC_ACCEPT = ".pdf,.docx,.xlsx,.txt,.csv";
export const PAU_DOC_MAX_BYTES = 10 * 1024 * 1024;

export async function getPauLearning(): Promise<PauLearningOverview> {
  return (await axiosAuth.get<PauLearningOverview>(LEARNING)).data;
}

export async function uploadPauDocument(input: { file: File; name?: string; storeId?: string }): Promise<PauDocument> {
  const form = new FormData();
  form.append("file", input.file);
  if (input.name?.trim()) form.append("name", input.name.trim());
  if (input.storeId) form.append("storeId", input.storeId);
  return (await axiosAuth.post<PauDocument>(`${LEARNING}/documents`, form)).data;
}

export async function removePauDocument(id: string): Promise<void> {
  await axiosAuth.delete(`${LEARNING}/documents/${encodeURIComponent(id)}`);
}

export async function approvePauLearning(input: { source: PendingSource; id: string; answer?: string }): Promise<void> {
  await axiosAuth.post(`${LEARNING}/${input.source}/${encodeURIComponent(input.id)}/approve`, {
    ...(input.answer ? { answer: input.answer } : {}),
  });
}

export async function discardPauLearning(input: { source: PendingSource; id: string }): Promise<void> {
  await axiosAuth.post(`${LEARNING}/${input.source}/${encodeURIComponent(input.id)}/discard`);
}

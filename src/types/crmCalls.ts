export type CallDirection = "out" | "in";
export type CallResult = "sold" | "callback" | "no_answer" | "not_interested" | "other";
export type CallDays = 1 | 7 | 30;

/** Registro manual de una llamada hecha con el teléfono del equipo. */
export interface Call {
  id: string;
  conversationId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  userId: string;
  userName: string | null;
  direction: CallDirection;
  result: CallResult;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CallListParams {
  days: CallDays;
  mine: boolean;
  conversationId?: string;
}

export interface CreateCallInput {
  conversationId?: string;
  phone?: string;
  direction: CallDirection;
  result: CallResult;
  /** 0 a 14400. */
  durationSeconds?: number;
  /** Hasta 1000 caracteres. */
  notes?: string;
  /** Con «volver a llamar»: crea una tarea de llamada en la Agenda. ISO. */
  callbackAt?: string;
}

export interface CallStatsByUser {
  userId: string;
  userName: string | null;
  calls: number;
  answered: number;
  sold: number;
}

export interface CallStats {
  days: number;
  calls: number;
  /** Todas menos «No contestó». */
  answered: number;
  sold: number;
  callback: number;
  noAnswer: number;
  notInterested: number;
  totalMinutes: number;
  byUser: CallStatsByUser[];
}

"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import { crmError } from "@/services/crmService";
import { crmKeys } from "@/lib/crmSse";
import type { Message, MessagePage } from "@/types/crm";
import type { SoundPrefs, SoundPrefsResponse } from "@/lib/crmSound";

const BASE = `${API.crm}/crm`;
const conv = (id: string) => `${BASE}/conversations/${encodeURIComponent(id)}`;

export type AttachmentKind = "image" | "video" | "audio" | "file" | "sticker";

export interface AttachmentInput {
  kind: AttachmentKind;
  url?: string;
  stickerId?: string;
}

export async function sendAttachment(id: string, input: AttachmentInput): Promise<Message> {
  return (await axiosAuth.post<Message>(`${conv(id)}/social/attachment`, input)).data;
}

export async function sendReaction(
  id: string,
  input: { messageId: string; emoji?: string; react: boolean },
): Promise<Message | { removed: true }> {
  return (await axiosAuth.post<Message | { removed: true }>(`${conv(id)}/social/reaction`, input)).data;
}

export async function replyComment(
  id: string,
  input: { messageId: string; body: string },
): Promise<Message> {
  return (await axiosAuth.post<Message>(`${conv(id)}/social/comment-reply`, input)).data;
}

export async function transcribeMessage(id: string, messageId: string): Promise<Message> {
  const res = await axiosAuth.post<{ message: Message; provider: string }>(
    `${conv(id)}/messages/${encodeURIComponent(messageId)}/transcribe`,
  );
  return res.data.message;
}

function upsert(qc: ReturnType<typeof useQueryClient>, conversationId: string, message: Message) {
  qc.setQueryData<MessagePage>(crmKeys.messages(conversationId), (old) => {
    if (!old) return old;
    const exists = old.items.some((m) => m.id === message.id);
    return {
      ...old,
      items: exists
        ? old.items.map((m) => (m.id === message.id ? message : m))
        : [...old.items, message],
    };
  });
}

function onError(err: unknown) {
  toast.error(crmError(err).message);
}

export function useSendAttachment(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachmentInput) => sendAttachment(conversationId, input),
    onSuccess: (m) => upsert(qc, conversationId, m),
    onError,
  });
}

export function useReact(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { messageId: string; emoji?: string; react: boolean }) =>
      sendReaction(conversationId, input),
    onSuccess: (m) => {
      // Al quitar la reacción el servidor la borra y no devuelve mensaje: se recarga la lista.
      if ('removed' in m) void qc.invalidateQueries({ queryKey: crmKeys.messages(conversationId) });
      else upsert(qc, conversationId, m);
    },
    onError,
  });
}

export function useReplyComment(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { messageId: string; body: string }) => replyComment(conversationId, input),
    onSuccess: (m) => upsert(qc, conversationId, m),
    onError,
  });
}

export function useTranscribe(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => transcribeMessage(conversationId, messageId),
    onSuccess: (m) => upsert(qc, conversationId, m),
    onError,
  });
}

// ---- Sonidos ----

export const soundKeys = { prefs: ["crm", "sound-prefs"] as const };

export function useSoundPrefs() {
  return useQuery({
    queryKey: soundKeys.prefs,
    queryFn: async () => (await axiosAuth.get<SoundPrefsResponse>(`${BASE}/sound-prefs`)).data,
    retry: false,
    staleTime: 60_000,
  });
}

export function useSaveSoundPrefs(scope: "me" | "team") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: SoundPrefs) =>
      (await axiosAuth.put<SoundPrefsResponse>(`${BASE}/sound-prefs/${scope}`, prefs)).data,
    onSuccess: (data) => {
      qc.setQueryData(soundKeys.prefs, data);
      toast.success("Sonidos guardados");
    },
    onError,
  });
}

export function useResetSoundPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await axiosAuth.delete<SoundPrefsResponse>(`${BASE}/sound-prefs/me`)).data,
    onSuccess: (data) => {
      qc.setQueryData(soundKeys.prefs, data);
      toast.success("Valores del administrador restablecidos");
    },
    onError,
  });
}

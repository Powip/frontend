"use client";

import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getWhatsAppRules } from "@/features/whatsapp/api/rules.api";
import {
  createWhatsAppTemplate,
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
} from "@/features/whatsapp/api/templates.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import { WHATSAPP_TEMPLATE_HEADER_TYPES } from "@/features/whatsapp/enums/whatsapp.enums";
import { toCreateTemplatePayload } from "@/features/whatsapp/mappers/to-create-template-payload.mapper";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { TemplateEditorValues } from "@/features/whatsapp/schemas/template-editor.schema";
import { TemplateEditorDialog, type TemplateEditorMode } from "./TemplateEditorDialog";
import { type TemplateApprovedNotice, TemplatesListView } from "./TemplatesListView";

interface TemplatesTabProps {
  canManage: boolean;
  businessName: string;
  onActivateRule?: (template: WhatsAppTemplate) => void;
}

type SyncNotice = { kind: "success" | "error"; text: string } | null;

export function buildApprovedNotice(
  template: WhatsAppTemplate | null,
  options: {
    canActivateRule: boolean;
    onActivateRule?: (template: WhatsAppTemplate) => void;
    onDismiss: () => void;
  },
): TemplateApprovedNotice | null {
  if (!template) return null;
  return {
    templateName: template.name,
    canActivateRule: options.canActivateRule && !!options.onActivateRule,
    onActivateRule: () => options.onActivateRule?.(template),
    onDismiss: options.onDismiss,
  };
}

/** Texto legible del error del backend (Nest/Zod devuelve message como texto o lista). */
function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const message = Array.isArray(data?.message) ? data?.message.join(" · ") : data?.message;
    if (message) return message;
    if (error.response?.status === 502) return "Meta no aceptó la plantilla. Revisa el texto y las variables.";
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

/**
 * "Se usa en": la regla de la tienda que tiene asignada cada plantilla (templateId → clave de la regla).
 * Las claves de las reglas son los mismos valores que los usos de plantilla (C-16/D-49).
 * Si las reglas no cargan, la columna queda en "Sin asignar" sin romper la lista.
 */
async function loadUsageByTemplate(storeId: string | null): Promise<Map<string, string>> {
  const usage = new Map<string, string>();
  if (!storeId || !isWhatsAppContractAvailable("rules")) return usage;
  try {
    const response = (await getWhatsAppRules(storeId)) as unknown as {
      items?: Array<{ key: string; templateId: string | null }>;
    };
    for (const rule of response.items ?? []) {
      if (rule.templateId && !usage.has(rule.templateId)) usage.set(rule.templateId, rule.key);
    }
  } catch (error) {
    console.error("No se pudieron cargar las reglas para «Se usa en»:", error);
  }
  return usage;
}

export function TemplatesTab({ canManage, businessName, onActivateRule }: TemplatesTabProps) {
  const sessionCounter = useRef(0);
  const [editorSession, setEditorSession] = useState<{
    key: number;
    mode: TemplateEditorMode;
  } | null>(null);
  const [approvedTemplate, setApprovedTemplate] = useState<WhatsAppTemplate | null>(null);

  // Tienda activa de POWIP (igual que en Programación).
  const { auth, selectedStoreId } = useAuth();
  const stores = auth?.company?.stores ?? [];
  const storeId =
    stores.find((store) => store.id === selectedStoreId)?.id ?? stores[0]?.id ?? null;

  const [templateState, setTemplateState] = useState<WhatsAppResourceState<WhatsAppTemplate[]>>({
    kind: "loading",
  });

  // Sincronización con Meta y avisos de la pestaña
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<SyncNotice>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setTemplateState({ kind: "loading" });
      const [templates, usageByTemplate] = await Promise.all([
        listWhatsAppTemplates(),
        loadUsageByTemplate(storeId),
      ]);
      const withUsage = templates.map((template) => ({
        ...template,
        usage: usageByTemplate.get(template.id) ?? null,
      }));
      setTemplateState({
        kind: "ready",
        data: withUsage as unknown as WhatsAppTemplate[],
      });
    } catch (error) {
      console.error("Error al cargar plantillas:", error);
      setTemplateState({
        kind: "error",
        message: describeError(error),
      } as WhatsAppResourceState<WhatsAppTemplate[]>);
    }
  }, [storeId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const result = await syncWhatsAppTemplates();
      const changes = result.created + result.updated;
      setSyncNotice({
        kind: "success",
        text:
          changes === 0
            ? `Todo al día: tus ${result.total} plantillas ya coinciden con Meta.`
            : `Listo: ${result.created} nuevas y ${result.updated} actualizadas desde Meta (${result.total} en total).`,
      });
      await fetchTemplates();
    } catch (error) {
      console.error("Error al sincronizar plantillas:", error);
      setSyncNotice({
        kind: "error",
        text: "No se pudo actualizar desde Meta. Revisa que el número esté conectado e inténtalo de nuevo.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitForReview = async (values: TemplateEditorValues) => {
    if (values.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT) {
      window.alert(
        "El encabezado PDF todavía no se puede enviar desde POWIP. Elige otro encabezado o «Ninguno».",
      );
      return;
    }
    try {
      const payload = toCreateTemplatePayload(values);
      await createWhatsAppTemplate(payload);
      setEditorSession(null);
      setSyncNotice({
        kind: "success",
        text: `«${payload.name}» se envió a revisión de Meta. Usa «Actualizar desde Meta» para ver si ya la aprobaron.`,
      });
      fetchTemplates();
    } catch (error) {
      console.error("Error al enviar la plantilla:", error);
      // El editor queda abierto con lo que escribiste.
      window.alert(`No se pudo enviar a revisión: ${describeError(error)}`);
    }
  };

  const openEditor = (mode: TemplateEditorMode) => {
    sessionCounter.current += 1;
    setEditorSession({ key: sessionCounter.current, mode });
  };

  return (
    <>
      <div className="mb-3 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          title="Trae las plantillas y sus estados desde tu cuenta de WhatsApp en Meta"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {syncing ? "Actualizando…" : "Actualizar desde Meta"}
        </button>
        {syncNotice && (
          <p
            role="status"
            className={`text-sm ${syncNotice.kind === "success" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {syncNotice.text}
          </p>
        )}
      </div>

      <TemplatesListView
        state={templateState}
        canManage={canManage}
        onCreate={() => openEditor({ kind: "new" })}
        onEdit={(template) => openEditor({ kind: "edit", template })}
        onDuplicate={(template) => openEditor({ kind: "duplicate", template })}
        onRetry={fetchTemplates}
        approvedNotice={buildApprovedNotice(approvedTemplate, {
          canActivateRule: canManage,
          onActivateRule,
          onDismiss: () => setApprovedTemplate(null),
        })}
      />
      {editorSession && (
        <TemplateEditorDialog
          key={editorSession.key}
          open
          mode={editorSession.mode}
          businessName={businessName}
          canManage={true}
          canPersist={true}
          onClose={() => setEditorSession(null)}
          onSubmitForReview={handleSubmitForReview}
        />
      )}
    </>
  );
}
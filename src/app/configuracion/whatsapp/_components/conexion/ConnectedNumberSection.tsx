"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill, type WaTone } from "@/components/whatsapp/ui/WaPill";
import { WhatsAppGlyph } from "@/components/whatsapp/ui/WhatsAppGlyph";
import {
  waButton,
  waCaps,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  getConnectionTypeDefinition,
  NAME_STATUS_LABELS,
  QUALITY_LABELS,
} from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import {
  WHATSAPP_NAME_STATUSES,
  WHATSAPP_QUALITY_RATINGS,
  type WhatsAppNameStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppAccount } from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import {
  describeLimitReset,
  describeUsage,
  describeWebhook,
  formatMetaId,
} from "@/features/whatsapp/utils/connection.util";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";
import { type ActionState, type ConnectionMutations, errorMessage } from "./connection-types";

const KV_GRID =
  "grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-wa-border bg-wa-border min-[900px]:grid-cols-3";

function KvCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] bg-wa-surface px-4 py-3.5">
      <dt className={waCaps}>{label}</dt>
      <dd className="m-0 flex min-w-0 flex-col gap-[3px] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function KvMissing({ children = "Sin dato" }: { children?: ReactNode }) {
  return <span className="text-[13px] text-wa-muted">{children}</span>;
}

function CopyableId({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <KvMissing />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <code className="font-wa-mono text-[12.5px] text-wa-fg">{formatMetaId(value)}</code>
      <Button
        type="button"
        className={cn(
          waButton({ variant: "ghost", size: "sm" }),
          "px-1.5 py-0.5 text-xs text-wa-muted [&_svg:not([class*='size-'])]:size-3.5",
        )}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        <Copy aria-hidden="true" />
        {copied ? "Copiado" : "Copiar"}
        <span className="sr-only"> {label}</span>
      </Button>
    </span>
  );
}

const QUALITY_TONE: Partial<Record<string, string>> = {
  [WHATSAPP_QUALITY_RATINGS.GREEN]: "text-wa-green",
  [WHATSAPP_QUALITY_RATINGS.YELLOW]: "text-wa-amber",
  [WHATSAPP_QUALITY_RATINGS.RED]: "text-wa-red",
};

const NAME_STATUS_TONE: Record<WhatsAppNameStatus, WaTone> = {
  [WHATSAPP_NAME_STATUSES.APPROVED]: "ok",
  [WHATSAPP_NAME_STATUSES.IN_REVIEW]: "warn",
  [WHATSAPP_NAME_STATUSES.REJECTED]: "err",
};

function NumberAvatar({ verified }: { verified: boolean }) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-wa-whatsapp-soft text-wa-whatsapp-dark">
      <WhatsAppGlyph className="size-7" />
      {verified && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2 border-wa-surface bg-wa-whatsapp text-white">
          <Check className="size-[11px] stroke-[3]" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function AccountDetails({ account, now }: { account: WhatsAppAccount; now: Date }) {
  const quality = QUALITY_LABELS[account.qualityRating ?? WHATSAPP_QUALITY_RATINGS.UNKNOWN];
  const usage = describeUsage(account);
  const typeTitle = account.connectionType
    ? getConnectionTypeDefinition(account.connectionType).title
    : "Tipo sin dato";
  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center gap-4">
        <NumberAvatar verified={account.nameStatus === WHATSAPP_NAME_STATUSES.APPROVED} />
        <div className="min-w-0">
          <div className="text-lg font-semibold [overflow-wrap:anywhere]">
            {account.verifiedName ?? <KvMissing>Nombre visible sin dato</KvMissing>}
          </div>
          <div className="wa-num text-wa-muted [overflow-wrap:anywhere]">
            {account.phone ?? "Número sin dato"} · {typeTitle}
          </div>
        </div>
        <WaPill
          tone={account.nameStatus ? NAME_STATUS_TONE[account.nameStatus] : "neutral"}
          className="ml-auto whitespace-normal"
        >
          {account.nameStatus
            ? NAME_STATUS_LABELS[account.nameStatus]
            : "Estado del nombre sin dato"}
        </WaPill>
      </div>
      <dl className={KV_GRID}>
        <KvCell label="Calidad del número">
          <span
            className={cn(
              "text-[15px] font-semibold",
              QUALITY_TONE[account.qualityRating ?? ""] ?? "text-wa-fg",
            )}
          >
            {quality.label}
          </span>
          <span className="text-xs text-wa-muted">{quality.detail}</span>
        </KvCell>
        <KvCell label="Límite diario">
          {account.messagingLimitLabel ? (
            <span className="wa-num text-[15px] font-semibold">{account.messagingLimitLabel}</span>
          ) : (
            <KvMissing />
          )}
        </KvCell>
        <KvCell label="Webhook de estados">
          <span className="text-sm font-semibold">{describeWebhook(account, now)}</span>
        </KvCell>
        <KvCell label="Cuenta de Meta (WABA)">
          <CopyableId label="WABA" value={account.wabaId} />
        </KvCell>
        <KvCell label="Phone number ID">
          <CopyableId label="phone number ID" value={account.phoneNumberId} />
        </KvCell>
        <KvCell label="Conectado desde">
          {account.connectedAt ? (
            <span className="wa-num text-sm font-semibold">
              {formatLimaDateTime(account.connectedAt)}
              {account.connectedBy && ` · por ${account.connectedBy.name}`}
            </span>
          ) : (
            <KvMissing />
          )}
        </KvCell>
      </dl>
      <div className="mt-[18px] flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <span>
            <b className="font-semibold">Uso del límite hoy</b> · <span>{usage.text}</span>
          </span>
          <span className="text-wa-muted">
            {describeLimitReset(account.usageToday?.resetsAt ?? null, now)}
          </span>
        </div>
        {usage.percent !== null && (
          <span
            className="block h-2 overflow-hidden rounded-full border border-wa-border bg-wa-surface-2"
            role="progressbar"
            aria-label="Uso del límite diario"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usage.percent)}
          >
            <span
              className="block h-full rounded-full bg-wa-whatsapp"
              style={{ width: `${usage.percent}%` }}
            />
          </span>
        )}
        <p className="m-0 text-xs text-wa-muted">
          {account.messagesThisMonth === null
            ? "Mensajes del mes sin dato"
            : `${account.messagesThisMonth.toLocaleString("es-PE")} mensajes este mes`}
          {" · "}
          {account.lastSyncedAt
            ? `datos leídos de Meta el ${formatLimaDateTime(account.lastSyncedAt)}`
            : "sin fecha de lectura de Meta"}
        </p>
      </div>
    </>
  );
}

const PENDING_FIELDS = [
  "Calidad del número",
  "Límite diario",
  "Webhook de estados",
  "Cuenta de Meta (WABA)",
  "Phone number ID",
  "Conectado desde",
];

function PendingAccount({ descriptionId }: { descriptionId: string }) {
  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-dashed border-wa-border-strong bg-wa-surface-2 text-wa-muted-2">
          <WhatsAppGlyph className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold">Número pendiente de integración</p>
          <p id={descriptionId} className="m-0 text-[13px] text-wa-muted">
            Nombre, calidad, límite, WABA y webhook se leerán de Meta cuando POWIP los informe. Que
            no aparezcan no significa que la tienda esté desconectada.
          </p>
        </div>
      </div>
      <dl className={KV_GRID}>
        {PENDING_FIELDS.map((label) => (
          <KvCell key={label} label={label}>
            <span className="text-[15px] font-semibold text-wa-muted-2" aria-hidden="true">
              —
            </span>
            <span className="sr-only">Pendiente de integración</span>
          </KvCell>
        ))}
      </dl>
    </>
  );
}

interface ConnectedNumberSectionProps {
  storeName: string;
  account: ResourceState<WhatsAppAccount | null>;
  now: Date;
  blockedReason: string | null;
  mutations: Pick<ConnectionMutations, "refresh" | "disconnect">;
  onConnect: () => void;
  onRetry?: () => void;
}

export function ConnectedNumberSection({
  storeName,
  account,
  now,
  blockedReason,
  mutations,
  onConnect,
  onRetry,
}: ConnectedNumberSectionProps) {
  const refreshReasonId = useId();
  const disconnectReasonId = useId();
  const pendingDescriptionId = useId();
  const [refreshState, setRefreshState] = useState<ActionState>({ kind: "idle" });
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectState, setDisconnectState] = useState<ActionState>({ kind: "idle" });
  const ready = account.kind === "ready" ? account.data : null;
  const pendingIntegration = account.kind === "pending-integration";

  const refresh = async () => {
    if (!ready || !mutations.refresh || blockedReason || refreshState.kind === "pending") return;
    setRefreshState({ kind: "pending" });
    try {
      await mutations.refresh(ready.id);
      setRefreshState({ kind: "idle" });
    } catch (caught) {
      setRefreshState({ kind: "error", message: errorMessage(caught, "Meta no respondió.") });
    }
  };

  const disconnect = async () => {
    if (!ready || !mutations.disconnect || blockedReason || disconnectState.kind === "pending")
      return;
    setDisconnectState({ kind: "pending" });
    try {
      await mutations.disconnect(ready.id);
      setDisconnectOpen(false);
      setDisconnectState({ kind: "idle" });
    } catch (caught) {
      setDisconnectState({
        kind: "error",
        message: errorMessage(caught, "No se pudo desconectar."),
      });
    }
  };

  const actions = ready ? (
    <>
      <BlockedActionButton
        className={waButton({ size: "sm" })}
        blocked={!!blockedReason || refreshState.kind === "pending"}
        blockedReasonId={refreshReasonId}
        onClick={refresh}
      >
        <RefreshCw aria-hidden="true" />
        Actualizar
      </BlockedActionButton>
      <Button
        type="button"
        className={waButton({ variant: "danger", size: "sm" })}
        onClick={() => {
          setDisconnectState({ kind: "idle" });
          setDisconnectOpen(true);
        }}
      >
        Desconectar
      </Button>
    </>
  ) : pendingIntegration ? (
    <>
      <BlockedActionButton
        className={waButton({ size: "sm" })}
        blocked
        blockedReasonId={pendingDescriptionId}
      >
        <RefreshCw aria-hidden="true" />
        Actualizar
      </BlockedActionButton>
      <BlockedActionButton
        className={waButton({ variant: "danger", size: "sm" })}
        blocked
        blockedReasonId={pendingDescriptionId}
      >
        Desconectar
      </BlockedActionButton>
    </>
  ) : null;

  return (
    <WaCard aria-labelledby="connected-number-title">
      <WaCardHeader
        titleId="connected-number-title"
        title="Número conectado"
        description="Este es el número desde el que tus clientes reciben los avisos."
        actions={actions}
      />
      {ready && blockedReason && (
        <p id={refreshReasonId} className="-mt-2 mb-4 text-xs text-wa-muted">
          {blockedReason}
        </p>
      )}
      {refreshState.kind === "error" && (
        <p role="alert" className="-mt-2 mb-4 text-xs text-wa-red">
          {refreshState.message}
        </p>
      )}
      {pendingIntegration ? (
        <PendingAccount descriptionId={pendingDescriptionId} />
      ) : (
        <WhatsAppResourceState
          state={account}
          pendingTitle="Número pendiente de integración"
          loadingLabel="Cargando el número conectado"
          errorTitle="No se pudo cargar el número conectado"
          onRetry={onRetry}
          isEmpty={(data) => data === null}
          empty={
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-wa-border-strong p-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-wa-surface-2 text-wa-muted">
                <WhatsAppGlyph className="size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">{storeName} no tiene número conectado.</p>
                <p className="m-0 text-[13px] text-wa-muted">
                  Sus pedidos no generan avisos por WhatsApp.
                </p>
              </div>
              <Button
                type="button"
                className={waButton({ variant: "whatsapp", size: "sm" })}
                onClick={onConnect}
              >
                <WhatsAppGlyph />
                Conectar número
              </Button>
            </div>
          }
        >
          {(data) => (data ? <AccountDetails account={data} now={now} /> : null)}
        </WhatsAppResourceState>
      )}
      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>
              ¿Desconectar el número de {storeName}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className={cn(waDialogBody, "space-y-3")}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              Se pausan todos los avisos automáticos y envíos programados de {storeName}. Tus
              plantillas y el historial se conservan y vuelven a funcionar al reconectar.
            </AlertDialogDescription>
            {disconnectState.kind === "error" && (
              <p role="alert" className="text-[13px] text-wa-red">
                {disconnectState.message}
              </p>
            )}
            {blockedReason && (
              <p id={disconnectReasonId} className="text-xs text-wa-muted">
                {blockedReason}
              </p>
            )}
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Cancelar</AlertDialogCancel>
            <BlockedActionButton
              className={waButton({ variant: "solid-danger" })}
              blocked={!!blockedReason || disconnectState.kind === "pending"}
              blockedReasonId={disconnectReasonId}
              onClick={disconnect}
            >
              Desconectar
            </BlockedActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WaCard>
  );
}

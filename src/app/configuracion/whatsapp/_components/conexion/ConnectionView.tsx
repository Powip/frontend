"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WaDot, WaPill } from "@/components/whatsapp/ui/WaPill";
import { waSelectTrigger } from "@/components/whatsapp/ui/wa-classes";
import {
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  WHATSAPP_PERMISSION_CODES,
  type WhatsAppConnectionType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAccount,
  WhatsAppAssistedQueue,
  WhatsAppCoexistenceState,
  WhatsAppConnectionStatus,
  WhatsAppContingencySettings,
  WhatsAppPricing,
  WhatsAppTestRun,
  WhatsAppUsageSummary,
} from "@/features/whatsapp/models/connection.model";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppEffectivePermissions } from "@/features/whatsapp/models/settings-tab.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  describeConnectionStatus,
  resolveTestProgress,
} from "@/features/whatsapp/utils/connection.util";
import {
  combineBlockReasons,
  getPermissionBlockReason,
} from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { cn } from "@/lib/utils";
import { AppOnlyNumberDialog } from "./AppOnlyNumberDialog";
import { AssistedQueueSection } from "./AssistedQueueSection";
import { ChangeConnectionTypeDialog, changeWarnings } from "./ChangeConnectionTypeDialog";
import { ConnectedNumberSection } from "./ConnectedNumberSection";
import { ConnectionTypeSection } from "./ConnectionTypeSection";
import { ConnectNumberDialog, type SignupPhase } from "./ConnectNumberDialog";
import { ContingencySection } from "./ContingencySection";
import {
  CONNECTION_PENDING_REASON,
  type ConnectionMutations,
  SIGNUP_UNAVAILABLE_REASON,
} from "./connection-types";
import { ManualNumberDialog } from "./ManualNumberDialog";
import { MessagingCostSection } from "./MessagingCostSection";
import { StoreNumbersSection } from "./StoreNumbersSection";
import { type AddNumberMode, StoreWhatsAppNumbersSection } from "./StoreWhatsAppNumbersSection";
import { TestMessageSection } from "./TestMessageSection";

export interface ConnectionViewProps {
  stores: { id: string; name: string }[];
  storeId: string | null;
  onStoreChange: (storeId: string) => void;
  now: Date;
  canManage: boolean;
  effectivePermissions: WhatsAppEffectivePermissions;
  status: ResourceState<WhatsAppConnectionStatus>;
  account: ResourceState<WhatsAppAccount | null>;
  accounts: ResourceState<WhatsAppAccount[]>;
  templates: ResourceState<WhatsAppTemplate[]>;
  testRun: WhatsAppTestRun | null;
  contingency: ResourceState<WhatsAppContingencySettings | null>;
  agents: ResourceState<WhatsAppAgentOption[]>;
  assistedQueue: ResourceState<WhatsAppAssistedQueue>;
  pricing: ResourceState<WhatsAppPricing>;
  usage: ResourceState<WhatsAppUsageSummary>;
  signupAvailable: boolean;
  /** Qué falta para habilitar «Conectar con Facebook» (por defecto, el texto genérico). */
  signupUnavailableReason?: string;
  mutations: ConnectionMutations;
  /** Números conectados con coexistencia (siguen en la app del celular). */
  coexistence?: WhatsAppCoexistenceState[];
  initialSignup?: { storeId: string; phase: SignupPhase } | null;
  onRetry?: () => void;
}

export function ConnectionView({
  stores,
  storeId,
  onStoreChange,
  now,
  canManage,
  effectivePermissions,
  status,
  account,
  accounts,
  templates,
  testRun: initialTestRun,
  contingency,
  agents,
  assistedQueue,
  pricing,
  usage,
  signupAvailable,
  signupUnavailableReason,
  mutations,
  coexistence = [],
  initialSignup = null,
  onRetry,
}: ConnectionViewProps) {
  const [signup, setSignup] = useState<{
    storeId: string;
    phase?: SignupPhase;
    mode?: AddNumberMode;
  } | null>(initialSignup);
  // Cambio de modo pedido desde las tarjetas «Tipo de conexión».
  const [change, setChange] = useState<{ storeId: string; target: WhatsAppConnectionType } | null>(
    null,
  );
  const [reconnect, setReconnect] = useState<{
    storeId: string;
    mode: "api" | "coex";
    phone: string;
    isCompanyDefault: boolean;
  } | null>(null);
  const [typeNotice, setTypeNotice] = useState<{ storeId: string; text: string } | null>(null);
  const [testRun, setTestRun] = useState<WhatsAppTestRun | null>(initialTestRun);
  const refreshTest = mutations.refreshTest;
  const testInProgress =
    !!testRun?.messageId && resolveTestProgress(testRun, now).kind === "in-progress";
  // Mientras la prueba no llegue a leído/fallido, se consulta su estado cada 2 s.
  useEffect(() => {
    if (!refreshTest || !testInProgress || !testRun?.messageId) return;
    const messageId = testRun.messageId;
    let cancelled = false;
    const timer = window.setInterval(() => {
      refreshTest(messageId)
        .then((next) => {
          if (!cancelled) setTestRun(next);
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshTest, testInProgress, testRun?.messageId]);
  const store = stores.find((item) => item.id === storeId) ?? null;
  const connectionPermission = getPermissionBlockReason(
    effectivePermissions,
    WHATSAPP_PERMISSION_CODES.CONNECTION,
  );
  const pending = (handler: unknown) => (handler ? null : CONNECTION_PENDING_REASON);
  const accountData = account.kind === "ready" ? account.data : null;
  const statusLabel =
    status.kind === "ready"
      ? describeConnectionStatus(status.data)
      : status.kind === "pending-integration"
        ? "Estado de conexión pendiente de integración"
        : status.kind === "loading"
          ? "Cargando estado…"
          : "Estado sin confirmar";
  const statusTone =
    status.kind !== "ready" || status.data.state === null
      ? "neutral"
      : status.data.state === WHATSAPP_CONNECTION_STATES.CONNECTED
        ? "connected"
        : status.data.state === WHATSAPP_CONNECTION_STATES.NAME_IN_REVIEW
          ? "warn"
          : "err";

  if (stores.length === 0 || !store) {
    return (
      <StoreNumbersSection
        stores={stores}
        accounts={accounts}
        selectedStoreId={null}
        onSelectStore={onStoreChange}
        onConnect={(id) => setSignup({ storeId: id })}
      />
    );
  }

  const signupStore = signup ? stores.find((item) => item.id === signup.storeId) : null;
  const appOnlyPhone =
    accountData?.connectionType === WHATSAPP_CONNECTION_TYPES.APP_MANUAL ? accountData.phone : null;
  const isAppOnly = accountData?.connectionType === WHATSAPP_CONNECTION_TYPES.APP_MANUAL;
  // El principal es el que envía los avisos de la tienda.
  const principal =
    accounts.kind === "ready"
      ? (accounts.data.find((item) => item.isPrimary ?? item.role === "principal") ??
        accounts.data[0])
      : undefined;
  const storeSendsByApi =
    !!principal && principal.connectionType !== WHATSAPP_CONNECTION_TYPES.APP_MANUAL;

  const numbers = accounts.kind === "ready" ? accounts.data : [];
  const changeCandidates =
    change?.storeId === store.id
      ? numbers.filter((item) => item.connectionType !== change.target)
      : [];
  const openReconnect = (item: WhatsAppAccount, target: WhatsAppConnectionType) => {
    setChange(null);
    if (!item.phone?.startsWith("+")) {
      setTypeNotice({
        storeId: store.id,
        text: "Powip no tiene el teléfono de este número. Toca «Actualizar» y vuelve a intentar.",
      });
      return;
    }
    setReconnect({
      storeId: store.id,
      mode: target === WHATSAPP_CONNECTION_TYPES.COEXISTENCE ? "coex" : "api",
      phone: item.phone,
      isCompanyDefault: !!item.isCompanyDefault,
    });
  };
  const requestChange = (target: WhatsAppConnectionType) => {
    setChange(null);
    if (numbers.length === 0) {
      setTypeNotice({
        storeId: store.id,
        text: `Todavía no hay un número conectado en ${store.name}. Elige cómo conectarlo abajo, en «Números de ${store.name}».`,
      });
      return;
    }
    if (numbers.every((item) => item.connectionType === target)) {
      setTypeNotice({
        storeId: store.id,
        text:
          numbers.length === 1
            ? "El número ya está conectado así."
            : "Todos los números ya están conectados así.",
      });
      return;
    }
    setTypeNotice(null);
    // Un solo número y nada que perder: directo a la ventana de Meta, sin aviso vacío.
    if (numbers.length === 1 && !changeWarnings(numbers[0].connectionType, target).length) {
      openReconnect(numbers[0], target);
      return;
    }
    setChange({ storeId: store.id, target });
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="text-[13px] font-medium text-wa-muted">Tienda</span>
          <Select
            value={store.id}
            onValueChange={(value) => {
              if (value && value !== store.id) onStoreChange(value);
            }}
          >
            <SelectTrigger
              className={cn(waSelectTrigger, "w-auto min-w-40 py-[7px]")}
              aria-label="Tienda"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stores.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p role="status" className="m-0">
          <span className="sr-only">Estado: </span>
          {statusTone === "connected" ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--wa-whatsapp)_30%,transparent)] bg-wa-whatsapp-soft px-3 py-[7px] text-[13px] font-semibold text-wa-whatsapp-dark">
              <WaDot />
              {statusLabel}
            </span>
          ) : (
            <WaPill
              tone={statusTone === "neutral" ? "neutral" : statusTone}
              className="whitespace-normal px-3 py-[7px] text-[13px]"
            >
              {statusLabel}
            </WaPill>
          )}
        </p>
      </div>

      <ConnectionTypeSection
        key={`type-${store.id}`}
        storeName={store.name}
        status={status}
        onSelect={accounts.kind === "ready" ? requestChange : undefined}
        blockedReason={connectionPermission}
        notice={typeNotice?.storeId === store.id ? typeNotice.text : null}
      />

      <StoreWhatsAppNumbersSection
        key={`numbers-${store.id}`}
        storeName={store.name}
        accounts={accounts}
        agents={agents}
        coexistence={coexistence}
        now={now}
        blockedReason={connectionPermission}
        mutations={mutations}
        onAdd={(mode) => setSignup({ storeId: store.id, mode })}
      />

      <div className="grid grid-cols-1 items-start gap-5 min-[1050px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ConnectedNumberSection
          key={`number-${store.id}`}
          storeName={store.name}
          account={account}
          now={now}
          blockedReason={combineBlockReasons(
            pending(mutations.refresh && mutations.disconnect),
            connectionPermission,
          )}
          mutations={mutations}
          onConnect={() => setSignup({ storeId: store.id })}
          onRetry={onRetry}
        />
        {!isAppOnly && (
          <TestMessageSection
            key={`test-${store.id}`}
            accountId={accountData?.id ?? null}
            templates={templates}
            storeId={store.id}
            testRun={testRun}
            now={now}
            blockedReason={combineBlockReasons(pending(mutations.sendTest), connectionPermission)}
            sendTest={mutations.sendTest}
            onTestStarted={setTestRun}
          />
        )}
      </div>

      <StoreNumbersSection
        stores={stores}
        accounts={accounts}
        selectedStoreId={store.id}
        onSelectStore={onStoreChange}
        onConnect={(id) => setSignup({ storeId: id })}
      />

      <ContingencySection
        settings={contingency}
        agents={agents}
        storeKey={store.id}
        canEdit={canManage}
        blockedReason={combineBlockReasons(
          pending(mutations.saveContingency),
          connectionPermission,
        )}
        onSave={mutations.saveContingency}
        onRetry={onRetry}
        aside={
          <AssistedQueueSection
            key={`assisted-${store.id}`}
            queue={assistedQueue}
            contingencyActive={
              contingency.kind === "ready" ? (contingency.data?.active ?? null) : null
            }
            blockedReason={combineBlockReasons(
              pending(mutations.markAssistedSent),
              getPermissionBlockReason(effectivePermissions, WHATSAPP_PERMISSION_CODES.REPLY),
            )}
            mutations={mutations}
            appOnlyPhone={appOnlyPhone}
            onRetry={onRetry}
          />
        }
      />

      <MessagingCostSection pricing={pricing} usage={usage} now={now} onRetry={onRetry} />

      {change && changeCandidates.length > 0 && (
        <ChangeConnectionTypeDialog
          storeName={store.name}
          target={change.target}
          candidates={changeCandidates}
          askWhich={numbers.length > 1}
          switchToApp={mutations.switchToApp}
          onReconnect={(item) => openReconnect(item, change.target)}
          onClose={() => setChange(null)}
        />
      )}
      {reconnect?.storeId === store.id && (
        <ConnectNumberDialog
          storeId={store.id}
          storeName={store.name}
          mode={reconnect.mode}
          reconnect={reconnect}
          blockedReason={combineBlockReasons(
            signupAvailable ? null : (signupUnavailableReason ?? SIGNUP_UNAVAILABLE_REASON),
            pending(mutations.startSignup),
            connectionPermission,
          )}
          startSignup={signupAvailable ? mutations.startSignup : undefined}
          selectSignupPhone={signupAvailable ? mutations.selectSignupPhone : undefined}
          onClose={() => setReconnect(null)}
        />
      )}
      {signup && signupStore && signup.mode === "app" && (
        <AppOnlyNumberDialog
          storeId={signupStore.id}
          storeName={signupStore.name}
          connectAppOnly={mutations.connectAppOnly}
          agents={agents.kind === "ready" ? agents.data : []}
          storeSendsByApi={storeSendsByApi}
          onClose={() => setSignup(null)}
        />
      )}
      {signup && signupStore && signup.mode === "manual" && (
        <ManualNumberDialog
          storeId={signupStore.id}
          storeName={signupStore.name}
          connectManual={mutations.connectManual}
          agents={agents.kind === "ready" ? agents.data : []}
          onClose={() => setSignup(null)}
        />
      )}
      {signup && signupStore && signup.mode !== "manual" && signup.mode !== "app" && (
        <ConnectNumberDialog
          storeId={signupStore.id}
          storeName={signupStore.name}
          // «Conectar número» sin modo: la persona elige dedicado o el que ya usa en el celular.
          mode={signup.mode === "coex" || signup.mode === "api" ? signup.mode : "choose"}
          blockedReason={combineBlockReasons(
            signupAvailable ? null : (signupUnavailableReason ?? SIGNUP_UNAVAILABLE_REASON),
            pending(mutations.startSignup),
            connectionPermission,
          )}
          startSignup={signupAvailable ? mutations.startSignup : undefined}
          selectSignupPhone={signupAvailable ? mutations.selectSignupPhone : undefined}
          initialPhase={signup.phase}
          agents={agents.kind === "ready" ? agents.data : []}
          onClose={() => setSignup(null)}
        />
      )}
    </div>
  );
}

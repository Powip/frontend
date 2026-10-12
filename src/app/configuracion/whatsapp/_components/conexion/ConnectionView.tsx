"use client";

import { useState } from "react";
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
  WHATSAPP_PERMISSION_CODES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAccount,
  WhatsAppAssistedQueue,
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
import { describeConnectionStatus } from "@/features/whatsapp/utils/connection.util";
import {
  combineBlockReasons,
  getPermissionBlockReason,
  UNDEFINED_PERMISSION_REASON,
} from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { cn } from "@/lib/utils";
import { AssistedQueueSection } from "./AssistedQueueSection";
import { ConnectedNumberSection } from "./ConnectedNumberSection";
import { ConnectionTypeSection } from "./ConnectionTypeSection";
import { ConnectNumberDialog, type SignupPhase } from "./ConnectNumberDialog";
import { ContingencySection } from "./ContingencySection";
import {
  CONNECTION_PENDING_REASON,
  type ConnectionMutations,
  SIGNUP_UNAVAILABLE_REASON,
} from "./connection-types";
import { MessagingCostSection } from "./MessagingCostSection";
import { StoreNumbersSection } from "./StoreNumbersSection";
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
  mutations: ConnectionMutations;
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
  mutations,
  initialSignup = null,
  onRetry,
}: ConnectionViewProps) {
  const [signup, setSignup] = useState<{ storeId: string; phase?: SignupPhase } | null>(
    initialSignup,
  );
  const [testRun, setTestRun] = useState<WhatsAppTestRun | null>(initialTestRun);
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
        accountId={accountData?.id ?? null}
        blockedReason={combineBlockReasons(pending(mutations.changeType), connectionPermission)}
        changeType={mutations.changeType}
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
              UNDEFINED_PERMISSION_REASON,
            )}
            mutations={mutations}
            onRetry={onRetry}
          />
        }
      />

      <MessagingCostSection pricing={pricing} usage={usage} now={now} onRetry={onRetry} />

      {signup && signupStore && (
        <ConnectNumberDialog
          storeId={signupStore.id}
          storeName={signupStore.name}
          mode="api"
          blockedReason={combineBlockReasons(
            signupAvailable ? null : SIGNUP_UNAVAILABLE_REASON,
            pending(mutations.startSignup),
            connectionPermission,
          )}
          startSignup={signupAvailable ? mutations.startSignup : undefined}
          initialPhase={signup.phase}
          onClose={() => setSignup(null)}
        />
      )}
    </div>
  );
}

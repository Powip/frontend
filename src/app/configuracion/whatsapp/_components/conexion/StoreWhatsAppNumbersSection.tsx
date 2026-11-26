"use client";

import { History, Plus, Smartphone, Star } from "lucide-react";
import { useId, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import { WhatsAppGlyph } from "@/components/whatsapp/ui/WhatsAppGlyph";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waSelectTriggerSm,
} from "@/components/whatsapp/ui/wa-classes";
import type {
  WhatsAppAccount,
  WhatsAppCoexistenceState,
} from "@/features/whatsapp/models/connection.model";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { cn } from "@/lib/utils";
import { type ActionState, type ConnectionMutations, errorMessage } from "./connection-types";

/** Valor del selector para «sin vendedora»: el número es de la tienda. */
const STORE_OWNED = "__store__";

export type AddNumberMode = "api" | "coex" | "manual";

interface StoreWhatsAppNumbersSectionProps {
  storeName: string;
  accounts: ResourceState<WhatsAppAccount[]>;
  agents: ResourceState<WhatsAppAgentOption[]>;
  coexistence: WhatsAppCoexistenceState[];
  now: Date;
  blockedReason: string | null;
  mutations: ConnectionMutations;
  onAdd: (mode: AddNumberMode) => void;
}

function historyLabel(state: WhatsAppCoexistenceState): string {
  switch (state.historyStatus) {
    case "requested":
      return "Historial pedido a Meta";
    case "importing":
      return `Importando historial (${state.historyProgress ?? 0}%)`;
    case "done":
      return "Historial importado";
    case "declined":
      return "El celular no compartió el historial";
    default:
      return state.canSync ? "Historial sin traer" : "Plazo de 24 h vencido";
  }
}

/**
 * Varios números por tienda: uno por vendedora. Cada fila muestra su vendedora, si es el
 * principal (el que envía los avisos automáticos) y si sigue en la app del celular.
 */
export function StoreWhatsAppNumbersSection({
  storeName,
  accounts,
  agents,
  coexistence,
  now,
  blockedReason,
  mutations,
  onAdd,
}: StoreWhatsAppNumbersSectionProps) {
  const reasonId = useId();
  const [action, setAction] = useState<{ accountId: string; state: ActionState } | null>(null);
  const [toDisconnect, setToDisconnect] = useState<WhatsAppAccount | null>(null);
  const list = accounts.kind === "ready" ? accounts.data : [];
  const agentList = agents.kind === "ready" ? agents.data : [];
  const blocked = !!blockedReason;
  const { setPrimary, assignNumber, syncAppData, disconnect } = mutations;

  const run = async (accountId: string, task: () => Promise<void>, fallback: string) => {
    setAction({ accountId, state: { kind: "pending" } });
    try {
      await task();
      setAction(null);
      return true;
    } catch (caught) {
      setAction({ accountId, state: { kind: "error", message: errorMessage(caught, fallback) } });
      return false;
    }
  };

  const busy = (accountId: string) =>
    action?.accountId === accountId && action.state.kind === "pending";

  return (
    <WaCard aria-labelledby="store-wa-numbers-title">
      <WaCardHeader
        titleId="store-wa-numbers-title"
        title={`Números de ${storeName}`}
        description="Cada vendedora puede tener su propio número. Los chats de un número llegan a su vendedora; sin vendedora, el número es de la tienda. El principal envía los avisos automáticos."
      />

      {accounts.kind === "loading" && (
        <p className="m-0 text-[13px] text-wa-muted">Cargando números…</p>
      )}
      {accounts.kind === "error" && (
        <p className="m-0 text-[13px] text-wa-red">{accounts.message}</p>
      )}
      {accounts.kind === "ready" && list.length === 0 && (
        <p className="m-0 text-[13px] text-wa-muted">Esta tienda todavía no tiene números.</p>
      )}

      {list.length > 0 && (
        <ul className="m-0 list-none p-0" aria-label={`Números de ${storeName}`}>
          {list.map((account) => {
            const coex = coexistence.find((item) => item.credentialId === account.id) ?? null;
            const primary = account.isPrimary ?? account.role === "principal";
            const error =
              action?.accountId === account.id && action.state.kind === "error"
                ? action.state.message
                : null;
            const assigned = account.assignedUserId ?? STORE_OWNED;
            const assignedMissing =
              !!account.assignedUserId &&
              !agentList.some((agent) => agent.id === account.assignedUserId);
            const canSync =
              !!coex?.canSync && now.getTime() <= new Date(coex.syncDeadline).getTime();
            return (
              <li
                key={account.id}
                data-testid={`wa-number-${account.phoneNumberId ?? account.id}`}
                className="flex flex-wrap items-center gap-3.5 border-t border-wa-border py-3.5 first:border-t-0 first:pt-0 last:pb-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-wa-whatsapp-soft text-wa-whatsapp-dark">
                  <WhatsAppGlyph />
                </span>
                <span className="min-w-[180px] flex-1">
                  <span className="wa-num block font-semibold [overflow-wrap:anywhere]">
                    {account.phone ?? "Número sin dato"}
                  </span>
                  <span className="block text-xs text-wa-muted">
                    {[
                      account.verifiedName,
                      account.isCompanyDefault ? "Número de la empresa" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin nombre visible"}
                  </span>
                  {coex && (
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-wa-muted">
                      <Smartphone className="size-3.5" aria-hidden="true" />
                      Sigue en la app del celular · {historyLabel(coex)}
                    </span>
                  )}
                </span>

                <span className="flex flex-wrap items-center gap-2">
                  {primary ? (
                    <WaPill tone="purple">
                      <Star className="size-3" aria-hidden="true" />
                      Principal
                    </WaPill>
                  ) : (
                    <Button
                      type="button"
                      className={waButton({ size: "sm", variant: "ghost" })}
                      disabled={
                        blocked ||
                        busy(account.id) ||
                        !mutations.setPrimary ||
                        account.isCompanyDefault
                      }
                      aria-describedby={blocked ? reasonId : undefined}
                      onClick={() =>
                        setPrimary &&
                        run(
                          account.id,
                          () => setPrimary(account.id),
                          "No se pudo marcar como principal.",
                        )
                      }
                    >
                      Hacer principal
                      <span className="sr-only"> el número {account.phone}</span>
                    </Button>
                  )}
                </span>

                <span className="flex min-w-[200px] flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-wa-muted">
                    Vendedora
                  </span>
                  <Select
                    value={assigned}
                    disabled={
                      blocked ||
                      busy(account.id) ||
                      !mutations.assignNumber ||
                      account.isCompanyDefault
                    }
                    onValueChange={(value) => {
                      if (!assignNumber || value === assigned) return;
                      const agent = agentList.find((item) => item.id === value) ?? null;
                      void run(
                        account.id,
                        () =>
                          assignNumber({
                            accountId: account.id,
                            userId: agent?.id ?? null,
                            userName: agent?.name ?? null,
                          }),
                        "No se pudo cambiar la vendedora.",
                      );
                    }}
                  >
                    <SelectTrigger
                      className={cn(waSelectTriggerSm, "min-w-[180px]")}
                      aria-label={`Vendedora del número ${account.phone ?? ""}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STORE_OWNED}>Sin vendedora (de la tienda)</SelectItem>
                      {assignedMissing && (
                        <SelectItem value={account.assignedUserId as string}>
                          {account.assignedUserName ?? "Vendedora asignada"}
                        </SelectItem>
                      )}
                      {agentList.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>

                <span className="flex flex-wrap items-center gap-2">
                  {coex && canSync && syncAppData && (
                    <Button
                      type="button"
                      className={waButton({ size: "sm" })}
                      disabled={blocked || busy(account.id)}
                      onClick={() =>
                        run(
                          account.id,
                          () => syncAppData(account.id),
                          "No se pudo pedir el historial a Meta.",
                        )
                      }
                    >
                      <History aria-hidden="true" />
                      Traer historial y contactos
                    </Button>
                  )}
                  {!account.isCompanyDefault && (
                    <Button
                      type="button"
                      className={waButton({ size: "sm", variant: "ghost-danger" })}
                      disabled={blocked || busy(account.id) || !mutations.disconnect}
                      onClick={() => setToDisconnect(account)}
                    >
                      Desconectar
                      <span className="sr-only"> el número {account.phone}</span>
                    </Button>
                  )}
                </span>

                {error && (
                  <p role="alert" className="m-0 basis-full text-[13px] text-wa-red">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-wa-border pt-4">
        <Button
          type="button"
          className={waButton({ variant: "whatsapp", size: "sm" })}
          disabled={blocked}
          onClick={() => onAdd("api")}
        >
          <Plus aria-hidden="true" />
          Agregar número con Facebook
        </Button>
        <Button
          type="button"
          className={waButton({ size: "sm" })}
          disabled={blocked}
          onClick={() => onAdd("coex")}
        >
          <Smartphone aria-hidden="true" />
          Agregar número que ya usa en el celular
        </Button>
        <Button
          type="button"
          className={waButton({ size: "sm", variant: "ghost" })}
          disabled={blocked}
          onClick={() => onAdd("manual")}
        >
          Agregar manual
        </Button>
      </div>
      {blocked && (
        <p id={reasonId} className="m-0 mt-2 text-xs text-wa-muted">
          {blockedReason}
        </p>
      )}

      <AlertDialog open={!!toDisconnect} onOpenChange={(open) => !open && setToDisconnect(null)}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>
              ¿Desconectar {toDisconnect?.phone ?? "este número"}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className={cn(waDialogBody, "space-y-3")}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              Solo se desconecta este número. Los otros números de {storeName} siguen funcionando.
              Sus chats se conservan en la Bandeja.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Cancelar</AlertDialogCancel>
            <BlockedActionButton
              className={waButton({ variant: "solid-danger" })}
              blocked={blocked || !toDisconnect || !mutations.disconnect}
              blockedReasonId={reasonId}
              onClick={async () => {
                const target = toDisconnect;
                if (!target || !disconnect) return;
                setToDisconnect(null);
                await run(
                  target.id,
                  () => disconnect(target.id),
                  "No se pudo desconectar el número.",
                );
              }}
            >
              Desconectar
            </BlockedActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WaCard>
  );
}

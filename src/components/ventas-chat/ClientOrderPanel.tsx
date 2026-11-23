"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, ExternalLink, Loader2, Plus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import type { Client } from "@/interfaces/ICliente";
import type { Conversation, ConversationOrder } from "@/types/crm";
import { crmError } from "@/services/crmService";
import { useConversationOrders, useCoreOrder, useUpdateConversation } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import ChatCallsSection from "./ChatCallsSection";
import { FollowupsSection, TagsSection } from "./ChatExtrasSections";
import { PipelineSection, TasksSection } from "./ChatPlanningSections";
import CustomerPhoneField from "./CustomerPhoneField";
import CrearClienteDialog from "./CrearClienteDialog";
import PedidoLinkSection from "./PedidoLinkSection";
import {
  CodSection,
  DiscountApprovalsSection,
  FinanceQueueSection,
  PaymentPolicySection,
  ReceiptsSection,
} from "./OrderPanelSections";
import { CRM_UNREACHABLE } from "./ConversationList";
import {
  abrirPedidoUrl,
  crearPedidoUrl,
  formatMoney,
  formatTime,
  isMetaChannel,
  orderBalance,
  phoneForCustomer,
  showPhone,
} from "./format";

interface Props {
  conversation: Conversation;
  companyId: string | undefined;
  client: Pick<UseQueryResult<Client | null>, "data" | "isLoading" | "isError" | "refetch">;
  /** Deja un texto en la caja del chat (sin enviarlo). */
  onInsertMessage?: (text: string) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function ClientSection({ conversation, companyId, client }: Props) {
  const { phoneMasked } = useCrmMe();
  const [creating, setCreating] = useState(false);
  const found = client.data;
  const phone = phoneForCustomer(conversation);
  const meta = isMetaChannel(conversation);
  return (
    <section className="space-y-2" aria-label="Cliente">
      <SectionTitle>Cliente</SectionTitle>
      {meta && <CustomerPhoneField conversation={conversation} />}
      {!companyId && (
        <p className="text-sm text-muted-foreground">No se pudo identificar la empresa.</p>
      )}
      {companyId && client.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando cliente…
        </p>
      )}
      {companyId && client.isError && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">No se pudo buscar el cliente.</p>
          <Button size="sm" variant="outline" onClick={() => client.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {found && (
        <div className="space-y-0.5 rounded-md border p-2 text-sm" data-testid="client-card">
          <p className="font-medium">{found.fullName}</p>
          {found.documentNumber && (
            <p className="text-xs text-muted-foreground">
              {found.documentType ?? "Doc."} {found.documentNumber}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {showPhone(found.phoneNumber ?? phone, phoneMasked)}
          </p>
          {(found.district || found.address) && (
            <p className="text-xs text-muted-foreground">
              {[found.district, found.address].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}
      {companyId && !!phone && !client.isLoading && !client.isError && !found && (
        <div className="space-y-2 text-sm">
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Este número no está en Clientes
          </p>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <UserPlus /> Crear cliente
          </Button>
          {creating && (
            <CrearClienteDialog
              open
              onOpenChange={setCreating}
              companyId={companyId}
              phone={phone ?? ""}
              name={conversation.contactName}
              onCreated={() => void client.refetch()}
            />
          )}
        </div>
      )}
    </section>
  );
}

/** «No enviar promociones»: lo respetan las difusiones y los seguimientos de venta y postventa. */
function MarketingOptOutSection({ conversation }: { conversation: Conversation }) {
  const update = useUpdateConversation(conversation.id);
  return (
    <section className="space-y-1.5" aria-label="Promociones">
      <SectionTitle>Promociones</SectionTitle>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="marketing-opt-out" className="text-sm font-normal">
          No enviar promociones
        </Label>
        <Switch
          id="marketing-opt-out"
          checked={conversation.marketingOptOut}
          disabled={update.isPending}
          onCheckedChange={(v) => update.mutate({ marketingOptOut: v })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {conversation.marketingOptOut
          ? "Pidió la baja: no recibe difusiones ni seguimientos de venta o postventa."
          : "Actívalo si el cliente pide no recibir mensajes comerciales."}
      </p>
    </section>
  );
}

function OrderRow({
  link,
  onPayments,
}: {
  link: ConversationOrder;
  onPayments: (order: { id: string; number: string }) => void;
}) {
  const router = useRouter();
  const core = useCoreOrder(link.orderId);
  const order = core.data;
  const number = order?.orderNumber ?? link.orderNumber ?? link.orderId.slice(0, 8);
  const balance = order ? orderBalance(order) : null;
  return (
    <li className="space-y-1.5 rounded-md border p-2 text-sm" data-testid="order-row">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{number}</span>
        {order && <Badge variant="secondary">{getStatusLabel(order.status)}</Badge>}
        {core.isLoading && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Cargando pedido"
          />
        )}
      </div>
      {order && (
        <p className="text-xs text-muted-foreground">
          Total {formatMoney(order.grandTotal, order.currency)} ·{" "}
          {balance && balance > 0
            ? `Saldo ${formatMoney(balance, order.currency)}`
            : "Sin saldo"}
        </p>
      )}
      {core.isError && (
        <p className="text-xs text-muted-foreground">No se pudo cargar el detalle del pedido.</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Creado {formatTime(link.createdAt)}
        {link.createdByName ? ` por ${link.createdByName}` : ""}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPayments({ id: link.orderId, number })}
        >
          Pagos
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(abrirPedidoUrl(link.orderId))}
        >
          <ExternalLink /> Abrir pedido
        </Button>
      </div>
    </li>
  );
}

function OrdersSection({ conversation }: { conversation: Conversation }) {
  const orders = useConversationOrders(conversation.id);
  const qc = useQueryClient();
  const [paying, setPaying] = useState<{ id: string; number: string } | null>(null);
  const err = orders.isError ? crmError(orders.error) : null;
  return (
    <section className="space-y-2" aria-label="Pedidos de esta conversación">
      <SectionTitle>Pedidos de esta conversación</SectionTitle>
      {orders.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando pedidos…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => orders.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {orders.data && orders.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aún no hay pedidos creados desde este chat.
        </p>
      )}
      {orders.data && orders.data.length > 0 && (
        <ul className="space-y-2">
          {orders.data.map((o) => (
            <OrderRow key={o.id} link={o} onPayments={setPaying} />
          ))}
        </ul>
      )}
      {paying && (
        <PaymentVerificationModal
          open
          onClose={() => setPaying(null)}
          orderId={paying.id}
          orderNumber={paying.number}
          onPaymentUpdated={() =>
            qc.invalidateQueries({ queryKey: ["crm", "core-order", paying.id] })
          }
        />
      )}
    </section>
  );
}

/** Panel «Cliente y pedido» de la conversación seleccionada. */
export default function ClientOrderPanel(props: Props) {
  const router = useRouter();
  const { conversation } = props;
  return (
    <div className="h-full space-y-5 overflow-y-auto p-3" data-testid="client-order-panel">
      <ClientSection {...props} />
      <TagsSection conversation={conversation} />
      <PipelineSection conversation={conversation} />
      <TasksSection conversation={conversation} />
      <FollowupsSection conversation={conversation} />
      <ChatCallsSection conversation={conversation} />
      <PedidoLinkSection
        conversation={conversation}
        client={props.client.data}
        onInsertMessage={props.onInsertMessage}
      />
      <OrdersSection conversation={conversation} />
      <PaymentPolicySection conversation={conversation} />
      <DiscountApprovalsSection />
      <ReceiptsSection conversation={conversation} />
      <FinanceQueueSection />
      <CodSection conversation={conversation} />
      <MarketingOptOutSection conversation={conversation} />
      <Button className="w-full" onClick={() => router.push(crearPedidoUrl(conversation))}>
        <Plus /> Registrar venta completa
      </Button>
    </div>
  );
}

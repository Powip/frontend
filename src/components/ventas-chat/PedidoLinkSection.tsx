"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, MessageSquarePlus, PackagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/components/quotations/quotationHelpers";
import type { Client } from "@/interfaces/ICliente";
import type { Conversation, ConversationQuote } from "@/types/crm";
import { crmError } from "@/services/crmService";
import {
  useAutoLinkConvertedOrder,
  useConversationQuotes,
  useCoreQuotation,
} from "@/hooks/useCrmQuotes";
import { useAiQuote, type QuoteHandoff } from "@/hooks/useAiQuote";
import ArmarPedidoDialog from "./ArmarPedidoDialog";
import { CRM_UNREACHABLE } from "./ConversationList";
import { formatTime } from "./format";
import {
  abrirCotizacionUrl,
  quoteMessage,
  quoteStatusLabel,
  QUOTE_PAYMENT_METHOD_LABEL,
  QUOTE_PAYMENT_STATUS_LABEL,
} from "./quotes";

interface Props {
  conversation: Conversation;
  client: Client | null | undefined;
  onInsertMessage?: (text: string) => void;
}

function QuoteRow({
  link,
  conversationId,
  onInsertMessage,
}: {
  link: ConversationQuote;
  conversationId: string;
  onInsertMessage?: (text: string) => void;
}) {
  const router = useRouter();
  const core = useCoreQuotation(link.quotationId);
  const quotation = core.data;
  useAutoLinkConvertedOrder(conversationId, quotation);
  const number = quotation?.number ?? link.quotationNumber ?? link.quotationId.slice(0, 8);
  const url = quotation?.publicUrl || link.publicUrl;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  return (
    <li className="space-y-1.5 rounded-md border p-2 text-sm" data-testid="quote-row">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{number}</span>
        {quotation && <Badge variant="secondary">{quoteStatusLabel(quotation)}</Badge>}
        {core.isLoading && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Cargando cotización"
          />
        )}
      </div>
      {quotation && (
        <>
          <p className="text-xs text-muted-foreground">
            Total {money(quotation.total)} ·{" "}
            {quotation.paymentType === "ADELANTO" ? "Adelanto" : "Pago completo"}
          </p>
          {quotation.payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Pagos">
              {quotation.payments.map((p) => (
                <li key={p.id}>
                  {money(p.amount)} · {QUOTE_PAYMENT_METHOD_LABEL[p.method] ?? p.method} ·{" "}
                  {QUOTE_PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                </li>
              ))}
            </ul>
          )}
          {quotation.status === "CONVERTIDA" && quotation.orderNumber && (
            <p className="text-xs text-muted-foreground">Pedido {quotation.orderNumber}</p>
          )}
        </>
      )}
      {core.isError && (
        <p className="text-xs text-muted-foreground">
          No se pudo cargar la cotización. Se muestra lo guardado en el chat.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Creado {formatTime(link.createdAt)}
        {link.createdByName ? ` por ${link.createdByName}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!url} onClick={copy}>
          <Copy /> Copiar enlace
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!url || !onInsertMessage}
          onClick={() => url && onInsertMessage?.(quoteMessage(url))}
        >
          <MessageSquarePlus /> Poner en el mensaje
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(abrirCotizacionUrl(link.quotationId))}
        >
          <ExternalLink /> Abrir cotización
        </Button>
      </div>
    </li>
  );
}

/** «Pedido / POWIP Link»: arma una cotización de Core desde el chat y lista las enviadas. */
export default function PedidoLinkSection({ conversation, client, onInsertMessage }: Props) {
  const [building, setBuilding] = useState<QuoteHandoff | null>(null);
  const ai = useAiQuote({ conversation, client, onInsertMessage, onHandoff: setBuilding });
  const quotes = useConversationQuotes(conversation.id);
  const err = quotes.isError ? crmError(quotes.error) : null;
  return (
    <section className="space-y-2" aria-label="Pedido / POWIP Link">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pedido / POWIP Link
      </h3>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
        disabled={ai.loading}
        onClick={() => void ai.run()}
      >
        {ai.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Armar pedido leyendo el chat
      </Button>
      <Button size="sm" className="w-full" onClick={() => setBuilding({ cart: [] })}>
        <PackagePlus /> Armar pedido
      </Button>
      {building && (
        <ArmarPedidoDialog
          conversation={conversation}
          client={client}
          autoAi={!building.cart}
          initialCart={building.cart}
          onClose={() => setBuilding(null)}
          onInsertMessage={onInsertMessage}
        />
      )}
      <h4 className="pt-1 text-xs font-medium text-muted-foreground">POWIP Links enviados</h4>
      {quotes.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando enlaces…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => quotes.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {quotes.data && quotes.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Aún no enviaste enlaces de pedido.</p>
      )}
      {quotes.data && quotes.data.length > 0 && (
        <ul className="space-y-2">
          {quotes.data.map((q) => (
            <QuoteRow
              key={q.id}
              link={q}
              conversationId={conversation.id}
              onInsertMessage={onInsertMessage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

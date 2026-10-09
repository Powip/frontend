import { Info } from "lucide-react";
import type { WhatsAppHistoryMetrics } from "@/features/whatsapp/models/history.model";
import {
  buildFunnel,
  computeRatio,
  describeRatio,
  formatCount,
} from "@/features/whatsapp/utils/history.util";
import { cn } from "@/lib/utils";

function KpiCard({
  title,
  value,
  detail,
  note,
  tone = "default",
}: {
  title: string;
  value: number | null;
  detail: string;
  note?: string;
  tone?: "default" | "danger" | "muted";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{title}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tabular-nums",
          value === null && "text-base font-medium text-muted-foreground",
          tone === "danger" && value !== null && value > 0 && "text-red-700 dark:text-red-300",
        )}
      >
        {formatCount(value)}
      </dd>
      <dd className="text-xs text-muted-foreground">{detail}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

export function HistoryKpis({ metrics }: { metrics: WhatsAppHistoryMetrics }) {
  const deliveredRatio = computeRatio(metrics.delivered, metrics.sent);
  const readRatio = computeRatio(metrics.read, metrics.delivered);
  const trackingRatio = computeRatio(metrics.trackingOpened, metrics.sent);
  const breakdown =
    metrics.notSent === null
      ? "Sin dato"
      : metrics.notSent === 0
        ? "Ninguno en el periodo"
        : metrics.notSentBreakdown && metrics.notSentBreakdown.length > 0
          ? metrics.notSentBreakdown
              .map((item) => `${formatCount(item.count)} ${item.label}`)
              .join(" · ")
          : "Desglose de motivos sin dato";

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        title="Enviados"
        value={metrics.sent}
        detail="Salieron de tu número por la API de WhatsApp"
      />
      <KpiCard
        title="Entregados"
        value={metrics.delivered}
        detail={describeRatio(deliveredRatio, "los enviados", "Sin envíos en el periodo")}
      />
      <KpiCard
        title="Leídos"
        value={metrics.read}
        detail={describeRatio(readRatio, "los entregados", "Sin entregas en el periodo")}
      />
      <KpiCard
        title="Abrieron el rastreo"
        value={metrics.trackingOpened}
        detail={describeRatio(trackingRatio, "los enviados", "Sin envíos en el periodo")}
        note="Abrir el link no prueba que leyó el mensaje en WhatsApp."
      />
      <KpiCard title="No enviados" value={metrics.notSent} detail={breakdown} tone="danger" />
      <KpiCard
        title="Asistidos"
        value={metrics.assisted}
        detail="Enviados a mano por el número de contingencia"
        note="No cuentan como enviados, entregados ni leídos."
        tone="muted"
      />
    </dl>
  );
}

export function HistoryFunnel({ metrics }: { metrics: WhatsAppHistoryMetrics }) {
  const steps = buildFunnel(metrics);
  return (
    <section aria-labelledby="history-funnel-title" className="space-y-3 rounded-xl border p-4">
      <div>
        <h3 id="history-funnel-title" className="font-semibold">
          Del envío a la lectura
        </h3>
        <p className="text-sm text-muted-foreground">
          Cada barra es el porcentaje sobre el total enviado.
        </p>
      </div>
      <ol className="space-y-2">
        {steps.map((step) => {
          const width = step.ratio.kind === "value" ? Math.min(step.ratio.percent, 100) : 0;
          const ratioText =
            step.ratio.kind === "value"
              ? step.ratio.label
              : step.ratio.kind === "no-base"
                ? "sin envíos"
                : "sin dato";
          return (
            <li
              key={step.key}
              className="grid grid-cols-[minmax(7rem,auto)_1fr] items-center gap-3"
            >
              <span className="text-sm">{step.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatCount(step.count)} · {ratioText}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        «Leído» depende de que el comprador tenga activadas las confirmaciones de lectura; si las
        apagó, el mensaje se queda en «Entregado» aunque lo haya visto.
      </p>
    </section>
  );
}

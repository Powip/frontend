import { Info, Link2, TriangleAlert, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { DoubleTick, SingleTick } from "@/components/whatsapp/MessageStatusTicks";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import type { WhatsAppHistoryMetrics } from "@/features/whatsapp/models/history.model";
import {
  buildFunnel,
  computeRatio,
  describeRatio,
  type FunnelStep,
  formatCount,
} from "@/features/whatsapp/utils/history.util";
import { cn } from "@/lib/utils";

export const KPI_ICONS = {
  sent: <SingleTick className="text-wa-tick" />,
  delivered: <DoubleTick className="text-wa-tick" />,
  read: <DoubleTick className="text-wa-tick-read" />,
  tracking: <Link2 className="size-4 text-wa-teal" aria-hidden="true" />,
  notSent: <TriangleAlert className="size-4 text-wa-red" aria-hidden="true" />,
  assisted: <UserRound className="size-4 text-wa-muted" aria-hidden="true" />,
} as const;

export const KPI_GRID = "m-0 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6";

export const KPI_CARD =
  "flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-wa-border bg-wa-surface px-[18px] py-4 shadow-wa";

function RatioText({ text, tone }: { text: string; tone: string }) {
  const match = /^([\d.,]+%)(.*)$/.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      <b className={cn("font-semibold", tone)}>{match[1]}</b>
      {match[2]}
    </>
  );
}

function KpiCard({
  title,
  icon,
  value,
  detail,
  note,
  tone = "default",
}: {
  title: string;
  icon: ReactNode;
  value: number | null;
  detail: ReactNode;
  note?: string;
  tone?: "default" | "danger" | "muted";
}) {
  return (
    <div className={KPI_CARD}>
      <dt className="flex items-center justify-between gap-2 text-[13px] text-wa-muted">
        {title}
        {icon}
      </dt>
      <dd
        className={cn(
          "wa-num m-0 text-[26px] font-bold leading-[1.1]",
          value === null && "text-base font-medium text-wa-muted",
          tone === "danger" && value !== null && value > 0 && "text-wa-red",
        )}
      >
        {formatCount(value)}
      </dd>
      <dd className="m-0 text-xs text-wa-muted">{detail}</dd>
      {note && <dd className="m-0 text-[11px] text-wa-muted">{note}</dd>}
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
    <dl className={KPI_GRID}>
      <KpiCard
        title="Enviados"
        icon={KPI_ICONS.sent}
        value={metrics.sent}
        detail="Salieron de tu número por la API de WhatsApp"
      />
      <KpiCard
        title="Entregados"
        icon={KPI_ICONS.delivered}
        value={metrics.delivered}
        detail={
          <RatioText
            text={describeRatio(deliveredRatio, "los enviados", "Sin envíos en el periodo")}
            tone="text-wa-green"
          />
        }
      />
      <KpiCard
        title="Leídos"
        icon={KPI_ICONS.read}
        value={metrics.read}
        detail={
          <RatioText
            text={describeRatio(readRatio, "los entregados", "Sin entregas en el periodo")}
            tone="text-wa-green"
          />
        }
      />
      <KpiCard
        title="Abrieron el rastreo"
        icon={KPI_ICONS.tracking}
        value={metrics.trackingOpened}
        detail={
          <RatioText
            text={describeRatio(trackingRatio, "los enviados", "Sin envíos en el periodo")}
            tone="text-wa-teal"
          />
        }
        note="Abrir el link no prueba que leyó el mensaje en WhatsApp."
      />
      <KpiCard
        title="No enviados"
        icon={KPI_ICONS.notSent}
        value={metrics.notSent}
        detail={breakdown}
        tone="danger"
      />
      <KpiCard
        title="Asistidos"
        icon={KPI_ICONS.assisted}
        value={metrics.assisted}
        detail="Enviados a mano por el número de contingencia"
        note="No cuentan como enviados, entregados ni leídos."
        tone="muted"
      />
    </dl>
  );
}

const FUNNEL_COLORS: Record<FunnelStep["key"], string> = {
  sent: "bg-[color-mix(in_srgb,var(--wa-tick)_55%,transparent)]",
  delivered: "bg-[color-mix(in_srgb,var(--wa-tick)_80%,transparent)]",
  read: "bg-wa-tick-read",
  trackingOpened: "bg-wa-teal",
};

export const FUNNEL_LINE =
  "grid grid-cols-[80px_minmax(0,1fr)_84px] items-center gap-3 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)_110px]";

export const FUNNEL_BAR =
  "h-[26px] overflow-hidden rounded-lg border border-wa-border bg-wa-surface-2";

export function HistoryFunnelCard({ children }: { children: ReactNode }) {
  return (
    <WaCard aria-labelledby="history-funnel-title">
      <WaCardHeader
        level={3}
        titleId="history-funnel-title"
        title="Del envío a la lectura"
        description="Cuántos clientes avanzan en cada estado. Cada barra es el porcentaje sobre el total enviado."
      />
      {children}
    </WaCard>
  );
}

export function HistoryFunnel({ metrics }: { metrics: WhatsAppHistoryMetrics }) {
  const steps = buildFunnel(metrics);
  return (
    <HistoryFunnelCard>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {steps.map((step) => {
          const width = step.ratio.kind === "value" ? Math.min(step.ratio.percent, 100) : 0;
          const ratioText =
            step.ratio.kind === "value"
              ? step.ratio.label
              : step.ratio.kind === "no-base"
                ? "sin envíos"
                : "sin dato";
          return (
            <li key={step.key} className={FUNNEL_LINE}>
              <span>{step.label}</span>
              <span className={FUNNEL_BAR} aria-hidden="true">
                <span
                  className={cn("block h-full rounded-[7px]", FUNNEL_COLORS[step.key])}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="wa-num text-wa-muted">
                {formatCount(step.count)} · {ratioText}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="m-0 mt-3.5 flex items-start gap-1.5 text-xs text-wa-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        «Leído» depende de que el comprador tenga activadas las confirmaciones de lectura; si las
        apagó, el mensaje se queda en «Entregado» aunque lo haya visto.
      </p>
    </HistoryFunnelCard>
  );
}

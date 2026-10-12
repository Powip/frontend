import {
  Camera,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  MapPin,
  PackageX,
  RefreshCw,
  Store,
  TriangleAlert,
  Truck,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  WHATSAPP_EVIDENCE_TYPES,
  type WhatsAppEvidenceType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  PublicOrderTracking,
  PublicTrackingState,
} from "@/features/whatsapp/models/public-tracking.model";
import {
  formatDateKey,
  formatLimaDateTime,
  formatLimaShortDate,
} from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";

const EVIDENCE_LABELS: Record<WhatsAppEvidenceType, { title: string; detail: string | null }> = {
  [WHATSAPP_EVIDENCE_TYPES.DELIVERY]: { title: "Foto de entrega", detail: null },
  [WHATSAPP_EVIDENCE_TYPES.DISPATCH]: {
    title: "Foto del despacho",
    detail: "Se tomó al enviar el pedido; no confirma la entrega.",
  },
  [WHATSAPP_EVIDENCE_TYPES.PREPARATION]: {
    title: "Foto de la preparación",
    detail: "Se tomó al preparar el pedido; no confirma la entrega.",
  },
};

const STATUS_TONES = {
  progress:
    "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
  delivered:
    "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  incident:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  cancelled:
    "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-100",
} as const;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-md space-y-4">{children}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function MessageScreen({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-6 text-center dark:bg-slate-900">
        {icon}
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
        {action}
      </div>
    </Shell>
  );
}

function StoreHeader({ data }: { data: PublicOrderTracking }) {
  return (
    <header className="flex items-center gap-3">
      {data.store.logoUrl ? (
        <Image
          src={data.store.logoUrl}
          alt={`Logo de ${data.store.name}`}
          width={44}
          height={44}
          unoptimized
          className="h-11 w-11 rounded-full object-cover"
        />
      ) : (
        <span
          className="grid h-11 w-11 place-items-center rounded-full bg-slate-200 dark:bg-slate-800"
          aria-hidden="true"
        >
          <Store className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold">{data.store.name}</p>
        <h1 className="text-sm text-slate-600 dark:text-slate-300">
          Pedido {data.order.number}
          {data.order.customerFirstName ? ` de ${data.order.customerFirstName}` : ""}
        </h1>
      </div>
    </header>
  );
}

function StatusCard({ data }: { data: PublicOrderTracking }) {
  return (
    <section
      className={cn("space-y-1 rounded-2xl border p-4", STATUS_TONES[data.status.tone])}
      aria-live="polite"
    >
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">Estado de tu pedido</p>
      <p className="text-xl font-semibold">{data.status.label}</p>
      {data.status.description && <p className="text-sm">{data.status.description}</p>}
      {data.status.tone === "incident" && (
        <p className="flex items-start gap-2 text-sm font-medium">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {data.status.incidentReason ?? "El courier informó una incidencia."}
        </p>
      )}
      {data.updatedAt && (
        <p className="text-xs opacity-80">
          Actualizado {formatLimaDateTime(data.updatedAt)} (hora de Lima)
        </p>
      )}
    </section>
  );
}

function Timeline({ data }: { data: PublicOrderTracking }) {
  if (!data.timeline || data.timeline.length === 0) return null;
  return (
    <Card title="Seguimiento" icon={<Truck className="h-4 w-4" aria-hidden="true" />}>
      <ol className="space-y-2">
        {data.timeline.map((step) => (
          <li key={step.label} className="flex items-start gap-2 text-sm">
            {step.done ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            )}
            <span className={cn(!step.done && "text-slate-500 dark:text-slate-400")}>
              {step.label}
              {step.at && (
                <span className="block text-xs text-slate-500">{formatLimaDateTime(step.at)}</span>
              )}
              {!step.done && <span className="sr-only"> (pendiente)</span>}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ShippingCard({ data }: { data: PublicOrderTracking }) {
  const shipping = data.shipping;
  if (!shipping) return null;
  const rows: [string, string | null][] = [
    ["Courier", shipping.courierName],
    ["Código de guía", shipping.trackingCode],
    [
      "Entrega",
      shipping.deliveryMode === "agency"
        ? "Recojo en agencia"
        : shipping.deliveryMode === "home"
          ? `A domicilio${shipping.district ? ` · ${shipping.district}` : ""}`
          : null,
    ],
    ["Fecha estimada", shipping.estimatedDate ? formatDateKey(shipping.estimatedDate) : null],
  ];
  const visible = rows.filter(([, value]) => value);
  if (visible.length === 0 && !shipping.agency) return null;
  return (
    <Card title="Envío" icon={<MapPin className="h-4 w-4" aria-hidden="true" />}>
      <dl className="space-y-1 text-sm">
        {visible.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-right font-medium [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      {shipping.deliveryMode === "agency" && shipping.agency && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p className="font-medium">{shipping.agency.name}</p>
          {shipping.agency.address && <p>{shipping.agency.address}</p>}
          {shipping.agency.hours && (
            <p className="text-slate-500 dark:text-slate-400">{shipping.agency.hours}</p>
          )}
        </div>
      )}
    </Card>
  );
}

function EvidenceCard({ data }: { data: PublicOrderTracking }) {
  if (data.evidence.length === 0) return null;
  return (
    <Card title="Fotos del pedido" icon={<Camera className="h-4 w-4" aria-hidden="true" />}>
      <ul className="space-y-3">
        {data.evidence.map((item) => {
          const label = EVIDENCE_LABELS[item.type];
          const when = item.takenAt ? formatLimaShortDate(item.takenAt) : null;
          return (
            <li key={`${item.type}-${item.imageUrl}`} className="space-y-1">
              <Image
                src={item.imageUrl}
                alt={`${label.title}${when ? ` del ${when}` : ""}`}
                width={400}
                height={300}
                unoptimized
                className="h-auto w-full rounded-lg object-cover"
              />
              <p className="text-sm font-medium">
                {label.title}
                {when ? ` · ${when}` : ""}
              </p>
              {label.detail && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{label.detail}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function InvoiceCard({ data }: { data: PublicOrderTracking }) {
  if (!data.invoice) return null;
  return (
    <Card title="Comprobante" icon={<FileText className="h-4 w-4" aria-hidden="true" />}>
      <p className="text-sm">
        {data.invoice.label}
        {data.invoice.seriesNumber ? ` ${data.invoice.seriesNumber}` : ""} aceptada por SUNAT.
      </p>
      <Button asChild variant="outline" size="sm">
        <a href={data.invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
          Descargar {data.invoice.label.toLowerCase()} (PDF)
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </Button>
    </Card>
  );
}

interface PublicTrackingPageProps {
  state: PublicTrackingState;
  onRetry?: () => void;
}

export function PublicTrackingPage({ state, onRetry }: PublicTrackingPageProps) {
  switch (state.kind) {
    case "pending-integration":
      return (
        <MessageScreen
          icon={<Truck className="h-8 w-8 text-slate-400" aria-hidden="true" />}
          title="Seguimiento no disponible todavía"
          text="Esta página de seguimiento aún no está habilitada. Si recibiste este enlace, revisa el mensaje de la tienda para más información."
        />
      );
    case "loading":
      return (
        <MessageScreen
          icon={<Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden="true" />}
          title="Cargando tu pedido"
          text="Un momento, por favor."
        />
      );
    case "not-found":
      return (
        <MessageScreen
          icon={<PackageX className="h-8 w-8 text-slate-400" aria-hidden="true" />}
          title="No encontramos este pedido"
          text="El enlace no es válido o ya venció. Pide a la tienda un enlace nuevo."
        />
      );
    case "error":
      return (
        <MessageScreen
          icon={<TriangleAlert className="h-8 w-8 text-amber-600" aria-hidden="true" />}
          title="No pudimos cargar tu pedido"
          text={state.message}
          action={
            onRetry ? (
              <Button type="button" variant="outline" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </Button>
            ) : undefined
          }
        />
      );
    case "ready":
      return (
        <Shell>
          <StoreHeader data={state.data} />
          <StatusCard data={state.data} />
          <Timeline data={state.data} />
          <ShippingCard data={state.data} />
          <EvidenceCard data={state.data} />
          <InvoiceCard data={state.data} />
          {state.data.order.items && state.data.order.items.length > 0 && (
            <Card title="Productos" icon={<Store className="h-4 w-4" aria-hidden="true" />}>
              <ul className="space-y-1 text-sm">
                {state.data.order.items.map((item) => (
                  <li key={item.name} className="flex justify-between gap-3">
                    <span className="[overflow-wrap:anywhere]">{item.name}</span>
                    <span className="shrink-0 text-slate-500">x{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </Shell>
      );
  }
}

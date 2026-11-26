import {
  Clock,
  FileText,
  Link2,
  type LucideIcon,
  MessageSquare,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WHATSAPP_TAB_DEFINITIONS,
  type WhatsAppTabDefinition,
} from "@/features/whatsapp/constants/whatsapp-tabs";
import { WHATSAPP_TABS, type WhatsAppTab } from "@/features/whatsapp/enums/whatsapp.enums";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<WhatsAppTab, LucideIcon> = {
  [WHATSAPP_TABS.CONNECTION]: Link2,
  [WHATSAPP_TABS.TEMPLATES]: FileText,
  [WHATSAPP_TABS.SCHEDULING]: Clock,
  [WHATSAPP_TABS.CONVERSATIONS]: MessageSquare,
  [WHATSAPP_TABS.HISTORY]: Send,
  [WHATSAPP_TABS.SETTINGS]: SlidersHorizontal,
};

export function WhatsAppPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="wa-ui flex min-w-0 flex-1 flex-col gap-[22px] px-4 pt-[18px] pb-[60px] min-[900px]:px-8 min-[900px]:pt-7">
      {children}
    </div>
  );
}

export function WhatsAppPageHeader({ status }: { status: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-wa-muted">
          <Link href="/configuracion" className="rounded hover:text-wa-fg hover:underline">
            Configuración
          </Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">WhatsApp</span>
        </nav>
        <h1 className="my-1 text-balance text-[22px] font-bold leading-[1.2] text-wa-fg sm:text-[26px]">
          Notificaciones por WhatsApp
        </h1>
        <p className="m-0 max-w-[62ch] text-wa-muted">
          Conecta tu número de WhatsApp Business y avisa a tus clientes en cada etapa del envío con
          su link de rastreo POWIP.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">{status}</div>
    </header>
  );
}

export function WhatsAppPendingStatusPill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-wa-border bg-wa-surface-2 px-3 py-[7px] text-[13px] font-semibold text-wa-muted">
      <Clock className="size-4" aria-hidden="true" />
      Integración pendiente
    </span>
  );
}

export function WhatsAppTabCount({
  value,
  tone = "primary",
  label,
}: {
  value: number;
  tone?: "primary" | "red";
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-[7px] py-px text-[11px] font-semibold",
        tone === "red" ? "bg-wa-red-soft text-wa-red" : "bg-wa-primary-soft text-wa-primary",
      )}
    >
      {value}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

interface WhatsAppTabsShellProps {
  value: WhatsAppTab;
  onValueChange: (value: string) => void;
  counts?: Partial<Record<WhatsAppTab, ReactNode>>;
  renderPanel: (definition: WhatsAppTabDefinition) => ReactNode;
}

export function WhatsAppTabsShell({
  value,
  onValueChange,
  counts,
  renderPanel,
}: WhatsAppTabsShellProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full min-w-0 gap-0">
      <TabsList className="h-auto w-fit max-w-full justify-start gap-1 overflow-x-auto rounded-xl border border-wa-border bg-wa-surface-2 p-1 text-wa-muted">
        {WHATSAPP_TAB_DEFINITIONS.map((tab) => {
          const Icon = TAB_ICONS[tab.key];
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="h-auto flex-none gap-2 rounded-[9px] border-0 px-3.5 py-2 text-sm font-medium text-wa-muted shadow-none hover:text-wa-fg focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-2px] focus-visible:outline-wa-primary data-[state=active]:bg-wa-surface data-[state=active]:text-wa-fg data-[state=active]:shadow-wa dark:text-wa-muted dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-wa-surface dark:data-[state=active]:text-wa-fg [&_svg:not([class*='size-'])]:size-[18px]"
            >
              <Icon aria-hidden="true" />
              {tab.label}
              {counts?.[tab.key]}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {WHATSAPP_TAB_DEFINITIONS.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="mt-[22px] min-w-0">
          {renderPanel(tab)}
        </TabsContent>
      ))}
    </Tabs>
  );
}

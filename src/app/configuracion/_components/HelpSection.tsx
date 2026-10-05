import { buttonVariants } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarDays,
  CircleHelp,
  Clock,
  FileText,
  MessageCircle,
  Play,
  Users,
  Video,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

export const HELP_CENTER_URL = "https://www.powip.lat/centro-de-ayuda";

/** Destinos de soporte definidos en landing-powip (centro-ayuda/data/help-content.json). */
export const SUPPORT_MEETING_URL = "https://calendar.app.google/hr6MCGP8di62n7kk7";
export const SUPPORT_WHATSAPP_URL =
  "https://wa.me/51923101193?text=Hola,%20tengo%20una%20duda%20sobre%20POWIP";

type Tone = "violet" | "sky" | "green";

const tones: Record<
  Tone,
  { card: string; badge: string; icon: string; button: string }
> = {
  violet: {
    card: "border-violet-100 bg-gradient-to-br from-violet-50 via-violet-50 to-indigo-100/70 dark:border-slate-700 dark:from-violet-950/50 dark:via-slate-900 dark:to-indigo-950/40",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
    icon: "text-violet-600 dark:text-violet-300",
    button: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700",
  },
  sky: {
    card: "border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50/60 dark:border-slate-700 dark:from-sky-950/40 dark:to-slate-900",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
    icon: "text-indigo-600 dark:text-indigo-300",
    button: "bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700",
  },
  green: {
    card: "border-emerald-100 bg-gradient-to-br from-emerald-50 to-green-50/60 dark:border-slate-700 dark:from-emerald-950/40 dark:to-slate-900",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    icon: "text-emerald-600 dark:text-emerald-400",
    button: "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700",
  },
};

const actionClass =
  "mt-6 h-12 w-full rounded-full px-6 text-base text-white shadow-md";

/** Enlace externo en pestaña nueva con el estilo de botón del bloque. */
function HelpAction({
  href,
  tone,
  icon,
  label,
}: {
  href: string;
  tone: Tone;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ size: "lg" }), actionClass, tones[tone].button)}
    >
      {icon}
      {label}
      <ArrowRight aria-hidden="true" />
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </a>
  );
}

function HelpCard({
  tone,
  badge,
  titleId,
  title,
  icon,
  className,
  children,
}: {
  tone: Tone;
  badge: string;
  titleId: string;
  title: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border p-6",
        tones[tone].card,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
            tones[tone].badge
          )}
        >
          {badge}
        </span>
        {icon && (
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm dark:bg-slate-800"
          >
            {icon}
          </div>
        )}
      </div>
      <h2
        id={titleId}
        className={cn(
          "font-bold text-slate-900 dark:text-slate-100",
          icon ? "-mt-2 pr-14 text-xl" : "mt-3 text-3xl sm:text-4xl"
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChecklistBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-white bg-white/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
      {children}
    </div>
  );
}

/** Ilustración decorativa: reproductor de video, lista de tutoriales y mascota oficial. */
function TutorialArt() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] sm:block"
    >
      <div className="absolute right-6 top-8 w-[82%] rotate-2 rounded-xl border border-white/80 bg-white/90 p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
        <div className="flex gap-2">
          <div className="flex aspect-video flex-1 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
          <div className="flex w-2/5 flex-col justify-between gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-violet-100 dark:bg-violet-500/20">
                  <Play className="h-2 w-2 fill-violet-600 text-violet-600 dark:fill-violet-300 dark:text-violet-300" />
                </div>
                <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-600" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center">
          <div className="h-1 w-1/3 rounded-full bg-violet-600 dark:bg-violet-400" />
          <div className="-ml-0.5 h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400" />
          <div className="h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-600" />
        </div>
      </div>
      <Image
        src="/mascota-indicando.svg"
        alt=""
        width={400}
        height={400}
        className="absolute -bottom-[14%] -right-[38%] h-auto w-[150%] max-w-none select-none drop-shadow-xl"
      />
    </div>
  );
}

export function HelpHeaderLink() {
  return (
    <a
      href={HELP_CENTER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
    >
      <CircleHelp aria-hidden="true" />
      ¿Necesitas ayuda?
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </a>
  );
}

export function HelpSection() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {/* 1. Centro de ayuda: mitad del ancho en desktop */}
      <HelpCard
        tone="violet"
        badge="APRENDE A TU RITMO"
        titleId="help-center-title"
        title="Centro de ayuda"
        className="md:col-span-2"
      >
        <TutorialArt />
        <div className="relative flex flex-1 flex-col sm:max-w-[60%]">
          <p className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
            Todo Powip en videos, paso a paso
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Encuentra guías, tutoriales y recursos para gestionar pedidos,
            productos, pagos, envíos, clientes e integraciones.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {[
              { label: "Videos paso a paso", icon: Play },
              { label: "Guías rápidas", icon: FileText },
              { label: "Disponible 24/7", icon: Clock },
            ].map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-200"
              >
                <Icon className={cn("h-4 w-4", tones.violet.icon)} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <div className="mt-auto sm:max-w-xs">
            <HelpAction
              href={HELP_CENTER_URL}
              tone="violet"
              label="Ir al Centro de ayuda"
            />
          </div>
        </div>
      </HelpCard>

      {/* 2. Reunión virtual */}
      <HelpCard
        tone="sky"
        badge="AGENDA UNA REUNIÓN"
        titleId="help-meeting-title"
        title="Reunión virtual con nuestro equipo"
        icon={<CalendarDays className={cn("h-6 w-6", tones.sky.icon)} />}
      >
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          ¿Tienes dudas específicas o necesitas asesoría personalizada? Agenda
          una videollamada con nuestro equipo de soporte.
        </p>
        <ChecklistBox>
          <ul className="space-y-3">
            {[
              { label: "Reunión por Google Meet", icon: Video },
              { label: "Elige el día y la hora que más te convenga", icon: Clock },
              { label: "Te ayudamos con tu configuración", icon: Users },
            ].map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-start gap-3">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tones.sky.icon)} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </ChecklistBox>
        <div className="mt-auto">
          <HelpAction
            href={SUPPORT_MEETING_URL}
            tone="sky"
            icon={<CalendarDays aria-hidden="true" />}
            label="Agendar reunión"
          />
        </div>
      </HelpCard>

      {/* 3. WhatsApp */}
      <HelpCard
        tone="green"
        badge="SOPORTE RÁPIDO"
        titleId="help-whatsapp-title"
        title="Habla con nuestro equipo por WhatsApp"
        icon={<WhatsAppIcon className={cn("h-7 w-7", tones.green.icon)} />}
      >
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Si necesitas ayuda, puedes escribir directamente a nuestro equipo de
          soporte por WhatsApp.
        </p>
        <ChecklistBox>
          <div className="flex items-start gap-3">
            <MessageCircle className={cn("mt-0.5 h-5 w-5 shrink-0", tones.green.icon)} aria-hidden="true" />
            <p>
              Cuéntanos tu consulta e indica el nombre de tu negocio para que
              podamos ayudarte.
            </p>
          </div>
        </ChecklistBox>
        <div className="mt-auto">
          <HelpAction
            href={SUPPORT_WHATSAPP_URL}
            tone="green"
            icon={<WhatsAppIcon className="h-5 w-5" />}
            label="Abrir WhatsApp"
          />
        </div>
      </HelpCard>
    </div>
  );
}

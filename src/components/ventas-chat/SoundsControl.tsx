"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useInboxSummary } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCrmSettings } from "@/hooks/useCrmTeam";
import { useResetSoundPrefs, useSaveSoundPrefs, useSoundPrefs } from "@/hooks/useCrmSocial";
import {
  EVENT_LABEL,
  LOCKED_EVENT,
  SOUND_EVENTS,
  SOUND_EVENT_NAME,
  SOUND_TONES,
  TONE_LABEL,
  insideShift,
  playTone,
  shouldPlay,
  soundUnlocked,
  tabTitle,
  unlockSound,
  type SoundEvent,
  type SoundEventDetail,
  type SoundPrefs,
  type SoundTone,
} from "@/lib/crmSound";
import { NATIVE_SELECT_CLASS } from "./format";

/** Escucha los avisos del CRM y suena según las preferencias de la persona. */
export function useCrmSounds(openConversationId: string | null) {
  const prefsQuery = useSoundPrefs();
  const { isAdmin } = useCrmMe();
  const settings = useCrmSettings(isAdmin);
  const summary = useInboxSummary();
  const [unlocked, setUnlocked] = useState(soundUnlocked());
  const prefs = prefsQuery.data?.effective ?? null;
  const ref = useRef({ prefs, openConversationId, hours: settings.data?.hours });
  ref.current = { prefs, openConversationId, hours: settings.data?.hours };

  const unlock = useCallback(async () => setUnlocked(await unlockSound()), []);

  // Navegadores bloquean el audio hasta un gesto: el primer clic lo habilita.
  useEffect(() => {
    if (unlocked) return;
    const handler = () => void unlock();
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [unlocked, unlock]);

  useEffect(() => {
    const onSound = (e: Event) => {
      const { prefs: p, openConversationId: open, hours } = ref.current;
      if (!p) return;
      const detail = (e as CustomEvent<SoundEventDetail>).detail;
      const ok = shouldPlay({
        prefs: p,
        event: detail.event,
        conversationId: detail.conversationId,
        openConversationId: open,
        tabVisible: document.visibilityState === "visible",
        inShift: insideShift(new Date(), hours ? { start: hours.start, end: hours.end } : null),
      });
      if (!ok) return;
      playTone(p.events[detail.event].tone, p.vol);
      if (p.vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(detail.event === "msg" ? 80 : [120, 60, 120]);
      }
    };
    window.addEventListener(SOUND_EVENT_NAME, onSound);
    return () => window.removeEventListener(SOUND_EVENT_NAME, onSound);
  }, []);

  // Título de la pestaña: «(3) POWIP».
  const pending = summary.data?.unanswered ?? 0;
  useEffect(() => {
    const base = document.title;
    const wanted = prefs?.tab === false ? 0 : pending;
    document.title = tabTitle(base, wanted);
    return () => {
      document.title = tabTitle(base, 0);
    };
  }, [pending, prefs?.tab]);

  return { prefs, unlocked, unlock, loading: prefsQuery.isLoading };
}

function PrefsEditor({
  value,
  onChange,
  lockedForUser,
}: {
  value: SoundPrefs;
  onChange: (next: SoundPrefs) => void;
  lockedForUser: boolean;
}) {
  const setEvent = (key: SoundEvent, patch: Partial<SoundPrefs["events"][SoundEvent]>) =>
    onChange({ ...value, events: { ...value.events, [key]: { ...value.events[key], ...patch } } });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="snd-on">Sonidos activados</Label>
        <Switch id="snd-on" checked={value.on} onCheckedChange={(on) => onChange({ ...value, on })} />
      </div>
      <div className="flex items-center gap-3">
        <Label htmlFor="snd-vol" className="shrink-0">
          Volumen
        </Label>
        <input
          id="snd-vol"
          type="range"
          min={0}
          max={100}
          value={value.vol}
          onChange={(e) => onChange({ ...value, vol: Number(e.target.value) })}
          className="w-full"
        />
        <span className="w-9 text-right text-xs tabular-nums">{value.vol}</span>
      </div>
      <ul className="divide-y rounded-md border">
        {SOUND_EVENTS.map((key) => {
          const locked = lockedForUser && key === LOCKED_EVENT;
          return (
            <li key={key} className="flex items-center gap-2 p-2 text-sm">
              <Switch
                aria-label={`Activar ${EVENT_LABEL[key]}`}
                checked={value.events[key].on}
                disabled={locked}
                onCheckedChange={(on) => setEvent(key, { on })}
              />
              <span className="min-w-0 flex-1 break-words sm:truncate">
                {EVENT_LABEL[key]}
                {locked && <span className="ml-1 text-xs text-muted-foreground">· fijo por el administrador</span>}
              </span>
              <select
                aria-label={`Tono de ${EVENT_LABEL[key]}`}
                value={value.events[key].tone}
                disabled={locked}
                onChange={(e) => setEvent(key, { tone: e.target.value as SoundTone })}
                className={cn(NATIVE_SELECT_CLASS, "w-auto")}
              >
                {SOUND_TONES.map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABEL[t]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Probar ${EVENT_LABEL[key]}`}
                onClick={async () => {
                  await unlockSound();
                  playTone(value.events[key].tone, value.vol);
                }}
              >
                <Volume2 />
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="snd-turno">Silenciar fuera del turno</Label>
        <Switch id="snd-turno" checked={value.turno} onCheckedChange={(turno) => onChange({ ...value, turno })} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="snd-tab">Número de pendientes en la pestaña</Label>
        <Switch id="snd-tab" checked={value.tab} onCheckedChange={(tab) => onChange({ ...value, tab })} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="snd-vib">Vibrar en el celular</Label>
        <Switch id="snd-vib" checked={value.vibrate} onCheckedChange={(vibrate) => onChange({ ...value, vibrate })} />
      </div>
    </div>
  );
}

export function SoundsDialog({ onClose }: { onClose: () => void }) {
  const { isAdmin } = useCrmMe();
  const query = useSoundPrefs();
  const saveMine = useSaveSoundPrefs("me");
  const saveTeam = useSaveSoundPrefs("team");
  const reset = useResetSoundPrefs();
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [mine, setMine] = useState<SoundPrefs | null>(null);
  const [team, setTeam] = useState<SoundPrefs | null>(null);
  const data = query.data;
  const mineValue = mine ?? data?.effective ?? null;
  const teamValue = team ?? data?.team ?? null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sonidos y avisos</DialogTitle>
          <DialogDescription>
            Cada persona elige sus sonidos. El administrador fija los valores del equipo.
          </DialogDescription>
        </DialogHeader>
        {isAdmin && (
          <div role="tablist" className="flex gap-1">
            <Button size="sm" role="tab" aria-selected={tab === "mine"} variant={tab === "mine" ? "default" : "outline"} onClick={() => setTab("mine")}>
              Mis sonidos
            </Button>
            <Button size="sm" role="tab" aria-selected={tab === "team"} variant={tab === "team" ? "default" : "outline"} onClick={() => setTab("team")}>
              Equipo · administrador
            </Button>
          </div>
        )}
        {query.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {query.isError && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los sonidos.</p>}
        {tab === "mine" && mineValue && (
          <PrefsEditor value={mineValue} onChange={setMine} lockedForUser={!isAdmin} />
        )}
        {tab === "team" && isAdmin && teamValue && (
          <PrefsEditor value={teamValue} onChange={setTeam} lockedForUser={false} />
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {tab === "mine" ? (
            <Button
              variant="outline"
              disabled={reset.isPending || !data?.mine}
              onClick={() => reset.mutate(undefined, { onSuccess: () => setMine(null) })}
            >
              Restablecer valores del administrador
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              disabled={saveMine.isPending || saveTeam.isPending || (tab === "mine" ? !mine : !team)}
              onClick={() =>
                tab === "mine"
                  ? mine && saveMine.mutate(mine, { onSuccess: () => setMine(null) })
                  : team && saveTeam.mutate(team, { onSuccess: () => setTeam(null) })
              }
            >
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botón «Sonidos» + aviso «Activar sonidos» mientras el navegador no deja reproducir. */
export default function SoundsControl({
  openConversationId,
  showButton = true,
}: {
  openConversationId: string | null;
  /** La campanita de la cabecera (layout) ya abre «Sonidos y avisos»: aquí solo el aviso. */
  showButton?: boolean;
}) {
  const { prefs, unlocked, unlock } = useCrmSounds(openConversationId);
  const [open, setOpen] = useState(false);
  return (
    <>
      {!unlocked && prefs?.on && (
        <Button size="sm" variant="outline" data-testid="activar-sonidos" onClick={() => void unlock()}>
          <BellOff /> Activar sonidos
        </Button>
      )}
      {showButton && (
        <Button size="sm" variant="outline" aria-label="Sonidos y avisos" onClick={() => setOpen(true)}>
          <Bell /> Sonidos
        </Button>
      )}
      {open && <SoundsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-alert-dialog";
import axios from "axios";
import { observeUnauthorized } from "@/lib/axiosAuth";
import { replacePage } from "@/lib/browserNavigation";
import { decodeToken, isExpired } from "@/lib/jwt";
import {
  isAnonymousRoute,
  isSessionExpired,
  listenOtherTabs,
  loginUrl,
  subscribeSessionExpiry,
  wasManualLogout,
} from "@/lib/sessionExpiry";
import { renewCurrentSession } from "@/lib/sessionRefresh";
import { tokenStore } from "@/lib/tokenStore";

export const COUNTDOWN_SECONDS = 5;

/** Renueva si el access token ya venció; si el refresh tampoco vale, sale el aviso. */
function verifySession() {
  const session = tokenStore.snapshot();
  if (!session.active || !session.token) return;
  const decoded = decodeToken(session.token);
  if (decoded?.exp && isExpired(decoded.exp)) void renewCurrentSession(session);
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (seconds === 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, onDone]);

  // Al llegar a 0 se queda en 1 mientras carga el login.
  const shown = Math.max(seconds, 1);

  return (
    <>
      <div className="relative size-16 shrink-0" aria-hidden="true">
        <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" className="stroke-white/25" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            className="session-countdown-ring stroke-[var(--brand-surface)]"
            style={{ animationDuration: `${COUNTDOWN_SECONDS}s` }}
          />
        </svg>
        <span className="font-heading absolute inset-0 flex items-center justify-center text-2xl font-bold">
          {shown}
        </span>
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <Dialog.Title className="font-heading text-lg font-bold">Tu sesión expiró</Dialog.Title>
        <Dialog.Description className="text-sm text-white/90">
          Por seguridad, vuelve a iniciar sesión. Te llevamos en {shown}
        </Dialog.Description>
      </div>
    </>
  );
}

/**
 * Aviso global y único de sesión vencida. No se cierra con Escape ni clic fuera:
 * la sesión ya no sirve y la única salida es el login.
 */
export default function SessionExpiredDialog() {
  const pathname = usePathname() ?? "";
  const expired = useSyncExternalStore(subscribeSessionExpiry, isSessionExpired, () => false);
  const loggedOut = useSyncExternalStore(subscribeSessionExpiry, wasManualLogout, () => false);
  const open = expired && !loggedOut && !isAnonymousRoute(pathname);
  const actionRef = useRef<HTMLButtonElement>(null);

  const goToLogin = useCallback(() => {
    replacePage(loginUrl(`${window.location.pathname}${window.location.search}`));
  }, []);

  // Las llamadas que no usan axiosAuth tampoco deben quedarse en errores genéricos.
  useEffect(() => observeUnauthorized(axios), []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") verifySession();
    };
    window.addEventListener("focus", verifySession);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", verifySession);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    verifySession();
  }, [pathname]);

  useEffect(() => listenOtherTabs(), []);

  // Cerró sesión a mano en otra pestaña: al login, sin aviso ni retorno.
  useEffect(() => {
    if (expired && loggedOut && !isAnonymousRoute(pathname)) replacePage("/login");
  }, [expired, loggedOut, pathname]);

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        {/* Solo desenfoque: el fondo no se oscurece. */}
        <Dialog.Overlay className="animate-in fade-in-0 fixed inset-0 z-[200] bg-transparent backdrop-blur-md duration-300" />
        <Dialog.Content
          data-session-expired=""
          onEscapeKeyDown={(event) => event.preventDefault()}
          // Sin botón de cancelar, Radix no enfoca nada por sí solo.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            actionRef.current?.focus();
          }}
          className="animate-in slide-in-from-top-full fade-in-0 fixed inset-x-0 top-0 z-[201] mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-b-2xl bg-[var(--brand-primary)] p-6 text-white shadow-2xl duration-500 ease-out outline-none sm:flex-row motion-reduce:animate-none"
        >
          <Countdown onDone={goToLogin} />
          <Dialog.Action
            ref={actionRef}
            onClick={(event) => {
              event.preventDefault();
              goToLogin();
            }}
            className="w-full shrink-0 cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-surface)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-primary)] focus-visible:outline-none sm:w-auto"
          >
            Iniciar sesión ahora
          </Dialog.Action>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

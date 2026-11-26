"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** Evento de ventana que avisa a la barra lateral (fuera de este layout) del cambio de vista. */
export const CRM_VIEW_EVENT = "crm-view-mode";
const STORAGE_KEY = "crm_mode";

/** Lee la vista guardada en este navegador. Sin almacenamiento, vista completa. */
export function readCrmFocused(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "focus";
  } catch {
    return false;
  }
}

interface VistaValue {
  /** Vista enfocada (mockup 152): barra lateral con íconos, sin título ni indicadores. */
  focused: boolean;
  setFocused: (focused: boolean) => void;
}

const VistaContext = createContext<VistaValue>({ focused: false, setFocused: () => {} });

export function VistaProvider({ children }: { children: ReactNode }) {
  const [focused, setState] = useState(false);
  useEffect(() => setState(readCrmFocused()), []);
  const setFocused = useCallback((next: boolean) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "focus" : "full");
    } catch {}
    window.dispatchEvent(new CustomEvent(CRM_VIEW_EVENT, { detail: { focused: next } }));
  }, []);
  // Al salir de Ventas por chat la barra lateral vuelve a su tamaño normal.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CRM_VIEW_EVENT, { detail: { focused } }));
  }, [focused]);
  useEffect(
    () => () => {
      window.dispatchEvent(new CustomEvent(CRM_VIEW_EVENT, { detail: { focused: false } }));
    },
    [],
  );
  return <VistaContext.Provider value={{ focused, setFocused }}>{children}</VistaContext.Provider>;
}

export function useVista() {
  return useContext(VistaContext);
}

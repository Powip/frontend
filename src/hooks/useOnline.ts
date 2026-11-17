"use client";

import { useSyncExternalStore } from "react";

// FEAT-24 H6-D — ¿hay señal? (`navigator.onLine` y los eventos online/offline).
// `navigator.onLine === true` no garantiza internet: por eso la cola igual
// trata los errores de red aunque el navegador diga que hay conexión.

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const read = () => navigator.onLine !== false;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}

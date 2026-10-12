"use client";

import { useEffect, useState } from "react";

export function useAdvertisingTablePreferences(actorId: string | null | undefined) {
  const [preference, setPreference] = useState<{ actorId: typeof actorId; more: boolean }>({
    actorId,
    more: false,
  });
  const key = actorId ? `powip:advertising:table:v1:${actorId}` : null;
  useEffect(() => {
    let more = false;
    if (key) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        more =
          !!saved &&
          typeof saved === "object" &&
          "version" in saved &&
          saved.version === 1 &&
          "more" in saved &&
          saved.more === true;
      } catch {
        // Storage may be unavailable; the default table remains usable.
      }
    }
    setPreference({ actorId, more });
  }, [actorId, key]);
  function setMore(more: boolean) {
    setPreference({ actorId, more });
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, more }));
    } catch {
      // A display preference never blocks access to results.
    }
  }
  return { more: preference.actorId === actorId && preference.more, setMore };
}

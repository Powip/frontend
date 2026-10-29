"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PanelSkeleton } from "@/components/panel-control/PanelStates";
import { useAuth } from "@/contexts/AuthContext";
import type { PanelSession } from "@/features/panel-control/shared/models/panel-session.model";
import { PanelProvider } from "@/features/panel-control/shared/state/panel-context";
import type { PanelUiState } from "@/features/panel-control/shared/state/panel-state.model";
import { getClientTimeZone } from "@/features/panel-control/shared/utils/client-time-zone";
import {
  parsePanelUrlState,
  serializePanelUrlState,
} from "@/features/panel-control/shared/utils/panel-url";
import { resolvePanelRole } from "@/features/panel-control/shared/utils/resolve-panel-role";
import { PanelShell } from "./shell/PanelShell";

export function PanelControlScreen() {
  const { auth, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [initialState] = useState(() =>
    parsePanelUrlState(new URLSearchParams(searchParams.toString())),
  );
  // La zona del equipo que consulta: los días se cuentan en ella, no en la del servidor.
  const [timeZone] = useState(getClientTimeZone);

  const session = useMemo<PanelSession | null>(() => {
    if (!auth) return null;
    const nombre = [auth.user.name, auth.user.surname].filter(Boolean).join(" ");
    return {
      userId: auth.user.id,
      userName: nombre || auth.user.email,
      empresaId: auth.company?.id ?? null,
      tiendas: (auth.company?.stores ?? []).map((tienda) => ({
        id: tienda.id,
        nombre: tienda.name,
      })),
      rol: resolvePanelRole({
        email: auth.user.email,
        role: auth.user.role,
        permissions: auth.user.permissions,
      }),
    };
  }, [auth]);

  const syncUrl = useCallback(
    (state: PanelUiState) => {
      const next = serializePanelUrlState(state).toString();
      const current = window.location.search.replace(/^\?/, "");
      if (next !== current)
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  if (loading || !session) {
    return (
      <div className="p-6">
        <PanelSkeleton variant="kpis" label="panel de control" />
      </div>
    );
  }

  return (
    <PanelProvider
      session={session}
      initialState={initialState}
      timeZone={timeZone}
      onStateChange={syncUrl}
    >
      <PanelShell />
    </PanelProvider>
  );
}

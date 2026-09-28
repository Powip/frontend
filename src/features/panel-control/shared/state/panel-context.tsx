"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { DetalleGrupo } from "../../detalle/models/detalle.model";
import type { PanelSourceRegistry } from "../data/panel-source";
import { DEFAULT_PANEL_SOURCES } from "../data/panel-sources";
import type { PanelSession } from "../models/panel-session.model";
import { derivePanelView, type PanelView } from "../utils/derive-panel-view";
import { PanelCatalogProvider } from "./panel-catalog-provider";
import { DEFAULT_PANEL_STATE, type PanelAction, type PanelUiState } from "./panel-state.model";
import { panelStateReducer } from "./panel-state.reducer";

interface PanelContextValue {
  state: PanelUiState;
  dispatch: (action: PanelAction) => void;
  session: PanelSession;
  view: PanelView;
  now: number;
  sources: PanelSourceRegistry;
  drilldown: DetalleGrupo | null;
  openDrilldown: (grupo: DetalleGrupo) => void;
  closeDrilldown: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

interface PanelProviderProps {
  session: PanelSession;
  initialState?: PanelUiState;
  now?: number;
  sources?: PanelSourceRegistry;
  onStateChange?: (state: PanelUiState) => void;
  children: ReactNode;
}

export function PanelProvider({
  session,
  initialState = DEFAULT_PANEL_STATE,
  now: fixedNow,
  sources = DEFAULT_PANEL_SOURCES,
  onStateChange,
  children,
}: PanelProviderProps) {
  const [state, dispatch] = useReducer(panelStateReducer, initialState);
  const [mountedAt] = useState(() => Date.now());
  const now = fixedNow ?? mountedAt;
  const [drilldown, setDrilldown] = useState<DetalleGrupo | null>(null);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  const closeDrilldown = useCallback(() => setDrilldown(null), []);

  const view = useMemo(() => derivePanelView(state, session, now), [state, session, now]);

  const value = useMemo<PanelContextValue>(
    () => ({
      state,
      dispatch,
      session,
      view,
      now,
      sources,
      drilldown,
      openDrilldown: setDrilldown,
      closeDrilldown,
    }),
    [state, session, view, now, sources, drilldown, closeDrilldown],
  );

  return (
    <PanelContext.Provider value={value}>
      <PanelCatalogProvider>{children}</PanelCatalogProvider>
    </PanelContext.Provider>
  );
}

export function usePanel(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanel debe usarse dentro de <PanelProvider>");
  }
  return context;
}

import { createContext } from "react";
import type { PanelCatalogo } from "../models/panel-catalog.model";

export const PanelCatalogContext = createContext<PanelCatalogo | null>(null);

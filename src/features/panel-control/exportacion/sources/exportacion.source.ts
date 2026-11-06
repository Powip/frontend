import type { PanelSource } from "../../shared/data/panel-source";
import { descargarLibro } from "../api/exportacion.api";

export const exportacionLibroRealSource: PanelSource<"exportacion-libro"> = {
  contractId: "exportacion-libro",
  kind: "real",
  descripcion:
    "GET /panel/export.xlsx (ms-ventas, solo Dueño): libro de 9 hojas generado en el servidor con los mismos filtros del panel",
  fetch: (query) => descargarLibro(query),
};

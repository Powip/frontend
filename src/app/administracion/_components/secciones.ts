/**
 * Navegación de Administración (FEAT-34): 5 secciones con subpestañas, como el Panel de control. Las URL de siempre
 * no cambian. Liquidaciones salió del menú (vive en Operaciones). Fase 3 (27-11-2026): Cuentas por cobrar y pagar
 * vuelve al menú en Caja y Capital y ROI pierde el aviso «solo en este navegador»: los dos guardan en el servidor.
 */

export interface PaginaAdmin {
  href: string;
  /** Nombre corto en la subpestaña. */
  label: string;
  titulo: string;
  subtitulo: string;
}

export interface SeccionAdmin {
  id: string;
  label: string;
  paginas: PaginaAdmin[];
}

export const SECCIONES_ADMIN: SeccionAdmin[] = [
  {
    id: "resultados",
    label: "Resultados",
    paginas: [
      {
        href: "/administracion/resumen",
        label: "Resumen",
        titulo: "Resumen",
        subtitulo: "Estado de resultados del periodo",
      },
      {
        href: "/administracion/utilidad",
        label: "Utilidad y margen",
        titulo: "Utilidad y margen",
        subtitulo: "De la venta a la utilidad operativa",
      },
      {
        href: "/administracion/equilibrio",
        label: "Punto de equilibrio",
        titulo: "Punto de equilibrio",
        subtitulo: "Cuánto hay que vender para cubrir los gastos fijos",
      },
      {
        href: "/administracion/anual",
        label: "Resumen anual",
        titulo: "Resumen anual",
        subtitulo: "Mes a mes del año del periodo elegido",
      },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    paginas: [
      {
        href: "/administracion/reporte",
        label: "Reporte rápido",
        titulo: "Reporte rápido",
        subtitulo: "Lo esencial del periodo en una pantalla",
      },
      {
        href: "/administracion/diario",
        label: "Control diario",
        titulo: "Control diario",
        subtitulo: "Ventas por día y por canal",
      },
      {
        href: "/administracion/canales",
        label: "Canales y marketplaces",
        titulo: "Canales y marketplaces",
        subtitulo: "Ventas, comisiones y neto por canal",
      },
      {
        href: "/administracion/margen-producto",
        label: "Margen por producto",
        titulo: "Margen por producto",
        subtitulo: "Precio, costo y margen de lo vendido",
      },
    ],
  },
  {
    id: "costos",
    label: "Costos",
    paginas: [
      {
        href: "/administracion/gastos",
        label: "Gastos y costos",
        titulo: "Gastos y costos",
        subtitulo: "Gastos del mes y costo de lo vendido",
      },
      {
        href: "/administracion/merma",
        label: "Merma",
        titulo: "Merma",
        subtitulo: "Pérdidas de inventario del periodo",
      },
    ],
  },
  {
    id: "publicidad",
    label: "Publicidad",
    paginas: [
      {
        href: "/administracion/pauta",
        label: "Inversión publicitaria",
        titulo: "Inversión publicitaria",
        subtitulo: "Consumo de las cuentas conectadas y su retorno",
      },
    ],
  },
  {
    id: "caja",
    label: "Caja",
    paginas: [
      {
        href: "/administracion/flujo",
        label: "Flujo de caja",
        titulo: "Flujo de caja",
        subtitulo: "Entradas y salidas mes a mes del año del periodo",
      },
      {
        href: "/administracion/cuentas",
        label: "Cuentas por cobrar y pagar",
        titulo: "Cuentas por cobrar y pagar",
        subtitulo: "Lo que te deben y lo que debes, hoy",
      },
      {
        href: "/administracion/capital",
        label: "Capital y ROI",
        titulo: "Capital y ROI",
        subtitulo: "Capital invertido, retorno y préstamos",
      },
    ],
  },
];

/** Páginas que siguen existiendo pero no están en el menú (hoy ninguna). */
export const PAGINAS_FUERA_DE_MENU: (PaginaAdmin & { seccion: string })[] = [];

export function ubicarPagina(pathname: string): { seccion: SeccionAdmin; pagina: PaginaAdmin; enMenu: boolean } | null {
  for (const seccion of SECCIONES_ADMIN) {
    const pagina = seccion.paginas.find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
    if (pagina) return { seccion, pagina, enMenu: true };
  }
  const oculta = PAGINAS_FUERA_DE_MENU.find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  if (oculta) {
    const seccion = SECCIONES_ADMIN.find((s) => s.id === oculta.seccion);
    if (seccion) return { seccion, pagina: oculta, enMenu: false };
  }
  return null;
}

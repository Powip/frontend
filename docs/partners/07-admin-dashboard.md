# Page

Partners Admin · Dashboard

## Route

`/partners/admin`

## Objetivo

Que el equipo de Powip vea de un vistazo la salud del programa de partners: cuánto MRR trae, cuánto cuesta el canal, y quiénes son los partners que más aportan.

## UI / Layout

Server wrapper (`page.tsx`, metadata) + Client Component (`_components/dashboard-page-content.tsx`). Usa el `layout.tsx` de `/partners/admin` (header + `PartnersAdminTabs`, distinto del de la vista Partner).

- Fila de 6 KPIs.
- Gráfico de barras (MRR referido por mes) + donut (referidos por origen) — primer uso de `recharts` en el feature Partners.
- Tabla "Top partners" (linkea a la ficha de cada uno).
- Embudo del programa (reutiliza `FunnelBars`, el mismo componente que la página Resumen de la vista Partner).

## Componentes

- `_components/admin-dashboard-kpi-row.tsx`
- `_components/mrr-by-month-chart.tsx` — `recharts` `BarChart`.
- `_components/referrals-by-origin-chart.tsx` — `recharts` `PieChart` (donut).
- `_components/top-partners-table.tsx` — ordena y recorta a 5 client-side sobre `useAdminPartners()` (mismo patrón que "Top partners" del mockup).
- `_components/program-funnel.tsx` — reutiliza `@/components/partners/funnel-bars`.

## Información mostrada

- MRR referido, comisiones del mes, descuentos dados, costo del canal, LTV traído, ROI del canal (múltiplo).
- Evolución de MRR referido, últimos 6 meses.
- Distribución de referidos por origen (link/manual/código) + conversión clic→pago.
- Top 5 partners activos por MRR.
- Embudo del programa completo (leads → cuenta creada → activaron → pagando).

## Acciones del usuario

Ninguna — página de solo lectura. El link a la ficha de un top partner es la única navegación.

## Estados

### Loading
Skeletons independientes por sección (KPIs, cada gráfico, tabla, embudo).

### Empty
"Top partners" muestra `EmptyState` si no hay ningún partner activo todavía.

### Error
`PartnerSectionError` independiente para el resumen (KPIs + gráficos + embudo, misma query) y para la tabla de partners.

### Success
Datos normales.

## Datos requeridos

- `AdminDashboardSummary` — modelo nuevo (KPIs + serie mensual + distribución por origen + embudo).
- `AdminPartner[]` — mismo modelo que usan las páginas Partners/Ficha (ver `08-admin-partners.md`).

## Mock data

- `src/features/partners/mocks/admin-dashboard.mock.ts`.
- `services/get-admin-dashboard-summary.ts` es el único lugar a reemplazar cuando exista backend.

## Backend Requirements

Propuesta, no confirmada.

1. **Resumen agregado del programa** para el ciclo actual (KPIs + serie mensual + distribución por origen + embudo). **BACKEND TBD**: ¿la serie mensual es de los últimos 6 meses fijos, o un rango configurable?
2. El "Top partners" reutiliza el mismo endpoint de listado de partners que la página `/partners/admin/partners` — no necesita uno propio, solo se ordena/recorta en el cliente.

## API Contract Proposal

### Request

```
GET /partners/admin/dashboard-summary
Authorization: Bearer <token>
```

### Response

```json
{
  "referredMrr": 4230,
  "monthlyCommissions": 1340,
  "discountsGiven": 412,
  "channelCost": 1752,
  "ltvBrought": 63450,
  "channelRoiMultiplier": 36,
  "monthlyMrr": [{ "month": "mar", "mrr": 1607 }],
  "referralsByOrigin": { "link": 55, "manual": 23, "codigo": 22 },
  "clickToPayConversionPct": 37,
  "funnel": [{ "label": "Leads", "count": 220 }]
}
```

## Business Rules

- Ningún KPI se calcula en el frontend — `channelCost`, `ltvBrought` y `channelRoiMultiplier` vienen ya calculados del backend.
- **BACKEND TBD**: fórmula exacta de `channelRoiMultiplier` (¿LTV / costo del canal, con qué ventana de LTV?) y de `ltvBrought` (el mockup asumía ×15 meses de retención, un supuesto, no un dato real).

## Acceptance Criteria

- [ ] Solo usuarios superadmin pueden acceder (verificado por `AuthGuard` + `ROUTE_PERMISSIONS["/partners/admin"]`).
- [ ] Los 6 KPIs, ambos gráficos y el embudo muestran los datos del mock.
- [ ] "Top partners" solo lista partners con `status: "activo"`, ordenados por MRR descendente.
- [ ] Click en un partner de la tabla navega a `/partners/admin/partners/{id}`.
- [ ] Si la query de resumen falla, KPIs+gráficos+embudo muestran error, pero la tabla de partners sigue funcionando si su propia query no falló.

# Page

Partners · Comisiones

## Route

`/partners/comisiones`

## Objetivo

Que el partner entienda el detalle de cómo se compone su comisión: cuánto genera cada referido, y por qué (transparencia sobre el cálculo, sin que el frontend calcule nada).

## UI / Layout

Usa el `layout.tsx` compartido de Partners (se agregó la pestaña "Comisiones" al array `TABS`). Reutiliza `loading.tsx`/`error.tsx` del segmento padre `/partners`, igual que `/partners/referidos`.

- Fila de 4 KPIs (recurrente activa, comisión 1er mes, pendiente al pago, reversos).
- Tabla de detalle por referido, con badge de la opción de comisión vigente en el header.
- Alert explicativo al final ("Cómo se calcula").

## Componentes

- `_components/commissions-kpi-row.tsx` — mismo patrón visual que `PartnerKpiRow` del Resumen (4 tarjetas con borde de color), pero con un 4to KPI distinto ("Reversos", en rojo). Se duplica el pequeño helper `Kpi()` en vez de compartirlo entre páginas — es el mismo patrón que ya usa el resto del dashboard (`GuiasKpiRow.tsx`, `CcKpiBar.tsx`, etc.: cada KPI-row define su propio `Kpi()` local).
- `_components/commission-status-badge.tsx` — badge de 3 estados (Activa/Pendiente/Reverso), una simplificación de los 6 estados de `ReferralStatus` específica de esta vista de comisiones.
- `_components/commissions-table.tsx` — tabla de detalle, reutiliza `ui/table.tsx` y `ui/empty-state.tsx`.
- `_components/commission-explainer-alert.tsx` — usa `ui/alert.tsx` (shadcn), no un componente hecho a mano.

## Información mostrada

- KPIs: recurrente activa/mes, comisión de 1er mes del mes en curso, comisión pendiente (activó sin pagar), reversos del ciclo.
- Por cada línea: negocio, plan, neto del 1er mes (precio ya con el descuento aplicado), comisión de 1er mes, recurrente/mes, estado.
- Opción de comisión vigente del partner (código + %s).

## Acciones del usuario

Página de solo lectura — no hay mutaciones acá.

## Estados

### Loading
Skeletons en los KPIs y en la tabla mientras `usePartnerSummary()`/`useCommissionLines()` cargan.

### Empty
`EmptyState` en la tabla si el partner todavía no tiene ninguna línea de comisión.

### Error
`PartnerSectionError` (reutilizado del Resumen) con "Reintentar", independiente para el bloque de KPIs y para la tabla — si solo una de las dos queries falla, la otra sigue mostrando sus datos.

### Success
KPIs y tabla con los datos normales.

## Datos requeridos

- `PartnerSummary` — el mismo modelo del Resumen, extendido con un campo `reversals: number` (ver "Business Rules" por la convención de signo).
- `CommissionLine[]` — modelo **nuevo**, no reutiliza `PartnerReferral`. Ver la nota de diseño abajo.

### Nota de diseño: por qué `CommissionLine` es un modelo separado de `PartnerReferral`

La tabla de comisiones necesita un dato que `PartnerReferral` no tiene (`netFirstMonthAmount`, el monto neto ya con el descuento aplicado) y agrupa el estado en solo 3 valores en vez de 6. En vez de forzar ese campo dentro del modelo de referido (usado también por `/partners` y `/partners/referidos`), se modela como una entidad propia — más parecido a como funcionaría en un backend real: un reporte de comisiones es típicamente una vista/agregación distinta de la tabla de referidos, no el mismo registro con un campo pegado. Esto mantiene esta página sin tocar el modelo ni los mocks que ya usan las otras dos páginas.

## Mock data

- `src/features/partners/mocks/commission-lines.mock.ts` — 5 líneas: 2 activas, 2 pendientes (sin neto ni comisión todavía) y 1 en reverso (comisión de 1er mes negativa). Incluye `EMPTY_COMMISSION_LINES` para el estado vacío.
- `src/features/partners/services/get-commission-lines.ts` es el único lugar a reemplazar cuando exista backend.
- El KPI "Reversos" viene de `PartnerSummary.reversals` (mismo mock que ya usa el Resumen, `partner-summary.mock.ts`, con el campo agregado).

## Backend Requirements

Propuesta, no confirmada.

1. **Detalle de comisiones** del partner autenticado, con el neto pagado por referido (para que el partner pueda verificar el cálculo, no para que el frontend lo recalcule).
2. El campo `reversals` del resumen general debería incluir cualquier comisión revertida en el ciclo actual (cancelaciones, reembolsos, clawback).
3. **BACKEND TBD**: ¿el detalle de comisiones es paginado? Esta página asume que la lista completa es chica (igual que Referidos); si un partner tiene cientos de referidos activos, va a necesitar paginación o rango de fechas.

## API Contract Proposal

### Request

```
GET /partners/me/commissions
Authorization: Bearer <token>
```

### Response

```json
[
  {
    "id": "cl-livii-moda",
    "businessName": "Livii Moda SAC",
    "planName": "Standard",
    "netFirstMonthAmount": 170.10,
    "firstMonthCommission": 68.04,
    "recurringCommission": 11.34,
    "status": "activa"
  },
  {
    "id": "cl-moda-urbana",
    "businessName": "Moda Urbana EIRL",
    "planName": "Basic",
    "netFirstMonthAmount": 89.10,
    "firstMonthCommission": -35.64,
    "recurringCommission": 0,
    "status": "reverso"
  }
]
```

`GET /partners/me/summary` (ya propuesto en `01-resumen.md`) agrega el campo:
```json
{
  "reversals": -5.94
}
```

## Business Rules

- El frontend no calcula ningún monto de esta página — ni el neto, ni la comisión, ni el total de reversos. Todo viene ya calculado del backend.
- Convención de signo: `PartnerSummary.reversals` y `CommissionLine.firstMonthCommission` de una línea en `"reverso"` son **negativos o cero**, nunca positivos. El KPI y la celda de la tabla muestran el signo tal cual lo reciben (con el prefijo "–" solo cuando el valor es negativo, para no mostrar "– S/ 0.00" cuando no hay reversos).
- **BACKEND TBD**: ¿un referido "reverso" puede volver a "activa" si se revierte el reembolso? No contemplado en esta versión.

## Acceptance Criteria

- [ ] La pestaña "Comisiones" navega correctamente y queda resaltada en `/partners/comisiones`.
- [ ] Los 4 KPIs muestran los valores de `PartnerSummary`, con "Reversos" en rojo y sin signo negativo cuando es 0.
- [ ] La tabla muestra "—" en neto/comisión/recurrente cuando son `null` (línea sin comisión generada aún).
- [ ] Una línea en estado "reverso" con comisión negativa se resalta visualmente (no solo por el badge de estado).
- [ ] Si falla `usePartnerSummary()` o `useCommissionLines()` de forma independiente, solo esa sección muestra el error — la otra sigue funcionando.
- [ ] El badge de la opción de comisión vigente solo se muestra si `commissionOption` llegó (no rompe si `summaryQuery` todavía está cargando).

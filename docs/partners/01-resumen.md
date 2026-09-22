# Page

Partners · Resumen

## Route

`/partners`

## Objetivo

Mostrarle al usuario (partner) una foto rápida de su programa de referidos: cuánto está ganando, en qué nivel está, cómo viene el embudo de referidos y cuáles fueron sus últimos referidos registrados.

## UI / Layout

- `src/app/partners/layout.tsx`: header "PROGRAMA DE PARTNERS" + barra de tabs (hoy solo "Resumen", las próximas páginas agregan su propia pestaña al mismo array `TABS`).
- `src/app/partners/page.tsx`: dos filas de cards (hero de comisión + nivel, luego embudo + próxima liquidación), una fila de 4 KPIs, y una tabla de "últimos referidos".

## Componentes

- `_components/partner-hero-card.tsx` — mensaje de "ganás dos veces" con la opción de comisión vigente del partner.
- `_components/partner-tier-card.tsx` — nivel actual (bronce/plata/oro), MRR activo, progreso al siguiente nivel.
- `_components/partner-kpi-row.tsx` — 4 KPIs: recurrente activa, comisión 1er mes del mes, pendiente/en revisión, acumulado pagado.
- `_components/partner-referral-funnel.tsx` — barras del embudo clic→cuenta→activó→pagó.
- `_components/next-payout-card.tsx` — monto y fecha de la próxima liquidación, con su desglose.
- `_components/recent-referrals-table.tsx` — tabla de los últimos referidos (negocio, origen, estado, comisión 1er mes, recurrente).
- `_components/referral-status-badge.tsx`, `_components/referral-origin-badge.tsx` — badges de estado/origen del referido, reutilizables en futuras páginas de Partners.
- `_components/partner-section-error.tsx` — bloque de error inline con botón "Reintentar", usado cuando falla una query de esta página.

## Información mostrada

- Comisión recurrente activa por mes.
- Comisión de 1er mes generada en el mes en curso.
- Comisión pendiente (referidos activados que todavía no pagaron).
- Acumulado histórico pagado al partner.
- Nivel del partner (bronce/plata/oro), MRR activo y cuánto falta para el siguiente nivel.
- Opción de comisión vigente (código + % 1er mes + % recurrente).
- Embudo: clics/código → cuenta creada → activó → pagó.
- Próxima liquidación: monto total, fecha de depósito, desglose por concepto.
- Últimos 5 referidos: negocio, origen (link/código/manual), estado, comisión 1er mes y recurrente.

## Acciones del usuario

En esta página el usuario solo **lee** información — no hay mutaciones (alta de referido, edición de datos de cobro, etc. son de otras páginas del feature, fuera de esta ronda). La única acción interactiva es "Reintentar" cuando una sección falla.

## Estados

### Loading

Skeletons locales por sección (`Skeleton` de `ui/skeleton.tsx` y bloques `animate-pulse`), mientras `usePartnerSummary()`/`useRecentReferrals()` están en `isLoading`. La ruta completa además usa `loading.tsx` (`PowipPulseLoader`) para la navegación inicial de Next.js.

### Empty

La tabla de últimos referidos usa `EmptyState` (`ui/empty-state.tsx`) cuando el partner todavía no tiene referidos.

### Error

Si `usePartnerSummary()` o `useRecentReferrals()` devuelven `isError`, la sección correspondiente muestra `PartnerSectionError` (card con ícono, mensaje y botón "Reintentar" que llama a `refetch()`). Errores no controlados en el render de la ruta los captura `error.tsx` (`RouteErrorFallback`).

### Success

Se muestran los datos normalmente, como se describe en "Información mostrada".

## Datos requeridos

- `PartnerSummary` (`src/features/partners/models/partner-summary.ts`): tier, opción de comisión, KPIs, embudo, próxima liquidación.
- `PartnerReferral[]` (`src/features/partners/models/partner-referral.ts`): últimos N referidos.

## Mock data

- `src/features/partners/mocks/partner-summary.mock.ts` — un `PartnerSummary` de ejemplo, con los montos ya calculados (no hay fórmulas de comisión en el frontend).
- `src/features/partners/mocks/partner-referrals.mock.ts` — 6 referidos cubriendo los estados reales: pagando, activó sin pagar, en revisión, correo enviado sin abrir, cancelado. Incluye también `EMPTY_PARTNER_REFERRALS` para probar el estado vacío.
- Servidos por `src/features/partners/services/get-partner-summary.ts` y `get-recent-referrals.ts`, con un delay simulado de 300ms. Estos dos archivos son el único lugar que hay que tocar para reemplazar el mock por la llamada real cuando exista backend — los hooks, componentes y tests de componentes no cambian.

## Backend Requirements

Esta sección es lo que el frontend necesita que backend entregue. Ninguno de estos endpoints existe hoy — es una propuesta para discutir con backend, no un contrato confirmado.

1. **Resumen del partner** (KPIs + tier + embudo + próxima liquidación) para el usuario autenticado.
2. **Últimos N referidos** del partner autenticado, ordenados por fecha de registro descendente, con su comisión ya calculada (el frontend no debe calcular %s de comisión).
3. El backend es la fuente de verdad de todos los montos — el frontend solo los muestra tal cual los recibe.
4. Falta definir (BACKEND TBD): qué identifica a "el partner autenticado" (¿el mismo JWT de `ms-auth` trae un `partnerId`? ¿hay un partner por company o por usuario?), y si existe el concepto de "partner externo" sin cuenta Powip (ver informe de arquitectura previo).

## API Contract Proposal

> Propuesta, no confirmada. Nombres de endpoint/campos a validar con backend.

### Request

```
GET /partners/me/summary
Authorization: Bearer <token>
```

```
GET /partners/me/referrals?limit=5
Authorization: Bearer <token>
```

### Response

`GET /partners/me/summary`
```json
{
  "tier": { "level": "plata", "activeMrr": 458, "nextLevelThreshold": 1500, "extraResidualPct": 1 },
  "commissionOption": { "code": "A", "firstMonthPct": 40, "recurringPct": 6 },
  "recurringActiveMonthly": 27.48,
  "firstMonthCommissionThisMonth": 68.04,
  "pendingCommission": 11.34,
  "totalPaidToDate": 512.90,
  "funnel": [
    { "label": "Clic / código", "count": 24 },
    { "label": "Cuenta creada", "count": 11 },
    { "label": "Activó", "count": 4 },
    { "label": "Pagó", "count": 2 }
  ],
  "nextPayout": {
    "amount": 95.52,
    "payoutDate": "2026-08-25",
    "breakdown": [
      { "label": "Livii Moda · 1er mes (40%)", "amount": 68.04 },
      { "label": "2 recurrentes (6%)", "amount": 27.48 }
    ]
  }
}
```

`GET /partners/me/referrals?limit=5`
```json
[
  {
    "id": "ref-livii-moda",
    "businessName": "Livii Moda SAC",
    "origin": "link",
    "status": "pagando",
    "registeredAt": "2026-08-02",
    "planName": "Standard",
    "firstMonthCommission": 68.04,
    "recurringCommission": 11.34
  }
]
```

## Business Rules

- El frontend no calcula comisiones, porcentajes, niveles ni liquidaciones — solo muestra lo que backend devuelve. **BACKEND TBD**: reglas reales de cálculo (%s por opción, umbrales de nivel, reversos/clawback) viven en backend.
- `firstMonthCommission`/`recurringCommission` pueden ser `null` en un referido que todavía no generó comisión (ej. en revisión, correo enviado, activó sin pagar).
- **BACKEND TBD**: qué pasa con un referido cancelado — ¿su comisión pasa a `0`, se mantiene el valor histórico, o desaparece del listado de "últimos referidos"? El mock actual asume que se conserva en `0`, a confirmar.

## Acceptance Criteria

- [ ] `/partners` requiere sesión iniciada (cubierto por `AuthGuard` existente); no requiere ningún permiso adicional todavía.
- [ ] El ítem "Partners" aparece en el sidebar para cualquier usuario autenticado y navega a `/partners`.
- [ ] Mientras cargan los datos, cada sección muestra su propio skeleton (no un loader de página completa bloqueando todo).
- [ ] Si `useRecentReferrals` devuelve una lista vacía, se muestra el `EmptyState`, no una tabla vacía ni un error.
- [ ] Si `usePartnerSummary` o `useRecentReferrals` fallan, se muestra `PartnerSectionError` con botón "Reintentar" que dispara `refetch()`.
- [ ] Ningún componente de esta página calcula comisiones ni porcentajes — solo formatea y muestra valores recibidos del service/mock.
- [ ] La página es usable en mobile (KPIs y cards se apilan en 1 columna, la tabla scrollea horizontalmente si hace falta).

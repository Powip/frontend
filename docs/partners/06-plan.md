# Page

Partners · Mi Plan

## Route

`/partners/plan`

## Objetivo

Que el partner entienda las 3 opciones de comisión disponibles, pueda proyectar cuánto ganaría con un simulador, y compare la comisión por plan de Powip — todo dejando clarísimo que es una **estimación**, no un número real.

## UI / Layout

Usa el `layout.tsx` compartido de Partners (se agregó la pestaña "Mi Plan"). Reutiliza `loading.tsx`/`error.tsx` del segmento padre. Server wrapper (`page.tsx`, con `metadata`) + Client Component (`_components/plan-page-content.tsx`), mismo patrón que el resto de las páginas.

- Cards de las 3 opciones de comisión (seleccionables, con `RadioGroup` real).
- Simulador de ingresos (inputs + salida estimada + disclaimer).
- Tabla comparativa de comisión por plan × opción.

## Componentes

- `_components/commission-option-cards.tsx` — usa el nuevo `src/components/ui/radio-group.tsx` (shadcn wrapper sobre el paquete `radix-ui`, ya instalado — no se agregó ninguna dependencia nueva). Marca "Vigente" en la opción real del partner (`PartnerSummary.commissionOption`).
- `_components/commission-simulator.tsx` — inputs locales (cantidad de referidos, plan, retención) + salida calculada con `estimateCommissionEarnings`. Incluye un `Alert` (variant destructive) que aclara explícitamente que es una estimación.
- `_components/commission-comparison-table.tsx` — tabla Plan × Opción, usa las mismas funciones puras que el simulador (consistencia garantizada entre ambas vistas).

## Información mostrada

- Las 3 opciones de comisión con su % de 1er mes y recurrente.
- Cuál es la opción vigente del partner.
- Simulación: total proyectado, desglose 1er mes / recurrente, según cantidad de referidos, plan promedio y retención esperada que el usuario ingresa.
- Tabla de referencia: comisión de 1er mes y recurrente por cada combinación de plan (Basic/Standard/Full) × opción (A/B/C).

## Acciones del usuario

- Elegir una opción (afecta solo al simulador — **no cambia la opción real del partner**, esa es una decisión de negocio/aprobación que no está en el alcance de esta página).
- Ajustar los inputs del simulador.

## Estados

### Loading
Skeletons en las cards de opción y en la tabla comparativa mientras `useCommissionOptions()` carga. El simulador no tiene su propio loading — depende de que `options` ya haya llegado (si no llegó, muestra "—" en los totales).

### Empty
No aplica — las opciones de comisión son un catálogo fijo, no una lista que pueda estar vacía en un caso de uso real.

### Error
`PartnerSectionError` si `useCommissionOptions()` falla. Si `usePartnerSummary()` o `usePartnerLink()` fallan, la página se degrada con gracia (sin badge "Vigente", descuento por defecto 10%) en vez de romper toda la página — esos dos datos son complementarios, no críticos para que el simulador funcione.

### Success
Cards, simulador y tabla con datos normales.

## Datos requeridos

- `CommissionOptionDetail[]` — modelo nuevo (código, nombre, descripción, %s).
- `PartnerSummary.commissionOption` — ya existente (para el badge "Vigente").
- `PartnerLink.discountPct` — ya existente (para el cálculo del neto en la simulación; si no cargó todavía, se usa 10% como valor por defecto razonable, documentado en el código).
- `PlanOption.monthlyPrice` — **se agregó esta ronda** al modelo `PlanOption` ya existente (antes solo tenía `value`/`label`, usado por el formulario de alta de referido en `/partners/referidos`). Se reutiliza el mismo catálogo en vez de duplicar Basic/Standard/Full en dos lugares.

## Mock data

- `src/features/partners/mocks/commission-options.mock.ts` — las 3 opciones (A/C/B) con los mismos valores del mockup de referencia.
- `services/get-commission-options.ts` es el único lugar a reemplazar cuando exista backend.

## Backend Requirements

Propuesta, no confirmada.

1. **Catálogo de opciones de comisión** disponibles (código, nombre, descripción, %s) — hoy es fijo en frontend, debería venir de backend para poder cambiarlo sin deploy.
2. **BACKEND TBD**: ¿cómo pide un partner cambiar de opción? Esta página no lo permite — solo simula. Si el negocio quiere que el partner pueda solicitar un cambio real, es una mutación nueva (probablemente con aprobación manual desde la vista Admin), fuera de esta ronda.
3. El catálogo de planes con precio (`PARTNER_PLAN_OPTIONS`) probablemente debería venir de `ms-subscription` en vez de estar hardcodeado en el frontend de Partners — hoy no hay tiempo/endpoint confirmado para integrarlo, así que se mantiene como mock local documentado.

## API Contract Proposal

### Request

```
GET /partners/commission-options
Authorization: Bearer <token>
```

### Response

```json
[
  { "code": "A", "label": "Agencias y developers", "description": "...", "firstMonthPct": 40, "recurringPct": 6 },
  { "code": "C", "label": "Creadores", "description": "...", "firstMonthPct": 50, "recurringPct": 8 },
  { "code": "B", "label": "Todos los perfiles", "description": "...", "firstMonthPct": 70, "recurringPct": 3 }
]
```

## Business Rules

- **La simulación NUNCA se muestra como comisión real** — todos los números del simulador y de la tabla comparativa están junto a un rótulo "estimado"/"proyectado" o dentro de un `Alert` de advertencia. Esto es intencional y cumple la regla del proyecto de no presentar cálculos del frontend como fuente de verdad.
- El descuento usado en la simulación es el mismo `discountPct` que ve el partner en `/partners/link` — si ese valor cambia, el simulador cambia con él (no hay un número de descuento hardcodeado suelto en dos lugares).
- Elegir una opción en las cards **no dispara ninguna llamada** — es 100% estado local de UI para alimentar el simulador.

## Acceptance Criteria

- [ ] La pestaña "Mi Plan" navega correctamente y su `<title>` sigue el patrón `Mi Plan | Partners | Powip`.
- [ ] La opción vigente del partner muestra el badge "Vigente" (si `usePartnerSummary()` cargó a tiempo).
- [ ] Cambiar cualquier input del simulador recalcula el total proyectado sin recargar la página.
- [ ] El simulador y la tabla comparativa muestran el mismo número para la misma combinación plan+opción (usan las mismas funciones puras).
- [ ] Es imposible confundir un número del simulador con una comisión real: siempre hay texto/alert aclarándolo.
- [ ] Si falla `useCommissionOptions()`, se muestra `PartnerSectionError`; si fallan `usePartnerSummary()`/`usePartnerLink()`, la página sigue funcionando con valores por defecto razonables.

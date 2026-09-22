# Page

Partners · Pagos

## Route

`/partners/pagos`

## Objetivo

Que el partner vea el historial de sus liquidaciones, su próximo depósito, y pueda gestionar sus datos de cobro.

## UI / Layout

Usa el `layout.tsx` compartido de Partners (se agregó la pestaña "Pagos"). Reutiliza `loading.tsx`/`error.tsx` del segmento padre.

Grid de 2 columnas:
- Izquierda: card "Historial de liquidaciones" (tabla).
- Derecha: card "Próxima liquidación" (reutilizada del Resumen), card "Datos de cobro" (con botón para editar) y card "Umbral mínimo" (informativa).

## Componentes

- `_components/payout-history-table.tsx` + `_components/payout-history-status-badge.tsx` (2 estados: Programado/Pagado).
- `_components/payout-settings-card.tsx` — muestra método + número/cuenta + titular.
- `_components/edit-payout-settings-dialog.tsx` — formulario (react-hook-form + zod) para cambiar método y número/cuenta.
- `_components/minimum-threshold-card.tsx` — texto informativo con el umbral, viene de `PayoutSettings.minimumThreshold` (no hardcodeado).
- Reutiliza `@/components/partners/next-payout-card` — se movió ahí en esta ronda (antes vivía en `src/app/partners/_components/`, exclusivo del Resumen; ahora también lo usa esta página) y `@/components/partners/partner-section-error`.

## Información mostrada

- Historial: fecha, concepto, monto, estado.
- Próxima liquidación: mismo dato que ya se muestra en el Resumen (`PartnerSummary.nextPayout`) — no se duplica el modelo, se reutiliza la misma query/componente.
- Datos de cobro: método (Yape/Plin/Transferencia), número/cuenta, titular.
- Umbral mínimo de pago (con qué monto se empieza a pagar / cuándo se acumula al siguiente ciclo).

## Acciones del usuario

- Editar datos de cobro (método + número/cuenta). El **titular** no es editable desde este formulario — así está en la referencia visual; si el negocio quiere que sea editable, es una confirmación pendiente con backend/producto.

## Estados

### Loading
Skeletons independientes en cada card/tabla mientras cada query (`usePartnerSummary`, `usePayoutHistory`, `usePayoutSettings`) carga.

### Empty
`EmptyState` en la tabla de historial si el partner todavía no tiene liquidaciones.

### Error
`PartnerSectionError` independiente por sección — si falla el historial pero el resto carga bien, solo esa card muestra el error.

### Success
Datos normales en las 4 secciones.

### Mutation (editar datos de cobro)
- Botón deshabilitado + spinner + "Guardando..." mientras `isPending`.
- Éxito: toast, el dialog se cierra, la card de datos de cobro se actualiza al instante (`queryClient.setQueryData`, sin esperar un refetch).
- Error: toast de error, el dialog se mantiene abierto con lo que el usuario ya escribió.

## Datos requeridos

- `PayoutHistoryEntry[]` — modelo nuevo.
- `PayoutSettings` — modelo nuevo (método, número/cuenta, titular, umbral mínimo, todo en un solo recurso).
- `PartnerSummary.nextPayout` — ya existente, reutilizado del Resumen.

## Mock data

- `src/features/partners/mocks/payout-history.mock.ts` — 3 entradas (1 programada + 2 pagadas), con `EMPTY_PAYOUT_HISTORY` para el estado vacío.
- `src/features/partners/mocks/payout-settings.store.ts` — store mutable en memoria (mismo patrón que `partner-referrals.store.ts` y `mocks/partner-referrals.store.ts`), con reset para tests. Guardar datos de cobro nuevos en esta sesión persiste mientras no se recargue la página.
- `services/get-payout-history.ts`, `get-payout-settings.ts` y `update-payout-settings.ts` son el único lugar a reemplazar cuando exista backend.

## Backend Requirements

Propuesta, no confirmada.

1. **Historial de liquidaciones** del partner autenticado.
2. **Datos de cobro actuales** del partner (método, número/cuenta, titular, umbral mínimo configurado para su cuenta).
3. **Actualizar datos de cobro**: solo método y número/cuenta son editables por el partner en esta versión.
4. **BACKEND TBD**: ¿el titular del cobro es editable por el partner, o siempre es el nombre de la cuenta/usuario? La referencia visual no lo permite editar, lo asumimos fijo — a confirmar.
5. **BACKEND TBD**: ¿el umbral mínimo es configurable por partner/nivel, o es un valor global del programa? Lo modelamos como parte de `PayoutSettings` (por partner) porque es lo más flexible, pero podría ser una constante global del sistema.

## API Contract Proposal

### Request

```
GET /partners/me/payouts
Authorization: Bearer <token>
```

```
GET /partners/me/payout-settings
Authorization: Bearer <token>
```

```
PATCH /partners/me/payout-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "plin",
  "accountNumber": "999 111 222"
}
```

### Response

`GET /partners/me/payouts`
```json
[
  { "id": "payout-2026-08-25", "date": "2026-08-25", "concept": "1er mes + 2 recurrentes", "amount": 95.52, "status": "programado" }
]
```

`GET /partners/me/payout-settings` / `PATCH /partners/me/payout-settings`
```json
{
  "method": "yape",
  "accountNumber": "987 654 321",
  "accountHolder": "Joel Coila",
  "minimumThreshold": 50
}
```

## Business Rules

- El frontend no decide cuándo se liquida un pago ni si supera el umbral — solo muestra `minimumThreshold` como información.
- El `PATCH` de datos de cobro solo envía `method` y `accountNumber` — `accountHolder`/`minimumThreshold` nunca se mandan desde este formulario.

## Acceptance Criteria

- [ ] La pestaña "Pagos" navega correctamente.
- [ ] El historial muestra fecha/concepto/monto/estado, y el estado vacío si no hay liquidaciones.
- [ ] "Próxima liquidación" muestra el mismo monto/fecha que la card equivalente del Resumen (misma fuente de datos).
- [ ] Editar datos de cobro con un número/cuenta vacío muestra el error de validación y no dispara la mutación.
- [ ] Guardar datos de cobro válidos actualiza la card sin recargar la página y muestra el toast de éxito.
- [ ] Si una de las 3 queries de la página falla, solo esa sección muestra el error — las demás siguen funcionando.

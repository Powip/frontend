# Page

Partners Admin · Liquidaciones

## Route

`/partners/admin/liquidaciones`

## Objetivo

Que el equipo de Powip pague el ciclo de comisiones a los partners, vea los reversos/clawback del ciclo, y sepa quién está esperando llegar al umbral mínimo de pago.

## UI / Layout

Server wrapper + Client Component. Grid de 2 columnas: tabla del ciclo (izquierda, con botón "Pagar todo" en el header de la card) + reversos y cola por umbral (derecha).

## Componentes

- `_components/admin-liquidations-table.tsx` — botón "Pagar" por fila, o badge "Pagado ✓" si ya se pagó.
- `_components/clawbacks-list.tsx` — lista de reversos, montos en rojo.
- `_components/threshold-queue-list.tsx` — partners que no llegan al umbral, badge "Acumula".

## Información mostrada

- Por partner: comisión de 1er mes, recurrente, total del ciclo, si ya se pagó.
- Reversos: partner, motivo, monto (negativo).
- Partners en cola por umbral: partner, monto acumulado vs umbral mínimo.

## Acciones del usuario

- **Pagar** una fila individual.
- **Pagar todo**: liquida todas las filas pendientes del ciclo de una vez. El botón muestra el total pendiente calculado (suma simple de los totales ya provistos, no una comisión derivada de %s).

## Estados

### Loading
Skeletons en la tabla principal.

### Empty
Mensaje simple si no hay liquidaciones en el ciclo, si no hay reversos, o si nadie está en la cola por umbral (sin `EmptyState` ilustrado — son listas secundarias, un texto simple alcanza).

### Error
`PartnerSectionError` independiente para las 3 queries (liquidaciones, reversos, umbral).

### Success
Datos normales.

### Mutation
- Pagar individual: botón de esa fila pasa a "Pagando..."; al terminar, la fila muestra "Pagado ✓"; toast de confirmación.
- Pagar todo: botón del header pasa a "Liquidando..."; se deshabilita si no hay nada pendiente (`pendingTotal === 0`); toast "Ciclo liquidado".

## Datos requeridos

- `AdminLiquidationRow[]`, `AdminClawback[]`, `AdminThresholdQueueItem[]` — modelos nuevos.

## Mock data

- `src/features/partners/mocks/admin-liquidations.mock.ts` (liquidaciones + reversos + cola por umbral) + `admin-liquidations.store.ts` (mutable, solo las liquidaciones tienen estado editable — reversos y cola por umbral son de solo lectura en esta ronda).

## Backend Requirements

Propuesta, no confirmada.

1. **Liquidaciones del ciclo actual**, con el total ya calculado por partner.
2. **Marcar como pagada** una liquidación individual o el ciclo completo — **BACKEND TBD**: ¿esto dispara una transferencia real (integración con Yape/Plin/banco) o solo registra que se pagó manualmente fuera del sistema? El mock asume lo segundo.
3. **Reversos/clawback** del ciclo — de solo lectura en esta página; generarlos es responsabilidad de la lógica de negocio que detecta cancelaciones/reembolsos (fuera del alcance del frontend).
4. **BACKEND TBD**: ¿"Pagar todo" debería exigir confirmación adicional (es una acción irreversible con dinero real)? El frontend no agregó un diálogo de confirmación — a decidir si backend/producto lo requiere.

## API Contract Proposal

### Request

```
GET /partners/admin/liquidations?cycle=2026-08
POST /partners/admin/liquidations/:id/pay
POST /partners/admin/liquidations/pay-all?cycle=2026-08
GET /partners/admin/clawbacks?cycle=2026-08
GET /partners/admin/threshold-queue
Authorization: Bearer <token>
```

## Business Rules

- El frontend no calcula el total a pagar — solo suma montos ya provistos por fila para mostrar el total en el botón "Pagar todo".
- Ninguna liquidación se marca como pagada sin una respuesta exitosa del backend (en producción) — el mock simula esto con el store en memoria.

## Acceptance Criteria

- [ ] La tabla muestra el ciclo actual con los 3 partners de ejemplo.
- [ ] Pagar una fila la marca como pagada sin afectar las demás.
- [ ] "Pagar todo" se deshabilita cuando no queda nada pendiente.
- [ ] Reversos y cola por umbral se muestran correctamente, sin acciones (solo lectura).
- [ ] Si una de las 3 queries falla, solo esa sección lo muestra — las demás funcionan.

# Page

Partners Admin · Cola de referidos

## Route

`/partners/admin/cola`

## Objetivo

Que el equipo de Powip revise cada referido antes de que se active su comisión: conflictos de atribución, alertas anti-fraude, y confirmación manual de pago.

## UI / Layout

Server wrapper + Client Component. Callout de advertencia arriba, luego grid de 2 columnas: cards de la cola (izquierda) + "Confirmar pago del referido" e "Invitaciones sin abrir" (derecha).

## Componentes

- `_components/review-queue-card.tsx` — la UI y las acciones disponibles cambian según `kind` (conflicto/fraude/revision/sin_conflicto). Una vez resuelto (`resolution !== "pendiente"`), la card colapsa a una fila con el badge de resolución, sin botones.
- `_components/pending-payments-table.tsx` — botón "Confirmar" por fila.
- `_components/unopened-invitations-table.tsx` — botón "Reenviar" (toast-only, no hay backend de envío de correos que mockear con sentido).
- La pestaña "Cola de referidos" del layout de Admin (`partners-admin-tabs.tsx`) muestra un badge con la cantidad de items `pendiente` — se actualiza solo cuando se resuelve un item (misma query, invalidada).

## Información mostrada

- Por cada item de la cola: negocio, partner, origen, contacto, tipo de alerta, explicación, nota (si la hay).
- Pagos pendientes de confirmar: negocio, partner, nota de estado.
- Invitaciones sin abrir: negocio, hace cuántos días se envió.

## Acciones del usuario

- **Conflicto**: Rechazar / Asignar igual.
- **Alerta anti-fraude**: Bloquear / Es legítimo.
- **En revisión**: Aprobar / Rechazar.
- **Sin conflicto**: Aprobar.
- **Confirmar pago**: activa la comisión de ese referido (mock: solo cambia el estado local, no está conectado a la activación real de comisión de otras páginas — ver limitación abajo).
- **Reenviar invitación**: sin efecto real, solo feedback visual.

## Estados

### Loading
Skeletons en las cards de la cola y en ambas tablas.

### Empty
No implementado explícitamente — con el mock actual siempre hay datos. Si `getReviewQueue()`/`getPendingPaymentConfirmations()` devuelven `[]`, las listas simplemente no renderían filas (comportamiento razonable, pero no tiene un mensaje de "todo al día" dedicado — mejora pendiente si se considera necesaria).

### Error
`PartnerSectionError` independiente para cada una de las 3 queries (cola, confirmaciones, invitaciones).

### Success
Cards y tablas con datos normales.

### Mutation
- Resolver un item de la cola: botones de esa card deshabilitados mientras se resuelve; toast con la resolución aplicada; la card colapsa al instante.
- Confirmar pago: botón de esa fila muestra "Confirmando..."; toast de éxito.

## Datos requeridos

- `ReviewQueueItem[]` — modelo nuevo.
- `PendingPaymentConfirmation[]` — modelo nuevo.
- `UnopenedInvitation[]` — modelo nuevo.

## Mock data

- `src/features/partners/mocks/review-queue.mock.ts` + `.store.ts` (mutable).
- `src/features/partners/mocks/pending-payment-confirmations.mock.ts` + `.store.ts` (mutable).
- `src/features/partners/mocks/unopened-invitations.mock.ts` (estático, sin mutación).

### Limitación conocida del mock

Confirmar el pago de un referido acá **no** actualiza el referido correspondiente en `/partners/comisiones` (vista Partner) ni en la ficha del partner en `/partners/admin/partners/[id]` — son stores mock independientes. En un backend real, confirmar el pago sería la misma operación vista desde ambos lados.

## Backend Requirements

Propuesta, no confirmada.

1. **Cola de revisión**: lista de referidos con conflicto/alerta/en revisión/sin conflicto pendientes de resolver.
2. **Resolver un item de la cola**: acción distinta según el tipo (rechazar, asignar, bloquear, verificar, aprobar) — **BACKEND TBD**: ¿es un único endpoint con un campo `resolution`, o endpoints separados por acción?
3. **Confirmar pago de un referido**: activa su comisión. Este es el punto donde el mock diverge más de un sistema real — en producción esta acción debería disparar la misma actualización que ve el partner en su propio panel.
4. **BACKEND TBD**: ¿qué reglas determinan automáticamente si un referido es "conflicto"/"fraude" vs "sin conflicto"? El mock trae la clasificación ya hecha; el motor de esas reglas es 100% responsabilidad de backend.

## API Contract Proposal

### Request

```
GET /partners/admin/review-queue
POST /partners/admin/review-queue/:id/resolve   { "resolution": "aprobado" }
GET /partners/admin/pending-payments
POST /partners/admin/pending-payments/:id/confirm
GET /partners/admin/unopened-invitations
Authorization: Bearer <token>
```

## Business Rules

- El frontend no decide si un referido es fraudulento — solo muestra la clasificación que ya viene del backend y ofrece las acciones correspondientes a esa clasificación.
- Ninguna acción de esta página calcula montos de comisión — solo cambia estados.

## Acceptance Criteria

- [ ] Cada tipo de alerta muestra exactamente los botones que le corresponden (ver "Acciones del usuario").
- [ ] Resolver un item lo colapsa a su estado final sin recargar la página.
- [ ] El badge de la pestaña "Cola de referidos" refleja la cantidad de items pendientes en tiempo real.
- [ ] Confirmar un pago actualiza esa fila a "Pagó" sin recargar la página.
- [ ] Si una de las 3 queries falla, solo esa sección muestra error — las otras dos siguen funcionando.

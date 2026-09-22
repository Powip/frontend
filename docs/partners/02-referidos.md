# Page

Partners · Mis Referidos

## Route

`/partners/referidos`

## Objetivo

Que el partner vea el listado completo de sus referidos, pueda filtrarlos por estado, registrar uno nuevo manualmente, y ver el detalle/recorrido de cada uno.

## UI / Layout

Usa el mismo `src/app/partners/layout.tsx` de la página anterior (se agregó la pestaña "Mis Referidos" al array `TABS`). No se creó un `loading.tsx`/`error.tsx` propio para esta ruta: Next.js reutiliza automáticamente el `loading.tsx`/`error.tsx` del segmento padre (`/partners`) para cualquier subruta que no defina el suyo — duplicarlos hubiera sido un archivo idéntico sin aportar nada.

- Card superior: título "Mis referidos" + botón "+ Registrar referido" + fila de filtros.
- Card inferior: tabla completa de referidos (o estado vacío/error).
- Dialog de alta de referido (se abre con el botón o desde el empty state).
- Drawer (Sheet) de detalle al hacer click en una fila: recorrido del referido + comisión.

## Componentes

- `_components/referral-filters.tsx` — botones de filtro (Todos/Pagando/Sin activar cuenta/Activó sin pagar), con `aria-pressed` para el estado activo.
- `_components/referrals-table.tsx` — tabla completa (Negocio, Origen, Fecha, Plan, Estado, 1er mes, Recurrente), filas clickeables y navegables por teclado (`tabIndex`, `Enter`/`Espacio` abren el detalle).
- `_components/register-referral-dialog.tsx` — formulario de alta (react-hook-form + zod), mismo patrón que `ManageSunatDocumentSequenceModal.tsx`.
- `_components/referral-detail-drawer.tsx` — drawer con el recorrido (timeline) y la comisión del referido seleccionado.
- `_lib/referral-filters.ts` — función pura `filterReferrals()` + catálogo de filtros, testeada de forma aislada.
- Reutiliza de la página anterior: `@/components/partners/referral-status-badge`, `@/components/partners/referral-origin-badge`, `@/components/partners/partner-section-error` (por eso se movieron de `src/app/partners/_components/` a `src/components/partners/` en esta ronda — dejaron de ser exclusivos de una sola página).

## Información mostrada

Igual que la tabla de "últimos referidos" del Resumen, pero completa y con 2 columnas más (Fecha, Plan). El detalle (drawer) agrega el recorrido paso a paso: Registrado → Correo de activación enviado → Cuenta creada → Activó un plan → Pagó (o, si canceló, los primeros 3 pasos + un paso final "Canceló · comisión detenida").

## Acciones del usuario

- Filtrar por estado (client-side, sobre la lista ya cargada).
- Registrar un referido nuevo (nombre, correo, teléfono opcional, plan) → queda con estado "Correo enviado".
- Ver el detalle de un referido (click o Enter/Espacio sobre la fila).

## Estados

### Loading
Skeletons en la tabla mientras `useReferrals()` está en `isLoading`.

### Empty
Dos casos distintos, con mensajes distintos:
- El partner no tiene **ningún** referido todavía → `EmptyState` con botón "Registrar referido".
- Tiene referidos pero el filtro activo no matchea ninguno → texto simple "No hay referidos en este filtro" (no se repite el `EmptyState` grande, sería confuso sugerir "registrar" cuando ya tiene referidos).

### Error
`PartnerSectionError` con botón "Reintentar" (`refetch()`) si `useReferrals()` falla.

### Success
Tabla con los referidos filtrados.

### Mutation (alta de referido)
- Botón de submit deshabilitado + spinner + texto "Enviando..." mientras `isPending`.
- Éxito: toast (`sonner`) "Invitación enviada a {negocio}", el dialog se cierra, el formulario se resetea, la tabla se actualiza sola (invalidación de query).
- Error: toast de error, el dialog se mantiene abierto con los datos que el usuario ya cargó (no se pierde el formulario).

## Datos requeridos

Mismo modelo `PartnerReferral` de la página anterior — no se agregó ningún campo nuevo, la ficha completa ya alcanzaba.

## Mock data

- `src/features/partners/mocks/partner-referrals.store.ts` — un store en memoria (mutable, a nivel de módulo) sembrado desde `partner-referrals.mock.ts`, con `listPartnerReferrals()` / `addPartnerReferral()` / `resetPartnerReferralsStore()` (el reset es para tests).
- **Limitación conocida del mock**: este store es independiente del mock estático que lee el Resumen (`get-partner-summary.ts`/`get-recent-referrals.ts`). Registrar un referido acá lo suma a la lista completa de esta página, pero **no** actualiza la mini-tabla "Últimos referidos" del Resumen ni sus KPIs en la misma sesión — eso requiere backend real (o una capa de mock compartida más elaborada, que no se justifica todavía).
- `src/features/partners/services/get-referrals.ts` y `register-referral.ts` son el único lugar a tocar cuando exista backend.

## Backend Requirements

Propuesta, no confirmada.

1. **Listado completo de referidos** del partner autenticado (con filtro por estado idealmente resuelto en el backend cuando el volumen crezca; hoy se filtra en el cliente porque la lista es chica).
2. **Alta de referido**: recibe nombre del negocio, correo (obligatorio, es la llave de invitación), teléfono (opcional), plan de interés. Dispara el correo de activación. Responde con el referido creado en estado inicial.
3. **BACKEND TBD**: ¿qué pasa si el correo ya existe como referido de otro partner o como cliente directo? (el mockup original contemplaba "conflicto de atribución" — no lo implementamos acá porque es lógica de revisión que le compete a la vista Admin, fuera de esta ronda).
4. **BACKEND TBD**: ¿el alta de referido devuelve inmediatamente el referido creado (síncrono) o queda en un estado "pendiente de validar" hasta que un proceso backend lo confirme?

## API Contract Proposal

### Request

```
GET /partners/me/referrals
Authorization: Bearer <token>
```

```
POST /partners/me/referrals
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessName": "Zapatería Andes",
  "email": "andes@mail.com",
  "phone": "+51 987654321",
  "planValue": "standard"
}
```

### Response

`GET /partners/me/referrals` → mismo shape que `GET /partners/me/referrals?limit=5` del Resumen, sin el parámetro `limit`.

`POST /partners/me/referrals`
```json
{
  "id": "ref-abc123",
  "businessName": "Zapatería Andes",
  "origin": "manual",
  "status": "correo_enviado",
  "registeredAt": "2026-08-17",
  "planName": "Standard",
  "firstMonthCommission": null,
  "recurringCommission": null
}
```

## Business Rules

- El frontend no calcula comisiones — un referido recién creado siempre tiene `firstMonthCommission`/`recurringCommission` en `null` hasta que backend confirme el pago.
- `origin` de un referido dado de alta manualmente por el partner es siempre `"manual"` — no elegible por el usuario en el formulario (a diferencia de `"link"`/`"codigo"`, que se generan solos según cómo entró el negocio).
- **BACKEND TBD**: reglas de duplicados/atribución (referido ya existente, auto-referido) — no implementadas en esta página, quedan para la cola de revisión de la vista Admin.

## Acceptance Criteria

- [ ] `/partners/referidos` requiere sesión iniciada (mismo `ROUTE_PERMISSIONS["/partners"]` que ya cubre todo el prefijo `/partners/*`).
- [ ] La pestaña "Mis Referidos" aparece en la barra de tabs del layout y navega correctamente.
- [ ] Los 4 filtros muestran el subconjunto correcto de referidos y el filtro activo es visualmente distinguible sin depender solo del color (cambia de `outline` a relleno sólido).
- [ ] Registrar un referido con el formulario válido: crea el referido, muestra el toast de éxito, cierra el dialog y lo suma a la tabla sin recargar la página.
- [ ] Registrar con el correo vacío o inválido: muestra el error de validación y no dispara la mutación.
- [ ] Click o Enter/Espacio en una fila abre el drawer con el recorrido correcto según el estado del referido.
- [ ] Si `useReferrals()` falla, se muestra `PartnerSectionError` con "Reintentar".
- [ ] La tabla es usable en mobile (scroll horizontal del contenedor de `ui/table.tsx`, filtros con `flex-wrap`).

# Page

Partners Admin · Partners (listado + ficha)

## Route

`/partners/admin/partners` (listado)
`/partners/admin/partners/[partnerId]` (ficha)

## Objetivo

Que el equipo de Powip vea todos los partners del programa, invite nuevos, apruebe los que están pendientes, y pueda entrar al detalle de cualquiera.

## UI / Layout

Ambas rutas son Server wrapper + Client Component, dentro del `layout.tsx`/tabs de `/partners/admin`.

**Listado**: card con tabla completa + botón "+ Invitar partner" (abre dialog).

**Ficha** (`[partnerId]`): link "Volver a Partners" + header (avatar, nombre, badges de nivel/estado, meta) + 6 KPIs + tabs (Referidos / Actividad).

## Componentes

**Listado**:
- `_components/admin-partners-table.tsx` — botón "Aprobar" si `status: "por_aprobar"`, si no "Ver ficha".
- `_components/admin-partner-status-badge.tsx` — 3 estados (Activo/Por aprobar/Rechazado).
- `_components/invite-partner-dialog.tsx` — formulario (react-hook-form + zod).

**Ficha**:
- `_components/partner-detail-header.tsx`, `partner-detail-kpis.tsx`.
- `_components/partner-referrals-tab.tsx` — tabla completa de referidos del partner, con columnas de comisión.
- `_components/partner-activity-tab.tsx` — timeline derivado de datos reales (último referido registrado, nivel actual, fecha de alta) — **no es un log de eventos real**, es un resumen calculado a partir de lo que ya se tiene, hasta que exista un endpoint de actividad.

Comparten `@/components/partners/partner-tier-badge.tsx` (nuevo, reutilizable) con la vista Partner si en el futuro se necesita mostrar el nivel ahí también.

## Información mostrada

**Listado**: nombre/handle, perfil, código, opción, nivel, cantidad de referidos (total y activos), MRR, estado.

**Ficha**: todo lo anterior + ticket promedio, comisión recurrente mensual del partner, % de conversión, LTV estimado, y el detalle completo de sus referidos (negocio, origen, fecha, plan, modalidad, comisión 1er mes/recurrente, estado).

## Acciones del usuario

- **Invitar partner**: nombre/marca, email, perfil, opción sugerida → crea un partner en estado "por_aprobar".
- **Aprobar partner**: asigna código (si no tenía) y opción de comisión (C para creadores, A para el resto — **BACKEND TBD**: esta regla de asignación automática es una suposición del frontend, a confirmar).

## Estados

### Loading
Skeletons en tabla, header y KPIs.

### Empty
`EmptyState` si no hay ningún partner (listado) o ningún referido (tab Referidos de la ficha).

### Error
`PartnerSectionError` en listado y en cada sección de la ficha (header/KPIs dependen de `useAdminPartner`, la tab de Referidos de `useAdminPartnerReferrals`, independientes entre sí).

### Success
Datos normales.

### Mutation
- Invitar: botón deshabilitado + "Enviando..." mientras `isPending`; toast de éxito/error; el dialog se cierra y la lista se actualiza sola (invalidación).
- Aprobar: botón de esa fila muestra "Aprobando..." (estado local por fila, no bloquea el resto de la tabla); toast con el código asignado.

## Datos requeridos

- `AdminPartner` — modelo nuevo, entidad central reutilizada por Dashboard, listado y ficha.
- `AdminPartnerReferral[]` — modelo nuevo, específico de la ficha (más rico que `PartnerReferral` de la vista Partner: incluye `billingCycle` y comisión ya calculada).

## Mock data

- `src/features/partners/mocks/admin-partners.mock.ts` + `admin-partners.store.ts` (mutable, soporta aprobar/invitar en la sesión).
- `src/features/partners/mocks/admin-partner-referrals.mock.ts` — referidos de 3 de los 5 partners de ejemplo (los otros 2 no tienen referidos porque están "por_aprobar"/"rechazado").

## Backend Requirements

Propuesta, no confirmada.

1. **Listado de partners** con sus métricas agregadas ya calculadas (MRR, ticket promedio, conversión, LTV, comisión recurrente mensual) — el frontend no las deriva.
2. **Ficha de un partner** por id, con sus referidos detallados.
3. **Invitar partner**: crea el registro y dispara el correo de invitación.
4. **Aprobar partner**: **BACKEND TBD** — ¿quién decide el código y la opción de comisión al aprobar? Hoy el frontend lo infiere del perfil (creador→C, resto→A), una regla que probablemente debería vivir en backend o ser explícita en el formulario de aprobación.
5. **BACKEND TBD**: endpoint de actividad real del partner (hoy la tab "Actividad" es derivada, no un log real).

## API Contract Proposal

### Request

```
GET /partners/admin/partners
GET /partners/admin/partners/:id
GET /partners/admin/partners/:id/referrals
POST /partners/admin/partners/invite
POST /partners/admin/partners/:id/approve
Authorization: Bearer <token>
```

### Response

`GET /partners/admin/partners` → array de `AdminPartner`.

`POST /partners/admin/partners/:id/approve`
```json
{ "id": "partner-carlos-ruiz", "status": "activo", "code": "CARLOS10", "commissionOptionCode": "C", "joinedAt": "2026-09-23" }
```

## Business Rules

- El frontend no calcula MRR, ticket promedio, conversión ni LTV — son campos que el backend debe entregar ya resueltos.
- La comisión de cada referido en la tab "Referidos" de la ficha se muestra tal cual llega — nunca se deriva de un %.

## Acceptance Criteria

- [ ] El listado muestra los 5 partners de ejemplo con su estado correcto.
- [ ] Invitar con datos válidos agrega el partner a la lista sin recargar la página.
- [ ] Aprobar un partner "por_aprobar" lo pasa a "activo" con código y opción asignados, visible al instante.
- [ ] La ficha de un partner inexistente muestra "No encontramos este partner" en vez de romper.
- [ ] La tab "Referidos" de la ficha muestra las mismas columnas de comisión que `/partners/comisiones` de la vista Partner (consistencia visual entre ambas vistas).

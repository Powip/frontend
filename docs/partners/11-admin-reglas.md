# Page

Partners Admin · Reglas & Comisiones

## Route

`/partners/admin/reglas`

## Objetivo

Que el equipo de Powip configure las comisiones por opción, los tramos de nivel, el descuento a referidos y las reglas generales del programa — el módulo de control de todo el feature.

## UI / Layout

Server wrapper + Client Component. Callout explicativo arriba, luego grid de 2 columnas: editor de comisiones (izquierda) + descuento, reglas y plantillas de correo (derecha).

## Componentes

- `_components/commission-rules-editor.tsx` — tabla editable (opción A/C/B: % 1er mes y % recurrente) + tabla de tramos por nivel (Bronce fijo en 0, Plata/Oro editables), con un botón "Guardar comisiones" que persiste ambas tablas juntas.
- `_components/discount-settings-card.tsx` — % de descuento, duración, quién lo asume — cada cambio guarda al instante. Incluye una alerta de rentabilidad que reutiliza `estimateFirstMonthCommission` (la misma función del simulador de `/partners/plan`) sobre un plan de referencia (Standard, S/ 189) para avisar si la comisión + el descuento dejan el primer mes en negativo.
- `_components/program-rules-card.tsx` — toggles (auto-aprobar sin conflicto, bloquear auto-referido), selects (ventana de atribución, expiración de invitación) y umbral mínimo — cada cambio guarda al instante.
- `_components/email-templates-card.tsx` — 3 plantillas, cada una abre un dialog con asunto/cuerpo editable. **No persiste nada realmente** (ni en el mock) — mismo comportamiento que tenía la referencia visual original, que tampoco guardaba el contenido, solo mostraba el flujo. Si el negocio necesita plantillas editables de verdad, hace falta modelarlas con un contenido persistente.

## Información mostrada

- % de comisión de 1er mes y recurrente por opción (A/C/B).
- Umbral de MRR y % extra por nivel (Bronce/Plata/Oro).
- Configuración de descuento vigente.
- Reglas del programa (auto-aprobación, anti-fraude, ventanas de tiempo, umbral mínimo).

## Acciones del usuario

- Editar y guardar comisiones por opción + tramos por nivel (guardado explícito, un botón).
- Editar descuento, duración y quién lo asume (guardado instantáneo por campo).
- Prender/apagar reglas y ajustar ventanas/umbral (guardado instantáneo).
- Abrir y "guardar" una plantilla de correo (sin persistencia real, ver arriba).

## Estados

### Loading
Skeleton en cada card mientras `useAdminCommissionSettings()` carga (una sola query alimenta las 3 cards principales).

### Empty
No aplica — es un formulario de configuración, siempre tiene valores.

### Error
`PartnerSectionError` a nivel de página si la query de configuración falla (bloquea las 3 cards, ya que todas dependen del mismo dato).

### Success
Formularios con los valores actuales.

### Mutation
- Guardar comisiones: botón "Guardando..." mientras `isPending`; toast "Comisiones guardadas · aplicadas a nuevos referidos".
- Cambios de descuento/reglas: cada campo dispara su propia mutación con un toast corto ("Regla actualizada", etc.), igual que la referencia visual original (sin un botón de guardado general para estos, siguiendo el mismo patrón de guardado instantáneo).

## Datos requeridos

- `AdminCommissionSettings` — modelo nuevo, agrupa comisiones por opción, tramos por nivel, descuento y reglas del programa en un solo recurso (mismo criterio que `PayoutSettings` en la vista Partner: un solo GET/PATCH en vez de 4 endpoints separados).

## Mock data

- `src/features/partners/mocks/admin-commission-settings.mock.ts` + `.store.ts` (mutable, con merge parcial — cada sección de la página actualiza solo su parte del objeto).

## Backend Requirements

Propuesta, no confirmada.

1. **Configuración completa del programa** en un solo recurso (comisiones, tramos, descuento, reglas) — **BACKEND TBD**: ¿backend prefiere endpoints separados por sección en vez de un objeto único? El frontend ya está preparado para cualquiera de los dos (el merge parcial en el mock simula bien un PATCH único, pero separar en varios `PATCH` por sección tampoco requeriría rehacer la UI).
2. **BACKEND TBD**: ¿guardar comisiones nuevas afecta solo a referidos futuros, o también recalcula comisiones de referidos ya activos? El callout de la página asume que solo aplica "a los nuevos referidos" — a confirmar que esa es la regla real.
3. **Plantillas de correo con contenido real**: hoy no hay modelo de persistencia, es la pieza más incompleta de esta página — si el negocio las necesita funcionales, es un desarrollo aparte (probablemente con su propio CRUD).

## API Contract Proposal

### Request

```
GET /partners/admin/commission-settings
PATCH /partners/admin/commission-settings
Authorization: Bearer <token>
Content-Type: application/json

{ "discount": { "pct": 15, "duration": "primer_mes", "assumedBy": "powip" } }
```

### Response

```json
{
  "commissionRules": [{ "code": "A", "firstMonthPct": 40, "recurringPct": 6 }],
  "tierThresholds": [{ "level": "plata", "fromMrr": 500, "extraResidualPct": 1 }],
  "discount": { "pct": 10, "duration": "primer_mes", "assumedBy": "powip" },
  "programRules": { "autoApproveLinkWithoutConflict": true, "blockSelfReferral": true, "attributionWindowDays": 60, "invitationExpirationDays": 30, "minimumPayoutThreshold": 50 }
}
```

## Business Rules

- La alerta de rentabilidad es informativa, calculada sobre un plan de referencia fijo (Standard) — no valida contra todos los planes ni bloquea el guardado, solo advierte.
- El frontend nunca decide reglas de negocio nuevas — todos los valores por defecto vienen del mock, listos para ser reemplazados por lo que backend confirme.

## Acceptance Criteria

- [ ] Editar un % de comisión y guardar actualiza el valor mostrado en toda la sesión (por ejemplo, en `/partners/plan` de la vista Partner, si comparte el mismo query key — **nota**: en esta ronda `/partners/plan` usa su propio `useCommissionOptions()`, con un mock separado; unificarlos es un refinamiento pendiente si se considera necesario).
- [ ] Cambiar el descuento a un valor que deja el primer mes en negativo muestra la alerta roja; un valor rentable muestra la confirmación verde.
- [ ] Cada toggle/select de "Reglas & correos" guarda al cambiar, sin necesidad de un botón aparte.
- [ ] Abrir una plantilla de correo pre-carga su asunto; "Guardar" cierra el dialog y muestra el toast, sin pretender que el contenido persiste.

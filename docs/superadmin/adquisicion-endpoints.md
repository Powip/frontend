# Adquisición — contrato de endpoints (leads/CRM)

> A diferencia del Dashboard, acá **sí existe backend real** — el mini-CRM viejo sobre Supabase (`leads`, `landing_leads`, `lead_activities`) sigue vivo bajo `src/app/api/superadmin/leads/**`, `pipeline/summary`, `conversion-funnel`. El frontend de `/superadmin/adquisicion` ya está conectado a él vía `src/hooks/superadmin/useAdquisicion.ts`.
>
> Este documento no es una lista de endpoints por construir de cero (como el de Dashboard) — es un **diff entre lo que el frontend necesita y lo que el backend real ya da**, más un pedido concreto de arreglo de rendimiento que es más urgente que cualquier feature nueva.

## 🔴 Urgente — arreglar antes que cualquier feature nueva

### `GET /api/superadmin/leads` trae la tabla completa a memoria

Hoy: hace `SELECT *` de `leads` **sin `.range()`**, hace lo mismo con `landing_leads`, mergea y deduplica por teléfono en JS, y recién ahí corta con `.slice(offset, offset+limit)`. Con cientos de miles de leads esto se cae — cada request carga la tabla entera en la función serverless.

**Pedido concreto**: paginar en la base, como ya hace `GET /api/superadmin/businesses` (`.range(offset, offset+limit-1)` + `count: 'exact'`). El merge con `landing_leads` complica la paginación exacta (son dos tablas distintas) — opciones, de más simple a más prolija:
1. Dejar de mergear en cada `GET /leads` — migrar `landing_leads` a `leads` en batch (job único) y que `GET /leads` sea un solo `SELECT` paginado. Es lo más simple y lo recomendado.
2. Si se necesita mantener separado: paginar cada tabla por su cuenta y exponer un flag `source=landing` para filtrar explícitamente, en vez de mergear siempre.

También: `GET /leads/activations` y `GET /leads/postventa` no paginan en absoluto — mismo arreglo (`.range()`) cuando ese volumen crezca.

### `POST /leads` no dedupea

La spec pide "advertir si ya existe" por email/whatsapp al crear un lead manual. Hoy el `POST` insertá sin chequear — solo el importador Excel (`/leads/import`) hace `upsert(onConflict: phone_whatsapp)`. Pedido: mismo chequeo en el alta manual (409 con el lead existente, o al menos un warning en la respuesta).

---

## 🟢 Ya real y ya conectado (referencia)

| Necesidad del frontend | Endpoint real | Notas |
|---|---|---|
| Listar leads (bandeja, kanban, lista, filtros) | `GET /api/superadmin/leads?stage&source&assigned_to&search&page&limit` | Ver el problema de paginación arriba |
| Crear lead ("Nuevo Prospecto") | `POST /api/superadmin/leads` | Solo exige `contact_name`+`phone_whatsapp`; el resto de los campos del modal (`plan_interest`, `orders_per_day`, etc.) hoy **no los acepta el insert** — ver sección de campos faltantes |
| Detalle + timeline de un lead | `GET /api/superadmin/leads/{id}` | Devuelve `activities: lead_activities(*)` embebido y ordenado desc |
| Cambiar de etapa (mover kanban, marcar perdido) | `PATCH /api/superadmin/leads/{id}/stage` | Body `{new_stage, old_stage, performed_by}`, loguea actividad sola |
| Registrar gestión/nota | `POST /api/superadmin/leads/{id}/activity` | Body `{activity_type, description, performed_by?, metadata?}` — ver mapeo de campos abajo |
| Actualizar campos sueltos (`next_action`, `next_action_date`, etc.) | `PATCH /api/superadmin/leads/{id}` | Update genérico, cualquier columna |
| Convertir lead en empresa | `POST /api/superadmin/leads/{id}/activate` | RPC `activate_lead_v3` — transaccional, ya resuelto en backend |
| Rendimiento por SDR | `GET /api/superadmin/pipeline/summary` | `salesperson_breakdown: [{salesperson, managed_leads, closed_leads}]` — falta `demos` y `cpl` (ver abajo) |
| Embudo comercial | `GET /api/superadmin/conversion-funnel` | Ya usado por el Dashboard también |

### Bodies reales (leídos de cada `route.ts`, no inventados)

**Listar leads**
```
GET /api/superadmin/leads?stage=nuevo&source=whatsapp&assigned_to=Heidy%20Medina&search=bella&page=1&limit=20
```
```jsonc
{
  "data": [
    {
      "id": "3f2b6b0a-2e2a-4c9a-9c1e-3a1a2f9c0b11",
      "contact_name": "Rosa Delgado",
      "business_name": "Bella Piel Cosmética",
      "phone_whatsapp": "+51987654321",
      "email": "rosa@bellapiel.pe",
      "source": "whatsapp",
      "pipeline_stage": "nuevo",
      "plan_interest": "Pro",
      "orders_per_day": 12,
      "courier": "Shalom",
      "interested_in": "Automatizar pedidos por WhatsApp",
      "assigned_to": "Heidy Medina",
      "observations": "Vende maquillaje, pidió demo",
      "city": "Lima",
      "next_action": "Llamar para agendar demo",
      "next_action_date": "2026-08-26T15:00:00.000Z",
      "created_at": "2026-08-20T14:32:10.000Z",
      "updated_at": "2026-08-22T09:10:00.000Z",
      "is_landing": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 134, "total_pages": 7 }
}
```
Nota: hoy `limit` default es `500` (no 20) porque el backend pagina en memoria (ver problema de rendimiento arriba) — el frontend igual manda `limit=20` explícito.

**Crear lead**
```
POST /api/superadmin/leads
```
**Body:**
```jsonc
{
  "contact_name": "Rosa Delgado",
  "business_name": "Bella Piel Cosmética",
  "phone_whatsapp": "+51987654321",
  "email": "rosa@bellapiel.pe",
  "source": "whatsapp"
}
```
**Response** (201 — el insert solo persiste estas 5 columnas + `pipeline_stage: "nuevo"` fijo; el resto del modal se manda después via `PATCH /leads/{id}` y `POST /leads/{id}/activity`, ver `useCreateLead` en el hook):
```jsonc
{
  "message": "Lead created successfully",
  "data": {
    "id": "3f2b6b0a-2e2a-4c9a-9c1e-3a1a2f9c0b11",
    "contact_name": "Rosa Delgado",
    "business_name": "Bella Piel Cosmética",
    "phone_whatsapp": "+51987654321",
    "email": "rosa@bellapiel.pe",
    "source": "whatsapp",
    "pipeline_stage": "nuevo",
    "updated_at": "2026-08-24T18:00:00.000Z"
  }
}
```

**Detalle + timeline de un lead**
```
GET /api/superadmin/leads/{id}
```
```jsonc
{
  "id": "3f2b6b0a-2e2a-4c9a-9c1e-3a1a2f9c0b11",
  "contact_name": "Rosa Delgado",
  "business_name": "Bella Piel Cosmética",
  "phone_whatsapp": "+51987654321",
  "email": "rosa@bellapiel.pe",
  "source": "whatsapp",
  "pipeline_stage": "demo_agendada",
  "plan_interest": "Pro",
  "orders_per_day": 12,
  "next_action": "Realizar demo",
  "next_action_date": "2026-08-26T15:00:00.000Z",
  "created_at": "2026-08-20T14:32:10.000Z",
  "updated_at": "2026-08-22T09:10:00.000Z",
  // devuelto plano (sin wrapper `{data}`) — la ruta hace NextResponse.json(lead) directo
  "activities": [
    {
      "id": "a1c9e2f0-...",
      "lead_id": "3f2b6b0a-2e2a-4c9a-9c1e-3a1a2f9c0b11",
      "activity_type": "status_change",
      "old_stage": "contactado",
      "new_stage": "demo_agendada",
      "description": "Stage changed from contactado to demo_agendada",
      "performed_by": "Heidy Medina",
      "metadata": {},
      "created_at": "2026-08-22T09:10:00.000Z"
    },
    {
      "id": "b2d0f3a1-...",
      "lead_id": "3f2b6b0a-2e2a-4c9a-9c1e-3a1a2f9c0b11",
      "activity_type": "other",
      "description": "[WhatsApp] Interesado — Preguntó por el plan Pro, pidió demo",
      "performed_by": "Heidy Medina",
      "metadata": {},
      "created_at": "2026-08-21T11:00:00.000Z"
    }
  ]
}
```

**Cambiar de etapa**
```
PATCH /api/superadmin/leads/{id}/stage
```
**Body:**
```jsonc
{ "new_stage": "demo_agendada", "old_stage": "contactado", "performed_by": "Heidy Medina" }
```
**Response:**
```jsonc
{
  "message": "Stage updated successfully",
  "data": { "id": "3f2b6b0a-...", "pipeline_stage": "demo_agendada", "updated_at": "2026-08-24T18:05:00.000Z" /* ...resto del lead */ }
}
```

**Registrar gestión/nota**
```
POST /api/superadmin/leads/{id}/activity
```
**Body:**
```jsonc
{
  "activity_type": "other",
  "description": "[WhatsApp] Interesado — Preguntó por el plan Pro, pidió demo",
  "performed_by": "Heidy Medina",
  "metadata": {}
}
```
**Response:**
```jsonc
{
  "message": "Activity logged successfully",
  "data": {
    "id": "b2d0f3a1-...",
    "lead_id": "3f2b6b0a-...",
    "activity_type": "other",
    "description": "[WhatsApp] Interesado — Preguntó por el plan Pro, pidió demo",
    "performed_by": "Heidy Medina",
    "metadata": {},
    "created_at": "2026-08-24T18:10:00.000Z"
  }
}
```

**Actualizar campos sueltos**
```
PATCH /api/superadmin/leads/{id}
```
**Body** (cualquier columna real de `leads`, ej. desde "Agendar demo"):
```jsonc
{ "next_action": "Realizar demo", "next_action_date": "2026-08-26T15:00:00.000Z", "assigned_to": "Heidy Medina" }
```
**Response** (devuelve el lead completo actualizado, sin wrapper — `NextResponse.json(data)` directo, mismas columnas que el ejemplo de "Detalle" arriba).

**Convertir lead en empresa**
```
POST /api/superadmin/leads/{id}/activate
```
**Body:** `{}` (sin payload — la ruta ni siquiera lee el body, solo el `{id}` de la URL)

**Response** (RPC `activate_lead_v3`; el frontend solo confirma `data.success`/`data.error` — el resto de las columnas que devuelva la RPC no está documentado en el código, así que no se inventan acá):
```jsonc
{ "success": true /* + posibles campos propios de la RPC no visibles desde el frontend, ej. empresaId/userId creados */ }
```
En error: `{ "success": false, "error": "mensaje" }` (mapeado a HTTP 400 por la ruta).

**Rendimiento por SDR**
```
GET /api/superadmin/pipeline/summary
```
```jsonc
{
  "leads_this_month": 42,
  "leads_previous_month": 35,
  "closed_this_month": 6,
  "closed_previous_month": 4,
  "effectiveness": 18.5,
  "states_count": {
    "nuevo": 20, "contactado": 15, "respondio": 8,
    "demo_pendiente": 3, "demo_agendada": 4, "demo_realizada": 2,
    "pendiente_decision": 5, "pendiente_pago": 2, "pago_recibido": 6,
    "cerrado": 10, "perdido": 12, "cancelado": 1
  },
  "salesperson_breakdown": [
    { "salesperson": "Heidy Medina", "managed_leads": 48, "closed_leads": 9 },
    { "salesperson": "No asignado", "managed_leads": 12, "closed_leads": 0 }
  ],
  "contact_count": 88,
  "close_rate": 18.5,
  "closed_count": 16
}
```

**Embudo comercial**
```
GET /api/superadmin/conversion-funnel
```
```jsonc
{ "leads": 134, "prospects": 61, "closed": 16, "active": 52 }
```

---

## 🟡 Campos que el frontend quiere mostrar/editar y la tabla `leads` no tiene

La spec de Adquisición pide estos campos en el modal "Nuevo Prospecto" y en la ficha del lead. Hoy **no existen como columna** en `leads` (confirmado revisando cada route.ts, no solo el tipo TS declarado):

| Campo pedido por la spec | Estado |
|---|---|
| `rubro` (categoría del negocio) | No existe. `business_type` está declarado en el tipo TS del servicio pero ninguna ruta lo lee/escribe — probablemente una columna vieja sin usar o nunca migrada. |
| `canalesVenta` (dónde vende: WhatsApp/Web/TikTok/...) | No existe. |
| `tipoProductos` (qué vende) | No existe. |
| `motivoPerdida` | No existe ninguna columna `lost_reason`. Hoy si se pierde un lead, la única traza es la actividad de `status_change` con `new_stage: 'perdido'` — el motivo, si se guarda, queda como texto libre dentro de `description`, no estructurado. |

**Mientras tanto**: el frontend arma esos campos en el formulario igual (para no perder el dato del usuario) y los concatena dentro del `description` de la actividad inicial (`POST /leads` no los acepta, así que van como nota). Si el backend agrega estas 4 columnas a `leads`, es un cambio de una tarde — el frontend ya tiene el formulario armado, solo hay que dejar de concatenar y mandarlos directo en el `POST`.

---

## 🟡 "Gestión" real es más plana que la spec

La spec pide `gestion` con campos estructurados: `via` (Llamada/WhatsApp/Email/Demo/Visita), `resultado` (Contestó/Interesado/Objeción/...), `texto`, `proximaAccion`, `proximaFecha`. La tabla real `lead_activities` tiene: `activity_type` (string libre), `description` (texto libre), `performed_by`, `metadata` (jsonb, sin usar hoy), `created_at`.

**Cómo lo resolvimos sin esperar al backend**: el frontend arma `description` como `"[{via}] {resultado} — {texto}"` (todo queda legible en el timeline igual), y usa el campo real `next_action`/`next_action_date` de `leads` (que sí existe) para la "próxima acción" — eso sí es 100% real y estructurado, no hace falta nada nuevo ahí.

**Si quieren la spec al pie de la letra**: agregar 2 columnas a `lead_activities` (`via`, `resultado`, ambos enums cortos) sería suficiente — no hace falta rediseñar la tabla, con eso el frontend deja de concatenar texto.

---

## 🔴 Demos como entidad propia — no existe, es la brecha más grande

No hay tabla `demos` ni nada parecido. Lo que existe:
- `pipeline_stage` con 3 sub-etapas de demo (`demo_pendiente`, `demo_agendada`, `demo_realizada`) — sirve para el flujo agendar→resultado.
- `demo_scheduled_at`, columna suelta en `leads`, la escribe **solo** el webhook de Calendly (`/api/webhooks/calendly`) — un timestamp único, sin hora separada, sin SDR, sin tipo (venta/onboarding), sin reagendado (se pisa si cambia).

**Cómo lo resolvimos sin tabla nueva**: "Agendar demo" desde la UI hace `PATCH /leads/{id}/stage` (→ `demo_agendada`) + `PATCH /leads/{id}` (`next_action: "Realizar demo"`, `next_action_date: <fecha+hora elegida>`) + una actividad con el SDR y tipo en el texto. Es real y persiste, pero no queda queryable como "todas las demos de esta semana" sin traer leads uno por uno. El listado de "Demos" en el frontend hoy filtra leads por esas 3 etapas — funciona, pero no tiene fecha/hora confiable salvo que venga de Calendly.

**Si en algún momento se justifica una tabla `demos` propia** (fecha, hora, sdr_id, tipo, estado, resultado, lead_id): recién ahí el frontend puede mostrar un calendario real de demos por SDR. No es urgente mientras el volumen de demos sea manejable vía el filtro de `pipeline_stage`.

---

## 🔴 Origen & CAC — necesita datos que no existen en ningún lado

La tabla "Origen & CAC" de la spec (leads/cierres/conversión/inversión/CPL/CPD/CAC por canal) necesita dos cosas que no existen:

1. **Conteo de leads/cierres por canal (`source`)** — se puede resolver barato: `pipeline/summary` ya agrupa por `states_count` (etapa) y `salesperson_breakdown` (vendedor); falta un `source_breakdown` análogo, mismo patrón, una tarde de trabajo.
2. **Inversión por canal/fecha** — esto no existe en ningún lado, ni siquiera una tabla. La spec (Sección 8.2.1) pide `POST /inversion` para cargar el gasto en pauta por canal/fecha (equivalente a la hoja "KPI DIARIO" que usaban antes en Excel). Sin esto, CPL/CPD/CAC no se pueden calcular — son `inversión / algo`, y la inversión no está en ningún lado. Es la pieza que más valor movería (CAC es la pregunta que más le importa al CEO según la spec) pero es 100% a construir: tabla `inversion_canal (canal, fecha, monto)` + endpoint de carga + el `source_breakdown` de arriba para el denominador.

Mientras tanto, "Rendimiento por SDR" **sí** funciona real (via `pipeline/summary`), pero sin `demos` (no hay conteo de demos por SDR sin la tabla de demos) ni `cpl` (sin inversión) — el frontend directamente no muestra esas dos columnas hasta que haya de dónde sacarlas, en vez de inventarlas.

**Endpoint propuesto** (el frontend ya apunta acá, hoy 404 y muestra la card en rojo — `src/hooks/superadmin/useAdquisicion.ts`, `useOrigenCac`):

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/adquisicion/origen-cac
```

```jsonc
[
  { "canal": "ADS WhatsApp", "leads": 142, "cierres": 18, "conversionPct": 12.7, "inversion": 5200, "cpl": 36.6, "cpd": 92, "cac": 288.9 }
]
```

Bloqueado por el `source_breakdown` (para `leads`/`cierres`/`conversionPct`) y la tabla `inversion_canal` (para `inversion`/`cpl`/`cpd`/`cac`) descriptos arriba.

---

## Decisiones tomadas en el frontend por el problema de rendimiento

Mientras `GET /leads` no pagine en la base (ver arriba), el frontend evita agravar el problema:

- **"Exportar filtrado" de la spec se volvió "Exportar página"**: exporta solo las filas que ya están cargadas en pantalla (paginadas, acotadas), no todo el resultado filtrado — traer "todo lo filtrado" hoy significa la misma query sin límite que ya es lenta. El botón "BBDD completa" en cambio sí trae todo, pero delega en `GET /api/superadmin/reports/crm/excel`, que genera el archivo en el servidor (no en el navegador) — es el patrón correcto para exports grandes.
- **No hay filtro de período (Hoy/7d/30d/Todo)**: `GET /leads` no acepta rango de fechas, y combinarlo del lado del cliente rompería la paginación (no se puede filtrar por fecha después de paginar). Si se agrega `desde`/`hasta` como query params en el backend, agregar el filtro en el frontend es inmediato.
- **Kanban pide cada etapa por separado, acotada** (`limit=30` por columna) en vez de traer todo el pipeline sin filtro — son 12 llamadas paralelas en vez de 1, pero cada una liviana; es preferible a una sola llamada que traiga miles de filas para agrupar en el navegador.

## Resumen para planificar

| Ítem | Prioridad | Esfuerzo estimado |
|---|---|---|
| Paginar `GET /leads` en la base (no en memoria) | 🔴 Urgente | Media — el merge con `landing_leads` complica, pero migrar esa tabla lo simplifica |
| Dedupe en `POST /leads` | 🔴 Urgente | Baja — mismo patrón que `import` |
| `source_breakdown` en `pipeline/summary` | 🟡 Alto valor | Baja |
| Columnas `rubro`, `canales_venta`, `tipo_productos`, `lost_reason` en `leads` | 🟡 Medio | Baja |
| `via`/`resultado` en `lead_activities` | 🟢 Nice-to-have | Baja |
| Tabla `inversion_canal` + endpoint de carga | 🔴 Alto valor, alto esfuerzo | Alta — es lo que habilita CAC real |
| Tabla `demos` propia | 🟢 Nice-to-have, no urgente | Alta |

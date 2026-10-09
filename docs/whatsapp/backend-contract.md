# Notificaciones por WhatsApp (Hito 1) — contrato de backend

Fecha: 2026-10-08. Rama: `feat/whatsapp-notificaciones` (base `main` @ `a898173`).

Este documento reúne lo que el frontend necesita del backend para el Hito 1. Las pantallas lo referencian por ID (`C-xx`). El detalle por pantalla, pestaña y modal está en [`screens/`](screens/README.md).

> **Ningún endpoint `/wa/...` existe hoy.** Se buscó en `src/` de `main` y en todas las ramas remotas (`git grep` de `waba`, `/wa/`, `wa_templates`, `whatsapp-notif`): cero resultados. Todo lo marcado como SPEC o PROPUESTA es una propuesta hasta que backend entregue OpenAPI o una prueba de contrato.

## Convenciones de estado

| Etiqueta | Significado |
|---|---|
| **CONFIRMADO** | El frontend ya lo usa hoy contra un servicio real. Se cita archivo y línea. Prueba lo que el frontend espera, no lo que el backend garantiza. |
| **SPEC** | Aparece en el PDF (§10.3 "Endpoints internos de POWIP (propuesta)") o en las notas para devs del mockup. El propio PDF lo llama propuesta. |
| **PROPUESTA** | Lo sugiere este documento porque una pantalla lo necesita y el PDF no lo define. Se puede adaptar a lo que backend prefiera; no hay que implementar dos rutas equivalentes. |
| **SIN DEFINIR** | Dependencia que ni el PDF ni el repositorio resuelven. Requiere decisión antes de diseñar el contrato. |

Las formas JSON usan `camelCase` (como los DTO actuales de `src/features/*`). El PDF usa `snake_case` para columnas de base de datos; el mapeo es responsabilidad de backend.

---

## C-00 · Reglas transversales

### C-00.1 Servicio y URL base — SIN DEFINIR

- El PDF no dice qué microservicio expone `/wa/...` (opciones: `ms-integrations`, un `ms-whatsapp` nuevo, `ms-ventas`).
- `src/lib/api.ts` no tiene entrada para WhatsApp. El frontend propone `API.whatsapp = process.env.NEXT_PUBLIC_API_WHATSAPP` y toda llamada pasará por `src/features/whatsapp/api/*.api.ts`, de modo que cambiar de servicio sea un cambio de una línea.
- Mientras la variable no exista o el contrato no esté marcado como disponible, el frontend **no llama** al endpoint y muestra "pendiente de integración" (ver [frontend-plan.md §6](frontend-plan.md#6-revisión-sin-backend)).
- Estado en el código (etapa 2): el registro `src/features/whatsapp/constants/whatsapp-contracts.ts` replica los estados de este documento (C-E1 a C-E8 `confirmed`, C-E8 agregado en la etapa 4; el resto `proposed_in_spec`, `proposed` o `undefined`). No existe la variable ni ningún archivo `api/` del módulo (D-34). Cuando backend entregue un contrato, se cambia su estado a `confirmed` con la evidencia en el mismo cambio que agrega su llamada.

### C-00.2 Autenticación — CONFIRMADO (patrón)

- Todas las llamadas autenticadas usan `axiosAuth` (`src/lib/axiosAuth.ts`), que adjunta `Authorization: Bearer <jwt>`.
- El backend debe validar el JWT en cada endpoint. Antecedente: `docs/FIXES.md` (FIX-01) documenta un 401 en producción por usar `axios` sin token.

### C-00.3 Separación por empresa y tienda — PROPUESTA (obligatoria)

- `companyId` sale **siempre del JWT** (`auth.user.companyId`, `src/contexts/AuthContext.tsx:69-70`), nunca del body ni del query.
- `storeId` llega por query o path y backend debe verificar que pertenece a la empresa del JWT. Si no: `403 WA_STORE_FORBIDDEN`.
- Toda lectura de listas (hilos, mensajes, bajas, auditoría, plantillas, reglas) filtra por empresa en servidor. El frontend nunca filtra por seguridad, solo por presentación.
- El PDF dice "todas las tablas llevan `tienda_id`" (§9). Ver la decisión pendiente **D-07** (reglas por tienda o por empresa con filtro de tiendas) en [decisiones-y-contradicciones.md](decisiones-y-contradicciones.md).

### C-00.4 Formato de error — PROPUESTA (alineada al repo)

Mismo formato que ya usa el backend de SUNAT (`src/features/identity-lookup/utils/identity-lookup-error.util.ts:8-12`):

```json
{ "statusCode": 409, "code": "WA_TEMPLATE_NOT_APPROVED", "message": "La plantilla no está aprobada", "details": { "templateId": "..." } }
```

Códigos transversales que el frontend traduce a texto en `src/features/whatsapp/utils/whatsapp-error.util.ts`:

| HTTP | `code` | Comportamiento del frontend |
|---|---|---|
| 401 | — | Flujo de sesión existente (redirige a login). |
| 403 | `WA_FORBIDDEN` (+ `details.requiredPermission`) | Muestra estado "sin permisos" en la sección; deshabilita la acción. |
| 403 | `WA_STORE_FORBIDDEN` | Error genérico de acceso y recarga la lista de tiendas. |
| 404 | `WA_NOT_FOUND` | "Ya no existe"; invalida la lista que lo contenía. |
| 409 | `WA_NOT_CONNECTED` | La tienda no tiene número: muestra el estado vacío de conexión con CTA a Conexión. |
| 409 | `WA_VERSION_CONFLICT` | "Alguien más cambió esta configuración"; recarga y conserva el borrador local si existe. |
| 409 | `WA_WINDOW_CLOSED` | Cambia el pie del chat a "Ventana cerrada" y ofrece plantillas. |
| 409 | `WA_OPTED_OUT` | "El cliente está dado de baja"; no reintenta. |
| 422 | `WA_VALIDATION` (+ `details.fields: { campo: mensaje }`) | Pinta errores por campo en el formulario. |
| 429 | `WA_RATE_LIMITED` | "Meta limitó los envíos, se reintentará"; no reintenta automáticamente desde el navegador. |
| 502/503 | `WA_META_UNAVAILABLE` | "Meta no responde"; botón Reintentar. |
| 5xx | otro | Mensaje genérico + Reintentar. |

Los códigos de Meta (`131026`, `131047`, `131048`, `131049`, `131056`, PDF §10.1.2) llegan como dato del mensaje (`errorCode`), no como error HTTP. El texto visible lo define backend (`errorMessage`) porque el PDF pide "confirmar textos exactos en la documentación vigente de Meta".

### C-00.5 Paginación, filtros y orden — PROPUESTA

- Query: `page` (1..n), `pageSize` (máx. 100), `sort` (`campo:asc|desc`).
- Respuesta: `{ "items": [], "page": 1, "pageSize": 50, "total": 0 }`.
- Una lista vacía con `total: 0` es un **vacío real**. El frontend nunca la confunde con "pendiente de integración" (que se decide antes de llamar) ni con error (HTTP ≠ 2xx).

### C-00.6 Fechas, horas y montos — PROPUESTA

- Fechas en ISO-8601 UTC. El frontend las muestra en `America/Lima` (PDF §0.3).
- Horas de configuración (horario permitido, hora fija) como `"HH:mm"` en hora de Lima; la zona viaja explícita: `"timezone": "America/Lima"`.
- Montos de Meta en USD como string decimal (`"0.0130"`). Estimaciones en soles las calcula backend y devuelve `{ "usd": "...", "pen": "...", "exchangeRate": "3.50", "rateSource": "...", "rateDate": "..." }`. El frontend no multiplica tarifas propias.

### C-00.7 Idempotencia y concurrencia — PROPUESTA

- Toda acción que envía o encola mensajes acepta `Idempotency-Key` (uuid generado por el frontend al abrir la acción): prueba, responder, enviar plantilla, reintentar, reenviar, activar regla con actuales, crear envío programado. Un doble clic o un reintento de red no duplica envíos.
- Las configuraciones editables devuelven `version` (entero) y aceptan `If-Match: <version>`; si no coincide, `409 WA_VERSION_CONFLICT`.

### C-00.8 Auditoría — SPEC (§6.6.5, `wa_audit_log`)

Backend registra cada cambio de configuración (plantillas, reglas, alcance, horario, bajas y reactivaciones, conexión, permisos, alertas, respuesta automática, contingencia) con usuario, fecha y `antes → después`. El frontend no envía el registro; solo lo lee (C-27).

### C-00.9 Actualización en vivo — SIN DEFINIR

El PDF no define WebSocket ni SSE. El frontend usa **polling con TanStack Query** (patrón existente en `src/features/sunat/sunat-document/hooks/use-list-sunat-documents.ts`) e invalidación tras cada mutación. Intervalos propuestos en [frontend-plan.md §5](frontend-plan.md#5-datos-caché-e-invalidación). Si backend ofrece SSE más adelante, solo cambian los hooks.

### C-00.10 Permisos — SIN DEFINIR

- El mockup propone permisos `wa.ver`, `wa.responder`, `wa.plantillas`, `wa.reglas`, `wa.masivos`, `wa.bajas`, `wa.conexion`. El repo usa constantes en mayúscula con prefijo (`OPS_*`, `src/config/operationsPermissions.ts:20-42`). Propuesta: `WA_VIEW`, `WA_REPLY`, `WA_REASSIGN`, `WA_TEMPLATES`, `WA_RULES`, `WA_CAMPAIGNS`, `WA_OPTOUTS`, `WA_CONNECTION`, emitidos en `auth.user.permissions` del JWT.
- Los roles de la spec (Administrador, Supervisor CC, Asesora) **no existen como roles del JWT**. Lo más cercano en el repo: `ccRol: "agente" | "supervisor"` (`src/services/agentesService.ts:18`), que no viaja en el JWT. Ver **D-11**.
- Backend debe validar el permiso en cada endpoint; ocultar botones en el frontend no es seguridad.

---

## Contratos existentes que el módulo reutiliza

| ID | Operación | Uso en WhatsApp | Estado y evidencia |
|---|---|---|---|
| C-E1 | Tiendas de la empresa | Selector de tienda, "Números por tienda", filtros por tienda | **CONFIRMADO**: `auth.company.stores` (`src/contexts/AuthContext.tsx:34-48`), tienda activa `selectedStoreId` (`:86`). |
| C-E2 | `GET {COURIER}/couriers/company/:companyId` | Catálogo de couriers para alcance de reglas y segmentos | **CONFIRMADO**: `src/services/courierService.ts:24`. Ojo: usa `axios` sin token. |
| C-E3 | Canales de venta de la empresa | Catálogo "Canal de venta" del alcance | **CONFIRMADO**: `company.sales_channels` (`src/contexts/AuthContext.tsx:54`). Valores reales ≠ lista del PDF (ver D-09). |
| C-E4 | `GET {VENTAS}/atencion-al-cliente/agentes?storeId&companyId` | Lista de asesoras para reasignar y "Quién envía los mensajes asistidos" | **CONFIRMADO**: `src/services/agentesService.ts:22-31`; trae `ccRol` y `ccActivo`. Que `ccActivo` signifique "conectada" para el reparto por turnos **no está confirmado**. |
| C-E5 | `GET {VENTAS}/order-header/:orderId/evidence` | Foto de entrega en el hilo y en la página pública | **CONFIRMADO**: `src/components/orders/OrderEvidenceSection.tsx:52-53`; tipos `PREPARATION` y `DISPATCH`. La foto la sube un usuario de POWIP; no hay evidencia enviada por courier vía API (ver D-15). Despacho ≠ entrega: el hilo rotula cada tipo y no muestra despacho como prueba de entrega (D-56). |
| C-E6 | Asesora dueña del pedido | Asignación automática de conversaciones | **CONFIRMADO** como campo: `OrderHeader.ccAgenteId` (`src/interfaces/IOrder.ts:235`). |
| C-E7 | Link de rastreo actual | Botones WhatsApp existentes | **CONFIRMADO**: `${NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}` (p. ej. `src/components/modals/CustomerServiceModal.tsx:586`). Usa el número de pedido, que es adivinable; el PDF exige token (C-30). |
| C-E8 | Tipos de envío del pedido | Catálogo "Tipo de envío" del alcance de reglas | **CONFIRMADO**: `DELIVERY_TYPE_OPTIONS` (`src/constants/operationsDomain.ts`). Valores reales ≠ "Agencia/Domicilio" del PDF (ver D-09, D-50). |

---

## Conexión

### C-01 · Resumen de conexión de la página — PROPUESTA

`GET /wa/status?storeId=` → alimenta la etiqueta de estado de la cabecera y decide qué secciones se habilitan.

```json
{
  "storeId": "…",
  "connectionType": "api | coex | app_manual | null",
  "state": "connected | name_in_review | restricted | disconnected | not_connected",
  "displayLabel": "Conectado · API oficial",
  "contingencyActive": false,
  "unattendedReplies": 3
}
```

`unattendedReplies` evita una llamada extra para el contador rojo de la pestaña Conversaciones. Si backend prefiere, se reemplaza por C-22.2.

Los IDs C-15 y C-17 no se usan: los resultados A/B viajan dentro de C-12 y las estadísticas de reglas dentro de C-16.

### C-02 · Números por tienda — SPEC (`GET /wa/accounts`)

`GET /wa/accounts?storeId=` (opcional; sin `storeId` devuelve todas las tiendas de la empresa).

```json
{
  "items": [{
    "id": "…", "storeId": "…", "role": "principal | contingencia",
    "connectionType": "api | coex | app_manual",
    "phone": "+51987654321", "verifiedName": "LIVII Store",
    "nameStatus": "approved | in_review | rejected",
    "qualityRating": "GREEN | YELLOW | RED | UNKNOWN",
    "messagingLimitTier": "TIER_1K", "messagingLimitLabel": "1,000 clientes / 24 h",
    "wabaId": "…", "phoneNumberId": "…",
    "webhook": { "state": "active | inactive", "lastEventAt": "…" },
    "connectedAt": "…", "connectedBy": { "id": "…", "name": "…" },
    "usageToday": { "uniqueContacts": 312, "limit": 1000, "resetsAt": "…" },
    "messagesThisMonth": 1284,
    "lastSyncedAt": "…",
    "version": 3
  }]
}
```

Tiendas sin cuenta aparecen en la UI como "Sin conectar" cruzando con C-E1; backend no necesita devolverlas.

### C-03 · Tipo de conexión — SPEC parcial (`PUT /wa/accounts`)

`PUT /wa/accounts/:id` con `If-Match`. Body: `{ "connectionType": "api | coex | app_manual" }`.
Cambiar de tipo no es cosmético: implica otro flujo de Meta (coexistencia requiere Embedded Signup con opción de app Business). Ver **D-04**. Errores: `409 WA_REQUIRES_SIGNUP` (debe volver a conectar), `422`.

### C-04 · Actualizar datos desde Meta — PROPUESTA

`POST /wa/accounts/:id/refresh` → relee `quality_rating`, `messaging_limit_tier`, `verified_name`, `code_verification_status` (PDF §10.1). Responde la cuenta actualizada (forma C-02). Errores: `502 WA_META_UNAVAILABLE`, `429`.

### C-05 · Desconectar — PROPUESTA (el PDF describe el efecto, no la ruta)

`POST /wa/accounts/:id/disconnect` con `Idempotency-Key`. Efecto (§6.1.2): revocar token, pausar reglas y envíos programados de la tienda, conservar plantillas e historial. Respuesta: `{ "pausedRules": 7, "pausedCampaigns": 2 }`.

### C-06 · Embedded Signup — PROPUESTA (depende de configuración en Meta)

El flujo real de Meta corre en una ventana de Facebook (SDK JS `FB.login` con `config_id` y `extras.sessionInfoVersion`). La elección del número y el código SMS ocurren **dentro de esa ventana**, no en pantallas de POWIP (ver **D-03**).

1. `POST /wa/signup/session` `{ "storeId", "mode": "api | coex" }` → `{ "appId", "configId", "state", "graphApiVersion" }`. Backend genera `state` anti-CSRF.
2. El frontend abre el SDK de Meta con esos datos y escucha el evento `message` (`WA_EMBEDDED_SIGNUP`) para obtener `waba_id` y `phone_number_id`, y el `code` de `FB.login`.
3. `POST /wa/signup/complete` `{ "state", "code", "wabaId", "phoneNumberId" }` → backend intercambia el `code` por token, suscribe el webhook, registra el número y devuelve la cuenta (forma C-02) con `nameStatus: "in_review"` si corresponde.

Errores: `409 WA_SIGNUP_STATE_MISMATCH`, `409 WA_NUMBER_ALREADY_CONNECTED`, `422 WA_SIGNUP_INCOMPLETE` (el usuario cerró la ventana), `502`.
Dependencias: app de Meta en modo Tech Provider, `config_id`, dominio permitido, verificación de negocio. **SIN DEFINIR** quién la tramita.

### C-07 · Mensaje de prueba — SPEC (`POST /wa/accounts/:id/test`) + PROPUESTA (estado)

`POST /wa/accounts/:id/test` con `Idempotency-Key`. Body: `{ "phone": "+51912345678", "templateId": "…" }`.
Respuesta `202`: `{ "messageId": "…", "status": "queued" }`.
Estado: `GET /wa/messages/:messageId` → `{ "status": "queued | sent | delivered | read | failed", "sentAt", "deliveredAt", "readAt", "failedAt", "errorCode", "errorMessage" }`.
Errores: `422 WA_VALIDATION` (teléfono), `409 WA_TEMPLATE_NOT_APPROVED`, `409 WA_NOT_CONNECTED`, `409 WA_OPTED_OUT`.
El frontend solo enciende "Enviado/Entregado/Leído" cuando backend lo informa (webhook de Meta). No simula la progresión.

### C-08 · Uso y costo del mes — PROPUESTA

`GET /wa/usage?storeId=&month=2026-10` → `{ "templatesDelivered": 1284, "serviceRepliesUsed": 210, "serviceRepliesFree": 1000, "estimatedCost": { "usd": "16.69", "pen": "58.40", "exchangeRate": "3.50", "rateDate": "…" } }`.
**SIN DEFINIR** de dónde sale el costo real: el PDF dice que Meta cobra directo al negocio; POWIP solo puede estimar.

### C-09 · Tarifas de Meta — PROPUESTA

`GET /wa/pricing?country=PE` → `{ "market": "Resto de Latinoamérica", "currency": "USD", "effectiveFrom": "2026-10-01", "source": "…", "verifiedAt": "…", "items": [{ "type": "utility | marketing | service | ctwa", "label": "…", "chargedWhen": "…", "usd": "0.0130", "pen": "0.05" }] }`.
El frontend **no** escribe tarifas en código. Si la respuesta falta o `verifiedAt` es viejo, la tabla muestra "Tarifas no verificadas" (ver **D-05**).

### C-10 · Reglas de contingencia — PROPUESTA (tabla `wa_contingency_rules`, §9.1)

`GET /wa/contingency?storeId=` y `PUT /wa/contingency?storeId=` con `If-Match`.

```json
{
  "enabled": true,
  "accountId": "…",
  "triggers": { "onRestrictedOrRed": true, "onDailyLimit": true, "onConsecutiveFailures": { "enabled": true, "count": 5, "minutes": 15 }, "manualOnly": false },
  "sender": { "type": "role | user", "role": "OPERACIONES", "userId": null },
  "active": false, "activatedAt": null, "reason": null,
  "version": 2
}
```

`manualOnly: true` excluye los demás disparadores (validación en ambos lados). Activar/desactivar manualmente: `POST /wa/contingency/activate` y `/deactivate` (PROPUESTA).

### C-11 · Bandeja de envío asistido — PROPUESTA

- `GET /wa/assisted-queue?storeId=&status=pending` → `{ "items": [{ "id", "orderId", "orderNumber", "customerName", "phone", "templateName", "courier", "renderedText", "trackingUrl", "waMeUrl", "createdAt", "status": "pending | opened | marked_sent | discarded" }], "total" }`.
- `POST /wa/assisted-queue/:id/opened` → registra que la asesora abrió WhatsApp.
- `POST /wa/assisted-queue/:id/mark-sent` → la asesora declara que envió.
- `POST /wa/assisted-queue/:id/discard` `{ "reason" }`.

Abrir `wa.me` **no prueba** que el mensaje salió (ver **D-02**). El historial muestra `assisted` como "Asistido · marcado por {asesora}", nunca como entregado. El único dato medible es el clic en el link de rastreo (C-30.2).
El mockup menciona una tabla `wa_assisted_queue`; el PDF guarda el estado `assisted` en `wa_messages`. Lo decide backend.

---

## Plantillas

### C-12 · CRUD y revisión — SPEC (`GET/POST/PUT /wa/templates`) + PROPUESTA (acciones)

- `GET /wa/templates?storeId=&status=APPROVED|PENDING|REJECTED|PAUSED|DRAFT&page&pageSize` → items con `{ "id", "name", "event", "category": "UTILITY | MARKETING", "language": "es_PE | es", "status", "rejectionReason", "header": { "type": "none | text | document", "text" }, "body", "footer", "button": { "text", "urlBase": "https://powip.lat/r/" }, "quickReply": true, "variables": ["cliente", "orden"], "approvedVersion": { … } | null, "ab": { "enabled", "groupId", "variant": "A | B", "minSendsPerVariant", "results": { "a": { "readPct", "clickPct", "sends" }, "b": { … }, "winner": "A | B | null" } } | null, "stats30d": { "sent", "readPct", "clickPct" }, "usedByRules": ["…"], "updatedAt", "version" }`.
- `GET /wa/templates/:id`.
- `POST /wa/templates` (borrador; no va a Meta) → `201` plantilla en `DRAFT`.
- `PUT /wa/templates/:id` con `If-Match` (guarda borrador; si estaba `APPROVED`, sigue usándose `approvedVersion`).
- `POST /wa/templates/:id/submit` → envía a Meta (`POST /{waba_id}/message_templates`, §10.1) con variables posicionales y ejemplos; pasa a `PENDING`. Con A/B crea también `{nombre}_b`.
- `POST /wa/templates/:id/duplicate` → crea `{nombre}_copia`. El PDF dice que la copia "se envía a revisión"; el mockup la deja en revisión directamente. Ver **D-13**.

Errores: `422 WA_VALIDATION` (nombre duplicado en la WABA, longitudes, variables desconocidas), `409 WA_TEMPLATE_IN_REVIEW` (no se puede reenviar mientras está en revisión), `502 WA_META_UNAVAILABLE`, `422 WA_META_REJECTED_SUBMISSION` (Meta rechazó el formato al crear).

Garantías de backend: slug final (minúsculas, sin tildes, `_`), conversión `{{cliente}}` → `{{1}}` con `var_map`, ejemplos por variable, URL fija del botón, encabezado PDF solo para el evento "Comprobante emitido".

**Lo que el frontend ya espera (etapa 3).** El modelo `WhatsAppTemplate` (`src/features/whatsapp/models/template.model.ts`) define cómo el mapper futuro debe dejar la respuesta. Ajustes respecto de la forma de arriba:

| Campo del modelo | Origen propuesto | Nota |
|---|---|---|
| `usage` | `event` / uso de la plantilla, con los valores de `WHATSAPP_TEMPLATE_USAGES` (`guia_creada`, `pedido_en_camino`, …, `solo_envios_programados`) | Separado de los eventos de aviso de las reglas. `null` si backend no lo informa |
| `metaReason` | `rejectionReason` o motivo de pausa | Se muestra tal cual en REJECTED y PAUSED |
| `approvedVersion` | Contenido aprobado vigente + `approvedAt` | Se muestra en PENDING y REJECTED |
| `abTest.results.winner` | Solo backend | El frontend nunca lo calcula |
| `stats30d` | `null` si no hay envíos | Se muestra "—" |

Payload que el editor enviará al guardar (desde `TemplateEditorValues`): `{ storeId, name, usage, category, language, header: { type, text }, body, footer, button: { text }, quickReply, ab: { enabled, bodyB, minSendsPerVariant } }`. Detalle en [screens/02-plantillas.md](screens/02-plantillas.md#t2m1a1--guardar-borrador-pendiente).

### C-13 · Catálogo del editor — PROPUESTA

`GET /wa/template-catalog` → `{ "events": [{ "key": "PEDIDO_EN_CAMINO", "label": "Pedido en camino", "allowsDocumentHeader": false, "variables": ["cliente", "orden", "courier", "link_rastreo", "fecha_entrega"] }], "variables": [{ "key": "cliente", "label": "Nombre del cliente", "example": "Carlos" }], "languages": [{ "code": "es_PE", "label": "Español (Perú)" }, { "code": "es", "label": "Español" }], "limits": { "body": 1024, "header": 60, "footer": 60, "buttonText": 25 } }`.
Así el frontend no fija la lista "Se usa en" (el PDF da 8 eventos en §6.2.1 y 10 en §6.2.3; ver **D-14**). Mientras no exista, el editor usa la lista del PDF §6.2.3 desde `src/features/whatsapp/constants/whatsapp-template-catalog.ts` (usos, variables por uso, idiomas, límites, textos sugeridos y valores de muestra). Debe confirmar los códigos de idioma (D-39) y los límites de Meta aplicados (D-44).

### C-14 · Pedidos de ejemplo para la vista previa — PROPUESTA

`GET /wa/preview-orders?storeId=&event=&limit=5` → `{ "items": [{ "orderId", "label": "ORD-149912 · Carlos Hoyos · Shalom", "variables": { "cliente": "Carlos", "orden": "ORD-149912", "courier": "Shalom", "link_rastreo": "powip.lat/r/K7X2Q", "fecha_entrega": "jueves 8 de octubre", "agencia": "…", "saldo": "298.00", "tienda": "LIVII", "tipo_comprobante": "boleta", "serie_numero": "B001-000482" }, "missing": ["agencia"] }] }`.
El render de la vista previa es local. Sin este contrato, la vista previa usa los valores de ejemplo del catálogo (C-13) o, si tampoco existe, muestra las variables sin reemplazar y el aviso "Vista previa sin pedido real (pendiente de integración)".

---

## Programación

### C-16 · Reglas de aviso — SPEC

- `GET /wa/rules?storeId=` → `{ "items": [{ "id", "event": "GUIA_CREADA | EN_ENVIO | EN_AGENCIA | EN_REPARTO | ENTREGADO | ENCUESTA | SALDO_COD | INCIDENCIA | COMPROBANTE_ACEPTADO", "label", "orderStateTrigger", "templateId", "templateStatus", "active", "blockedReason": "TEMPLATE_NOT_APPROVED | NOT_CONNECTED | null", "when": { "mode": "now | delay | fixed | before", "minutes": null, "time": null, "hours": null }, "allowedWhenModes": ["now", "delay", "fixed"], "reminder": { "enabled": true, "hours": 48 } | null, "scope": { "dateMode": "since_activation | range", "from": null, "to": null, "maxOrderAgeDays": 15, "storeIds": [], "channels": [], "shippingTypes": [], "courierIds": [] }, "scopeDefaults": { … }, "stats": { "sentToday": 41, "estimatedMonthly": { "usd", "pen" } }, "activatedAt", "version" }], "summary": { "activeCount": 5, "estimatedMonthly": { "usd", "pen" } } }`.
- `PUT /wa/rules/:id` con `If-Match` (plantilla, cuándo, recordatorio, alcance). No activa.
- `GET /wa/rules/:id/preview` (con el alcance del borrador por query o `POST /wa/rules/:id/preview` con body; PROPUESTA usar POST para no serializar el alcance en la URL) → `{ "matchingOrders": 128, "orderState": "EN_ENVIO", "estimatedCost": { "usd", "pen" }, "computedAt" }`.
- `POST /wa/rules/:id/activate` `{ "includeExisting": false }` con `Idempotency-Key` → `{ "active": true, "enqueued": 0 }`.
- `POST /wa/rules/:id/deactivate` — PROPUESTA (el PDF solo nombra activar).

Errores: `409 WA_TEMPLATE_NOT_APPROVED`, `409 WA_NOT_CONNECTED`, `422 WA_VALIDATION` (`before` solo para EN_ENVIO y SALDO_COD; minutos/horas > 0; `to` ≥ `from`), `409 WA_VERSION_CONFLICT`.
Dependencia **SIN DEFINIR**: el origen de cada evento en el sistema real (ver **D-08**). `allowedWhenModes` y `scopeDefaults` los devuelve backend para no fijar reglas de negocio en el frontend.

Notas de la etapa 4 (frontend listo, sin llamadas):
- Identidad: cada ítem debe traer, además del `id`, la clave estable de la regla (`key`, los nueve valores de `WHATSAPP_RULE_KEYS`, iguales a los usos de plantilla). El enlace "Activar en una regla" desde Plantillas se resuelve por esa clave (D-49).
- Alcance: lista vacía = todas/todos (D-50); fechas como `YYYY-MM-DD` en America/Lima; `maxOrderAgeDays` entero 1..365; `courierIds` de `ms-courier` (C-E2), `storeIds` de C-E1, `channels` de C-E3 y `shippingTypes` de C-E8. Los IDs que ya no están en el catálogo (p. ej. una tienda eliminada) se conservan y se muestran como "(no disponible)"; backend decide si los rechaza.
- Rangos que valida el frontend (backend debe revalidarlos): `minutes` 1..10080, `hours` (antes de) 1..168, recordatorio 1..168 (solo "Disponible en agencia" ofrece recordatorio).
- Vista previa: informativa. `activate` debe revalidar en el servidor `version` (`If-Match`), plantilla aprobada, conexión, alcance guardado y pedidos actuales, y responder el `enqueued` real; el frontend no muestra nada encolado sin esa respuesta (D-51). Con cambios sin guardar en la tarjeta, el frontend no permite activar.
- Desactivar: qué pasa con lo ya encolado sigue pendiente (D-47).
- Permisos, tenant y auditoría: empresa y tienda salen del token, no del body; editar, activar y desactivar quedan auditados con usuario y versiones anterior y nueva. Los permisos `WA_*` siguen sin definir (C-00.10); el frontend no los infiere de roles.

### C-18 · Ajustes de envío — SPEC (`GET/PUT /wa/settings`)

`GET /wa/settings?storeId=` / `PUT` con `If-Match`:

```json
{
  "schedule": { "days": ["MON","TUE","WED","THU","FRI","SAT"], "from": "08:00", "to": "21:00", "outOfHours": "defer | drop", "timezone": "America/Lima" },
  "dedupe": true,
  "maxPerOrderPerDay": 3,
  "missingData": { "notifyAgent": true, "sendWhenFixed": true },
  "autoReply": { "enabled": true, "inHoursText": "…", "outOfHoursText": "…" },
  "optOutByKeyword": true,
  "foreignNumbers": { "inbound": "normal | reply_once | ignore", "allowOutbound": false },
  "version": 5
}
```

Validaciones de backend: `from < to` (el frontend rechaza horarios que cruzan la medianoche y `from = to`, D-48), al menos un día, `maxPerOrderPerDay` entero 1..10 (rango **SIN DEFINIR**; el PDF solo da el valor por defecto 3), variables de la respuesta automática limitadas a `{{cliente}}` y `{{link_rastreo}}`.
**Fuera de Hito 1:** `pau_en_whatsapp` (§9.1) no se expone en la UI (ver **D-01**).
"Horario de atención de las asesoras" (para elegir el texto alterno de la respuesta automática, §6.4.8) **SIN DEFINIR**: no es el mismo horario de envío.
Respuesta automática (etapa 5): el modal edita `autoReply.enabled`, `inHoursText` y `outOfHoursText` (≤ 1024, solo `{{cliente}}` y `{{link_rastreo}}`, obligatorios si está activa). Sin configuración guardada (`autoReply: null`) muestra los textos del PDF como sugeridos. Backend controla la frecuencia (una vez por ventana por conversación), qué texto usar según el horario y el envío.

### C-19 · Hoy no se enviaron — PROPUESTA

Se resuelve con C-24: `GET /wa/messages?storeId=&status=skipped&from=<hoy 00:00 Lima>&pageSize=20`. No hace falta endpoint aparte.

### C-20 · Próximas 24 horas — PROPUESTA

`GET /wa/queue/upcoming?storeId=&hours=24` → `{ "total": 68, "groups": [{ "sendAt": "…", "templateName": "pedido_en_camino", "source": "rule | campaign | reminder", "sourceLabel": "30 min tras entrega", "orders": 11, "deferred": true, "deferredTo": "…", "reason": "OUT_OF_HOURS" }] }`.

### C-21 · Envíos programados — SPEC (`GET/POST/PUT /wa/campaigns`) + PROPUESTA (acciones)

- `GET /wa/campaigns?storeId=&status=` → items `{ "id", "name", "templateId", "templateName", "segment": { "orderStates": ["EN_ENVIO"], "courierIds": [], "storeIds": [], "destination": "all | lima | provinces" }, "segmentLabel", "schedule": { "type": "once | recurring", "runAt": "…", "recurrence": "daily | mon_sat | weekly_mon", "time": "10:00" }, "status": "scheduled | active | paused | completed", "pausedReason": "manual | quality_red | null", "matchingToday": 42, "results": { "sent", "read" } | null, "version" }`.
- `POST /wa/campaigns` con `Idempotency-Key`; `PUT /wa/campaigns/:id` con `If-Match`.
- `POST /wa/campaigns/segment-count` `{ "storeId", "segment" }` → `{ "matchingToday": 42, "computedAt" }` (contador del modal).
- `POST /wa/campaigns/:id/pause` y `/resume`.
- `GET /wa/campaigns/:id/results` — **SIN DEFINIR** qué muestra "Ver resultados" (el mockup solo dispara un toast).

Errores: `409 WA_TEMPLATE_NOT_APPROVED`, `409 WA_CAMPAIGNS_PAUSED_BY_QUALITY` (pausa automática §6.6.2), `422` (fecha pasada, sin hora).
La lista del segmento se evalúa al enviar (§6.3.7): el contador es informativo.
**SIN DEFINIR**: cómo se determina "Solo Lima / Solo provincia" (ubigeo de la dirección, zona del courier).

Notas de la etapa 4: el modal arma un segmento con **un** estado (`EN_ENVIO | EN_AGENCIA | EN_REPARTO`), un courier o "Todos" (`courierIds: []`), una tienda y un destino (D-54); el array `orderStates` admite más de uno si producto lo pide. "Una vez" exige fecha y hora futuras en America/Lima: el frontend valida y backend revalida al guardar y al ejecutar. Recurrencias: `daily`, `mon_sat`, `weekly_mon`. `matchingToday` y `results` solo se muestran si vienen de backend; si faltan, la UI lo dice y no inventa números.

---

## Conversaciones

### C-22 · Hilos — SPEC (`GET /wa/threads`, `GET /wa/threads/:id`, `POST …/reply`, `POST …/template`, `PUT /wa/threads/:id`) + PROPUESTA

- **C-22.1** `GET /wa/threads?storeId=&q=&assignedTo=me|<userId>&column=&page&pageSize` → items `{ "id", "orderId", "orderNumber", "storeId", "storeName", "courier", "customerName", "phone", "column": "sent | delivered | read | replied | failed", "attended": false, "trackingOpened": true, "lastTemplateName", "lastMessageAt", "lastInbound": { "text", "at" } | null, "waitingSince": "…" | null, "overdue": false, "failure": { "reason", "code" } | null, "flaggedForReview": false, "assignee": { "id", "name", "initials" } | null }`. La columna la calcula backend (§8.2); el frontend no la deriva.
- **C-22.2** `GET /wa/threads/summary?storeId=&assignedTo=` → `{ "columns": { "sent": 1, "delivered": 2, "read": 4, "replied": 3, "failed": 3 }, "unattended": 3 }` (contadores del tablero y de la pestaña). PROPUESTA.
- **C-22.3** `GET /wa/threads/:id` → cabecera + `window: { "open": true, "expiresAt": "…" }` + `messages: [{ "id", "direction": "out | in", "kind": "template | text | auto | note | evidence | echo", "templateName", "header": { "type": "document", "fileName", "sizeBytes", "url" } | null, "body", "buttonText", "media": { "type": "image | audio | video | document", "url" } | null, "status", "sentAt", "deliveredAt", "readAt", "failedAt", "errorCode", "errorMessage", "author": { "id", "name" } | null, "createdAt" }]`. `echo` = enviado desde la app del celular en coexistencia (no abre ventana, §10.1.1).
- **C-22.4** `POST /wa/threads/:id/reply` `{ "text", "internalNote": "…" | null }` con `Idempotency-Key` → mensaje creado. Errores: `409 WA_WINDOW_CLOSED`, `409 WA_OPTED_OUT`, `422` (vacío o > 4096).
- **C-22.5** `POST /wa/threads/:id/template` `{ "templateId" }` con `Idempotency-Key`. Errores: `409 WA_TEMPLATE_NOT_APPROVED`, `409 WA_OPTED_OUT`.
- **C-22.6** `PUT /wa/threads/:id` `{ "assigneeId" }` | `{ "attended": true }` | `{ "note": "…" }`. PROPUESTA separar en `POST …/assign`, `POST …/attend`, `POST …/notes` para auditar mejor; cualquiera de las dos formas sirve.
- **C-22.7** `GET /wa/threads/by-order/:orderId` → hilo(s) del pedido para la ficha (X1). PROPUESTA.
- **C-22.8** `POST /wa/messages/:id/retry` (pie "No enviado" → Reintentar) con `Idempotency-Key`. Si el dato sigue faltando: `409 WA_MISSING_DATA` con `details.missing`.

Notas de la etapa 5 (frontend listo, sin llamadas; modelo en `src/features/whatsapp/models/conversation.model.ts`):

- **Atención separada del mensaje (D-55).** Cada ítem de C-22.1 y el detalle C-22.3 deben traer, además de `column`, los datos que la definen: `lastOutbound: { messageId, status, templateName, sentAt, failureReason } | null` y `attention: { pendingReply, lastInboundText, lastInboundAt, waitingSince, overdue, attended, attendedAt, attendedBy }`. El frontend ubica la tarjeta con `pendingReply` primero y luego `lastOutbound.status`; backend debe usar la misma regla para `column=` y para C-22.2. `overdue` lo calcula backend con el umbral de alertas (C-26). Una respuesta nueva del comprador vuelve `pendingReply` a `true` aunque estuviera atendida.
- **Ventana (D-57, D-62).** El detalle trae `replyWindow: { open: boolean | null, expiresAt }` (equivale al `window` de C-22.3). Sin ese dato el frontend bloquea los envíos. Backend revalida en cada envío.
- **Otros campos del detalle:** `orderId` (para "Ver pedido"; puede ser `null`), `trackingUrl` (link real para la respuesta rápida), `optedOut`, `version` (para `If-Match`), mensajes con `media: { type: image|audio|video|document|sticker, url, caption }` y `evidence: { type: PREPARATION|DISPATCH|DELIVERY, imageUrl, courier, takenAt }`.
- **Paginación y conteos.** Tablero: por columna, `{ items, total, hasMore }` con 20 por página; lista: `{ items, page, pageSize: 50, total, hasMore }`. `total` es global para los filtros; si no se puede calcular, `null` y el frontend no muestra número. Filtros: `q` (normalizado: teléfono solo dígitos), `storeId`, `assignedTo` (ID de usuario).
- **Mutaciones.** Se adopta la propuesta de C-22.6 separada: `POST …/assign`, `POST …/attend`, `POST …/notes`, todas con `If-Match` salvo notas. Las respuestas devuelven el detalle actualizado; el frontend no agrega mensajes por su cuenta.
- **Concurrencia.** Respuestas simultáneas permitidas (caso 29); asignar o marcar atendida sobre versión vieja → `409 WA_VERSION_CONFLICT`. Baja durante la composición → `409 WA_OPTED_OUT`.
- **Tenant.** Empresa y tienda salen del token; cada hilo pertenece a una tienda (`tienda_id`); reasignar solo a asesoras de esa tienda.
- **Varios pedidos por teléfono:** pendiente (D-60).
- **Tiempo real:** sin C-00.9 el frontend no hace polling.

Garantías de backend: ventana calculada solo con mensajes **entrantes** del comprador; asignación inicial (dueña del pedido `ccAgenteId`, si no, reparto por turnos), respuesta automática una vez por ventana, baja por palabra clave, regla de números extranjeros.

### C-23 · Respuestas rápidas — SIN DEFINIR

El mockup trae cuatro (Link de rastreo, Reprogramar entrega, Cambiar dirección, Horario de agencia), algunas agregan nota interna. El PDF no dice si son fijas, por tienda o editables. Propuesta mínima: `GET /wa/quick-replies?storeId=` → `[{ "id", "label", "text", "internalNote": "…" | null }]` con las variables ya resueltas por hilo (`GET /wa/threads/:id/quick-replies`). "Reprogramar entrega" y "Cambiar dirección" **no cambian el pedido**: solo escriben texto y nota (ver **D-16**).

---

## Historial

### C-24 · Mensajes — SPEC (`GET /wa/messages`) + PROPUESTA

- `GET /wa/messages?storeId=&period=today|7d|month&from&to&status=sent|delivered|read|failed|skipped|assisted&q=&page&pageSize&sort=sentAt:desc` → items `{ "id", "createdAt", "orderId", "orderNumber", "customerName", "phone", "templateName", "courier", "status", "reason": "…" | null, "timeline": { "sentAt", "deliveredAt", "readAt", "clickedAt", "failedAt" }, "assistedBy": { "id", "name" } | null, "canResend": true }`.
- `GET /wa/messages/metrics?<mismos filtros sin status>` → `{ "sent": 1284, "delivered": 1251, "read": 1018, "clicked": 642, "notSent": 33, "notSentBreakdown": [{ "reason": "NO_WHATSAPP", "label": "sin WhatsApp", "count": 21 }], "funnel": … }`. Los porcentajes los calcula el frontend con las fórmulas del PDF §6.5.1 a partir de los conteos (o backend los devuelve; elegir uno).
- `GET /wa/messages/export?<mismos filtros>` → `text/csv` o `xlsx`. Ver **D-17** sobre exportación en cliente vs servidor.
- `POST /wa/messages/:id/resend` con `Idempotency-Key` (PROPUESTA; distinto de C-22.8 porque reenvía un mensaje fallido de Meta, no un `skipped`).

Criterio §14.5: indicadores y tabla usan los mismos filtros y el export trae las mismas filas.

---

## Bajas, alertas y permisos

### C-25 · Bajas — SPEC (`GET/POST/DELETE /wa/optouts`)

- `GET /wa/optouts?storeId=&q=&page&pageSize` → items `{ "id", "customerName", "phone", "storeId", "storeName", "origin": "keyword | agent | meta_block | manual", "createdAt", "createdBy" }`.
- `POST /wa/optouts` `{ "phone", "storeId" | null, "customerName", "note" }`. `storeId: null` = todas las tiendas (**SIN DEFINIR** si la baja es por tienda o por empresa; ver **D-12**).
- `DELETE /wa/optouts/:id` `{ "reason": "customer_request", "note" }` → reactivación con registro de quién (§6.6.1). PROPUESTA usar `POST /wa/optouts/:id/reactivate` para no mandar body en DELETE.
Errores: `409 WA_ALREADY_OPTED_OUT`, `422` (teléfono inválido).

### C-26 · Alertas — SPEC (`GET/PUT /wa/alerts`) + PROPUESTA

- `GET /wa/alerts/rules?storeId=` / `PUT` con `If-Match` → `{ "rules": [{ "type": "quality | template | failed_pct | daily_limit_pct | unattended_minutes", "enabled": true, "threshold": 5 | null }], "recipients": "admins_bell_and_whatsapp | admins_bell_only", "pauseCampaignsOnRed": true, "version" }`.
- `GET /wa/alerts?storeId=&days=7` → `[{ "id", "type", "message", "createdAt", "relatedTab": "conexion | plantillas | conversaciones | …", "relatedId" }]`.
Dependencia **SIN DEFINIR**: la "campanita de POWIP" **no existe** en el frontend (búsqueda sin resultados de notificaciones in-app). Ver X5 en [screens/README.md](screens/README.md).

### C-27 · Registro de cambios — SPEC (`GET /wa/audit`)

`GET /wa/audit?storeId=&userId=&entity=template|rule|schedule|optout|connection|permission|alert|settings&page&pageSize` → items `{ "id", "createdAt", "user": { "id", "name" }, "entity", "entityId", "action", "summary", "before": {…}, "after": {…} }`. Solo lectura, sin borrado.

### C-28 · Matriz de permisos — PROPUESTA

`GET /wa/permissions` / `PUT /wa/permissions` con `If-Match` → `{ "roles": [{ "key": "admin", "label": "Administrador", "editable": false }, { "key": "cc_supervisor", "label": "Supervisor CC", "editable": true }, { "key": "cc_agent", "label": "Asesora", "editable": true }], "matrix": { "WA_VIEW": { "admin": true, "cc_supervisor": true, "cc_agent": true } }, "version" }`. Depende de **D-11**. La rama `origin/feat/usuarios-roles-permisos` (no mergeada) trabaja una matriz de permisos general; conviene unificar.

### Notas de la etapa 6 (C-24 a C-28)

Frontend listo, sin llamadas. Payloads completos en [screens/05-historial-de-envios.md](screens/05-historial-de-envios.md) y [screens/06-bajas-alertas-permisos.md](screens/06-bajas-alertas-permisos.md).

- **C-24 historial.** Alcance compartido por métricas, tabla y export: `period`, `from`/`to` (ISO UTC calculados desde la medianoche de Lima), `storeId`, `q`; `status` solo en tabla y export (D-67). Métricas: `sent`, `delivered`, `read`, `trackingOpened`, `notSent`, `notSentBreakdown`, `assisted`, `computedAt`, cada una puede ser `null`; `sent/delivered/read` excluyen asistidos; `trackingOpened` no implica lectura (D-63). Ítems con `timeline.queuedAt`, `canResend` y `resendBlockedReason`. Export de todas las páginas en servidor (D-64).
- **C-25 bajas.** `origin: keyword | agent | meta_block | manual` (`meta_block` solo cuando Meta lo informe); `createdBy`; reactivación con `reason: customer_request` y `note` obligatoria, auditada.
- **C-18 ajustes.** `optOutByKeyword` y `foreignNumbers` por tienda (D-68), con `If-Match`.
- **C-26 alertas.** Umbrales enteros: `failed_pct` y `daily_limit_pct` 1-100, `unattended_minutes` 1-1440; `threshold` ignorado si la alerta está apagada. Backend evalúa, deduplica (6 h) y pausa/reanuda campañas. `relatedTab` debe ser una pestaña válida (`conexion`, `plantillas`, `programacion`, `conversaciones`, `historial`, `ajustes`); el frontend no usa IDs de destino.
- **C-27 registro.** Agregar `users` (usuarios con cambios, para el filtro) y redactar secretos antes de guardar; el frontend además oculta claves sensibles.
- **C-28 permisos.** Códigos: `WA_VIEW`, `WA_REPLY`, `WA_REASSIGN`, `WA_TEMPLATES`, `WA_RULES`, `WA_CAMPAIGNS`, `WA_OPTOUTS`, `WA_CONNECTION` (+ propuestos `WA_ALERTS`, `WA_PERMISSIONS`, `WA_HISTORY_EXPORT`, D-65). Permisos efectivos del usuario por tienda en `/auth/me` o el JWT. `PUT` fuerza `admin: true`. Enforcement en cada endpoint.

---

## Integraciones fuera de Configuración

### C-29 · Último aviso por pedido — SPEC (`pedidos.wa_last_status`, §9.2)

Agregar a las respuestas de lista de pedidos que ya usan Ventas, Operaciones › Pedidos y Gestión CC (ms-ventas) el campo:

```json
"waLastNotice": { "status": "queued | sent | delivered | read | failed | skipped | assisted", "templateName": "pedido_en_camino", "at": "…", "reason": "…" | null }
```

`null` = nunca se envió un aviso automático. Los clics en los botones manuales de WhatsApp existentes (que abren `wa.me`) **no** generan este dato.

### C-30 · Página pública y acortador — SPEC

- **C-30.1** `GET /p/:token` (sin login) → `{ "store": { "name", "logoUrl" }, "order": { "number", "createdAt", "items": [...] }, "tracking": { "state", "courier", "trackingCode", "agency": {…} | null, "estimatedDelivery", "incident": { "reason", "at" } | null, "events": [{ "label", "at" }] }, "evidence": [{ "url", "takenAt", "type" }], "invoice": { "type": "BOLETA | FACTURA", "seriesNumber", "pdfUrl" } | null }`. Sin datos sensibles innecesarios (no mostrar teléfono completo ni dirección completa si no hace falta; **SIN DEFINIR** qué campos).
- **C-30.2** `GET /r/:codigo` → registra clic y responde `302` al POWIP Link. No lo consume el frontend autenticado.
- **C-30.3** `linkToken` / `trackingShortUrl` en el detalle del pedido autenticado, para que la ficha y los botones usen el link nuevo en vez de `/rastreo/{orderNumber}`.
Dónde se aloja la página: **SIN DEFINIR** (ver **D-06** y [screens/09-pagina-publica-rastreo.md](screens/09-pagina-publica-rastreo.md)).

### C-31 · Notificaciones in-app (campanita) — SIN DEFINIR

No existe en el repo. Necesaria para alertas (§6.6.2), aviso de aprobación de plantilla (§6.2.4), "avisar a la asesora del pedido" (§6.3.4) y recuperación del número principal (§6.1.5).

---

## Eventos que backend debe emitir o mapear (sin pantalla propia)

| Evento del PDF | Fuente | Estado |
|---|---|---|
| `GUIA_CREADA`, `EN_ENVIO`, `EN_AGENCIA`, `EN_REPARTO`, `ENTREGADO`, `INCIDENCIA` | Webhooks de Shalom/Olva y cambios manuales (§10.2) | **SIN DEFINIR**: los estados reales del pedido son `ASIGNADO_A_GUIA`, `EN_ENVIO`, `ENTREGADO`… (`src/interfaces/IOrder.ts:68-78`); `EN_AGENCIA`/`EN_REPARTO` solo existen como estados de Shalom (`EN_DESTINO`, `EN_REPARTO`, `:83-90`). Ver **D-08**. |
| `COMPROBANTE_ACEPTADO` | Callback del PSE de SUNAT con `pdf_url` | **SIN DEFINIR** dónde se engancha (ms-integrations/SUNAT). |
| `SALDO_COD` | "24 h antes de la entrega estimada" | **SIN DEFINIR**: no hay fecha de entrega estimada confiable ni evento de saldo. |
| Foto de entrega | "Evidencia de despacho" | Hoy la sube un usuario (C-E5). No hay ingreso por courier. |
| Webhooks de Meta (`statuses`, `messages`, `message.echo`, `message_template_status_update`, `phone_number_quality_update`, `account_update`) | `POST /webhooks/whatsapp` | Solo backend. Fuera del alcance del frontend. |
| Workers (cola, campañas, salud, alertas, A/B, contingencia) | §11 | Solo backend. |

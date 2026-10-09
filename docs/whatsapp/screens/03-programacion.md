# 03 · Pestaña Programación (`?tab=programacion`)

Referencias: PDF §6.3, §11, §12.1, §13 casos 1-8, 28, 30, 35, §14.3; mockup `#p-programacion`, `#mApply`, `#mSched`.
Permisos (PDF §6.6.3): reglas `WA_RULES` (Administrador), envíos programados `WA_CAMPAIGNS` (Administrador y Supervisor CC). Hoy solo administradores y superadmins pueden editar (D-33); no se deducen permisos para Supervisor CC ni Asesora (D-11).

**Estado (etapa 4):** frontend implementado completo. Formularios, validaciones, vistas previas, descarte, enlace desde Plantillas y todos los estados de pantalla funcionan en local y en Storybook. **Pendiente de integración:** leer y guardar reglas, ajustes, cola, no enviados y envíos programados; conteos, costos y activación (C-16, C-18, C-20, C-21, C-24).

## Implementado frente a pendiente

| Parte | Frontend (implementado) | Pendiente de integración |
|---|---|---|
| Avisos automáticos | Tarjeta por regla con plantilla, momento de envío, recordatorio, alcance, resumen, "Ver mensaje", activación y desactivación con diálogos | `GET /wa/rules`, `PUT /wa/rules/:id`, `POST …/preview`, `POST …/activate`, `POST …/deactivate` |
| Datos faltantes | Restricciones obligatorias y configurables; listado "Hoy no se enviaron" con "Corregir" | `GET/PUT /wa/settings` (`missingData`), `GET /wa/messages?status=skipped` |
| Horario y límites | Formulario completo con validación | `GET/PUT /wa/settings` (`schedule`, `dedupe`, `maxPerOrderPerDay`) |
| Próximas 24 horas | Listado con estados de pantalla | `GET /wa/queue/upcoming` |
| Envíos programados | Listado, modal de creación/edición, resultados, acciones | `GET/POST/PUT /wa/campaigns`, `POST …/pause|resume`, `POST /wa/campaigns/segment-count`, resultados |
| Catálogos | Tiendas, canales, tipos de envío y couriers reales, con carga, error y vacío | — (confirmados: C-E1, C-E2, C-E3, C-E8) |

## Componentes

| Archivo (`src/app/configuracion/whatsapp/_components/programacion/`) | Responsabilidad |
|---|---|
| `SchedulingTab.tsx` | Contenedor: estados pendientes, catálogos reales (`useWhatsAppScopeCatalogs`), enlace desde Plantillas, `OrderDetailModalProvider` para "Corregir" |
| `SchedulingView.tsx` | Vista presentacional que compone las cinco secciones (stories) |
| `RulesSection.tsx`, `RuleCard.tsx`, `RuleScopeFields.tsx`, `ScopeChipGroup.tsx`, `scope-labels.ts` | Avisos automáticos |
| `ActivateRuleDialog.tsx`, `DeactivateRuleDialog.tsx`, `RuleMessagePreviewDialog.tsx`, `RuleLinkNotice.tsx` | Diálogos y aviso del enlace |
| `MissingDataSection.tsx`, `SendingHoursSection.tsx`, `SettingsStateGate.tsx`, `FormDraftActions.tsx` | Ajustes de envío |
| `UpcomingQueueSection.tsx` | Próximas 24 horas |
| `CampaignsSection.tsx`, `CampaignDialog.tsx`, `CampaignResultsDialog.tsx` | Envíos programados |
| `src/components/whatsapp/BlockedActionButton.tsx` | Botón con `aria-disabled` y explicación (reutilizable) |

Dominio (`src/features/whatsapp/`): `constants/whatsapp-scheduling-catalog.ts`, `schemas/rule-config.schema.ts`, `schemas/sending-schedule.schema.ts`, `schemas/campaign.schema.ts`, `mappers/to-scheduling-form-values.mapper.ts`, `utils/rule-summary.util.ts`, `utils/rule-link.util.ts`, `hooks/use-whatsapp-scope-catalogs.ts`, modelos `rule`, `sending-settings`, `queue`, `campaign`, `money`, `scope-catalog`.

## Comportamiento común sin backend

- Cada sección que depende de datos muestra "pendiente de integración" con un texto que aclara que **no** es una lista vacía. No hay tarjetas, contadores, costos ni "0" ficticios.
- Los formularios se pueden completar y validar. Guardar, activar, desactivar, pausar y reanudar usan `BlockedActionButton`: `aria-disabled`, descritos por un texto que explica que el servicio no está conectado, y sin efecto al pulsarlos.
- Descartar cambios pide confirmación (`AlertDialog`) en tarjetas, formularios de ajustes y modales.
- Nada se guarda en `localStorage`.
- Las mutaciones solo se activarán con el contrato confirmado **y** un manejador real; tener un formulario editable no habilita nada.

---

## T3.S1 · Resumen de avisos

Etiquetas "≈ S/ X al mes · lo cobra Meta" y "N activos" solo con `summary` de C-16. Sin datos no se muestran. El frontend no calcula costos (D-05).

## T3.S2 · Tarjeta de regla

| Campo | Detalle |
|---|---|
| Identidad | `rule.key` (`WHATSAPP_RULE_KEYS`: las nueve reglas del PDF) es la identidad estable; `rule.id` es el ID de backend. El frontend **no** relaciona reglas con estados del pedido: muestra `triggerLabel` tal como lo envía backend (D-08) |
| Cabecera | Nombre, "Se dispara: {triggerLabel}", interruptor (`aria-checked` = estado guardado) |
| Plantilla | `Select` con todas las plantillas; las no aprobadas deshabilitadas con su estado. Sin C-12: deshabilitado con "Plantillas pendientes de integración" |
| Bloqueos | `blockedReason` de backend, o plantilla no aprobada: recuadro ámbar e interruptor deshabilitado. Si la regla está activa y su plantilla tiene una edición en revisión con versión aprobada: aviso informativo "se sigue enviando la versión aprobada" |
| Cuándo enviar | Solo los modos de `allowedWhenModes` (backend). Valor según el modo: minutos (1-10.080), hora fija `HH:mm` (Lima), horas antes de la entrega (1-168). Al elegir un modo sin valor se propone 30 min, 09:00 o 24 h (valores del mockup) |
| Recordatorio | Si la regla lo trae o el catálogo lo admite (Disponible en agencia): "Recordar si no lo recoge" + horas (1-168) |
| Alcance | Bloque plegable "A qué pedidos" con resumen en vivo (`describeRuleScope`): fechas (desde que se activa / entre dos fechas, "hasta" opcional y ≥ "desde"), antigüedad (1-365 días), tiendas, canales, tipos de envío y couriers. Lista vacía = "Todas/Todos" |
| Catálogos | Cada grupo muestra su propio cargando, error, pendiente o vacío. Los valores elegidos se conservan si el catálogo se recarga o falla; un valor guardado que ya no existe se muestra "(no disponible)" y se puede quitar |
| Pie | "{momento} · respeta horario", "N hoy · ≈ S/ X/mes" solo con datos, "Apagado" si está apagada, "Ver mensaje" (vista previa de la plantilla elegida con datos de muestra) |
| Acciones | Con cambios: "Descartar cambios" (confirmación) y "Guardar cambios" (bloqueado). El borrador no se pierde si llegan datos nuevos de la regla o de los catálogos (solo se recarga si no hay cambios) |
| Sin permisos | Solo lectura; interruptor deshabilitado |
| Mutación propuesta | `PUT /wa/rules/:id` con `If-Match: <version>`; payload `{ templateId, when: { mode, minutes, time, hours }, reminder: { enabled, hours } \| null, scope: { dateMode, from, to, maxOrderAgeDays, storeIds, salesChannels, shippingTypes, courierIds } }` (fechas `YYYY-MM-DD` en Lima, listas vacías = todas) |
| Errores | `422 WA_VALIDATION` por campo; `409 WA_VERSION_CONFLICT` (recargar sin perder el borrador); `409 WA_TEMPLATE_NOT_APPROVED`; `403 WA_FORBIDDEN` |
| Contrato | C-16 SPEC (no disponible) |

## T3.M1 · Activar regla (vista previa)

| Campo | Detalle |
|---|---|
| Disparador | Encender una regla apagada, o "Ver a cuántos pedidos actuales aplica" (modo consulta, sin activar) |
| Contenido | Título "Activar: {regla}"; criterios (resumen del alcance); conteo, estado y costo **solo** con datos reales; fecha de cálculo en hora de Lima y aviso de que se recalcula al activar |
| Opciones | "Solo pedidos nuevos" (por defecto). "También a los N pedidos actuales" solo habilitada con N > 0 real; con 0: "no hay pedidos que cumplan esta regla"; sin dato: "(cantidad desconocida)" deshabilitada |
| Estados del preview | Pendiente ("Conteo y costo pendientes de integración", nunca "0"), cargando, error, cero, resultados |
| Cambios sin guardar | Aviso: el conteo y la activación usan la configuración guardada; "Activar" bloqueado hasta guardar |
| Activar | Bloqueado con explicación: "El aviso sigue apagado y no se encoló ningún mensaje". El interruptor no cambia |
| Preview propuesto | `POST /wa/rules/:id/preview` (alcance guardado) → `{ matchingOrders, orderStateLabel, estimatedCost: { usd, pen, exchangeRate, rateDate }, computedAt }` |
| Activación propuesta | `POST /wa/rules/:id/activate` `{ includeExisting: boolean, previewComputedAt }` con `Idempotency-Key` y `If-Match` → `{ active: true, enqueued: number }` |

**Preview frente a activación (garantías de backend).** El preview es informativo y puede quedar desactualizado. Al activar, backend debe: revalidar la versión de la regla (`If-Match`, `409 WA_VERSION_CONFLICT`); recalcular en ese momento los pedidos que cumplen el alcance y siguen en el estado (no usar el número del preview); aplicar bajas, máximo diario, horario y anti-duplicado a cada pedido actual; ser idempotente (`Idempotency-Key`) para no encolar dos veces; responder la cantidad realmente encolada; y registrar la activación en la auditoría con usuario, opción elegida y cantidad. El frontend mostrará el número que responda la activación, no el del preview.

## Desactivar (propuesto)

`AlertDialog` "¿Desactivar «regla»?"; "Desactivar" bloqueado con explicación. Propuesta: `POST /wa/rules/:id/deactivate` con `Idempotency-Key`. Qué pasa con los avisos ya encolados (cancelar o dejar salir) **SIN DEFINIR** (D-47).

## T3.S3 · Si al pedido le faltan datos + "Hoy no se enviaron"

| Campo | Detalle |
|---|---|
| Obligatorias | Dos filas con candado e insignia "Obligatoria": falta link/courier/agencia; teléfono no válido de Perú. No son interruptores |
| Configurables | "Avisar a la asesora del pedido" y "Enviar solo cuando se corrija el dato". Sin backend: valores sugeridos del PDF (ambos activos) con el texto "estos valores no están guardados" |
| Listado | Pedido, comprador, plantilla, motivo y hora (Lima). "Corregir" abre la ficha compartida del pedido (`openOrderDetail(orderId, { initialTab: "seguimiento" })`) **solo** si el aviso trae `orderId`; si no, deshabilitado |
| Reenvío | No lo hace el frontend: lo hace el servicio de avisos al corregirse el dato (texto visible) |
| Contratos | `PUT /wa/settings` (`missingData`) con `If-Match`; `GET /wa/messages?status=skipped&from=<hoy Lima>` → `{ id, orderId, orderNumber, customerName, templateName, reason, createdAt }` |

## T3.S4 · Horario permitido y límites

| Campo | Detalle |
|---|---|
| Campos | Días (Lun–Dom, botones con `aria-pressed`), Desde, Hasta, "Si un aviso cae fuera del horario" (enviarlo al inicio del siguiente horario / no enviarlo), "No repetir el mismo aviso en un pedido", "Máximo de avisos por pedido al día", zona fija Lima (GMT-5) |
| Valores iniciales | Sin backend: sugeridos del PDF (Lun–Sáb, 08:00–21:00, enviar al siguiente horario, no repetir, máximo 3) con el texto "No son la configuración guardada de la tienda". Con backend: la configuración guardada |
| Validaciones | Al menos un día; horas `HH:mm`; "Hasta" distinta y posterior a "Desde"; máximo entero 1-10 |
| Combinaciones ambiguas | Un horario que cruza la medianoche (22:00–06:00) se **rechaza** por ahora: el PDF no dice a qué día pertenece la franja ni cómo se combina con los días elegidos (D-48). Días sin horario distinto por día: no soportado (PDF tampoco lo pide). Rango máximo por día: el PDF solo da el valor 3; 1-10 es propuesta |
| Contrato | `GET/PUT /wa/settings` (`schedule`, `dedupe`, `maxPerOrderPerDay`) con `If-Match`; validación final en backend |

## T3.S5 · Próximas 24 horas

Listado de grupos con hora y día (Lima), punto verde o ámbar, plantilla o envío, cantidad de pedidos, origen (aviso automático, recordatorio, envío programado) y motivo ("Pasa a mañana 08:00 · Fuera del horario permitido"). Etiqueta "N en cola" solo con datos. Estados pendiente (explica que la cola la calcula y ejecuta el servicio), cargando, error y vacío. El navegador no programa ni envía nada. Contrato: `GET /wa/queue/upcoming?storeId=&hours=24` (C-20). Polling 60 s cuando exista.

## T3.S6 · Envíos programados

| Campo | Detalle |
|---|---|
| Listado | Nombre, plantilla, segmento (`segmentLabel` de backend o compuesto con catálogos), una vez/recurrente con fecha y hora, volumen y estado (Programado, Activo, Pausado, "Pausado por calidad", Completado) |
| Volumen | Programado/activo/pausado: "N pedidos hoy · se recalcula al enviar" si backend lo envía; si no, "Destinatarios: se calculan al enviar". Completado: "X enviados · Y leídos" con resultados reales o "Resultados pendientes" |
| Acciones | Editar (no en completados); Pausar/Reanudar bloqueados con explicación; "Ver resultados" en completados (diálogo con enviados, entregados, leídos, rastreo y no enviados, o "pendientes de integración") |
| Estados | Pendiente, cargando, error, vacío ("No tienes envíos programados"), contenido |

### T3.M2 · Programar / editar envío

| Campo | Detalle |
|---|---|
| Campos | Nombre (1-80); plantilla (solo aprobadas; sin C-12, deshabilitado); estado del pedido (En camino, Disponible en agencia, En reparto: valores `EN_ENVIO`, `EN_AGENCIA`, `EN_REPARTO` del PDF, que interpreta backend); courier ("Todos" + catálogo real, con su estado de carga/error); tienda (catálogo real); destino (Todo el Perú, Solo Lima, Solo provincia); cuándo: una sola vez (fecha + hora) o se repite (frecuencia + hora) |
| Destinatarios | Pendiente: "Conteo de destinatarios pendiente de integración" y la aclaración de que la lista se recalcula al enviar. Con datos: "Hoy esto incluye N pedidos (calculado el …)" |
| Validaciones | Nombre requerido; plantilla, tienda, courier y hora requeridos; una vez: fecha válida y fecha+hora posteriores a ahora **en hora de Lima** (se revalida al cambiar la hora); se repite: frecuencia requerida |
| Guardar | "Programar"/"Guardar cambios" bloqueado con explicación; descarte con confirmación; cada apertura empieza limpia |
| Propuesto | `POST /wa/campaigns` (`Idempotency-Key`) / `PUT /wa/campaigns/:id` (`If-Match`) con `{ name, templateId, segment: { stage, courierId \| null, storeId, destination }, schedule: { type, date \| null, recurrence \| null, time, timezone: "America/Lima" } }`; `POST /wa/campaigns/segment-count` `{ storeId, segment }` → `{ matchingToday, computedAt }`; `POST /wa/campaigns/:id/pause|resume`; `GET /wa/campaigns/:id/results` |
| Errores | `422` por campo (fecha pasada según el reloj del servidor), `409 WA_TEMPLATE_NOT_APPROVED`, `409 WA_CAMPAIGNS_PAUSED_BY_QUALITY`, `409 WA_VERSION_CONFLICT` |
| Garantías de backend | Recalcular el segmento al ejecutar; respetar bajas, horario y máximo; pausar por calidad roja y reanudar (§6.6.2); calcular "Solo Lima / Solo provincia" (SIN DEFINIR, D-09) |

## Enlace desde Plantillas

- "Activar en una regla" construye `?tab=programacion&rule=<ruleKey>&template=<templateId>` con `buildActivateRuleSearch`. La regla se obtiene del **uso** de la plantilla (`getRuleDefinitionForTemplateUsage`), no de estados del pedido.
- Programación muestra `RuleLinkNotice`: reglas pendientes ("no se activó nada"), regla inexistente en el enlace, plantilla sin aviso automático (p. ej. "Solo envíos programados"), regla no disponible para la tienda, plantilla del enlace que ya no existe.
- Con reglas reales y la regla presente: resalta y enfoca la tarjeta y **preselecciona** la plantilla si está aprobada, con el aviso "Todavía no se guardó ni se activó". Nunca guarda, crea ni activa.
- Al cerrar el aviso o salir de Programación se quitan `rule` y `template` de la URL.
- El aviso de aprobación en Plantillas solo se arma con una plantilla aprobada real (`buildApprovedNotice`); hoy no hay datos, así que no aparece.

## Responsabilidades de backend (resumen)

Cola y ejecución (§11); cálculo de `send_at`; recordatorios; horario y reprogramación; anti-duplicado (pedido + evento); máximo diario con prioridad para comprobante e incidencia (caso 30); reevaluación del alcance y del estado del pedido al momento de enviar; cancelación del aviso viejo si el pedido avanzó (caso 2); antigüedad (caso 5); bajas; preview y activación (ver arriba); segmentos de campañas evaluados al enviar; pausa por calidad; auditoría de cada cambio (C-00.8); separación por empresa y tienda (C-00.3); idempotencia en activaciones y campañas (C-00.7).

## Criterios de aceptación

| Criterio | Estado |
|---|---|
| Sin backend se ve "pendiente", no "sin reglas", y sin ceros ni costos inventados | Hecho, con tests |
| Tarjetas con plantilla, momento, recordatorio, alcance, resumen y vista del mensaje | Hecho (stories y tests) |
| Catálogos reales con carga, error y vacío; borrador preservado al recargar | Hecho, con tests |
| Activación con opción por defecto "solo nuevos", conteo/costo solo reales, bloqueada y sin cambiar el interruptor | Hecho, con tests |
| Restricciones obligatorias distinguidas; "Corregir" con ID real | Hecho, con tests |
| Horario validado; horario que cruza medianoche rechazado y documentado | Hecho, con tests |
| Envíos programados con estados, recurrencia, fecha futura en Lima, descarte y acciones bloqueadas | Hecho, con tests |
| Enlace desde Plantillas con identidad estable y estados explicativos | Hecho, con tests |
| Cada regla envía en el momento correcto; el alcance excluye; horario/anti-duplicado/máximo se respetan; campañas evaluadas al enviar (§14.3) | Pendiente (backend) |
| Revisión visual en desktop, mobile, 320 px y modo oscuro | Pendiente (sin navegador) |

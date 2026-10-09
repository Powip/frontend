# Notificaciones por WhatsApp (Hito 1) — plan de frontend

Fecha: 2026-10-08. Rama: `feat/whatsapp-notificaciones` (base `main` @ `a898173`).

## 1. Principios

1. **Manda el PDF**; el mockup es referencia visual e interacciones (PDF §0.2).
2. **Sin datos ficticios en la app.** Conexiones, mensajes, métricas, contadores y guardados solo se muestran si vienen de backend. Los datos de ejemplo viven en `src/mocks/` y se usan solo en Storybook y tests.
3. **Tres estados distintos** para cada bloque que depende de datos: *pendiente de integración* (no hay contrato), *vacío real* (el contrato respondió sin filas) y *error* (el contrato falló). Más *cargando* y *sin permisos*.
4. **Lo local funciona sin persistencia**: formularios, validaciones, vista previa del teléfono, inserción de variables, advertencia de lenguaje promocional, resúmenes de alcance. Los botones que persisten quedan deshabilitados con "pendiente de integración" hasta que exista el contrato.
5. **`localStorage` solo para preferencias** de vista (pestaña, Tablero/Lista). Nunca como sustituto de backend.
6. **Seguir los patrones reales del repo**: dominio en `src/features/<dominio>/` (api → dto → mapper → model → service → hook → keys), TanStack Query, `axiosAuth`, Zod 4, React Hook Form, componentes de `src/components/ui` (Radix + shadcn), MSW en Storybook. Sin comentarios en el código (instrucción del encargo).
7. **Backend fuera de alcance**: webhooks, workers, colas, acortador, envío, Embedded Signup del lado servidor. Solo se documentan ([backend-contract.md](backend-contract.md)).

## 2. Piezas existentes que se reutilizan

| Pieza | Archivo | Uso |
|---|---|---|
| Patrón de dominio | `src/features/identity-lookup/`, `src/features/sunat/` | Estructura de `src/features/whatsapp/`. Biome solo revisa `src/features` (`package.json` scripts `lint`/`format`). |
| Cliente HTTP con token | `src/lib/axiosAuth.ts` | Todas las llamadas `/wa/...`. |
| Mapa de servicios | `src/lib/api.ts` | Agregar `whatsapp` cuando backend defina el servicio (C-00.1). |
| Polling condicionado | `src/features/sunat/sunat-document/hooks/use-list-sunat-documents.ts` | `refetchInterval` según estado (plantillas en revisión, prueba en curso). |
| Traducción de errores | `src/features/identity-lookup/utils/identity-lookup-error.util.ts` | Modelo de `whatsapp-error.util.ts`. |
| MSW + Storybook | `.storybook/preview.tsx`, `src/mocks/handlers/identity-lookup.handlers.ts`, `src/app/facturacion/components/VerifyIdentityButton.stories.tsx` | Handlers y fixtures de WhatsApp para stories. |
| Sesión, empresa, tiendas | `src/contexts/AuthContext.tsx` (`auth.company.stores`, `selectedStoreId`, `hasPermission`) | Selector de tienda, separación por empresa, permisos. |
| Permisos por rol | `src/config/permissions.config.ts` (`hasAdminAccess`, `isSuperadmin`), `src/config/operationsPermissions.ts` | Modelo para `WA_*`. |
| Tabs por URL | `src/app/operaciones/guias/page.tsx:26-27`, `:53-56` | `?tab=` en `/configuracion/whatsapp`. |
| Menú con etiqueta "Nuevo" | `src/components/layout/Sidebar.tsx:85-86`, `:216-219` (`badge`, `badgeUntil`) | Ítem "WhatsApp". |
| Tarjetas de Configuración | `src/app/configuracion/page.tsx:13-46` | Tarjeta "WhatsApp". |
| Cabecera de configuración | `src/components/header/HeaderConfig.tsx` | Título y acciones de la página. |
| Ficha del pedido | `src/components/orders/OrderDetailModal.tsx` (provider + botón "Ver") → `src/components/modals/CustomerServiceModal.tsx` (pestañas `resumen`, `seguimiento`, `pagos`, `reasignacion`; Seguimiento en `:2188`) | Sección "Mensajes de WhatsApp". `initialTab="seguimiento"` ya existe. |
| Evidencia del pedido | `src/components/orders/OrderEvidenceSection.tsx` (C-E5) | Foto en el hilo. |
| Ícono WhatsApp | `src/components/shared/WhatsAppIcon.tsx` | Botones e indicador. |
| Validación de celular | `src/utils/whatsapp/build-whatsapp-url.ts` (`toWhatsAppNumber`) | Mensaje de prueba, alta de baja. |
| Lista de asesoras | `src/services/agentesService.ts:22` (C-E4) | Reasignar, "quién envía asistidos". |
| Catálogo de couriers | `src/services/courierService.ts:24` (C-E2) | Alcance de reglas y segmentos. |
| UI | `src/components/ui/{tabs,dialog,alert-dialog,sheet,switch,select,checkbox,table,badge,tooltip,skeleton,empty-state,alert,progress,pagination,textarea,input,form}.tsx` | Todas las pantallas. |
| Exportación | `src/utils/exportCcPedidosExcel.ts` (ExcelJS + file-saver) | Historial, si D-17 se resuelve en cliente. |

Piezas útiles en una rama **no mergeada** (`origin/feat/usuarios-roles-permisos`): `PendingBackendNotice`/`UsersNotice` y `PermissionMatrix`. No están en la base; si esa rama entra antes, se mueven a `src/components/shared/` y se reutilizan en vez de duplicarlas.

## 3. Ruta y estructura

### 3.1 Ruta

`/configuracion/whatsapp` (cliente). Pestañas por `?tab=conexion|plantillas|programacion|conversaciones|historial|ajustes`. Si no hay `?tab`, se usa la preferencia guardada (`powip:wa:tab`) y si no, `conexion` (D-19).

`/configuracion` ya está en `ROUTE_PERMISSIONS` con acceso para cualquier autenticado (`src/config/permissions.config.ts`); la página hace su propio control por permiso, como las demás subpáginas de configuración. Decisión adoptada en la etapa 2: D-33.

### 3.2 Archivos definitivos (etapa 2)

```
src/features/whatsapp/
  enums/whatsapp.enums.ts                 estados de mensaje, direcciones, tipos de mensaje, columnas del
                                          tablero, estados/categorías/encabezados de plantilla, eventos de
                                          aviso, modos "cuándo", estados y tipos de campaña, pestañas,
                                          estados de contrato
  models/message.model.ts                 WhatsAppMessage (+ autor, documento, evidencia, línea de tiempo)
  models/conversation.model.ts            conversación, atención, ventana, tablero, lista (etapa 5;
                                          reemplaza a thread.model.ts)
  models/template.model.ts                WhatsAppTemplate
  models/rule.model.ts                    WhatsAppRule (+ when, scope)
  models/campaign.model.ts                WhatsAppCampaign (+ segmento, programación)
  models/contract.model.ts                WhatsAppContract
  constants/whatsapp-contracts.ts         registro de contratos (§6.1)
  constants/whatsapp-tabs.ts              definición de pestañas, clave de preferencia, pestaña por defecto
  keys/whatsapp.keys.ts                   query keys por empresa y tienda
  utils/template-name.util.ts             nombre técnico de plantilla
  utils/template-render.util.ts           segmentos tipados (texto/variable, negrita/cursiva), variables
  utils/promotional-language.util.ts      advertencia orientativa de lenguaje promocional
  utils/reply-window.util.ts              ventana de 24 h según backend (etapa 5, D-57)
  utils/lima-time.util.ts                 fechas y horas en America/Lima
  utils/message-status.util.ts            etiquetas, rango de Meta y separación de estados
  utils/whatsapp-tab.util.ts              pestaña por URL/preferencia y localStorage seguro
  utils/whatsapp-access.util.ts           quién gestiona la configuración (admin/superadmin)
  utils/__tests__/*.test.ts
  __tests__/whatsapp-contracts.test.ts    registro, pestañas, keys, acceso
  __tests__/no-mock-imports.test.ts       guarda: sin mocks ni /wa ni red en producción

src/components/whatsapp/
  MessageStatusTicks.tsx (+ .stories.tsx)
  WhatsAppPhonePreview.tsx (+ .stories.tsx)
  WhatsAppThread.tsx (+ .stories.tsx)
  WhatsAppFormattedText.tsx               render seguro de *negrita*, _cursiva_ y variables
  PendingIntegrationNotice.tsx (+ .stories.tsx)
  __tests__/whatsapp-components.test.tsx

src/app/configuracion/whatsapp/
  page.tsx                                Suspense + contenido
  _components/WhatsAppSettingsContent.tsx cabecera, aviso "Integración pendiente", pestañas
  _components/WhatsAppTabs.tsx            ?tab + preferencia, sin desajuste de hidratación
  _components/WhatsAppTabPanel.tsx        descripción, aviso pendiente, nota de acceso
  _components/WhatsAppStoresPendingList.tsx  tiendas reales con estado pendiente (Conexión)
  __tests__/page.test.tsx

src/mocks/whatsapp/whatsapp-message.fixtures.ts
src/mocks/whatsapp/whatsapp-template.fixtures.ts

Modificados: src/components/layout/Sidebar.tsx, src/app/configuracion/page.tsx,
             src/components/header/HeaderConfig.tsx
```

No se crearon `api/`, `dto/`, `mappers/`, `services/` ni `hooks/`: no hay contrato que consumir y el encargo prohíbe llamar a `/wa`. Tampoco `WhatsAppResourceState` (nada carga datos todavía) ni handlers MSW (ninguna story hace peticiones).

### 3.3 Árbol de archivos para las etapas siguientes (propuesto)

```
src/features/whatsapp/
  api/            whatsapp-status.api.ts, whatsapp-accounts.api.ts, whatsapp-signup.api.ts,
                  whatsapp-contingency.api.ts, whatsapp-assisted-queue.api.ts,
                  whatsapp-templates.api.ts, whatsapp-rules.api.ts, whatsapp-settings.api.ts,
                  whatsapp-queue.api.ts, whatsapp-campaigns.api.ts, whatsapp-threads.api.ts,
                  whatsapp-messages.api.ts, whatsapp-optouts.api.ts, whatsapp-alerts.api.ts,
                  whatsapp-audit.api.ts, whatsapp-permissions.api.ts, whatsapp-pricing.api.ts
  dto/            *.dto.ts por contrato (formas de backend-contract.md)
  enums/          whatsapp.enums.ts (estados de mensaje, columnas, categorías, modos "cuándo", orígenes de baja…)
  models/         *.model.ts (lo que consumen los componentes)
  mappers/        to-*.mapper.ts (+ __tests__)
  services/       *.service.ts (api + mapper)
  hooks/          use-whatsapp-*.ts (queries y mutations)
  keys/           whatsapp.keys.ts
  schemas/        template-editor.schema.ts, rule.schema.ts, campaign.schema.ts, sending-settings.schema.ts,
                  auto-reply.schema.ts, test-message.schema.ts, opt-out.schema.ts, alert-rules.schema.ts,
                  contingency.schema.ts
  constants/      whatsapp-contracts.ts (registro de disponibilidad por contrato),
                  whatsapp-copy.ts (textos fijos de producto, D-32),
                  whatsapp-spec-catalog.ts (listas del PDF usadas solo para diseño local)
  utils/          template-name.util.ts, template-render.util.ts, template-variables.util.ts,
                  promo-language.util.ts, rule-summary.util.ts, reply-window.util.ts,
                  lima-time.util.ts, message-status.util.ts, whatsapp-error.util.ts,
                  whatsapp-permissions.util.ts (+ __tests__)

src/components/whatsapp/          (lo que se usa fuera de /configuracion/whatsapp)
  MessageStatusTicks.tsx          ticks gris/azul, No enviado, Asistido, En cola
  WhatsAppNoticeButton.tsx        botón WhatsApp + mini indicador del último aviso (X2)
  WhatsAppThread.tsx              hilo presentacional (burbujas, notas, evidencia, documento)
  WhatsAppThreadBubble.tsx
  WhatsAppPhonePreview.tsx        teléfono con burbuja, encabezado, pie y botones
  OrderWhatsAppMessages.tsx       sección "Mensajes de WhatsApp" de la ficha (X1)
  PendingIntegrationNotice.tsx
  WhatsAppResourceState.tsx       cargando / vacío / error / sin permisos / pendiente

src/app/configuracion/whatsapp/
  page.tsx
  _components/
    WhatsAppPageHeader.tsx, WhatsAppConnectionPill.tsx, WhatsAppStoreSelect.tsx, WhatsAppTabs.tsx
    conexion/        ConnectionTab, ConnectionTypeCards, ConnectedNumberCard, TestMessageCard,
                     StoreNumbersCard, ContingencyCard, AssistedQueueList, MessagingCostCard,
                     ConnectNumberDialog, DisconnectNumberDialog, ChangeConnectionTypeDialog
    plantillas/      TemplatesTab, TemplatesTable, TemplateStatusFilter, TemplateApprovedBanner,
                     TemplateEditorDialog, TemplateEditorForm, TemplateVariableChips,
                     PromoLanguageWarning, TemplateAbFields
    programacion/    SchedulingTab, RulesSummary, RuleCard, RuleWhenFields, RuleScopeFields,
                     ActivateRuleDialog, MissingDataCard, SkippedTodayList, SendingHoursCard,
                     UpcomingQueueCard, CampaignsCard, CampaignDialog
    conversaciones/  ConversationsTab, ConversationsToolbar, ConversationsBoard, ConversationCard,
                     ConversationsTable, ConversationDrawer, ConversationComposer,
                     ConversationFailedFooter, AutoReplyDialog
    historial/       HistoryTab, HistoryPeriodSelect, MessageKpis, DeliveryFunnel, StatusLegend,
                     MessagesTable, MessageTimelineRow
    ajustes/         SettingsTab, OptOutsCard, AddOptOutDialog, ReactivateOptOutDialog,
                     HealthAlertsCard, RecentAlertsCard, ForeignNumbersCard, AuditLogCard,
                     PermissionsCard

src/mocks/whatsapp/               fixtures (solo stories y tests)
src/mocks/handlers/whatsapp.handlers.ts   handlers MSW por contrato y escenario
```

Pruebas en `__tests__/` junto a cada carpeta (patrón del repo). Stories `*.stories.tsx` junto a cada componente.

## 4. Componentes clave

| Componente | Responsabilidad | Datos | Reutilizado en |
|---|---|---|---|
| `WhatsAppResourceState` | Recibe un estado discriminado y pinta carga (skeleton), vacío (`EmptyState`), error (con Reintentar), sin permisos o pendiente | `WaResourceState<T>` | Todas las secciones |
| `PendingIntegrationNotice` | Aviso neutro "Pendiente de integración" con el nombre de la capacidad, sin IDs internos en la UI | — | Todas las secciones y botones deshabilitados (tooltip) |
| `MessageStatusTicks` | Muestra `queued/sent/delivered/read/failed/skipped/assisted` con ícono y texto accesible | estado | Historial, conversaciones, hilo, indicador, prueba |
| `WhatsAppPhonePreview` | Burbuja tipo WhatsApp con variables resaltadas, `*negrita*`, `_cursiva_`, encabezado texto/PDF, pie, botón de enlace y respuesta rápida | plantilla + valores | Editor de plantillas, "Ver mensaje" de reglas |
| `WhatsAppThread` | Lista de mensajes (plantilla, texto, automática, asesora, eco de app, nota interna, evidencia, documento, adjunto entrante) | `ThreadMessage[]` | Cajón de Conversaciones y ficha del pedido |
| `WhatsAppNoticeButton` | Botón WhatsApp existente + mini indicador del último aviso; no cambia lo que hace el clic | `waLastNotice` (C-29) | Ventas, Operaciones › Pedidos, Gestión CC |
| `OrderWhatsAppMessages` | Línea de tiempo del pedido con "Abrir conversación" | C-22.7 | `CustomerServiceModal` › Seguimiento |
| `ConversationDrawer` | Cabecera, ventana, hilo y pie según estado | C-22.3 | Pestaña Conversaciones, botón "Abrir conversación" de la ficha |

El cajón usa `Sheet` (`src/components/ui/sheet.tsx`); los modales, `Dialog`; las confirmaciones, `AlertDialog`.

## 5. Datos, caché e invalidación

### 5.1 Claves (`whatsapp.keys.ts`)

`["whatsapp", <recurso>, <storeId>, <filtros>]`, con fábricas al estilo de `identityLookupKeys`/`sunatDocumentKeys`. Recursos: `status`, `accounts`, `usage`, `pricing`, `contingency`, `assisted-queue`, `templates`, `template`, `template-catalog`, `preview-orders`, `rules`, `rule-preview`, `settings`, `queue-upcoming`, `campaigns`, `segment-count`, `threads`, `threads-summary`, `thread`, `thread-by-order`, `messages`, `messages-metrics`, `optouts`, `alert-rules`, `alerts`, `audit`, `permissions`, `message` (estado de un mensaje).

### 5.2 Polling (C-00.9)

| Dato | Intervalo | Condición |
|---|---|---|
| `status` (cabecera y contador) | 30 s | Página visible |
| `threads` + `threads-summary` | 15 s | Pestaña Conversaciones activa |
| `thread` | 5 s | Cajón abierto |
| `thread-by-order` | 15 s | Pestaña Seguimiento de la ficha abierta |
| `message` (prueba) | 2 s | Hasta `read`/`failed` o 2 min; luego botón "Actualizar" |
| `templates` | 30 s | Hay alguna en `PENDING` |
| `assisted-queue` | 15 s | Contingencia activa |
| `queue-upcoming` | 60 s | Pestaña Programación activa |
| `accounts` | — | Manual (botón Actualizar → C-04) |
| `messages`, `metrics`, `audit`, `optouts`, `alerts` | — | Al cambiar filtros o con botón Actualizar |

El `QueryClient` que monta el layout tiene `refetchOnWindowFocus: false`, `staleTime` 5 min y `retry: 1` (`src/components/providers/QueryProvider.tsx`); los hooks de WhatsApp fijan `staleTime` propio corto donde hay polling y `retry: false` en mutaciones que envían mensajes (la idempotencia la da `Idempotency-Key`, C-00.7).

### 5.3 Invalidaciones

| Mutación | Invalida |
|---|---|
| Conectar / desconectar / cambiar tipo / actualizar | `status`, `accounts`, `rules`, `campaigns` |
| Guardar contingencia, activar/desactivar | `contingency`, `status`, `assisted-queue` |
| Marcar asistido abierto/enviado/descartado | `assisted-queue`, `messages` |
| Crear/editar/enviar/duplicar plantilla | `templates`, `template`, `rules` (selects) |
| Guardar/activar/desactivar regla | `rules`, `queue-upcoming` |
| Guardar ajustes (horario, datos faltantes, respuesta automática, extranjeros, bajas por palabra) | `settings`, `queue-upcoming` |
| Crear/editar/pausar/reanudar envío programado | `campaigns`, `queue-upcoming` |
| Responder, enviar plantilla, asignar, atender, nota | `thread`, `threads`, `threads-summary`, `status`, `thread-by-order` |
| Reintentar/reenviar | `thread`, `threads`, `messages`, `messages-metrics` |
| Dar de baja / reactivar | `optouts`, `thread`, `threads`, `audit` |
| Guardar alertas | `alert-rules`, `audit` |
| Guardar permisos | `permissions`, `audit` |

Toda mutación de configuración invalida también `audit`.

## 6. Revisión sin backend

### 6.1 Registro de contratos

**Implementado (etapa 2).** `src/features/whatsapp/constants/whatsapp-contracts.ts` registra cada contrato con `id` (C-xx de [backend-contract.md](backend-contract.md)), `label`, `status` y `evidence`:

| `status` | Significado | `isWhatsAppContractAvailable` |
|---|---|---|
| `confirmed` | Se usa hoy en el repo; `evidence` apunta al archivo (C-E1 a C-E7) | `true` |
| `proposed_in_spec` | Aparece en el PDF §10.3 | `false` |
| `proposed` | Lo propone esta documentación | `false` |
| `undefined` | Nadie lo definió (URL base, respuestas rápidas, permisos, campanita) | `false` |

No existe variable de entorno ni URL para WhatsApp: activar un contrato será pasarlo a `confirmed` en el mismo cambio que agregue su API real y su `evidence`. Un test verifica que ningún contrato de las pestañas está disponible hoy y que los catálogos existentes sí lo están.

Cuando existan hooks (etapa 3 en adelante), cada query usará `enabled: isWhatsAppContractAvailable(<contrato>) && <condiciones>` y expondrá un estado discriminado:

```
pending-integration | loading | forbidden | error | empty | ready
```

- `pending-integration` se decide **antes** de llamar: nunca se infiere de un 404.
- `empty` solo si el contrato respondió 2xx sin filas.
- `error` si respondió ≠ 2xx (403 con `WA_FORBIDDEN` pasa a `forbidden`).

Las mutaciones sin contrato no se ejecutan: el botón queda deshabilitado con tooltip "Pendiente de integración". Los formularios igual se pueden completar y validar.

### 6.2 Qué funciona sin backend en la app

- Navegación, pestañas, preferencia de pestaña y de vista.
- Editor de plantillas completo en local: nombre técnico derivado, contador de caracteres, inserción de variables en el cursor, vista previa con variables resaltadas, encabezado, pie, botón, respuesta rápida, A/B con vista previa A/B, advertencia de lenguaje promocional. Sin guardar.
- Formularios de regla (cuándo, alcance, resumen plegado), horario, respuesta automática, envío programado, alerta, contingencia, extranjeros: validan y muestran errores. Sin guardar.
- Catálogos reales que ya existen: tiendas (C-E1), couriers (C-E2), canales (C-E3), asesoras (C-E4).
- Textos sugeridos de plantillas del PDF §6.2.2 se ofrecen como "Usar texto sugerido" al crear una plantilla, nunca como plantillas existentes.

### 6.3 Qué no se muestra en la app sin backend

Número conectado, calidad, límite, uso, costos, tarifas, plantillas existentes, estados de Meta, reglas activas o contadores, cola, envíos programados, conversaciones, contador rojo, historial, métricas, bajas, alertas, auditoría y matriz guardada. En su lugar: `PendingIntegrationNotice`.

### 6.4 Storybook y tests

- Fixtures en `src/mocks/whatsapp/` (datos del mockup y del PDF §6.4.6: Lucía Ramos, Kevin Flores, Sofía Medina, Alexandra Castellanos, Ana Soto, Luis Pérez…).
- Handlers MSW en `src/mocks/handlers/whatsapp.handlers.ts` con ruta comodín (`*/wa/...`, como `identity-lookup.handlers.ts`) y escenarios por contrato: `success`, `empty`, `error`, `forbidden`, `slow`, y escenarios de proceso (`testMessageProgress`, `templateApprovedAfterReview`, `windowClosed`).
- En stories y tests, el registro de contratos se sobreescribe para marcar contratos como disponibles (decorator o `jest.mock`).
- Cada componente de sección tiene stories para: pendiente, cargando, vacío, error, sin permisos y con datos.
- Prueba de guarda: un test que recorre `src/app`, `src/components`, `src/features` y falla si un archivo que no sea `*.stories.tsx` o `__tests__/*` importa de `@/mocks`.

## 7. Validaciones del frontend

| Esquema | Reglas (frontend) | Garantía que corresponde a backend |
|---|---|---|
| `template-editor` | Nombre requerido, slug no vacío, ≤ 512; cuerpo 1..1024; encabezado texto ≤ 60; pie ≤ 60; texto de botón 1..25; variables solo del catálogo del evento; encabezado PDF solo si el evento lo admite; versión B requerida si A/B; mínimo por versión entero ≥ 1 | Unicidad del nombre en la WABA, conversión a posicionales, ejemplos, reglas de Meta |
| `rule` | Minutos/horas enteros > 0; hora `HH:mm`; `before` solo en eventos permitidos; `to ≥ from`; antigüedad 1..365 (rango **SIN DEFINIR**); al menos una opción en cada filtro de alcance | Evaluación del alcance, cálculo de `send_at` |
| `sending-settings` | Al menos un día; `from < to`; máximo por día entero ≥ 1 | Aplicación del horario, anti-duplicado, máximo |
| `auto-reply` | Textos no vacíos si está activa; solo `{{cliente}}` y `{{link_rastreo}}` | Una vez por ventana |
| `campaign` | Nombre requerido; plantilla aprobada; fecha/hora futura (Lima) en "una vez"; frecuencia y hora en "se repite" | Evaluación del segmento al enviar |
| `test-message` | Celular peruano válido con `toWhatsAppNumber`; plantilla aprobada | Envío real |
| `opt-out` | Celular válido; tienda | Bloqueo de todo envío |
| `alert-rules` | Umbrales enteros dentro de rango (porcentajes 1..100, minutos ≥ 1) | Evaluación y "no repetir en 6 h" |
| `contingency` | "Solo manual" excluye los demás disparadores; fallos y minutos > 0 | Failover |
| Respuesta de asesora | No vacía; ≤ 4096; ventana abierta según `expiresAt` | Rechazo con `WA_WINDOW_CLOSED` |

## 8. Permisos

`useWhatsAppPermissions()` devuelve `can(<permiso WA_*>)`. Fuente: `auth.user.permissions` cuando backend emita `WA_*`; mientras tanto, mutaciones de configuración solo para `isSuperadmin || hasAdminAccess(role)` y lectura para el resto (D-11). Cada sección define su comportamiento sin permiso: oculta la acción, la deshabilita con explicación o muestra el estado "sin permisos". Backend valida siempre (C-00.10).

## 9. Integraciones fuera de la página

| ID | Dónde | Qué | Doc |
|---|---|---|---|
| X1 | `CustomerServiceModal` › Seguimiento | Sección "Mensajes de WhatsApp" + "Abrir conversación" | [screens/07](screens/07-ficha-pedido-seguimiento.md) |
| X2 | Botones WhatsApp de Ventas, Operaciones › Pedidos, Gestión CC | Mini indicador del último aviso | [screens/08](screens/08-indicador-ultimo-aviso.md) |
| X3 | Página pública del pedido y acortador | Rastreo, evidencia, comprobante | [screens/09](screens/09-pagina-publica-rastreo.md) |
| X4 | Operaciones › Guías › Config | Sección local actual | [screens/10](screens/10-seccion-local-operaciones-guias.md), D-22 |
| X5 | Campanita de notificaciones | No existe | C-31 |

## 10. Etapas

Numeración alineada con el encargo: la etapa 1 fue la revisión.

| Etapa | Alcance | Depende de backend | Criterio de salida | Estado |
|---|---|---|---|---|
| 1 | Revisión y documentación | No | `docs/whatsapp/` completo; sin cambios de código | Hecha |
| 2 | Base del dominio, componentes compartidos, página con 6 pestañas en estado pendiente, menú y tarjeta | No | Ver §11 | Hecha |
| 3 | Plantillas: tabla (estados), editor local completo con vista previa y validaciones; banner de aprobación y "Activar en una regla" en stories | Para guardar: C-12, C-13, C-14 | Editor usable en app sin guardar; stories con todos los estados | Hecha (§12) |
| 4 | Programación: tarjetas de regla, alcance, modal de activación, datos faltantes, horario, próximas 24 h, envíos programados y su modal | C-16, C-18, C-20, C-21, C-24 | Formularios validan en app; stories con datos | Hecha (§13) |
| 5 | Conversaciones: barra, tablero, lista, cajón con hilo y pies, respuesta automática | C-22, C-18, C-25 | Stories cubren ventana abierta/cerrada/no enviado/atendida | Hecha (§14) |
| 6 | Historial y Bajas/alertas/permisos | C-24, C-25, C-26, C-27, C-28 | Stories; export según D-17 | Hecha (§15) |
| 7 | Conexión: tipos, número, prueba, números por tienda, contingencia, bandeja asistida, costos, Embedded Signup | C-01..C-11 y configuración de Meta | Conexión real en tienda de prueba (§14.1) | Siguiente (§16) |
| 8 | Ficha del pedido (X1), indicador (X2), reemplazo de la sección local (X4) | C-22.7, C-29 | Ver screens/07, 08 y 10 | — |
| 9 | Página pública (X3) | D-06, C-30 | Según decisión | — |
| 10 | Integración contrato por contrato y criterios §14 del PDF con datos reales | Todo | Checklist §14 completo | — |

Las etapas 3 a 6 pueden avanzar en paralelo con backend: cada contrato que backend entrega se activa en el registro y se prueba con su story.

## 11. Etapa 2: qué se hizo y qué cambió respecto del plan

Hecho según el plan: enums, modelos, registro de contratos, keys, utilidades con tests, `MessageStatusTicks`, `WhatsAppPhonePreview`, `WhatsAppThread`, `PendingIntegrationNotice` con stories, fixtures aisladas, página con 6 pestañas (`?tab` + preferencia), ítem del menú, tarjeta en Configuración y guarda de imports.

Cambios respecto del plan de la etapa 1:

| Plan | Implementado | Motivo |
|---|---|---|
| `WhatsAppPageHeader`, `WhatsAppConnectionPill` | `WhatsAppSettingsContent` reutiliza `HeaderConfig` con un aviso fijo "Integración pendiente" | Igual que las otras subpáginas de Configuración; sin contrato no hay estado de conexión que mostrar |
| `WhatsAppStoreSelect` en la cabecera | `WhatsAppStoresPendingList` dentro de Conexión | Sin datos por tienda, un selector no cambiaría nada; la lista muestra las tiendas reales (C-E1) con estado pendiente. El selector entra cuando haya datos por tienda (D-07) |
| `WhatsAppThreadBubble` separado | Burbujas internas de `WhatsAppThread` + `WhatsAppFormattedText` compartido | El formato seguro se reutiliza en la vista previa y en el hilo |
| `WhatsAppResourceState`, handlers MSW, `whatsapp-copy.ts`, `whatsapp-spec-catalog.ts`, `whatsapp-error.util.ts`, `rule-summary.util.ts`, `template-variables.util.ts` | No creados | Nada consume datos aún; entran con la primera pestaña que los necesite (etapa 3). La extracción de variables quedó en `template-render.util.ts` |
| `useWhatsAppPermissions()` | `resolveWhatsAppAccess()` | Solo hace falta saber si la persona es administradora; los permisos `WA_*` no existen (D-11, D-33) |
| Flag por contrato + `NEXT_PUBLIC_API_WHATSAPP` | Estado del contrato | No se inventa URL ni variable (D-34) |

## 12. Etapa 3: Plantillas

### 12.1 Archivos

```
src/features/whatsapp/
  enums/whatsapp.enums.ts                     + WHATSAPP_TEMPLATE_USAGES, WHATSAPP_TEMPLATE_LANGUAGES, WHATSAPP_AB_VARIANTS
  models/template.model.ts                    reescrito: usage, metaReason, approvedVersion, abTest.results, stats30d
  models/resource-state.model.ts              WhatsAppResourceState<T> (pendiente, cargando, sin permisos, error, listo)
  constants/whatsapp-template-catalog.ts      usos (10), variables por uso, idiomas, categorías, límites, textos
                                              sugeridos, valores de muestra, etiquetas y filtros de estado
  constants/whatsapp-contracts.ts             + assertWhatsAppContractAvailable, WhatsAppContractUnavailableError
  schemas/template-editor.schema.ts           Zod 4 con mensajes en español
  schemas/template-editor.defaults.ts         valores de una plantilla nueva
  mappers/to-template-editor-values.mapper.ts plantilla → valores del editor (editar/duplicar)
  utils/template-variables.util.ts            insertTextAtSelection, variables por uso, token
  utils/template-render.util.ts               + hasMalformedVariableTokens
  schemas/__tests__, mappers/__tests__, utils/__tests__/template-variables.util.test.ts
  __tests__/no-mock-imports.test.ts           guarda de contratos (D-45)

src/components/whatsapp/
  WhatsAppResourceState.tsx (+ .stories.tsx)

src/app/configuracion/whatsapp/_components/
  WhatsAppTabPanel.tsx                        la pestaña Plantillas monta TemplatesTab
  WhatsAppTabs.tsx, WhatsAppSettingsContent.tsx  pasan businessName (nombre de la empresa)
  plantillas/TemplatesTab.tsx                 contenedor: estado pendiente + sesión del editor
  plantillas/TemplatesListView.tsx (+ stories)
  plantillas/TemplatesTable.tsx
  plantillas/TemplateStatusBadge.tsx
  plantillas/TemplateApprovedBanner.tsx (+ stories)
  plantillas/TemplateEditorDialog.tsx (+ stories)
  plantillas/TemplateEditorFields.tsx
  plantillas/TemplateEditorPreview.tsx
  plantillas/TemplateVariableChips.tsx
  plantillas/TemplateSegmentedChoice.tsx
  plantillas/TemplatePromotionalWarning.tsx
  plantillas/TemplateStatusNotice.tsx
  plantillas/__tests__/TemplatesListView.test.tsx, TemplateEditorDialog.test.tsx

src/mocks/whatsapp/whatsapp-templates.fixtures.ts   9 plantillas: todos los estados, A/B con y sin
                                                    resultados, versión aprobada, PDF
```

### 12.2 Qué queda pendiente de integración

API, DTO, servicio y hooks de C-12 (listar, obtener, crear, actualizar, enviar, duplicar), C-13 (catálogo) y C-14 (pedidos de muestra); polling de plantillas en revisión; detección de aprobación y "Activar en una regla" con navegación (etapa 4); contador de la pestaña. Cuando exista C-12: confirmar el contrato en el registro, crear `api/whatsapp-templates.api.ts` con `assertWhatsAppContractAvailable("templates")`, pasar el estado real a `TemplatesListView` y los manejadores `onSaveDraft`/`onSubmitForReview` a `TemplateEditorDialog`.

## 13. Etapa 4: Programación

### 13.1 Archivos

| Capa | Archivos |
|---|---|
| Enums | `WHATSAPP_RULE_KEYS`, `WHATSAPP_RULE_DATE_MODES`, `WHATSAPP_WEEKDAYS`, `WHATSAPP_OUT_OF_HOURS_POLICIES`, `WHATSAPP_QUEUE_SOURCES`, `WHATSAPP_CAMPAIGN_RECURRENCES`, `WHATSAPP_CAMPAIGN_DESTINATIONS` en `whatsapp.enums.ts` |
| Modelos | `rule.model.ts`, `campaign.model.ts` (reescritos), `money.model.ts`, `sending-settings.model.ts`, `queue.model.ts`, `scope-catalog.model.ts` |
| Constantes | `whatsapp-scheduling-catalog.ts` (definición de las 9 reglas, opciones, límites y valores sugeridos del PDF); `shippingTypes` (C-E8) en `whatsapp-contracts.ts` |
| Schemas | `rule-config.schema.ts`, `sending-schedule.schema.ts`, `campaign.schema.ts` |
| Mappers | `to-scheduling-form-values.mapper.ts` |
| Utils | `rule-summary.util.ts`, `rule-link.util.ts`; fechas y horas de Lima en `lima-time.util.ts` |
| Hooks | `use-whatsapp-scope-catalogs.ts` (couriers por `fetchCouriers` con la guarda de contratos; tiendas y canales de auth; tipos de envío de `DELIVERY_TYPE_OPTIONS`) |
| Componentes compartidos | `src/components/whatsapp/BlockedActionButton.tsx` |
| Pestaña | `_components/programacion/`: `SchedulingTab` (contenedor), `SchedulingView`, `RulesSection`, `RuleCard`, `RuleScopeFields`, `ScopeChipGroup`, `RuleMessagePreviewDialog`, `ActivateRuleDialog`, `DeactivateRuleDialog`, `RuleLinkNotice`, `MissingDataSection`, `SendingHoursSection`, `UpcomingQueueSection`, `CampaignsSection`, `CampaignDialog`, `CampaignResultsDialog`, `FormDraftActions`, `SettingsStateGate`, `scope-labels.ts` |
| Navegación | `WhatsAppTabs` y `WhatsAppTabPanel` pasan `search`/`onNavigate`; `TemplatesTab` expone `onActivateRule` |
| Fixtures, stories y tests | `src/mocks/whatsapp/whatsapp-scheduling.fixtures.ts`; stories `WhatsApp/Programacion/*`; `programacion/__tests__/SchedulingView.test.tsx`, `plantillas/__tests__/TemplatesTab.link.test.tsx` y casos nuevos en `whatsapp/__tests__/page.test.tsx` |

### 13.2 Qué queda pendiente de integración

API, DTO, servicio y hooks de C-16 (leer, guardar, vista previa, activar, desactivar), C-18 (ajustes), C-24 (omitidos de hoy), C-20 (cola) y C-21 (listar, crear, editar, pausar, reanudar, contador y resultados). Cuando exista cada uno: confirmarlo en el registro, crear su `api/` con `assertWhatsAppContractAvailable`, pasar el estado real a `SchedulingTab` y habilitar `canPersist` según los permisos que defina C-00.10. Decisiones abiertas: D-47, D-48, D-50 y D-54.

## 14. Etapa 5: Conversaciones

### 14.1 Archivos

| Capa | Archivos |
|---|---|
| Enums | `WHATSAPP_MEDIA_TYPES`, `WHATSAPP_EVIDENCE_TYPES`, `WHATSAPP_CONVERSATION_VIEWS` |
| Modelos | `conversation.model.ts` (reemplaza `thread.model.ts`); `message.model.ts` suma `media` y `evidence.type` |
| Constantes | `whatsapp-conversation-catalog.ts` (límites, tamaños de página, respuestas rápidas, variables y sugeridos de la respuesta automática) |
| Schemas | `auto-reply.schema.ts` |
| Utils | `conversation-state.util.ts`, `conversation-filters.util.ts`, `conversation-preferences.util.ts`, `conversation-access.util.ts`, `conversation-composer.util.ts`; `reply-window.util.ts` reescrito |
| Hooks | `use-ticking-now.ts`, `use-whatsapp-store-agents.ts` (C-E4 con la guarda de contratos) |
| Keys | `conversations`, `storeAgents` |
| Compartidos | `WhatsAppThread` con evidencia por tipo, adjuntos entrantes y cortes de textos largos |
| Pestaña | `_components/conversaciones/`: `ConversationsTab`, `ConversationsView`, `ConversationsToolbar`, `ConversationsBoard`, `ConversationCard`, `ConversationTags`, `ConversationsTable`, `ConversationDrawer`, `ConversationPanel`, `ConversationComposer`, `OptOutDialog`, `AutoReplyDialog`, `conversation-types.ts` |
| Navegación | `WhatsAppTabPanel` monta `ConversationsTab`; `WhatsAppTabs` quita `thread` al salir de Conversaciones |
| Fixtures, stories y tests | `whatsapp-conversation.fixtures.ts`; stories `WhatsApp/Conversaciones/*` y 3 del hilo; `conversation-utils.test.ts`, `ConversationsView.test.tsx`, `AutoReplyDialog.test.tsx`, casos nuevos en `page.test.tsx` y `reply-window.util.test.ts` reescrito |

### 14.2 Qué queda pendiente de integración

API, DTO, servicio y hooks de C-22 (tablero por columna, lista, detalle, responder, plantilla, nota, asignar, atender, reintentar), C-22.2 (contadores y contador de la pestaña), C-18 (`autoReply`), C-25 (baja), C-23 (respuestas rápidas), C-28 (códigos `WA_*` para `resolveConversationCapabilities`) y C-00.9 (tiempo real). Cuando exista cada uno: confirmarlo en el registro, crear su `api/` con `assertWhatsAppContractAvailable`, pasar estados y manejadores a `ConversationsTab` (`mutations`) e invalidar detalle, listas y contadores tras cada mutación. Integración en la ficha del pedido (X1) con `WhatsAppThread` en la etapa 8. Decisiones abiertas: D-12, D-27, D-55, D-56, D-58, D-60.

## 15. Etapa 6: Historial y Bajas, alertas y permisos

### 15.1 Archivos

| Capa | Archivos |
|---|---|
| Enums | Periodos, filtros de estado, orígenes de baja, tipos y destinatarios de alertas, políticas de números extranjeros, entidades del registro, roles y códigos `WA_*` |
| Modelos | `history.model.ts`, `settings-tab.model.ts` |
| Constantes | `whatsapp-settings-catalog.ts` (etiquetas, unidades, rangos, sugeridos del PDF, matriz documentada) |
| Schemas | `settings-tab.schema.ts` (alta y reactivación de bajas, alertas, protección) |
| Utils | `history.util.ts`, `whatsapp-permissions.util.ts`, `audit-format.util.ts`, `opt-out-phone.util.ts` (usa `toWhatsAppNumber`); `conversation-access.util.ts` usa los códigos comunes |
| Hooks | `use-settings-draft.ts` |
| Compartidos | `DebouncedSearchInput` (también usado ahora por Conversaciones) |
| Pestañas | `_components/historial/` (`HistoryTab`, `HistoryView`, `HistoryKpis`, `HistoryMessagesTable`) y `_components/ajustes/` (`SettingsTab`, `SettingsView`, `OptOutsSection`, `AddOptOutDialog`, `ReactivateOptOutDialog`, `AlertsSection`, `ForeignNumbersSection`, `AuditLogSection`, `PermissionsSection`, `SettingsDraftFooter`, `settings-types.ts`) |
| Otros cambios | `WhatsAppTabPanel` monta ambas pestañas; `MissingDataSection` (Programación) alinea la regla del teléfono peruano con Números extranjeros |
| Fixtures, stories y tests | `whatsapp-history.fixtures.ts`, `whatsapp-settings.fixtures.ts`; stories `WhatsApp/Historial/*` y `WhatsApp/Ajustes/*`; `history-settings-utils.test.ts`, `HistoryView.test.tsx`, `SettingsView.test.tsx` y casos nuevos en `page.test.tsx` |

### 15.2 Qué queda pendiente de integración

C-24 (métricas, mensajes, reenvío, export), C-25 (bajas), C-18 (protección), C-26 (alertas), C-27 (registro) y C-28 (matriz y permisos efectivos). Cuando existan: `api/` con la guarda de contratos, hooks de TanStack Query con claves por empresa y tienda, manejadores en `HistoryTab` y `SettingsTab`, e invalidación del registro tras cada mutación. Decisiones abiertas: D-12, D-55, D-63 a D-68.

## 16. Siguiente bloque (etapa 7): Conexión

**Entra:** tipo de conexión (con confirmación de cambio, D-04), número conectado (calidad, límite, nombre, actualizar, desconectar con confirmación), mensaje de prueba con estados reales, números por tienda y modal de Embedded Signup (pasos y estados, sin intercambiar tokens en el frontend), número de contingencia, bandeja de envío asistido (abrir en WhatsApp ≠ enviado, D-02), costos solo con datos (D-05). Todo con estados pendiente, carga, error, vacío y contenido; mutaciones bloqueadas; stories y tests; ficha `01-conexion.md`.

**No entra:** integraciones en pedidos (etapa 8), página pública (etapa 9), llamadas reales a `/wa` ni a Meta.

**Verificación esperada:** typecheck, Biome y ESLint de archivos afectados, Jest del módulo y completo, Storybook y revisión visual si hay navegador.

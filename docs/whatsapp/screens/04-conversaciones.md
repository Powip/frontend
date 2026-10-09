# 04 · Pestaña Conversaciones (`?tab=conversaciones`)

Referencias: PDF §6.4, §6.6.3, §8.1-8.2, §9.1 (`wa_threads`), §10.1.1, §13 casos 14-16, 25, 29, §14.4; mockup `#p-conversaciones`, `#drawer`, `#mAuto`.
Usuarias principales: asesoras de Gestión CC, todos los días.

**Estado (etapa 5, 2026-10-09):** frontend completo y revisable en Storybook. En la app, sin backend de WhatsApp, la pestaña muestra "Conversaciones pendientes de integración": sin tarjetas, sin contadores y sin conversaciones de ejemplo. Todas las mutaciones (responder, enviar plantilla, nota, reasignar, reintentar, dar de baja, marcar atendida, guardar respuesta automática) quedan bloqueadas con explicación accesible. No hay polling ni llamadas a `/wa`.

---

## Componentes definitivos

| Componente | Archivo | Rol |
|---|---|---|
| `ConversationsTab` | `src/app/configuracion/whatsapp/_components/conversaciones/ConversationsTab.tsx` | Contenedor. Lee tiendas y usuario de `useAuth`, guarda filtros en estado local, la vista en `localStorage`, la conversación abierta en `?thread=`, monta `OrderDetailModalProvider` y pasa todo en estado "pendiente" |
| `ConversationsView` | `…/ConversationsView.tsx` | Vista pura (props). Barra, tablero o lista, cajón, confirmación de descarte al cambiar o cerrar, modal de respuesta automática |
| `ConversationsToolbar` | `…/ConversationsToolbar.tsx` | Búsqueda, tienda, "Asignadas a mí", "Respuesta automática", Tablero/Lista |
| `ConversationsBoard` + `ConversationCard` + `ConversationTags` | `…/ConversationsBoard.tsx`, `ConversationCard.tsx`, `ConversationTags.tsx` | Cinco columnas y tarjetas |
| `ConversationsTable` | `…/ConversationsTable.tsx` | Vista lista con paginación |
| `ConversationDrawer` | `…/ConversationDrawer.tsx` | Panel lateral (`@radix-ui/react-dialog`, 480 px; pantalla completa en móvil) con estados del detalle |
| `ConversationPanel` | `…/ConversationPanel.tsx` | Datos, atención, asignación, acciones, ventana, aviso no enviado e hilo |
| `ConversationComposer` | `…/ConversationComposer.tsx` | Respuesta, respuestas rápidas, plantilla aprobada y nota interna |
| `OptOutDialog` | `…/OptOutDialog.tsx` | Confirmación de baja |
| `AutoReplyDialog` | `…/AutoReplyDialog.tsx` | Respuesta automática |
| `WhatsAppThread` (compartido) | `src/components/whatsapp/WhatsAppThread.tsx` | Hilo reutilizable; listo para Seguimiento (X1) sin tocar todavía `CustomerServiceModal` |

Dominio: `models/conversation.model.ts`, `utils/conversation-state.util.ts` (columna, atención, espera), `conversation-filters.util.ts`, `conversation-preferences.util.ts`, `conversation-access.util.ts`, `conversation-composer.util.ts`, `reply-window.util.ts`, `constants/whatsapp-conversation-catalog.ts`, `schemas/auto-reply.schema.ts`, `hooks/use-ticking-now.ts`, `hooks/use-whatsapp-store-agents.ts`.

---

## T4.S1 · Barra

| Campo | Detalle |
|---|---|
| Búsqueda | Pedido, comprador o teléfono. Espera 300 ms tras la última tecla; mínimo 2 caracteres (con menos, pista "Escribe al menos 2 caracteres" y no filtra). Si parece teléfono (`+`, dígitos, espacios, guiones, paréntesis) se envía solo con dígitos |
| Tienda | "Todas las tiendas" + tiendas de `auth.company.stores` (C-E1). Viaja el **ID** de la tienda |
| Asignadas a mí | Conmutador (`aria-pressed`). Viaja `assignedTo=<auth.user.id>`; nunca se compara por nombre. Sin usuario identificado queda bloqueado con explicación |
| Respuesta automática | Visible solo con `canManageConfiguration` (ver Permisos). Abre **T4.M1** |
| Vista | Tablero (por defecto) / Lista |
| Filtros frente a preferencias | Los filtros son **estado local** de la pestaña (no URL, no `localStorage`): se pierden al salir. La vista es una **preferencia** en `localStorage["powip:wa:conversations-view"]`. La conversación abierta vive en la URL (`?thread=`) y se descarta al cambiar de pestaña |
| Consulta | `toConversationQuery(filters, userId)` → `{ q, storeId, assignedTo }` para C-22.1/C-22.2 |

## T4.S2 · Tablero

| Campo | Detalle |
|---|---|
| Columnas | Enviado · Entregado · Leído · Respondió (fondo rojo suave, contador rojo) · No enviado |
| Regla de columna | `getConversationColumn`: si hay **respuesta pendiente de atención** (`attention.pendingReply`) → Respondió, aunque backend la haya agrupado en otra columna; si no, el estado del **último aviso saliente** (`queued`/`sent`/`assisted` → Enviado, `delivered` → Entregado, `read` → Leído, `failed`/`skipped` → No enviado). Sin aviso saliente ni respuesta pendiente no se inventa columna |
| Atención frente a lectura | "Atendida" es estado de la conversación, no del mensaje. Una conversación atendida **se queda en la columna de su último aviso** con la etiqueta "Atendida": marcar atendida no demuestra que el comprador leyó nada. **Provisional y pendiente de producto (D-55):** el PDF §8.2 la mueve a Leído. Si el comprador vuelve a escribir, `pendingReply` manda y la etiqueta desaparece |
| Tarjeta | Comprador (o teléfono), hora (HH:mm hoy en Lima; si no, día), "Pedido · tienda · courier", plantilla del último aviso, iniciales de la asesora (nombre en `title` y texto oculto), etiquetas Atendida, Abrió rastreo, Asistido, Revisar (incidencia) y Dado de baja; en Respondió el texto del comprador entre comillas y la espera ("Espera hace 8 min" ámbar; "Sin atender hace 2 h 45 min" rojo **solo si backend informa `overdue`**); en No enviado el motivo en rojo ("Motivo sin informar" si falta) |
| Contadores | Solo los `total` que devuelve backend por columna (C-22.2). **Nunca** se cuentan las tarjetas cargadas: con una página parcial el total sería falso. Sin total, la columna no muestra número |
| Paginación | Por columna: 20 tarjetas + "Ver más" (`column=` + `page`). Sin backend "Ver más" queda bloqueado con explicación |
| Orden | El que devuelve backend (propuesta: Respondió de la más antigua a la más reciente; el resto, más reciente primero). El frontend no reordena una página parcial |
| Estados | Pendiente (aviso único, sin columnas), cargando, sin permisos, error con Reintentar, vacío ("Todavía no hay conversaciones. Aparecen cuando sale el primer aviso"), sin coincidencias con filtros activos ("No hay conversaciones con estos filtros" + Limpiar filtros), contenido; columna vacía: "Nada por aquí" |
| Accesibilidad | Cada columna es una región con encabezado; cada tarjeta es un botón "Abrir conversación con {comprador}, {columna}" |

## T4.S3 · Lista

| Campo | Detalle |
|---|---|
| Columnas | Último mensaje, Pedido (+ tienda), Cliente (botón accesible) y teléfono, Plantilla, Estado (píldora Respondió + ticks del último aviso + etiquetas), Asesora, Rastreo |
| Paginación | `pageSize` 50. "Página N de M" solo si backend da `total`; si no, "Página N". Anterior/Siguiente según `page` y `hasMore`; bloqueados sin backend |
| Estados | Iguales al tablero |

---

## T4.C1 · Panel de la conversación

| Campo | Detalle |
|---|---|
| Apertura | Tarjeta, fila o `?thread=<id>` (desde ficha del pedido o alertas cuando existan) |
| Cierre | X "Cerrar conversación", Escape o clic fuera; con texto sin enviar pide confirmar ("¿Cerrar la conversación y descartar lo que escribiste?") |
| Estados | Pendiente ("Conversación pendiente de integración"), cargando, sin permisos, error con Reintentar ("ya no existe o no tienes acceso"), contenido |
| Datos | Teléfono; "Pedido · tienda · courier"; último aviso con ticks y detalle; atención ("Respondió · sin atender" + espera, o "Atendida", o "Sin respuestas pendientes"); etiquetas |
| Asignación | "Asignada a {nombre}". Con permiso de reasignar y backend: selector con las asesoras de la tienda (C-E4, `getAgentesCC`, solo se pide en ese caso). Con permiso sin backend: "Reasignar" bloqueado. Sin permiso: solo texto. Si está asignada a otra persona y puedo responder: "La asignación no te impide responder" (caso 29) |
| Acciones | **Ver pedido** → `openOrderDetail(orderId, { initialTab: "seguimiento" })` con el ID real; sin `orderId` queda bloqueado ("Esta conversación no tiene un pedido asociado"). **Marcar atendida** solo con respuesta pendiente y permiso de responder; aclara que no indica lectura. **Dar de baja** solo con permiso de bajas y si no está dado de baja → **T4.M2** |
| Ventana de 24 h | Ver "Ventana" abajo. Banner "Ventana abierta · Quedan 21 h…", "Ventana cerrada · Solo puedes enviar una plantilla aprobada" o "Ventana sin confirmar" |
| Aviso no enviado | Con último aviso `failed`/`skipped`: motivo, "Corregir en el pedido" (ficha real; bloqueado sin pedido), "Reintentar" (bloqueado sin backend, sin permiso o sin ID del aviso) y "Cuando corrijas el dato, el aviso sale solo si el pedido sigue en el mismo estado". Independiente de la ventana y de la atención |
| Hilo | `WhatsAppThread`, se desplaza al último mensaje al abrir y cuando llega uno nuevo |

### Hilo (`WhatsAppThread`)

| Tipo | Presentación |
|---|---|
| `template` | Derecha, "Plantilla · {nombre}", texto con formato, botón, hora y ticks; documento PDF si lo hay |
| `auto` | Derecha, "Respuesta automática" |
| `text` saliente | Derecha, nombre de la asesora |
| `echo` | Derecha, "Enviado desde la app del celular" (coexistencia; no abre ventana) |
| Entrante | Izquierda, texto plano; adjuntos como "Imagen", "Audio", "Video", "Documento" o "Sticker" con enlace si backend da URL, o "· no disponible" si no (caso 15) |
| `note` | Recuadro amarillo centrado con autor |
| `evidence` | Recuadro con el **tipo real**: "Foto de entrega" (`DELIVERY`), "Evidencia de despacho" (`DISPATCH`, "no confirma la entrega"), "Evidencia de preparación" (`PREPARATION`), o "Evidencia del pedido · tipo sin informar" (D-56) |
| `assisted` | Ticks "Asistido · enviado a mano, sin confirmación de entrega" |
| Separadores | Día en Lima ("Hoy", "Ayer", fecha) |

Textos largos (nombres, pedidos, URLs sin espacios) se cortan con `overflow-wrap: anywhere`.

### Ventana de 24 h

- Se toma **solo** de backend: `replyWindow = { open, expiresAt }` (C-22.3). `resolveReplyWindow`: `open: true` con `expiresAt` futuro → abierta; `open: false` o vencida → cerrada; sin objeto, `open: null` o abierta sin `expiresAt` válido → **desconocida**. El frontend ya no estima la ventana con mensajes entrantes (se eliminó `estimateReplyWindow`, D-57).
- Mientras el panel está abierto, un reloj local (`useTickingNow`) se actualiza cada 30 s y además exactamente al vencimiento: la ventana pasa a cerrada sin esperar datos nuevos. No hay polling.
- Abierta: respuestas rápidas + texto + Enviar. Cerrada: selector de plantillas aprobadas + "Enviar plantilla"; si había texto, se conserva en solo lectura con "La ventana de 24 h se cerró. Tu texto se conserva…" y "Descartar texto". Desconocida: el texto se puede escribir, pero Enviar y Enviar plantilla quedan bloqueados ("POWIP no confirmó si la ventana de 24 h está abierta") (D-62).
- Respondió, Atendida y No enviado no dependen de la ventana: una conversación atendida puede seguir con la ventana abierta y admitir respuesta.
- Backend revalida siempre al enviar (`409 WA_WINDOW_CLOSED`); el frontend conserva el texto y muestra el error.

### Composición

| Elemento | Detalle |
|---|---|
| Modo | "Responder al comprador" / "Nota interna" (radios) |
| Respuestas rápidas | Link de rastreo, Reprogramar entrega, Cambiar dirección, Horario de agencia. **Completan** el cuadro (o se agregan al final) y llevan el foco al final; no envían, no agregan notas y no cambian el pedido. Los textos no anuncian cambios: "¿qué día y en qué horario te queda mejor…? … te confirmamos por aquí". "Link de rastreo" se bloquea si el pedido no tiene link. Catálogo del frontend mientras C-23 no exista (D-58) |
| Texto | 1-4096 caracteres, contador |
| Plantillas | `getSendableTemplates`: de la tienda de la conversación (o globales), `APPROVED` o `PENDING` con versión aprobada anterior; se muestra el cuerpo aprobado. Sin plantillas: "No hay plantillas aprobadas para esta tienda" |
| Nota interna | 1-1000 caracteres (propuesta); "No se envía al comprador y no cambia el pedido" |
| Baja | Con el comprador dado de baja (también si ocurre con el panel abierto y llega el dato), banner rojo y envíos bloqueados; el texto queda en solo lectura |
| Sin permiso de responder | "No tienes permiso para responder ni dejar notas en esta conversación" y sin cuadro |
| Futura integración | Cada acción recibe un manejador opcional que devuelve una promesa: mientras espera muestra "Enviando…" y bloquea un segundo envío; si falla muestra el mensaje en `role="alert"` y **conserva el texto**; si sale bien limpia el borrador. Nunca agrega mensajes al hilo por su cuenta: el hilo cambia cuando backend devuelve el detalle actualizado |

### Borradores y navegación

- El borrador vive en memoria del componente de la conversación (`key` = ID): nunca pasa a otra conversación y no se guarda en `localStorage` (test con espía de `Storage.setItem`).
- Un refetch del detalle (misma conversación, nueva versión) no lo borra.
- Cerrar o cambiar de conversación (también por URL) con texto o plantilla elegida pide confirmación; "Seguir escribiendo" restaura la conversación anterior en la URL.

### Acciones y contratos

| Acción | Contrato | Payload | Respuesta | Errores |
|---|---|---|---|---|
| Responder | C-22.4 `POST /wa/threads/:id/reply` + `Idempotency-Key` + `If-Match: version` | `{ "text" }` | Mensaje creado (`queued`) y detalle | `409 WA_WINDOW_CLOSED`, `409 WA_OPTED_OUT`, `409 WA_VERSION_CONFLICT`, `422` |
| Enviar plantilla | C-22.5 `POST /wa/threads/:id/template` + `Idempotency-Key` | `{ "templateId" }` | Mensaje creado | `409 WA_TEMPLATE_NOT_APPROVED`, `409 WA_OPTED_OUT`, `422` |
| Nota interna | C-22.6 `POST /wa/threads/:id/notes` (propuesta) | `{ "text" }` | Nota creada | `422` |
| Reasignar | C-22.6 `POST /wa/threads/:id/assign` + `If-Match` | `{ "assigneeId" }` | Detalle | `403`, `409 WA_VERSION_CONFLICT`, `422` (asesora de otra tienda) |
| Marcar atendida | C-22.6 `POST /wa/threads/:id/attend` + `If-Match` | `{}` | Detalle con `attention.attended = true` | `409` si ya no hay respuesta pendiente |
| Reintentar | C-22.8 `POST /wa/messages/:id/retry` + `Idempotency-Key` | `{}` | Mensaje nuevo o reencolado | `409 WA_MISSING_DATA` (`details.missing`), `409 WA_OPTED_OUT` |
| Dar de baja | C-25 `POST /wa/optouts` + `Idempotency-Key` | `{ "phone", "storeId", "origin": "agent", "note" }` | Baja creada | `409 WA_ALREADY_OPTED_OUT` |

Tras cada mutación, backend devuelve o invalida: detalle (`thread`), listas (`conversations`), contadores y, para bajas, `optOuts` y `auditLog`.

### Permisos

Capacidades explícitas `WhatsAppConversationCapabilities { view, reply, reassign, manageOptOuts }` resueltas **solo** desde códigos de permiso (`WA_VIEW`, `WA_REPLY`, `WA_REASSIGN`, `WA_OPTOUTS`, C-28/C-00.10). No se infieren de `ADMINISTRADOR`, `AGENTES` ni `ccRol` (D-59). Hoy no hay permisos `WA_*`: todas las capacidades son `false`. La asignación nunca bloquea responder si hay permiso (caso 29). La respuesta automática se muestra con `canManageConfiguration` (mismo criterio provisorio que el resto de la configuración, D-11).

### Paginación, conteos y actualización en vivo

- Conteos globales por columna y el contador de la pestaña salen de C-22.2 con los mismos filtros; nunca del largo de la página.
- Actualización en vivo **no implementada**: no hay endpoint ni canal (C-00.9). Cuando exista, propuesta: polling del tablero cada 15 s con la pestaña visible y del detalle cada 5 s con el panel abierto, o eventos.
- Casos a resolver con datos en vivo:
  - **Nuevo mensaje o reasignación con el panel abierto:** el detalle se reemplaza; el borrador se conserva porque no depende del detalle.
  - **Respuestas simultáneas (caso 29):** ambas salen; cada asesora ve la otra respuesta al refrescar. `If-Match` evita marcar atendida o reasignar sobre una versión vieja (`409 WA_VERSION_CONFLICT` → refrescar y avisar).
  - **Ventana que cierra entre escribir y enviar:** el reloj local ya cambia el pie; si igual llega `409 WA_WINDOW_CLOSED`, se conserva el texto.
  - **Baja con el panel abierto:** al llegar `optedOut: true` se bloquean los envíos; si se envía antes, `409 WA_OPTED_OUT`.
  - **Separación por empresa y tienda:** empresa y tienda salen del token; backend filtra `tienda_id` en lecturas y escrituras y rechaza IDs de otra empresa.
  - **Un teléfono con varios pedidos:** el PDF define una conversación por comprador y pedido; backend debe decidir a qué conversación asociar un mensaje entrante (propuesta: la del aviso más reciente al que respondió por contexto de Meta; si no hay contexto, la del pedido activo más reciente) y exponerlo en el detalle. Pendiente (D-60).

### Garantías de backend

Asignación inicial (dueña `ccAgenteId`; si no, reparto por turnos), respuesta automática una vez por ventana, apertura de ventana solo con mensajes del comprador, baja por STOP/BAJA/NO MÁS con confirmación, números extranjeros, alerta por sin atender (`overdue` lo calcula backend con el umbral configurable).

## T4.M2 · Confirmar dar de baja

`OptOutDialog`: "{comprador} ({teléfono}) no recibirá más avisos de {tienda}. Solo se reactiva si el cliente lo pide." Motivo opcional (≤ 200). "Dar de baja" bloqueado sin backend; con manejador muestra error y no cierra si falla. Alcance tienda/empresa pendiente (D-12).

## T4.M1 · Respuesta automática

| Campo | Detalle |
|---|---|
| Componente | `AutoReplyDialog` + `auto-reply.schema.ts` |
| Campos | Interruptor "Responder automáticamente cuando el cliente escribe"; "En horario de atención"; "Fuera de horario"; botones que insertan `{{cliente}}` y `{{link_rastreo}}` en el cursor; contador ≤ 1024 (propuesta) |
| Validaciones | Textos obligatorios solo si está activa; llaves bien cerradas; solo las dos variables ("Quita: {{orden}}") |
| Vista previa | `WhatsAppPhonePreview` del texto elegido con "Muestra con datos de ejemplo («Lucía», «powip.lat/r/EJEMPLO»). No es un mensaje real" |
| Valores | Sin backend o sin configuración guardada: textos del PDF como **sugeridos para una configuración nueva**, con aviso de que no están guardados. Con C-18: lo guardado; un refetch no pisa cambios locales |
| Guardar | Bloqueado con explicación; no guarda ni cierra |
| Descarte | Cancelar, X o Escape con cambios pide confirmar; la comprobación de cambios es sincrónica |
| Backend | Controla frecuencia (una vez por ventana de 24 h por conversación), qué texto usar según el horario de atención (D-27) y el envío. La cifra "1,000 respuestas gratis" solo con C-09 (D-05) |
| Contrato | C-18 `GET/PUT /wa/settings` (`autoReply`) con `If-Match` |

## Criterios de aceptación

- §14.4 con datos reales: tarjetas en la columna correcta con Respondió primero; un mensaje entrante suma al contador rojo; con ventana abierta se responde texto y con ventana cerrada solo plantillas; responder o marcar atendida deja la conversación "Atendida" (columna según D-55); STOP da de baja y confirma; el mismo hilo se ve en la ficha del pedido.
- Sin backend (verificado en tests): sin contadores ni conversaciones ficticias; ninguna mutación agrega mensajes ni muestra éxito; borradores sin `localStorage`.

## Dependencias pendientes

C-22 (todo), C-22.2 (contadores), C-23 (respuestas rápidas), C-18 (respuesta automática), C-25 (bajas), C-28/C-00.10 (permisos), C-00.9 (tiempo real), D-12, D-27, D-55, D-56, D-60.

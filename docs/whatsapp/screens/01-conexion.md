# 01 · Pestaña Conexión (`?tab=conexion`)

Referencias: PDF §6.1, §10.1, §11 (salud, contingencia), §12, §14.1; mockup `#p-conexion`, `#mConn`, `#mDisc`.
Usuarios principales: Administrador (PDF §6). Permiso de mutación: `WA_CONNECTION` (PDF §6.6.3 "Conectar o desconectar el número": solo Administrador).

Estado de la pestaña sin contratos: las siete secciones muestran `PendingIntegrationNotice`, salvo la lista de tiendas (C-E1), que sí se lista con estado "Pendiente de integración" por fila.

**Estado (etapa 2):** implementado exactamente eso. `WhatsAppTabPanel` muestra la descripción y un `PendingIntegrationNotice` con las seis secciones; `WhatsAppStoresPendingList` lista `auth.company.stores` con "Estado de WhatsApp pendiente de integración" o, sin tiendas, el enlace "Crear una tienda". Ninguna sección, modal ni acción de esta ficha está implementada todavía (etapa 7).

---

## T1.S1 · Tipo de conexión

| Campo | Detalle |
|---|---|
| Ubicación | Primera tarjeta |
| Disparador | Elegir una de tres tarjetas (radio) |
| Referencia | PDF §6.1.1; mockup `#ctypes` |
| Componente | Propuesto: `ConnectionTypeCards` (radio group accesible con tarjetas) |
| Datos | Opciones: `api` "API oficial de WhatsApp" (Recomendado), `coex` "API + app WhatsApp Business" (Mismo número), `app_manual` "Solo app WhatsApp Business" (Contingencia). Ventajas y limitaciones como texto fijo en `whatsapp-copy.ts` (D-32). Valor actual: `connectionType` de C-02 (cuenta principal de la tienda) |
| Estados | Pendiente: tarjetas visibles en solo lectura, ninguna marcada, aviso "pendiente de integración". Sin número conectado: ninguna marcada y texto "Conecta un número para elegir el tipo" con enlace a T1.S4. Sin permiso: solo lectura |
| Mutación | Elegir otra tarjeta no guarda: abre **T1.M3** |
| Errores | Ver T1.M3 |
| Validaciones FE | Solo una opción |
| Garantías BE | Qué cambios son posibles sin reconectar (D-04) |
| Permisos / tenant | `WA_CONNECTION`; cuenta de la tienda elegida |
| Criterios de aceptación | La etiqueta de la cabecera no cambia hasta que backend confirme; no aparece el texto "Habilita la confirmación por POWIP Link" (D-01) |
| Contrato | C-02 SPEC, C-03 SPEC parcial |

### T1.M3 · Confirmar cambio de tipo (propuesto)

| Campo | Detalle |
|---|---|
| Disparador | Elegir una tarjeta distinta de la actual |
| Referencia | No está en el PDF ni en el mockup; lo pide D-04 |
| Componente | `ChangeConnectionTypeDialog` (`AlertDialog`) |
| Contenido | Efecto del cambio (p. ej. a `app_manual`: "Los avisos dejarán de salir solos; tu equipo tendrá que enviarlos desde la bandeja de envío asistido"). Botones Cancelar / Cambiar |
| Mutación | `PUT /wa/accounts/:id` `If-Match: <version>` `{ "connectionType": "coex" }` → cuenta (C-02) |
| Errores | `409 WA_REQUIRES_SIGNUP` → cierra y abre T1.M1 en modo `coex`; `409 WA_VERSION_CONFLICT` → recarga; otros → toast con mensaje |
| Invalidación | `status`, `accounts` |
| Criterios de aceptación | Cancelar deja la selección anterior; no hay cambio optimista |
| Contrato | C-03 SPEC parcial |

---

## T1.S2 · Número conectado

| Campo | Detalle |
|---|---|
| Ubicación | Columna izquierda |
| Referencia | PDF §6.1.2; mockup card "Número conectado" |
| Componente | Propuesto: `ConnectedNumberCard` |
| Datos (C-02) | Nombre visible (`verifiedName`), número, tipo; estado del nombre (`nameStatus`); calidad (`qualityRating` → Alta/Media/Baja con texto); límite diario (`messagingLimitLabel`); webhook (`webhook.state` + "Último evento hace X"); WABA (`wabaId`); Phone number ID; Conectado desde (`connectedAt` + `connectedBy.name`); uso de hoy (`usageToday.uniqueContacts` / `limit`, barra `Progress`, "Se reinicia en…" desde `resetsAt`) |
| Estados | Pendiente. Carga: skeleton. Sin número: estado vacío "Esta tienda no tiene número conectado" + botón que abre T1.M1. Error: Reintentar. Calidad desconocida: "Sin dato de Meta" |
| Lecturas | `GET /wa/accounts?storeId=` → cuenta `role: "principal"` |
| Acciones | **T1.A1** Actualizar, **T1.M2** Desconectar |
| Permisos | Ver: `WA_VIEW`. Actualizar y Desconectar: `WA_CONNECTION` (ocultos sin permiso) |
| Actualización | Sin polling (backend relee cada 6 h y por webhook); se invalida con T1.A1 |
| Criterios de aceptación | §14.1: aparece con calidad, límite, WABA y phone number ID correctos. IDs con fuente monoespaciada y botón copiar |
| Contrato | C-02 SPEC |

### T1.A1 · Actualizar desde Meta

| Campo | Detalle |
|---|---|
| Disparador | Botón "Actualizar" |
| Mutación | `POST /wa/accounts/:id/refresh` → cuenta |
| Estados | Botón con spinner y deshabilitado mientras corre |
| Errores | `502 WA_META_UNAVAILABLE` → "Meta no responde, intenta en unos minutos"; `429` → igual |
| Invalidación | `accounts`, `status` |
| Contrato | C-04 PROPUESTA |

### T1.M2 · Desconectar número

| Campo | Detalle |
|---|---|
| Disparador | Botón "Desconectar" |
| Referencia | PDF §6.1.2; mockup `#mDisc` |
| Componente | `DisconnectNumberDialog` (`AlertDialog`, botón destructivo) |
| Contenido | Título "¿Desconectar el número de {tienda}?"; texto del PDF: se pausan avisos automáticos y envíos programados de esa tienda; plantillas e historial se conservan |
| Mutación | `POST /wa/accounts/:id/disconnect` + `Idempotency-Key` → `{ pausedRules, pausedCampaigns }` |
| Éxito | Toast "Número desconectado. Se pausaron N avisos y M envíos programados" |
| Errores | `404` → ya estaba desconectado, recarga; `5xx` → mensaje y el diálogo queda abierto |
| Invalidación | `status`, `accounts`, `rules`, `campaigns` |
| Permisos | `WA_CONNECTION` |
| Criterios de aceptación | §14.1: desconectar pausa reglas y envíos programados sin borrar plantillas ni historial. Sin simulación (el mockup solo muestra un toast) |
| Contrato | C-05 PROPUESTA |

---

## T1.S3 · Enviar mensaje de prueba

| Campo | Detalle |
|---|---|
| Ubicación | Columna derecha |
| Referencia | PDF §6.1.3; mockup `#btnTest`, `#liveStatus` |
| Componente | Propuesto: `TestMessageCard` + `MessageStatusTicks` |
| Campos | Número de WhatsApp (texto), Plantilla (solo `APPROVED`, C-12) |
| Estados | Pendiente: campos editables, botón deshabilitado. Sin número conectado: deshabilitado con explicación. Sin plantillas aprobadas: select vacío con "No hay plantillas aprobadas" y enlace a Plantillas. En curso: botón deshabilitado (PDF) y tres etiquetas Enviado → Entregado → Leído que se encienden según el estado real. Fallo: etiqueta roja con `errorMessage` |
| Mutación | `POST /wa/accounts/:id/test` + `Idempotency-Key` `{ phone, templateId }` → `202 { messageId }` |
| Lectura | `GET /wa/messages/:messageId` cada 2 s hasta `read`/`failed` o 2 min; después, "Seguimos esperando a Meta" + botón Actualizar. Si queda en `delivered`, explicar que el destinatario puede tener desactivadas las confirmaciones de lectura |
| Errores | `422` (teléfono) → error en el campo; `409 WA_TEMPLATE_NOT_APPROVED`, `WA_NOT_CONNECTED`, `WA_OPTED_OUT` → mensaje en la tarjeta |
| Validaciones FE | `toWhatsAppNumber` (`src/utils/whatsapp/build-whatsapp-url.ts:5`); plantilla requerida |
| Garantías BE | Envío real con datos de ejemplo; estados por webhook |
| Permisos | `WA_CONNECTION` (el PDF no lo define; propuesta: quien conecta prueba) |
| Criterios de aceptación | §14.1: recorre Enviado → Entregado → Leído con datos reales; nunca con temporizadores |
| Contrato | C-07 SPEC + PROPUESTA |

---

## T1.S4 · Números por tienda

| Campo | Detalle |
|---|---|
| Referencia | PDF §6.1.4; mockup card "Números por tienda" |
| Componente | Propuesto: `StoreNumbersCard` |
| Datos | Filas = tiendas de la empresa (C-E1) cruzadas con C-02 (todas las tiendas). Por fila: iniciales/logo, nombre de tienda, número + nombre visible, estado (Conectado / Sin conectar / Nombre en revisión), mensajes del mes (`messagesThisMonth`), botón |
| Estados | Pendiente: las tiendas se listan con estado "Pendiente de integración" y sin botón activo. Error de C-02: filas con "Estado desconocido". Tienda sin número: "Los avisos están apagados" + botón "Conectar número" |
| Acciones | **T1.A2** Ver detalle; **T1.M1** Conectar número |
| Permisos | Conectar: `WA_CONNECTION` |
| Tenant | Solo tiendas de la empresa |
| Criterios de aceptación | Con tienda conectada en revisión: "Nombre en revisión" y "Puedes enviar mientras Meta revisa el nombre" |
| Contrato | C-E1 CONFIRMADO, C-02 SPEC |

### T1.A2 · Ver detalle

El mockup no define comportamiento. Propuesta: cambia el selector de tienda (PG-1.2) a esa tienda y hace scroll a T1.S2. Sin contrato propio.

### T1.M1 · Conectar número (Embedded Signup)

| Campo | Detalle |
|---|---|
| Disparador | "Conectar número" en T1.S4 o en el vacío de T1.S2; también desde T1.M3 con `WA_REQUIRES_SIGNUP` |
| Referencia | PDF §6.1.4, §10.1; mockup `#mConn` (3 pasos) |
| Componente | Propuesto: `ConnectNumberDialog` (`Dialog`) |
| Paso 1 | "Inicia sesión con Meta": texto y requisitos del PDF (número que no esté en la app normal, acceso para recibir código, método de pago en Meta). Botón azul "Continuar con Facebook" |
| Paso 2 | Ventana de Meta abierta: "Completa los pasos en la ventana de Facebook" + indicador de progreso + "Cancelar". La elección del número, el nombre visible y el código SMS ocurren en Meta (D-03) |
| Paso 3 | Resultado: éxito → "Número conectado. Meta está revisando el nombre; puedes enviar mientras tanto" y cierra; fallo o cierre de la ventana → vuelve al paso 1 con el motivo |
| Lecturas / mutaciones | `POST /wa/signup/session` `{ storeId, mode }` → `{ appId, configId, state, graphApiVersion }`; SDK de Meta; `POST /wa/signup/complete` `{ state, code, wabaId, phoneNumberId }` → cuenta |
| Errores | `WA_SIGNUP_STATE_MISMATCH` → reiniciar; `WA_NUMBER_ALREADY_CONNECTED` → "Ese número ya está conectado a otra tienda"; `WA_SIGNUP_INCOMPLETE` → paso 1; bloqueador de ventanas emergentes → mensaje específico |
| Validaciones FE | Ninguna sobre el número (lo valida Meta) |
| Garantías BE | Intercambio de `code` por token, cifrado del token, suscripción de webhook, registro del número, `state` anti-CSRF |
| Permisos / tenant | `WA_CONNECTION`; la tienda del botón |
| Dependencias | SDK JS de Meta (carga dinámica solo al abrir el modal), app de Meta Tech Provider, `config_id`, dominio permitido (SIN DEFINIR) |
| Invalidación | `status`, `accounts` |
| Criterios de aceptación | §14.1: conexión real; nunca se marca conectado sin respuesta de backend; la coexistencia usa el mismo flujo con la opción de app Business |
| Contrato | C-06 PROPUESTA |

---

## T1.S5 · Número de contingencia

| Campo | Detalle |
|---|---|
| Referencia | PDF §6.1.5, §11 (contingencia), §13 casos 12, 13, 26; mockup card "Número de contingencia" |
| Componente | Propuesto: `ContingencyCard` |
| Campos | Interruptor "Activa"; número de respaldo (cuenta `role: "contingencia"`, etiqueta "Envío asistido"); casillas "Pasar a contingencia cuando": restricción o calidad roja, límite diario, "Fallan 5 envíos seguidos en 15 minutos" (5 y 15 editables, PROPUESTA), "Solo cuando yo la active"; "Quién envía los mensajes asistidos" (rol o persona) |
| Catálogos | Personas: C-E4 (asesoras por tienda). Roles: SIN DEFINIR (el mockup dice "Todas las asesoras de Operaciones", D-11) |
| Estados | Pendiente: formulario editable y validable, Guardar deshabilitado. Sin número de respaldo: texto "Agrega un número de respaldo" (cómo se registra un número `app_manual`: SIN DEFINIR, no pasa por Embedded Signup). Contingencia activa ahora: banda ámbar "Contingencia activa desde {hora} · motivo" |
| Lecturas | `GET /wa/contingency?storeId=` |
| Mutaciones | `PUT /wa/contingency?storeId=` `If-Match`; activar/desactivar manual `POST /wa/contingency/activate|deactivate` |
| Errores | `422` por campo; `409 WA_VERSION_CONFLICT` |
| Validaciones FE | "Solo cuando yo la active" excluye las demás; fallos y minutos enteros > 0; si está activa, al menos un disparador |
| Garantías BE | Evaluación continua; vuelta automática al principal con aviso al admin |
| Permisos | `WA_CONNECTION` (PROPUESTA; el PDF no asigna) |
| Actualización | Invalidada al guardar; `status` muestra si está activa |
| Criterios de aceptación | §14.1: al forzar una condición, los avisos aparecen en la bandeja asistida |
| Contrato | C-10 PROPUESTA, C-E4 CONFIRMADO |

## T1.S6 · Bandeja de envío asistido

| Campo | Detalle |
|---|---|
| Ubicación | Dentro de T1.S5, columna derecha |
| Referencia | PDF §6.1.5; mockup `#assistList` |
| Componente | Propuesto: `AssistedQueueList` |
| Datos (C-11) | Por fila: pedido, comprador, plantilla, courier, estado (`pending`, `opened`, `marked_sent`). Contador "N por enviar" |
| Estados | Pendiente. Vacío real: "No hay mensajes por enviar". Contingencia inactiva: la bandeja muestra solo pendientes remanentes o el texto "Se llena cuando la contingencia está activa" (sin filas de ejemplo, D-21) |
| Acciones | **T1.A3** |
| Paginación | Primeras 20 + "Ver más" |
| Permisos | Quien sea "enviador" configurado (C-10) o `WA_CONNECTION`. SIN DEFINIR si las asesoras ven esta bandeja fuera de Configuración |
| Actualización | Polling 15 s con contingencia activa |
| Criterios de aceptación | §14.1: "Abrir en WhatsApp" abre el texto correcto; el contador baja solo al marcar "Ya lo envié" |
| Contrato | C-11 PROPUESTA |

### T1.A3 · Abrir en WhatsApp / Ya lo envié / Descartar

| Campo | Detalle |
|---|---|
| Abrir en WhatsApp | Abre `waMeUrl` (generada por backend con texto y link de rastreo) en pestaña nueva y registra `POST /wa/assisted-queue/:id/opened`. La fila pasa a "Abierta · confirma cuando la envíes" |
| Ya lo envié | `POST /wa/assisted-queue/:id/mark-sent` → "Marcado como enviado por {asesora}" (D-02) |
| Descartar | `POST /wa/assisted-queue/:id/discard` `{ reason }` con confirmación |
| Errores | `404` → otra asesora la tomó; recarga |
| Validaciones FE | Si `waMeUrl` falta o el teléfono no es válido (`toWhatsAppNumber`), botón deshabilitado con motivo |
| Invalidación | `assisted-queue`, `messages` |
| Criterios de aceptación | Abrir no marca enviado; el historial muestra "Asistido · número de contingencia" |
| Contrato | C-11 PROPUESTA |

---

## T1.S7 · Costo de los mensajes

| Campo | Detalle |
|---|---|
| Referencia | PDF §6.1.6, §12; mockup card "Costo de los mensajes" |
| Componente | Propuesto: `MessagingCostCard` |
| Datos | Tabla de tarifas (C-09): tipo, cuándo se cobra, USD, aprox. en soles; fecha de vigencia, fuente y tipo de cambio. Recuadro "Meta te cobra directo" con el acumulado del mes (C-08: avisos y costo aproximado) |
| Estados | Pendiente: texto fijo "Meta te cobra directo… POWIP no agrega recargo" (es política de POWIP, PDF §3.3) y la tabla como pendiente. Tarifas no verificadas (`verifiedAt` viejo, umbral SIN DEFINIR): aviso ámbar. Sin uso en el mes: "Aún no hay avisos este mes" |
| Lecturas | `GET /wa/pricing?country=PE`, `GET /wa/usage?storeId=&month=` |
| Validaciones / garantías | El frontend no calcula tarifas (D-05) |
| Permisos | `WA_VIEW` |
| Criterios de aceptación | Ningún valor de tarifa está escrito en el código de la app |
| Contrato | C-08, C-09 PROPUESTA |

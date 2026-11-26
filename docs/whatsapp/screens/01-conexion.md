# 01 · Pestaña Conexión (`?tab=conexion`)

Referencias: PDF §6.1, §10.1, §11, §12, §14.1; mockup `#p-conexion`, `#mConn`, `#mDisc`. Contratos C-01 a C-11 (propuestos) y C-E1, C-E4 (confirmados).

**Estado (etapa 7, 2026-10-10):** frontend completo y revisable en Storybook (`WhatsApp/Conexion/ConnectionView`, 15 variantes). En la app, sin backend ni configuración de Meta: "Estado de conexión pendiente de integración", cada sección en pendiente (que no aparezca un dato no significa "desconectado" ni "cero"), tiendas reales con "Estado de WhatsApp pendiente de integración", y todas las acciones bloqueadas con explicación. No hay SDK de Meta, IDs de app, tokens, tarifas ni montos en el código.

## Componentes

| Componente | Archivo (`src/app/configuracion/whatsapp/_components/conexion/`) | Rol |
|---|---|---|
| `ConnectionTab` | `ConnectionTab.tsx` | Contenedor: tiendas y tienda activa de `useAuth`, selector local de tienda, permisos efectivos sin confirmar, todo en pendiente |
| `ConnectionView` | `ConnectionView.tsx` | Selector de tienda, etiqueta de estado (C-01), secciones, motivos de bloqueo |
| `ConnectionTypeSection` | `ConnectionTypeSection.tsx` | T1.S1 + T1.M3 |
| `ConnectedNumberSection` | `ConnectedNumberSection.tsx` | T1.S2 + T1.A1 + T1.M2 |
| `TestMessageSection` | `TestMessageSection.tsx` | T1.S3 |
| `StoreNumbersSection` | `StoreNumbersSection.tsx` | T1.S4 + T1.A2 |
| `ConnectNumberDialog` | `ConnectNumberDialog.tsx` | T1.M1 |
| `ContingencySection` | `ContingencySection.tsx` | T1.S5 |
| `AssistedQueueSection` | `AssistedQueueSection.tsx` | T1.S6 + T1.A3 |
| `MessagingCostSection` | `MessagingCostSection.tsx` | T1.S7 |

Dominio: `models/connection.model.ts`, `constants/whatsapp-connection-catalog.ts` (textos de tipos de conexión en un solo archivo, D-32), `utils/connection.util.ts`, `schemas/connection.schema.ts`.

Permisos: toda mutación requiere `WA_CONNECTION` confirmado (C-28). Sin confirmar: "Tus permisos de WhatsApp todavía no están confirmados…". La bandeja asistida usa un permiso aún no definido (D-65). Editar el borrador de contingencia usa `canManageConfiguration` (no habilita guardar).

---

## Selector de tienda y estado (PG-1.1/PG-1.2)

Selector "Tienda" con las tiendas de la empresa (C-E1); por defecto la tienda activa de POWIP. Cambiar de tienda remonta las secciones por tienda (sin arrastrar borradores). Etiqueta "Estado": C-01 → "Conectado · API oficial", "Conectado · API + app Business", "Solo envío asistido", "Nombre en revisión", "Restringido por Meta", "Desconectado", "Sin conectar"; `state: null` → "Estado sin confirmar"; sin contrato → "Estado de conexión pendiente de integración". Ver D-69.

## T1.S1 · Tipo de conexión + T1.M3 · Confirmar cambio

| Campo | Detalle |
|---|---|
| Tarjetas | API oficial (Recomendado), API + app WhatsApp Business (Mismo número), Solo app WhatsApp Business (Contingencia), con qué es, ventajas y limitaciones del PDF (sin "Habilita la confirmación por POWIP Link", D-01). Límites de coexistencia a validar por producto (D-32) |
| Selección local vs real | Solo con un número conectado se muestran como radios; el marcado es el tipo que informa POWIP. Elegir otro abre la confirmación con su efecto; Cancelar deja el tipo real; Cambiar queda bloqueado. Nunca cambia la etiqueta de estado sin respuesta de backend (D-04) |
| Sin datos / sin número | Tarjetas informativas (sin radios) y "Conecta un número para elegir el tipo" |
| Contrato | C-03 `PUT /wa/accounts/:id` + `If-Match` `{ "connectionType" }` → cuenta. Errores: `409 WA_REQUIRES_SIGNUP` (abrir T1.M1), `409 WA_VERSION_CONFLICT`, `422`. Invalidar `status`, `accounts` |

## T1.S2 · Número conectado + T1.A1 Actualizar + T1.M2 Desconectar

| Campo | Detalle |
|---|---|
| Datos (C-02) | Nombre visible, número, tipo, estado del nombre, calidad (Alta/Media/Baja/"Sin dato de Meta"), límite diario, uso de hoy (barra solo con contactados y límite; "Sin dato de uso"), reinicio del límite (solo `resetsAt` de backend; vencido → "Reinicio pendiente de confirmar por Meta"; sin dato → "Meta no informó cuándo se reinicia"), webhook ("Activo · último evento hace X" o "Sin dato"), WABA y Phone number ID (monoespaciados, botón Copiar), conectado desde y por quién, mensajes del mes, última lectura de Meta |
| Estados | Pendiente (con aclaración de que no significa desconectado), carga, sin permisos, error con Reintentar, sin número ("{tienda} no tiene número conectado" + Conectar número), contenido |
| Actualizar | C-04 `POST /wa/accounts/:id/refresh` → cuenta; errores `502 WA_META_UNAVAILABLE`, `429`; invalidar `accounts`, `status` |
| Desconectar | Confirmación "¿Desconectar el número de {tienda}?" con el efecto del PDF (pausa avisos y envíos programados; plantillas e historial se conservan). C-05 `POST /wa/accounts/:id/disconnect` + `Idempotency-Key` → `{ pausedRules, pausedCampaigns }`; error mantiene el diálogo abierto; invalidar `status`, `accounts`, `rules`, `campaigns` |

## T1.S3 · Enviar mensaje de prueba

| Campo | Detalle |
|---|---|
| Campos | Número (celular de Perú validado con `toWhatsAppNumber`) y plantilla (solo `APPROVED` de la tienda o globales, C-12) |
| Bloqueos | Sin backend, sin permiso, sin número conectado o con una prueba en curso |
| Seguimiento | Enviado → Entregado → Leído se encienden solo con las fechas reales de C-07; pasos sin fecha "· sin confirmar". Fallo con el mensaje de Meta. Si llega Entregado y pasan 2 min sin Leído, la prueba termina con "«Leído» puede no aparecer si el destinatario desactivó las confirmaciones de lectura" (no se espera indefinidamente). Nada avanza por temporizadores |
| Contrato | C-07 `POST /wa/accounts/:id/test` + `Idempotency-Key` `{ phone, templateId }` → `202 { messageId, status }`; estado `GET /wa/messages/:messageId` (polling 2 s hasta `read`/`failed` o 2 min, en la integración). Errores `422`, `409 WA_TEMPLATE_NOT_APPROVED`, `WA_NOT_CONNECTED`, `WA_OPTED_OUT` |

## T1.S4 · Números por tienda + T1.A2 Ver detalle

Filas por tienda real (C-E1) cruzadas con C-02: pendiente/carga/error/sin permiso → "Estado de WhatsApp pendiente de integración" / "Cargando estado…" / "Estado desconocido" / "Sin permiso…" (nunca "Sin conectar" sin dato); sin cuenta → "Sin conectar · los avisos están apagados" + "Conectar número"; con cuenta → número, nombre, "Nombre en revisión · puedes enviar mientras Meta lo revisa" o "Conectado", mensajes del mes. "Ver detalle" cambia el selector a esa tienda. Sin tiendas: enlace "Crear una tienda" (`/configuracion/tiendas`).

## T1.M1 · Conectar número (Embedded Signup)

| Campo | Detalle |
|---|---|
| Disparador | "Conectar número" en T1.S4 o en el vacío de T1.S2 |
| Contenido | Pasos "1. Inicia sesión con Meta · 2. Elige el número · 3. Verifica el código", aclarando que 2 y 3 ocurren en la ventana de Meta; requisitos del PDF; botón "Continuar con Facebook" |
| Estados | Inicio; esperando ("Completa los pasos en la ventana de Meta…", sin poder cerrar); éxito solo si POWIP lo confirma ("Meta está revisando el nombre: puedes enviar mientras tanto"); error con motivo e "Intentar de nuevo". Cancelar sin efectos |
| Bloqueo actual | "Falta configurar la app de Meta (Tech Provider, config_id y dominio permitido) y el servicio de conexión de POWIP. No se abrió ninguna ventana de Meta." Sin SDK, IDs, formularios de credenciales ni de SMS (D-03, D-71) |
| Contrato | C-06: `POST /wa/signup/session` `{ storeId, mode }` → `{ appId, configId, state, graphApiVersion }`; SDK de Meta; `POST /wa/signup/complete` `{ state, code, wabaId, phoneNumberId }` → cuenta. Errores `409 WA_SIGNUP_STATE_MISMATCH`, `409 WA_NUMBER_ALREADY_CONNECTED`, `422 WA_SIGNUP_INCOMPLETE`, `502`; ventana emergente bloqueada → mensaje del navegador |

## T1.S5 · Número de contingencia

| Campo | Detalle |
|---|---|
| Campos | Contingencia activa; número de respaldo (solo lectura, "Envío asistido"; sin dato → explica que el alta de un número solo app no está definida); motivos: restricción o calidad roja, límite diario, fallos seguidos (envíos 1-50, minutos 1-1440; sugerido 5 en 15), "Solo cuando yo la active" (excluye los demás); quién envía (todas las asesoras de la tienda o una persona de C-E4) |
| Validaciones | Manual excluyente; activa requiere al menos un motivo; rangos enteros; persona obligatoria si se elige "una persona" |
| Estados | Sugeridos rotulados sin backend o sin configuración; banda ámbar "Contingencia activa desde {fecha} · {motivo}" solo con `active: true`; `active: null` → "POWIP no informó si la contingencia está activa ahora" |
| Contrato | C-10 `GET/PUT /wa/contingency?storeId` + `If-Match`; `POST …/activate|deactivate`. Errores `422`, `409 WA_VERSION_CONFLICT` |

## T1.S6 · Bandeja de envío asistido + T1.A3

| Campo | Detalle |
|---|---|
| Filas | Pedido, comprador, plantilla, courier, estado (Por enviar / Abierta · falta confirmar el envío / Marcado como enviado / Descartado). Contador "N por enviar" solo con `pendingTotal` de backend |
| Abrir en WhatsApp | Enlace al `waMeUrl` generado por backend en otra pestaña; registra `opened` si hay contrato. **No** cambia la fila ni baja el contador. Sin `waMeUrl`: bloqueado ("POWIP no generó el enlace") |
| Ya lo envié | Única forma de pasar a enviado (confirmación explícita, D-72); bloqueado sin backend |
| Descartar | Diálogo con motivo obligatorio; bloqueado sin backend |
| Contrato | C-11 `GET /wa/assisted-queue?storeId&status` → `{ items, pendingTotal, hasMore }`; `POST …/:id/opened`, `…/mark-sent`, `…/discard { reason }`. `404` → otra asesora la tomó: recargar |

## T1.S7 · Costo de los mensajes

Texto fijo "Meta te cobra directo… POWIP no agrega recargo" (política de POWIP, PDF §3.3). Uso del mes (C-08) solo con datos: "{n} avisos este mes · aprox. S/ {x} (USD {y})", con tipo de cambio y fecha si los hay, rotulado como estimación. Tarifas (C-09) solo desde backend: tabla con tipo, cuándo se cobra, USD y aprox. S/, más mercado, vigencia, fuente (enlace si hay) y fecha de verificación; sin verificar o con más de 30 días → aviso ámbar (D-05). Los montos del PDF no se usan como precios actuales.

## Criterios de aceptación (§14.1, con datos reales)

Conectar un número real en una tienda de prueba; ver calidad, límite, WABA y phone number ID correctos; la prueba recorre Enviado → Entregado → Leído con estados reales; desconectar pausa reglas y envíos sin borrar plantillas ni historial; al forzar una condición de contingencia los avisos aparecen en la bandeja y el historial los muestra como "Asistido". Sin backend (tests): nada se muestra como conectado, desconectado o cero sin dato; ninguna acción se ejecuta.

## Dependencias externas

C-01 a C-11; configuración de la app de Meta (Tech Provider, `config_id`, dominio permitido, verificación del negocio); permisos C-28; D-04, D-05, D-32, D-65, D-72.

# Decisiones pendientes y contradicciones

Fuentes: `POWIP_Hito1_Notificaciones_WhatsApp_v2.docx.pdf` (v2.0, 7 oct 2026; en adelante "PDF") y `POWIP WhatsApp Notificaciones (Copy).html` (en adelante "mockup"). Si se contradicen, manda el PDF (§0.2).

Cada punto tiene un estado:

- **Decidido para el frontend**: el frontend procede así sin esperar a nadie. Se puede revertir si producto decide otra cosa.
- **Pendiente**: bloquea el diseño final de un contrato o de una pantalla. Se indica quién debería decidir.

| ID | Tema | Estado |
|---|---|---|
| D-01 | Referencias residuales al Hito 2 (COD, pagos, Pau) | Decidido para el frontend |
| D-02 | Abrir `wa.me` no prueba que el mensaje se envió | Decidido para el frontend |
| D-03 | Embedded Signup: pasos 2 y 3 del mockup | Decidido para el frontend; configuración de Meta pendiente |
| D-04 | Cambiar el tipo de conexión | Pendiente (producto + backend) |
| D-05 | Tarifas y condiciones de Meta | Decidido para el frontend; validación pendiente |
| D-06 | Dónde vive la página pública | Pendiente (producto + equipo landing) |
| D-07 | Reglas por tienda o por empresa | Pendiente (backend) |
| D-08 | Eventos del PDF frente a estados reales | Pendiente (backend) |
| D-09 | Catálogos de canal, tipo de envío y courier | Decidido para el frontend; mapeo pendiente |
| D-10 | Coexistencia y ventana de 24 h | Decidido para el frontend |
| D-11 | Roles de la spec frente a roles reales | Pendiente (producto + ms-auth) |
| D-12 | Bajas por tienda o por empresa | Pendiente (producto) |
| D-13 | Duplicar plantilla: borrador o revisión | Pendiente (producto) |
| D-14 | Lista "Se usa en" y recordatorio de recojo | Pendiente (producto) |
| D-15 | Foto de entrega frente a evidencia de despacho | Pendiente (producto + backend) |
| D-16 | Respuestas rápidas | Pendiente (producto) |
| D-17 | Exportación a Excel | Propuesta en D-64; pendiente de backend |
| D-18 | Interruptor "Notas para devs" | Decidido para el frontend |
| D-19 | Recordar la pestaña | Decidido para el frontend |
| D-20 | Encabezado "Documento PDF" | Decidido para el frontend |
| D-21 | Simulaciones del mockup que no se replican | Decidido para el frontend |
| D-22 | Sección local en Operaciones › Guías | Decidido (propuesta), ejecución en etapa posterior |
| D-23 | Huecos del PDF | Pendiente (autor del PDF) |
| D-24 | Prueba de salud del webhook | Pendiente (producto) |
| D-25 | "Responder una vez y cerrar" | Pendiente (producto) |
| D-26 | Destinatarios de las alertas | Pendiente (producto) |
| D-27 | Horario de atención de las asesoras | Pendiente (producto) |
| D-28 | Aviso "Saldo pendiente" | Pendiente (backend) |
| D-29 | Normalización de teléfonos duplicada | Decidido para el frontend |
| D-30 | Planes que incluyen el módulo | Pendiente (producto) |
| D-31 | Entrada en el menú | Decidido para el frontend (propuesta) |
| D-32 | Afirmaciones sobre Meta en textos fijos | Pendiente (producto) |
| D-33 | Acceso a la página en la etapa 2 | Decidido para el frontend (etapa 2) |
| D-34 | Sin URL ni variable de entorno para WhatsApp | Decidido para el frontend (etapa 2) |
| D-35 | Navegación entre pestañas e hidratación | Decidido para el frontend (etapa 2) |
| D-36 | Cabecera sin estado de conexión ni selector de tienda | Decidido para el frontend (etapa 2) |
| D-37 | Presentación de estados no confirmados por Meta | Decidido para el frontend (etapa 2) |
| D-38 | Alcance de la advertencia de lenguaje promocional | Decidido para el frontend; afinable por producto |
| D-39 | Códigos de idioma de plantilla | Pendiente (backend, C-13); `es_PE` listado por Meta, sin confirmar en integración |
| D-40 | Duplicar abre el editor como plantilla nueva | Decidido para el frontend (etapa 3); persistencia pendiente (D-13) |
| D-41 | Plantilla en revisión en solo lectura | Decidido para el frontend (etapa 3); confirmable por producto |
| D-42 | Botones de guardado sin backend | Decidido para el frontend (etapa 3) |
| D-43 | Vista previa con datos de muestra | Decidido para el frontend (etapa 3) |
| D-44 | Reglas de Meta aplicadas en el editor | Decidido; 5 reglas con fuente oficial comprobada, 2 requieren validación |
| D-45 | Guarda de contratos en lugar de prohibir red | Decidido para el frontend (etapa 3); reemplaza parte de D-34 |
| D-46 | Inserción de variables y texto sugerido | Decidido para el frontend (etapa 3) |
| D-47 | Desactivar una regla y avisos ya encolados | Pendiente (producto + backend) |
| D-48 | Horario que cruza la medianoche | Decidido para el frontend (rechazado); pendiente de producto |
| D-49 | Identidad estable de reglas y enlace desde Plantillas | Decidido para el frontend (etapa 4) |
| D-50 | Alcance: lista vacía = todas y catálogos reales | Decidido para el frontend; confirmar con backend |
| D-51 | Preview frente a activación | Decidido para el frontend; garantías a cargo de backend |
| D-52 | Valores sugeridos frente a configuración guardada | Decidido para el frontend (etapa 4) |
| D-53 | Selects de Radix y valores vacíos | Decidido para el frontend (etapa 4) |
| D-54 | Segmento de envíos programados | Decidido para el frontend; "Solo Lima/provincia" pendiente |
| D-55 | Columna del tablero frente a estado de atención | **Pendiente (producto).** Comportamiento provisional del frontend que difiere del PDF §8.2; no aprobado |
| D-56 | Evidencia de despacho frente a foto de entrega | Decidido para el frontend (etapa 5); fuente de `DELIVERY` pendiente |
| D-57 | Ventana de 24 h solo con autorización de backend | Decidido para el frontend (etapa 5) |
| D-58 | Respuestas rápidas sin cambios operativos | Decidido para el frontend (etapa 5); catálogo pendiente de C-23 |
| D-59 | Capacidades explícitas de conversaciones | Decidido para el frontend (etapa 5); códigos pendientes de C-28 |
| D-60 | Mensaje entrante con varios pedidos del mismo teléfono | Pendiente (backend + producto) |
| D-61 | Filtros, preferencias y borradores | Decidido para el frontend (etapa 5) |
| D-62 | Ventana desconocida bloquea también plantillas | Decidido para el frontend (etapa 5) |
| D-63 | Rastreo: base del porcentaje y clic sin lectura | Decidido para el frontend (etapa 6); difiere del PDF §6.5.1 |
| D-64 | Exportar todos los resultados filtrados | Propuesta (etapa 6); pendiente de backend |
| D-65 | Acciones sin permiso definido en el PDF | Decidido para el frontend (etapa 6); pendiente de C-28 |
| D-66 | Teléfonos en bajas manuales | Decidido para el frontend (etapa 6); extranjeros pendientes |
| D-67 | Alcance de indicadores frente al filtro de estado | Decidido para el frontend (etapa 6) |
| D-68 | Configuración por tienda activa | Decidido para el frontend (etapa 6); confirmar con backend |

---

## D-01 · Referencias residuales al Hito 2

El PDF deja fuera del Hito 1 la confirmación COD, el cobro por POWIP Link y Pau (§4.3). Aun así quedan menciones:

| Dónde | Texto | Qué hace el frontend |
|---|---|---|
| Mockup, tarjeta "API oficial" | "Habilita la confirmación por POWIP Link" | No se muestra. |
| PDF §6.1.1, tabla de tipos | "Habilita la confirmación por POWIP Link" | Igual. |
| Mockup y PDF §12, costos | "Respuestas en el chat (IA o asesor)", "confirmación, saldo" | Se muestra el texto de tarifas que devuelva backend (C-09); sin "IA" ni "confirmación". |
| PDF §9.1 `wa_settings.pau_en_whatsapp` | Interruptor de Pau | No se expone. |
| PDF §10.1.1 webhook entrante | "Si es el botón Confirmo: confirmar el lead" | Solo backend; no hay UI. |
| PDF §10.3 `/wa/settings` | "…respuesta automática, Pau, bajas" | Se omite Pau. |
| PDF §6.6.1 bajas | "ni automático, ni masivo, ni de confirmación" | Se dice "ningún aviso". |
| PDF §2 glosario | POWIP Pay, Mercado Pago, fee de pasarela | Sin pantalla. |

El aviso "Saldo pendiente" sí está en el Hito 1 como notificación (no cobra nada). Ver D-28.

## D-02 · Abrir `wa.me` no prueba que el mensaje se envió

- Bandeja de envío asistido (§6.1.5): el mockup pasa la fila a "Enviado por asesora" en cuanto se toca "Abrir en WhatsApp". El frontend separa dos pasos: **Abrir en WhatsApp** (registra `opened`, C-11) y **Ya lo envié** (registra `marked_sent`). La fila queda "Abierta, falta confirmar" entre ambos.
- En el historial, `assisted` se muestra como "Asistido · marcado por {asesora}". Nunca con ticks de entregado o leído.
- Los botones manuales de WhatsApp que ya existen en Ventas, Operaciones, Gestión CC, Finanzas, Clientes y Facturación abren `wa.me` o `api.whatsapp.com` y **no registran nada**. No alimentan el indicador del último aviso (C-29) ni el historial.

## D-03 · Embedded Signup

- El mockup dibuja tres pasos dentro de POWIP: iniciar sesión, elegir número y nombre, ingresar el código SMS de 6 dígitos. En Embedded Signup de Meta, la elección del número, el nombre visible y la verificación por SMS o llamada ocurren **dentro de la ventana de Meta**.
- El frontend muestra: requisitos (paso 1 del mockup), botón "Continuar con Facebook" que abre el SDK, un estado de progreso mientras la ventana está abierta y el resultado que devuelve backend (C-06). No dibuja casillas de código ni lista de números propia.
- Nunca se muestra "Conectado" sin respuesta exitosa de `POST /wa/signup/complete`. Si el usuario cierra la ventana, se vuelve al paso 1 con el aviso "No se completó la conexión".
- Pendiente fuera del frontend: app de Meta como Tech Provider, `config_id`, dominios permitidos y verificación de negocio.

## D-04 · Cambiar el tipo de conexión

El mockup cambia el tipo con un radio y actualiza la etiqueta al instante. En la realidad, pasar de API a coexistencia (o al revés) requiere otro alta en Meta, y "Solo app (contingencia)" como número principal deja a la tienda sin envío automático. Propuesta del frontend: el radio no guarda solo; abre una confirmación que explica el efecto y, si backend responde `409 WA_REQUIRES_SIGNUP`, lleva al flujo de conexión. Pendiente: qué cambios están permitidos sin reconectar.

## D-05 · Tarifas y condiciones de Meta

Los valores del PDF §12 y del mockup (USD 0.0130 utilidad, 0.0851 marketing, 1,000 respuestas gratis, CTWA 7 días, tipo de cambio 3.50, vigencia 1 oct 2026) son **referencia**; el propio PDF dice "Meta puede cambiarlos". El frontend no los escribe en código: los pide a C-09 y muestra fecha de vigencia y fuente. Sin C-09, la tabla de costos queda como "pendiente de integración". Los costos estimados de reglas y envíos los calcula backend.

## D-06 · Dónde vive la página pública

- El PDF ubica la página en `https://{tienda}.powip.lat/p/{token}` y el acortador en `powip.lat/r/{codigo}`. El capítulo 7 del PDF (que por la numeración debería describir esa página) **no está en el documento**: salta del 6 al 8.
- Hoy el rastreo público está en la landing: `${NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}` (por ejemplo `src/components/modals/CustomerServiceModal.tsx:586`), con el número de pedido, que es adivinable. Ese repositorio no está en este equipo.
- Este repo declara `/rastreo` como ruta pública (`src/components/auth/AuthGuard.tsx:15-21`, `src/components/layout/AppContainer.tsx:14-21`) pero no tiene `src/app/rastreo/`.
- Opciones y análisis en [screens/09-pagina-publica-rastreo.md](screens/09-pagina-publica-rastreo.md). Pendiente.

## D-07 · Reglas por tienda o por empresa

El PDF dice que todas las tablas llevan `tienda_id` (§9) y que `wa_settings` es "una fila por tienda", pero el alcance de cada regla tiene un filtro "Tiendas: LIVII, KUNCA…" (§6.3.2) y el mockup muestra una sola lista de reglas para todas las tiendas. Las dos lecturas posibles:

1. Reglas, horario y ajustes por tienda (la página tiene selector de tienda y el filtro "Tiendas" sobra).
2. Reglas por empresa con filtro de tiendas (y `wa_rules.tienda_id` sobra).

El frontend se diseña con un selector de tienda en la cabecera para lo que es claramente por número (conexión, contingencia, uso) y deja el resto parametrizable. Pendiente.

## D-08 · Eventos del PDF frente a estados reales

El PDF §16.2 asume que "mandan los estados actuales de POWIP". Los estados reales no coinciden uno a uno:

| Evento del PDF | Candidato en el repo | Observación |
|---|---|---|
| `GUIA_CREADA` | Pedido `ASIGNADO_A_GUIA` o guía `CREADA` (`src/constants/operationsDomain.ts:81-89`) | No es lo mismo: la guía puede crearse y no aprobarse. |
| `EN_ENVIO` | Pedido `EN_ENVIO` (`src/interfaces/IOrder.ts:68-78`) | Coincide de nombre. |
| `EN_AGENCIA` | Shalom `EN_DESTINO` (`IOrder.ts:83-90`) | Solo Shalom informa este estado. |
| `EN_REPARTO` | Shalom `EN_REPARTO`, guía `EN_RUTA` | No hay estado de pedido. |
| `ENTREGADO` | Pedido `ENTREGADO` | `CourierStatusMappingTable.tsx` documenta que Shalom "Entregado" no mueve el pedido hasta confirmarse. ¿Cuál dispara el aviso? |
| `INCIDENCIA` | Guía `FALLIDA` / `PARCIAL`; Shalom `FALLIDO` | Sin motivo estructurado. |
| `SALDO_COD` | — | No existe. Ver D-28. |
| `COMPROBANTE_ACEPTADO` | Documento SUNAT `ACCEPTED` (`src/features/sunat`) | Falta el gancho en backend. |

El frontend no inventa equivalencias: muestra el `label` y el `orderStateTrigger` que devuelva C-16. Pendiente (backend).

## D-09 · Catálogos de canal, tipo de envío y courier

| Concepto | PDF / mockup | Repo | Decisión del frontend |
|---|---|---|---|
| Canal | Shopify, WhatsApp, TikTok Live, Web, YaVendió | `SalesChannel` = TIENDA_FISICA, WHATSAPP, INSTAGRAM, FACEBOOK, MARKETPLACE, MERCADOLIBRE, WEB, OTRO (`IOrder.ts:57-64`); por empresa `company.sales_channels` | Usar el catálogo de la empresa (C-E3). |
| Tipo de envío | Agencia, Domicilio | `DeliveryType` = RETIRO_TIENDA, DOMICILIO, PUNTO_EXTERNO (`IOrder.ts:66`) | Mostrar los valores reales; el mapeo "Agencia" ↔ `PUNTO_EXTERNO` lo confirma backend. |
| Courier | Shalom, Olva, Indriver, Moto propia | Couriers por empresa en ms-courier (C-E2) + integraciones Shalom, EVA, Aliclik; constantes "Motorizado Propio", "Olva Courier", "Marvisur", "Flores" (`src/constants/operationsDomain.ts:67-72`) | Usar el catálogo por empresa (C-E2). |
| Destino | Todo el Perú, Solo Lima, Solo provincia | Sin campo directo | Pendiente: cómo se clasifica. |

## D-10 · Coexistencia y ventana de 24 h

- Los mensajes que el equipo envía desde la app del celular llegan como `message.echo` y **no abren** la ventana de respuesta (PDF §10.1.1, caso 25). Los avisos automáticos tampoco la abren. Solo un mensaje del comprador la abre.
- El frontend toma el estado de la ventana de `window.expiresAt` (C-22.3) y nunca lo calcula con mensajes salientes. Los `echo` se muestran con la etiqueta "Enviado desde la app del celular".
- Si la ventana vence con el chat abierto, el pie cambia a "Ventana cerrada" sin recargar: un reloj local se actualiza cada 30 s y al vencimiento exacto. No hay polling hasta que existan C-22 y C-00.9 (etapa 5, D-57).

## D-11 · Roles de la spec frente a roles reales

| Rol del PDF §6.6.3 | Más cercano en el repo | Observación |
|---|---|---|
| Administrador | `ADMINISTRADOR`, `ADMIN`, `OWNER`, `SUPERADMIN` (`hasAdminAccess`, `src/config/permissions.config.ts`) + superadmins por email | Razonable, pero no confirmado. |
| Supervisor CC | `ccRol: "supervisor"` (`src/services/agentesService.ts:18`) | No viaja en el JWT; se obtiene de la lista de agentes por tienda. |
| Asesora | `ccRol: "agente"`, rol `AGENTES` | Igual. |
| — | `VENTAS`, `OPERACIONES`, `COURIER`, `CALLER` | El PDF no dice qué ven. "Todas las asesoras de Operaciones" (§6.1.5) mezcla dos conceptos. |

Decisión del frontend: un hook `useWhatsAppPermissions()` que lee permisos `WA_*` del JWT cuando existan. Mientras backend no los emita, solo Administrador y superadmin pueden mutar configuración; el resto queda en lectura. Responder conversaciones queda deshabilitado hasta que exista el contrato, así que este límite no bloquea a nadie hoy. Pendiente: mapeo oficial y si la matriz es editable por empresa (C-28).

## D-12 · Bajas por tienda o por empresa

`wa_optouts` lleva `tienda_id` (§9.1) y la tabla muestra columna Tienda, pero un comprador que escribe STOP a una tienda ¿debe seguir recibiendo avisos de otra tienda del mismo dueño? Pendiente.

## D-13 · Duplicar plantilla

PDF §6.2.1: "Duplicar crea una copia `_copia` que se envía a revisión". Enviar a Meta una copia idéntica sin editarla puede terminar rechazada por duplicada. Propuesta: crear la copia como borrador y abrir el editor. Pendiente.

## D-14 · Lista "Se usa en" y recordatorio de recojo

- §6.2.1 enumera 8 usos (sin Incidencia ni Comprobante); §6.2.3 enumera 10. El frontend usa el catálogo de backend (C-13).
- La regla "Disponible en agencia" tiene recordatorio si no recoge en 48 h, pero no dice qué plantilla usa. El mockup muestra en la cola una plantilla `recordatorio_recojo` que no existe en la lista de plantillas. Pendiente.
- "Encuesta post-entrega" usa el evento `ENTREGADO` con retraso; la página de la encuesta está fuera del hito y no hay URL definida para su botón. Pendiente.

## D-15 · Foto de entrega

El PDF dice que la foto "es la misma de Evidencia de despacho de la ficha del pedido" y que la sube "el courier o el motorizado". En el repo la evidencia la suben usuarios de POWIP (`OrderEvidenceSection`, tipos `PREPARATION` y `DISPATCH`), y "despacho" no es "entrega". Pendiente: qué tipo de evidencia se muestra en el hilo y en la página pública, y si hace falta un tipo `DELIVERY`. Desde la etapa 5 el hilo rotula cada evidencia por su tipo (D-56).

## D-16 · Respuestas rápidas

No se sabe si son fijas, por tienda o editables, ni quién escribe los textos. "Reprogramar entrega" y "Cambiar dirección" solo llenan el texto; **no** cambian la fecha ni la dirección del pedido. Desde la etapa 5 tampoco agregan notas ni anuncian cambios (D-58). Pendiente (C-23).

## D-17 · Exportación a Excel

El repo exporta en el navegador con ExcelJS sobre filas ya cargadas (`src/utils/exportCcPedidosExcel.ts`). El historial puede tener miles de filas paginadas; el criterio §14.5 exige que el export traiga las mismas filas que los filtros. Opciones: endpoint de export en servidor (C-24) o descarga paginada en cliente con tope. Pendiente.

## D-18 · Interruptor "Notas para devs"

Es una ayuda del mockup. No se implementa en la app: su contenido vive en estos documentos.

## D-19 · Recordar la pestaña

El PDF dice "la pestaña elegida se recuerda en el navegador". El repo usa `?tab=` en la URL (`src/app/operaciones/guias/page.tsx:26-27`, `:53-56`). Decisión: `?tab=` manda; si no hay, se usa la última pestaña guardada en `localStorage` (preferencia de vista, permitida); si no hay, Conexión. La vista Tablero/Lista de Conversaciones se recuerda igual.

## D-20 · Encabezado "Documento PDF"

PDF §6.2.3: solo para "Comprobante emitido". El mockup lo permite en cualquier plantilla. Manda el PDF: la opción solo se habilita si el evento elegido lo admite (`allowsDocumentHeader`, C-13).

## D-21 · Simulaciones del mockup que no se replican en la app

| Mockup | App |
|---|---|
| La prueba enciende Enviado/Entregado/Leído con temporizadores | Solo cambia con estados reales (C-07). |
| La plantilla se aprueba sola a los 4 s | Solo cambia con el estado real (C-12) por polling. |
| "Reenviar" pasa a Enviado y luego a Entregado | Se muestra "En cola" hasta que backend informe. |
| "Verificar y conectar" deja KUNCA conectada | Ver D-03. |
| "Abrir en WhatsApp" marca enviado | Ver D-02. |
| La bandeja asistida muestra filas "de ejemplo" | Sin datos reales, la bandeja está vacía o pendiente. |
| El contador del segmento multiplica factores fijos | Solo C-21 `segment-count`. |
| Duplicar, desconectar, guardar borrador, programar envío solo muestran un toast | Llaman al contrato o quedan deshabilitados con "pendiente de integración". |

Esas simulaciones sí pueden existir en **Storybook** con MSW, nunca en la app (ver [frontend-plan.md §6](frontend-plan.md#6-revisión-sin-backend)).

## D-22 · Sección local en Operaciones › Guías

`src/app/operaciones/guias/_components/WhatsAppNotificationsSection.tsx` se monta en `CouriersTarifasTab.tsx:22`, pestaña `config` de `/operaciones/guias` (`page.tsx:112`). Guarda cuatro plantillas e interruptores en `useState`: se pierden al recargar, nunca envían nada, usan nombres distintos a los del PDF (`en_camino`, `entregado`, `recordatorio_pago`) y se protegen con `OPS_MANAGE_TARIFARIO`. Si convive con `/configuracion/whatsapp`, hay dos lugares que parecen configurar lo mismo y uno no hace nada.

Propuesta (no se ejecuta en esta etapa):

1. Cuando exista `/configuracion/whatsapp`, reemplazar la sección por una tarjeta de solo lectura: "Los avisos por WhatsApp se configuran en Configuración › WhatsApp" con enlace a `?tab=programacion`.
2. Cuando exista C-16, la tarjeta lista las reglas activas (nombre, plantilla, cuándo) en solo lectura.
3. Eliminar las plantillas locales y su estado.

## D-23 · Huecos del PDF

- Falta el capítulo 7 (por la referencia "cap. 5 a 7: las pantallas", probablemente la página pública y Gestión CC).
- §13 salta casos 17-21 y 23.
- El índice está vacío ("Actualizar campos").
- El mockup de Gestión CC con la ficha del pedido (`Powip_Confirmacion_Link_mockup.html`) no fue entregado; la integración en la ficha se basa en el texto de §6.4.7.

## D-24 · Prueba de salud del webhook

El PDF dice "Activo si llegó un evento en las últimas 24 h **o pasa la prueba**"; las notas del mockup mencionan un botón "Probar" que no está en la UI. Pendiente: si se agrega el botón o la prueba es el mensaje de prueba.

## D-25 · "Responder una vez y cerrar"

El mockup dice que "archiva la conversación"; el estado "archivada" no existe en la máquina de estados (§8.2). Pendiente.

## D-26 · Destinatarios de las alertas

PDF: "campanita de POWIP y WhatsApp, o solo campanita". Las notas del mockup agregan "correo". Manda el PDF. Enviar la alerta por WhatsApp al administrador requiere su número y una plantilla propia: no definido. La campanita no existe (C-31).

## D-27 · Horario de atención de las asesoras

La respuesta automática usa un texto alterno "fuera del horario de atención de las asesoras" (§6.4.8). Ese horario no está definido en ninguna parte (no es el horario permitido de envío de §6.3.5). Pendiente.

## D-28 · Aviso "Saldo pendiente"

Está en Hito 1 (regla apagada por defecto). Depende de una fecha de entrega estimada y del saldo por cobrar, que hoy no existen como evento. El frontend lo muestra como cualquier regla con el estado que devuelva backend (`blockedReason`).

## D-29 · Normalización de teléfonos duplicada

Hay tres implementaciones: `toWhatsAppNumber` (`src/utils/whatsapp/build-whatsapp-url.ts:5`, valida 9 dígitos que empiezan en 9), `normalizePeruPhone` (`src/app/operaciones/pedidos/_components/types.ts:209`) y una en línea en `CustomerServiceModal.tsx:581-593` que no valida. El módulo usa `toWhatsAppNumber`, que coincide con la regla del PDF §6.3.4 (+51, 9 dígitos, empieza en 9). No se tocan las otras en este hito.

## D-30 · Planes que incluyen el módulo

PDF §3.3: "el módulo es parte del valor del plan". No dice de qué planes. Pendiente: si se oculta, se muestra bloqueado o se ofrece mejorar el plan.

## D-31 · Entrada en el menú

El mockup muestra Configuración con submenú (Empresa, Tiendas, Couriers, WhatsApp, Integraciones, Usuarios y roles). El menú real tiene Configuración › Usuarios y Configuración › Configuración (`src/components/layout/Sidebar.tsx:237-243`), y las tarjetas de `/configuracion` (`src/app/configuracion/page.tsx:13-46`). Propuesta: agregar el ítem "WhatsApp" al grupo Configuración del menú con la etiqueta "Nuevo" (mecanismo `badge`/`badgeUntil` existente) y una tarjeta en `/configuracion`. La rama `origin/feat/usuarios-roles-permisos` también modifica `Sidebar.tsx`: coordinar el orden de merge.

## D-32 · Afirmaciones sobre Meta en textos fijos

Las tarjetas de tipo de conexión afirman límites de coexistencia (20 mensajes por segundo, app v2.24.17 o superior, sin difusiones nuevas, que responder desde la app no cuesta). Son condiciones de Meta que cambian. Producto debe validarlas antes de publicar; el frontend las deja en un único archivo de textos para cambiarlas sin tocar componentes.

---

# Decisiones adoptadas en la etapa 2

## D-33 · Acceso a la página en la etapa 2

- `/configuracion/whatsapp` es accesible para cualquier persona autenticada con empresa, igual que `/configuracion` (`ROUTE_PERMISSIONS`). No se restringe a administradores como `/configuracion/tiendas` porque Conversaciones e Historial son para el trabajo diario de las asesoras (PDF §6).
- `resolveWhatsAppAccess()` (`src/features/whatsapp/utils/whatsapp-access.util.ts`) considera "puede gestionar la configuración" solo a superadmin (`isSuperadmin`) y roles admin (`hasAdminAccess`). Quien no lo es ve, en Conexión, Plantillas, Programación y Bajas/alertas/permisos, la nota "Solo un administrador podrá cambiar esta configuración. Los permisos de Supervisor CC y Asesora todavía no están definidos."
- No se mapea ningún rol del JWT (`AGENTES`, `VENTAS`, `OPERACIONES`, `COURIER`, `CALLER`) a Supervisor CC o Asesora (D-11 sigue pendiente).
- Hoy no hay ninguna acción que mutar, así que esta regla no bloquea a nadie; cuando existan permisos `WA_*` se reemplaza.

## D-34 · Sin URL ni variable de entorno para WhatsApp

No se agregó `NEXT_PUBLIC_API_WHATSAPP` ni entrada en `src/lib/api.ts`. El registro de contratos decide la disponibilidad por estado (`confirmed` = disponible). En la etapa 2 un test prohibía `/wa/`, `axios`, `fetch(` y esa variable; en la etapa 3 se reemplazó por la guarda de contratos de D-45.

## D-35 · Navegación entre pestañas e hidratación

- `?tab` válido manda; si falta o no es válido, se usa la preferencia `powip:wa:tab` de `localStorage`; si tampoco, Conexión.
- La preferencia se lee en un efecto, después de montar: servidor y primer render del cliente son iguales. Mientras se lee (solo cuando no hay `?tab` válido) se muestra un skeleton en lugar de las pestañas, para no saltar de Conexión a la pestaña guardada.
- Al cambiar de pestaña se usa `router.replace` (no `push`) con `scroll: false`, conservando los demás parámetros de la URL. Guías usa `push`; aquí se prefirió no llenar el historial del navegador con cada pestaña.
- Un `?tab` inválido no se reescribe en la URL: se ignora.
- `localStorage` se lee y escribe dentro de `try/catch` (modo privado o almacenamiento bloqueado).

## D-36 · Cabecera sin estado de conexión ni selector de tienda

- En lugar de la etiqueta "Conectado · LIVII" del mockup, la cabecera muestra un aviso fijo "Integración pendiente". Sin C-01 no hay estado real que mostrar.
- No se agregó el selector de tienda (PG-1.2): sin datos por tienda no cambiaría nada. Conexión lista las tiendas reales (C-E1) con "Estado de WhatsApp pendiente de integración".
- Se reutiliza `HeaderConfig` como las demás subpáginas de Configuración y se agregó `/configuracion/whatsapp` a sus rutas con botón "Volver".
- El ítem del menú lleva la etiqueta "Nuevo" hasta el 2026-12-08 (mecanismo `badgeUntil`).

## D-37 · Presentación de estados no confirmados por Meta

- `failed` y `skipped` se muestran ambos como "No enviado" (texto del PDF), con detalle e ícono distintos: "Meta no pudo entregarlo" (triángulo) y "POWIP no lo envió" (prohibido). El motivo concreto viene de backend.
- `assisted` se muestra como "Asistido · Enviado a mano · sin confirmación de entrega", con ícono de persona; nunca con ticks de entregado o leído (D-02).
- `queued` se muestra "En cola".
- "Respondió" es solo una columna de conversación, no un estado de mensaje.
- Los eventos de aviso (`GUIA_CREADA`, `EN_AGENCIA`, …) viven en `WHATSAPP_NOTIFICATION_EVENTS`, separados de `OrderStatus`. No hay función de mapeo (D-08).

## D-38 · Alcance de la advertencia de lenguaje promocional

`findPromotionalTerms()` busca, sin distinguir mayúsculas ni tildes, los términos del PDF §6.2.3: descuento, %, código, oferta, promo, "compra ya" y llévate. Es orientativa y no bloquea. Efecto conocido: el texto base de `disponible_agencia` ("…el código de tu guía") también la dispara. Se mantiene por fidelidad al PDF; producto puede pedir excluir frases como "código de tu guía". Meta es quien decide la aprobación.

---

# Decisiones adoptadas en la etapa 3 (Plantillas)

## D-39 · Códigos de idioma de plantilla

El PDF ofrece "Español (Perú)" y "Español"; las notas del mockup mencionan `language=es (o es_PE)`. El editor guarda `es_PE` y `es`.

Revisión del 2026-10-08 (etapa 4): la página pública de Meta "Supported Languages" de plantillas (`developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages`) lista "Spanish (PER) · `es_PE`" y "Spanish · `es`". Eso es documentación pública, **no una confirmación de integración**: `es_PE` sigue sin confirmar hasta que backend lo acepte en una creación real de plantilla sobre la WABA de POWIP (C-12/C-13). Estado: pendiente (backend).

## D-40 · Duplicar abre el editor como plantilla nueva

Pulsar "Duplicar" abre el editor "Duplicar plantilla" con el contenido de la original y el nombre "{nombre} copia", con el aviso de que Meta revisará la copia desde cero. No crea nada en el servidor ni simula una copia en la lista. Cuando exista C-12, guardar la copia será un alta normal (`POST /wa/templates`) o `POST /wa/templates/:id/duplicate`; queda pendiente D-13 (si se envía a revisión directamente).

## D-41 · Plantilla en revisión en solo lectura

El PDF no dice si se puede editar una plantilla mientras Meta la revisa. El editor la muestra en solo lectura ("Ver plantilla") con el aviso y, si existe, la versión aprobada que se sigue enviando. Rechazadas, pausadas, aprobadas y borradores son editables.

## D-42 · Botones de guardado sin backend

"Guardar borrador" y "Enviar a revisión de Meta" se muestran con `aria-disabled="true"` (siguen enfocables para lectores de pantalla) y descritos por el texto del pie que explica que el servicio no está conectado. Al pulsarlos no ocurre nada. Solo se activan si el contrato `templates` está confirmado **y** el contenedor pasa un manejador real. Storybook usa los mismos valores: no hay simulación de guardado ni de aprobación.

## D-43 · Vista previa con datos de muestra

Mientras no exista C-14 (pedidos reales), la vista previa usa los valores de ejemplo del catálogo (`whatsapp-template-catalog.ts`, los del mockup), identificados con la insignia "Datos de muestra" y el texto "no con un pedido real". El remitente es el nombre de la empresa (`auth.company.name`) porque el nombre visible de cada número depende de C-02. Los datos de muestra no viven en `src/mocks` porque son parte de la interfaz, no simulaciones.

## D-44 · Reglas de Meta aplicadas en el editor

Además de los límites del PDF (encabezado 60, mensaje 1024, pie 60), el editor aplica reglas de Meta. Son validaciones de ayuda: backend y Meta son la autoridad. Si C-13 devuelve otros límites, se reemplazan.

Fuente revisada el 2026-10-08 (etapa 4): página oficial "Template components" (`developers.facebook.com/documentation/business-messaging/whatsapp/templates/components`).

| Regla en el editor | Estado de la fuente |
|---|---|
| Encabezado de texto máx. 60 caracteres | Comprobada: "Maximum 60 characters" |
| Encabezado de texto con 1 variable como máximo | Comprobada: "Text headers support 1 parameter" |
| Mensaje máx. 1024 caracteres | Comprobada: "Maximum of 1024 characters" |
| Pie máx. 60 caracteres | Comprobada: "60 characters maximum" |
| Pie sin variables | **Inferida**: la página describe el pie como componente "text-only" pero no lo prohíbe de forma explícita. Requiere validación con backend/Meta |
| Texto del botón de enlace y de respuesta rápida máx. 25 | Comprobada: "Button label text. 25 characters maximum" |
| Texto del botón sin variables | **No comprobada**: la página no lo menciona para el texto (la URL sí admite un sufijo variable). Requiere validación |

La página no muestra fecha de actualización; Meta puede cambiarla. Backend debe confirmar estas reglas en C-13.

## D-45 · Guarda de contratos en lugar de prohibir red

Se reemplazó la prueba que prohibía `fetch`, `axios` y rutas `/wa/` en el módulo. Ahora:

- `assertWhatsAppContractAvailable(key)` (`whatsapp-contracts.ts`) lanza `WhatsAppContractUnavailableError` si el contrato no está confirmado. Toda función de API del módulo debe llamarla antes de la petición.
- `no-mock-imports.test.ts` falla si un archivo de producción del módulo hace llamadas de red sin declarar su contrato con esa función, o si declara un contrato que no está confirmado; y sigue fallando si importa `@/mocks`.

Una integración real futura solo necesita confirmar el contrato en el registro y declarar la guarda en su archivo de API.

## D-46 · Inserción de variables y texto sugerido

- Los botones de variables insertan en el último mensaje enfocado (versión A o B) y lo indican ("Se inserta en: …"). Reemplazan la selección, devuelven el foco al mensaje y dejan el cursor después de la variable. Funcionan con ratón (sin perder la selección) y con teclado.
- Solo se ofrecen las variables del uso elegido (`{{tipo_comprobante}}` y `{{serie_numero}}` solo en "Comprobante emitido").
- "Usar texto sugerido" (textos base del PDF §6.2.2) aparece solo con el mensaje vacío, para no sobrescribir lo escrito.

---

# Decisiones adoptadas en la etapa 4 (Programación)

## D-47 · Desactivar una regla y avisos ya encolados

El PDF no dice qué pasa con los avisos que ya están en la cola cuando se apaga una regla (cancelarlos o dejarlos salir). El diálogo de desactivación lo dice explícitamente ("lo define el servicio de avisos") y la acción queda bloqueada. Producto y backend deben decidirlo; propuesta: cancelar los pendientes con `motivo_cancelacion = regla_desactivada` y registrarlo en auditoría.

## D-48 · Horario que cruza la medianoche

Un horario 22:00–06:00 es ambiguo: no está claro a qué día pertenece la franja ni cómo se combina con los días elegidos. Por ahora el formulario lo rechaza ("El horario no puede cruzar la medianoche"). También se rechazan "Desde" = "Hasta". Si producto lo necesita, backend debe definir la semántica antes de habilitarlo.

## D-49 · Identidad estable de reglas y enlace desde Plantillas

- Cada regla se identifica por `rule.key` (`WHATSAPP_RULE_KEYS`, las nueve reglas del PDF §6.3.1, con los mismos valores que los usos de plantilla). `rule.id` es el ID de backend; el frontend no inventa IDs.
- "Activar en una regla" usa el **uso** de la plantilla para elegir la regla (`getRuleDefinitionForTemplateUsage`) y viaja en la URL como `rule` + `template`. No se relacionan reglas con estados del pedido.
- Programación explica cada caso (reglas pendientes, regla desconocida, plantilla sin aviso automático, regla no disponible, plantilla inexistente) y, con datos reales, solo resalta la regla y preselecciona la plantilla aprobada sin guardar ni activar.

## D-50 · Alcance: lista vacía = todas y catálogos reales

- En el alcance de una regla, una lista vacía significa "todas/todos" (así una tienda o un courier nuevos quedan incluidos). Backend debe confirmar esta semántica en C-16.
- Los catálogos son los reales: tiendas (`auth.company.stores`), canales (`company.sales_channels`, sin valores por defecto inventados), tipos de envío (`DELIVERY_TYPE_OPTIONS`, registrado como C-E8) y couriers activos de `ms-courier` (`fetchCouriers`, que hoy usa `axios` sin token; ver C-E2). El PDF nombra "Agencia/Domicilio" y "Shalom/Olva/Indriver/Moto propia"; las equivalencias siguen pendientes (D-09) y no se fijan en el frontend.

## D-51 · Preview frente a activación

El conteo y el costo del preview son informativos. La activación debe revalidar en backend versión, alcance y pedidos actuales; el frontend mostrará la cantidad realmente encolada que responda la activación. Detalle de garantías en [screens/03-programacion.md](screens/03-programacion.md#t3m1--activar-regla-vista-previa). Si la tarjeta tiene cambios sin guardar, la activación se bloquea hasta guardar.

## D-52 · Valores sugeridos frente a configuración guardada

Sin C-18, el horario (Lun–Sáb, 08:00–21:00, enviar al siguiente horario, no repetir, máximo 3) y las opciones de datos faltantes (ambas activas) se cargan como valores iniciales sugeridos del PDF, con un texto que aclara que no son la configuración guardada. Con C-18, se carga lo guardado; mientras haya cambios locales, un refetch no los pisa.

## D-53 · Selects de Radix y valores vacíos

El `Select` de Radix emite `onValueChange("")` cuando el valor cambia programáticamente (lo detectaron los tests al preseleccionar una plantilla). Los selects del módulo ignoran el valor vacío y el valor repetido, que el usuario no puede elegir. Se aplicó también al editor de Plantillas.

## D-54 · Segmento de envíos programados

El modal sigue el PDF: un estado del pedido (En camino, Disponible en agencia, En reparto → `EN_ENVIO`, `EN_AGENCIA`, `EN_REPARTO`, que interpreta backend), un courier o "Todos", una tienda y un destino. Cómo se determina "Solo Lima / Solo provincia" sigue sin definir (D-09). Si una tienda no tiene número conectado, el PDF la muestra deshabilitada; sin C-02 el frontend no lo sabe y no la deshabilita.

## D-55 · Columna del tablero frente a estado de atención

**Estado: pendiente de producto.** Lo que sigue es el comportamiento provisional implementado en la etapa 5; difiere del PDF y no está aprobado.

El PDF §8.2 dice "replied → (asesora responde o marca atendida) → read + atendida=true", que mezcla dos cosas: el estado del mensaje (¿el comprador lo leyó?) y el de la conversación (¿alguien la atendió?). Marcar atendida no demuestra lectura, y la respuesta de la asesora puede estar solo "Enviado".

Decisión del frontend (`getConversationColumn`):

- Respuesta del comprador pendiente de atención (`attention.pendingReply`) → Respondió, siempre, aunque backend la haya agrupado en otra columna.
- Si no, la columna sigue el estado real del último aviso saliente (`queued`/`sent`/`assisted` → Enviado, `delivered` → Entregado, `read` → Leído, `failed`/`skipped` → No enviado).
- "Atendida" es una etiqueta de la conversación, independiente de la columna y de la ventana.
- Backend debe aplicar la misma regla para el filtro `column=` y los contadores de C-22.2; si agrupa distinto, la tarjeta se ubica por la regla y los totales siguen siendo los de backend.

Pendiente de producto: confirmar que una conversación atendida cuya respuesta no fue leída queda en Enviado/Entregado con "Atendida", y no en Leído.

## D-56 · Evidencia de despacho frente a foto de entrega

El contrato existente (C-E5, `GET {VENTAS}/order-header/:orderId/evidence`) devuelve evidencia con `type: "PREPARATION" | "DISPATCH"`, subida por usuarios de POWIP desde la ficha. El PDF §6.4.4 habla de una "Foto de entrega" que sube el courier o el motorizado y dice que es "la misma foto de Evidencia de despacho". No son equivalentes: despacho es cuando sale del almacén; entrega es cuando llega al comprador.

Decisión: `WhatsAppMessageEvidence.type` admite `PREPARATION`, `DISPATCH` y `DELIVERY`; el hilo rotula cada uno ("Evidencia de preparación", "Evidencia de despacho · no confirma la entrega", "Foto de entrega") y, sin tipo, "Evidencia del pedido · tipo sin informar". Nunca se presenta una evidencia de despacho como prueba de entrega. `DELIVERY` no existe hoy en ningún contrato: backend debe definir su origen (courier, motorizado o usuario) antes de mostrarla.

## D-57 · Ventana de 24 h solo con autorización de backend

La ventana se toma de `replyWindow = { open, expiresAt }` (C-22.3). Sin ese objeto, con `open: null` o abierta sin `expiresAt` válido, el estado es **desconocido** y se bloquea el envío. Se eliminó `estimateReplyWindow`, que la calculaba con el último mensaje entrante: con coexistencia, ecos y mensajes tardíos de Meta, el frontend no puede saberlo. Backend revalida siempre al enviar (`409 WA_WINDOW_CLOSED`) y el texto se conserva.

## D-58 · Respuestas rápidas sin cambios operativos

El mockup trae textos como "¡Listo! Reprogramamos tu entrega…" o "ya corregimos tu dirección" y notas automáticas ("Entrega reprogramada al vie 9 oct"), que anuncian cambios que nadie hizo. Decisión: catálogo del frontend (`WHATSAPP_QUICK_REPLIES`) mientras C-23 no exista, con textos que piden o confirman datos ("¿qué día y en qué horario te queda mejor…? … te confirmamos por aquí"), sin notas automáticas, y "Horario de agencia" deja que la asesora complete el horario (no se inventa). "Link de rastreo" usa el link real del detalle y se bloquea si no hay. Las respuestas rápidas solo completan el borrador; nunca envían.

## D-59 · Capacidades explícitas de conversaciones

`resolveConversationCapabilities` traduce solo códigos (`WA_VIEW`, `WA_REPLY`, `WA_REASSIGN`, `WA_OPTOUTS`) a `{ view, reply, reassign, manageOptOuts }`. No hay equivalencias con `ADMINISTRADOR`, `AGENTES` ni `ccRol` (D-11). Hoy no existen esos códigos: todo es `false`. La asignación no bloquea responder (caso 29). La respuesta automática usa provisoriamente `canManageConfiguration`, como el resto de la configuración.

## D-60 · Mensaje entrante con varios pedidos del mismo teléfono

`wa_threads` es "una conversación por comprador y pedido", pero un mismo teléfono puede tener varios pedidos abiertos y WhatsApp no indica a qué pedido responde (salvo el contexto de la respuesta a un mensaje). Pendiente de backend y producto: propuesta, asociar al hilo del aviso citado por el contexto de Meta; sin contexto, al del aviso más reciente; y exponer en el detalle si la asociación fue inferida.

## D-61 · Filtros, preferencias y borradores

- Filtros (búsqueda, tienda, asignadas a mí): estado local de la pestaña; no van a la URL ni a `localStorage`. Búsqueda con 300 ms de espera, mínimo 2 caracteres y teléfono normalizado a dígitos. Tienda y usuario viajan como IDs.
- Preferencia: solo la vista Tablero/Lista en `localStorage["powip:wa:conversations-view"]`.
- Conversación abierta: `?thread=` en la URL; se quita al cambiar de pestaña.
- Borradores: en memoria por conversación; no se trasladan, no se guardan en el navegador, sobreviven a refetch y piden confirmación al cerrar o cambiar.

## D-62 · Ventana desconocida bloquea también plantillas

Meta permite plantillas fuera de la ventana, pero con la ventana desconocida tampoco hay certeza sobre el estado del hilo (baja, versión). El frontend bloquea texto y plantilla hasta que backend informe la ventana. Se puede relajar para plantillas cuando C-22.3 garantice `optedOut` y versión en el mismo detalle.

## D-63 · Rastreo: base del porcentaje y clic sin lectura

El PDF §6.5.1 calcula "Abrieron el rastreo" como abrieron / leídos. Un clic en el link no prueba que el comprador leyó en WhatsApp (puede tener apagadas las confirmaciones de lectura), así que ese cociente puede superar el 100%. El frontend usa abrieron / **enviados** (igual que el embudo) y lo rotula; en la tabla, el clic se muestra en la columna Rastreo y en la línea de tiempo, nunca cambia el estado a Leído. Pendiente de producto si prefiere otra base.

## D-64 · Exportar todos los resultados filtrados

Resuelve la propuesta de D-17: la exportación no usa las filas cargadas. `GET /wa/messages/export` recibe el mismo alcance (periodo, from/to en Lima convertidos a UTC, tienda, búsqueda) y el estado de la tabla, recorre todas las páginas en servidor y devuelve el archivo o un trabajo asíncrono si es grande. Sin ese contrato, "Exportar Excel" queda bloqueado. El permiso de exportar no está en el PDF (D-65).

## D-65 · Acciones sin permiso definido en el PDF

El PDF §6.6.3 no asigna permiso para: cambiar alertas, editar la matriz de permisos, exportar el historial. El frontend no lo deduce de roles: esas acciones quedan bloqueadas con "El permiso para hacer este cambio todavía no está definido en POWIP" hasta que C-28 lo defina (propuesta: `WA_ALERTS`, `WA_PERMISSIONS` solo administrador, `WA_HISTORY_EXPORT`). Editar borradores sigue usando `canManageConfiguration` (D-11), que nunca habilita guardar.

## D-66 · Teléfonos en bajas manuales

El alta manual valida y normaliza con `toWhatsAppNumber` (D-29): solo celulares de Perú. Si el negocio permite números extranjeros (§6.6.4), haría falta aceptar formato E.164 en bajas; queda pendiente hasta que backend defina la validación internacional.

## D-67 · Alcance de indicadores frente al filtro de estado

Indicadores, embudo, tabla y exportación comparten periodo, tienda y búsqueda. El filtro de estado solo acota tabla y exportación: si filtrara los indicadores, "Entregados / Enviados" perdería sentido. Los filtros de estado no muestran contadores para no mezclar acumulados (los indicadores cuentan entregados que luego se leyeron) con estados actuales.

## D-68 · Configuración por tienda activa

Bajas automáticas, alertas y números extranjeros se guardan por tienda (`tienda_id`, §9.1). La pestaña usa la tienda activa de POWIP (`selectedStoreId`) y lo dice en el encabezado; la lista de bajas y el registro aceptan filtrar por tienda en backend. Confirmar con backend si alguna de estas configuraciones es por empresa.

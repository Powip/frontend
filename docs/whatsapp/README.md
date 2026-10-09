# Notificaciones por WhatsApp — Hito 1 (frontend)

Última actualización: 2026-10-08 · Rama: `feat/whatsapp-notificaciones` (creada desde `main` @ `a898173`, igual a `origin/main`).
Fuentes: `POWIP_Hito1_Notificaciones_WhatsApp_v2.docx.pdf` (v2.0, 7 oct 2026, 38 páginas) y `POWIP WhatsApp Notificaciones (Copy).html`. Si se contradicen, manda el PDF.

## Alcance

**Entra (frontend):** página Configuración › WhatsApp con seis pestañas (Conexión, Plantillas, Programación, Conversaciones, Historial de envíos, Bajas/alertas/permisos), sus modales y el cajón de chat; el hilo de mensajes en la ficha del pedido › Seguimiento; el indicador del último aviso en los botones WhatsApp de las listas de pedidos; los componentes de la página pública de rastreo (según dónde se aloje); el reemplazo de la sección local de Operaciones › Guías.

**No entra:** backend, webhooks de Meta, workers, colas, acortador `powip.lat/r`, envío de mensajes, intercambio de tokens de Embedded Signup, cálculo de costos, campanita de notificaciones. Tampoco nada del Hito 2 (confirmación COD, cobros, Pau): ver [D-01](decisiones-y-contradicciones.md#d-01--referencias-residuales-al-hito-2).

## Estado

| Área | Estado |
|---|---|
| Etapa 1 · revisión y documentación | Hecha |
| Etapa 2 · base del módulo, componentes compartidos, página y navegación | Hecha (ver [Implementado](#implementado-en-la-etapa-2)) |
| Etapa 3 · pestaña Plantillas (frontend completo) | **Hecha** (ver [Etapa 3](#implementado-en-la-etapa-3-plantillas)). Persistencia y datos reales pendientes de C-12/C-13/C-14 |
| Etapa 4 · pestaña Programación (frontend completo) | **Hecha** (ver [Etapa 4](#implementado-en-la-etapa-4-programación)). Persistencia, conteos, cola y campañas pendientes de C-16/C-18/C-20/C-21/C-24 |
| Etapa 5 · pestaña Conversaciones (frontend completo) | **Hecha** (ver [Etapa 5](#implementado-en-la-etapa-5-conversaciones)). Datos, envíos, contadores y tiempo real pendientes de C-22/C-22.2/C-18/C-25/C-28/C-00.9 |
| Etapa 6 · Historial de envíos y Bajas, alertas y permisos (frontend completo) | **Hecha** (ver [Etapa 6](#implementado-en-la-etapa-6-historial-y-bajas-alertas-y-permisos)). Datos, exportación, guardado y permisos efectivos pendientes de C-18/C-24/C-25/C-26/C-27/C-28 |
| Contratos de backend de WhatsApp | **Ninguno existe.** Todos los `/wa/...` son propuestas; el código no los llama ni declara una URL de backend. Una guarda impide usar contratos no confirmados (D-45) |
| Contratos existentes reutilizables | 8 confirmados (tiendas, couriers, canales, asesoras, evidencia, asesora del pedido, link de rastreo actual y tipos de envío, este último agregado en la etapa 4), registrados como disponibles en `whatsapp-contracts.ts` |
| Decisiones | D-01 a D-68: 32 de la revisión, 6 de la etapa 2, 8 de la etapa 3, 8 de la etapa 4, 8 de la etapa 5 y 6 de la etapa 6. Varias siguen pendientes; en particular **D-55 (Atendida) es provisional, difiere del PDF §8.2 y no está aprobada por producto**. De la etapa 6 dependen de otros D-63 (base del rastreo), D-64 (export), D-65 (permisos no definidos), D-66 (extranjeros en bajas) y D-68 (configuración por tienda) |

## Documentos

| Documento | Contenido |
|---|---|
| [frontend-plan.md](frontend-plan.md) | Principios, piezas reutilizables, archivos definitivos, componentes, caché y polling, revisión sin backend, validaciones, permisos, etapas y alcance del siguiente bloque |
| [backend-contract.md](backend-contract.md) | Reglas transversales (C-00) y cada contrato con método, ruta, parámetros, payload, respuesta, errores y estado |
| [decisiones-y-contradicciones.md](decisiones-y-contradicciones.md) | D-01 a D-68 |
| [screens/README.md](screens/README.md) | Inventario completo y una ficha por pantalla, pestaña, sección, modal, cajón y acción, con su estado de implementación |

## Implementado en la etapa 2

| Pieza | Archivos | Estado |
|---|---|---|
| Dominio | `src/features/whatsapp/enums/whatsapp.enums.ts`, `models/*.model.ts` (mensaje, conversación, plantilla, regla, campaña, contrato) | Tipos listos. Los eventos de aviso (`WHATSAPP_NOTIFICATION_EVENTS`) están separados de `OrderStatus`; no hay mapeo (D-08) |
| Registro de contratos | `src/features/whatsapp/constants/whatsapp-contracts.ts` | Confirmados = disponibles; propuestos (spec o frontend) y sin definir = no disponibles |
| Pestañas | `src/features/whatsapp/constants/whatsapp-tabs.ts` | Seis pestañas con secciones y contratos de los que dependen |
| Query keys | `src/features/whatsapp/keys/whatsapp.keys.ts` | Por empresa y, donde corresponde, por tienda. Sin hooks todavía |
| Utilidades | `src/features/whatsapp/utils/` | Nombre técnico, render de plantilla sin HTML, lenguaje promocional, ventana de 24 h, hora de Lima, estados de mensaje, pestañas, acceso |
| Componentes compartidos | `src/components/whatsapp/` | `MessageStatusTicks`, `WhatsAppPhonePreview`, `WhatsAppThread`, `WhatsAppFormattedText`, `PendingIntegrationNotice` + stories |
| Fixtures | `src/mocks/whatsapp/` | Solo stories y tests (verificado por test) |
| Página | `src/app/configuracion/whatsapp/` | `/configuracion/whatsapp` con 6 pestañas en estado "pendiente de integración" |
| Navegación | `Sidebar.tsx`, `src/app/configuracion/page.tsx`, `HeaderConfig.tsx` | Ítem "WhatsApp" con "Nuevo" hasta 2026-12-08, tarjeta en Configuración, botón "Volver" |

## Implementado en la etapa 3 (Plantillas)

| Pieza | Estado |
|---|---|
| Listado | `TemplatesListView` + `TemplatesTable`: estados pendiente, cargando, sin permisos, error, vacío y contenido; filtros por estado en Meta; métricas solo con datos; A/B sin ganador inventado. En la app muestra "pendiente de integración" |
| Editor | `TemplateEditorDialog`: nueva, editar, ver (solo lectura) y duplicar; todos los campos del PDF; variables en el cursor; vista previa con datos de muestra; A/B con vista previa de ambas versiones; encabezado PDF solo para "Comprobante emitido"; validaciones junto al campo; advertencia promocional sin bloqueo |
| Estados de Meta | DRAFT, PENDING (solo lectura y versión aprobada anterior), APPROVED, REJECTED (motivo de Meta), PAUSED |
| Sin backend | Guardar y enviar con `aria-disabled` y explicación; sin éxito ficticio ni plantillas agregadas; sin `localStorage`; confirmación de descarte; reapertura limpia |
| Aviso de aprobación | `TemplateApprovedBanner` verificable en Storybook; en la app solo con datos reales |
| Guarda de contratos | `assertWhatsAppContractAvailable` + test estático (D-45) |
| Pendiente de integración | Leer, guardar, enviar, duplicar en servidor, métricas, estados reales, catálogo de backend y pedidos reales para la vista previa (C-12, C-13, C-14) |

Ficha completa: [screens/02-plantillas.md](screens/02-plantillas.md).

## Implementado en la etapa 4 (Programación)

| Pieza | Estado |
|---|---|
| Avisos automáticos | `RulesSection` + `RuleCard` (9 reglas por clave estable, D-49): plantilla aprobada, cuándo según los modos permitidos, recordatorio, alcance (fechas, antigüedad, tiendas, canales, tipos de envío y couriers reales con sus propios estados de carga, error y vacío), resumen, estadísticas solo con datos y vista previa del mensaje |
| Activar / desactivar | `ActivateRuleDialog` ("Solo pedidos nuevos" por defecto o también los actuales; conteo y costo solo con datos reales; estados pendiente, cargando, error, cero y resultado). Activar queda bloqueado con explicación accesible; el switch no cambia y no se muestra nada encolado. `DeactivateRuleDialog` igual de bloqueado (D-47) |
| Datos faltantes | Dos condiciones obligatorias, dos opciones configurables, valores sugeridos rotulados (D-52) y "Hoy no se enviaron" con "Corregir" que abre la ficha del pedido real (`OrderDetailModalProvider`); sin reenvíos desde el frontend |
| Horario | Días, desde/hasta, fuera de horario, no repetir, máximo por día, America/Lima; rechaza cruzar la medianoche (D-48); guardar bloqueado |
| Próximas 24 h | Lista agrupada solo con datos de backend (C-20), con grupos aplazados |
| Envíos programados | Lista con Programado/Activo/Pausado (manual y por calidad)/Completado, `CampaignDialog` (nombre, plantilla aprobada, segmento completo, contador, una vez o se repite) y `CampaignResultsDialog`; crear, editar, pausar y reanudar bloqueados |
| Enlace desde Plantillas | "Activar en una regla" navega a `?tab=programacion&rule=&template=`; Programación explica cada caso y, con datos reales, solo resalta y preselecciona sin guardar ni activar |
| Formularios | Locales y revisables, sin `localStorage`, descarte con confirmación, sin perder el borrador al refrescar catálogos |
| Pendiente de integración | Leer y guardar reglas (C-16), vista previa y activación, ajustes (C-18), omitidos (C-24), cola (C-20), campañas y contador (C-21) |

Ficha completa: [screens/03-programacion.md](screens/03-programacion.md).

## Implementado en la etapa 5 (Conversaciones)

| Pieza | Estado |
|---|---|
| Barra | Búsqueda (300 ms, mínimo 2 caracteres, teléfono a dígitos), tienda por ID, "Asignadas a mí" por ID de usuario, Tablero/Lista. Filtros en estado local; solo la vista se guarda como preferencia |
| Tablero | Cinco columnas; Respondió tiene prioridad por la respuesta pendiente de atención, no por el último mensaje; "Atendida" separada de la lectura (D-55); contadores solo de backend; "Ver más" por columna |
| Lista | Tabla con paginación por `total`/`hasMore` de backend |
| Estados | Pendiente, cargando, sin permisos, error, vacío, sin coincidencias y contenido |
| Panel | Datos del pedido, atención y espera, asignación (sin bloquear respuestas), "Ver pedido" con la ficha compartida y el ID real, aviso no enviado con "Corregir" y "Reintentar", ventana de 24 h que se actualiza con el panel abierto, hilo con plantillas, entrantes y adjuntos, respuestas de asesoras, automáticas, ecos, notas y evidencia por tipo (D-56) |
| Composición | Texto y respuestas rápidas que solo completan el borrador y no anuncian cambios (D-58); plantillas aprobadas con ventana cerrada; ventana desconocida bloquea el envío (D-57, D-62); nota interna; estados de envío pendiente y error que conservan el texto |
| Borradores | En memoria por conversación, sin `localStorage`, sobreviven a refetch, confirmación al cerrar o cambiar (también por URL) |
| Respuesta automática | Modal con activación, dos textos, variables permitidas, vista previa rotulada como muestra, validaciones y descarte; sugeridos del PDF solo para configuración nueva; guardar bloqueado |
| Permisos | Capacidades explícitas desde códigos `WA_*`; hoy ninguna (D-59) |
| Sin backend | Ninguna mutación agrega mensajes ni muestra éxito; sin polling |
| Hilo reutilizable | `WhatsAppThread` listo para Seguimiento; `CustomerServiceModal` sin cambios |

Ficha completa: [screens/04-conversaciones.md](screens/04-conversaciones.md).

## Implementado en la etapa 6 (Historial y Bajas, alertas y permisos)

| Pieza | Estado |
|---|---|
| Historial | Periodos Hoy / 7 días / Este mes en hora de Lima; tienda y búsqueda compartidas por indicadores, tabla y export; indicadores y embudo con cero real distinto de "Sin dato" y sin divisiones por cero; asistidos fuera de entregados y leídos; clic de rastreo separado de la lectura (D-63); tabla con filtros, línea de tiempo, motivos, "Ver pedido" y Reenviar; exportación de todas las páginas documentada (D-64) y bloqueada |
| Bajas | Interruptor de palabras de baja, tabla con orígenes (sin afirmar bloqueos de Meta sin dato), alta manual con `toWhatsAppNumber`, reactivación que exige el pedido del comprador y queda auditada |
| Alertas | Cinco alertas con unidades y rangos, destinatarios, pausa por calidad roja (la hace POWIP), últimas alertas con "Ver" solo a la pestaña; campanita documentada y no integrada |
| Números extranjeros | Tres políticas y avisos a extranjeros; Programación dice la misma regla |
| Registro de cambios | Solo lectura, filtros, paginación, antes/después legible, secretos ocultos |
| Permisos | Permisos efectivos ("Sin confirmar") separados de la matriz por rol; matriz del PDF solo como referencia; Administrador fijo; casillas que no aplican nada |
| Formularios | Borradores locales con descarte confirmado, resistentes a refetch, sin `localStorage`, guardado bloqueado |

Fichas: [screens/05-historial-de-envios.md](screens/05-historial-de-envios.md) y [screens/06-bajas-alertas-permisos.md](screens/06-bajas-alertas-permisos.md).

## Qué falta para completar el frontend

| Bloque | Qué falta | Depende de |
|---|---|---|
| Etapa 7 · Conexión (T1) | Tipo de conexión y su cambio, número conectado (calidad, límite, actualizar desde Meta, desconectar), mensaje de prueba, números por tienda con Embedded Signup, número de contingencia, bandeja de envío asistido (abrir / ya lo envié / descartar), costos. Hoy solo lista las tiendas reales | C-01 a C-11, configuración de la app de Meta (D-03), D-04, D-05 |
| Etapa 8 · Integraciones en pedidos | X1: `WhatsAppThread` en la ficha del pedido › Seguimiento con "Abrir conversación" (`CustomerServiceModal`, sin tocar todavía). X2: indicador del último aviso en los botones de WhatsApp de Ventas, Operaciones y Gestión CC. X4: reemplazar la configuración local falsa de Operaciones › Guías (D-22) | C-22.7, C-29 |
| Campanita (X5) | Notificaciones dentro de POWIP para las alertas. No existe en el frontend | C-31 |
| Etapa 9 · Página pública (X3) | Página de rastreo con token y acortador `powip.lat/r`; dónde se aloja | D-06, C-30, equipo landing |
| Etapa 10 · Integración real | Por contrato: confirmar en el registro, crear `api/`, servicios, hooks de TanStack Query, invalidaciones y pasar estados y manejadores reales a cada pestaña; permisos efectivos `WA_*`; tiempo real o polling; criterios §14 con datos reales | Servicio y URL base (C-00.1), todos los `/wa`, C-28, C-00.9 |
| Revisión visual | Desktop, mobile, 320 px, teclado y modo oscuro de todas las pestañas | Navegador |
| Decisiones abiertas | Entre otras: D-55 (Atendida, difiere del PDF), D-56, D-58, D-60, D-63, D-64, D-65, D-66, D-12, D-27 | Producto y backend |

## Orden de implementación

| Etapa | Contenido | Bloqueada por backend | Estado |
|---|---|---|---|
| 1 | Revisión y documentación | No | Hecha |
| 2 | Base de `src/features/whatsapp`, componentes compartidos, página con 6 pestañas en estado pendiente, menú y tarjeta | No | Hecha |
| 3 | Plantillas: editor local completo y tabla con sus estados | Solo para guardar | Hecha |
| 4 | Programación | Solo para guardar | Hecha |
| 5 | Conversaciones | Para datos | Hecha |
| 6 | Historial; Bajas, alertas y permisos | Para datos | Hecha |
| **7 (siguiente)** | Conexión y Embedded Signup | Sí (y Meta) | — |
| 8 | Ficha del pedido, indicador, reemplazo de la sección local | Sí | — |
| 9 | Página pública | Decisión D-06 | — |
| 10 | Integración contrato por contrato y criterios §14 | Sí | — |

Detalle en [frontend-plan.md §10-16](frontend-plan.md#10-etapas).

## Dependencias pendientes del backend

Sin cambios respecto de la etapa 1: servicio y URL base (C-00.1), todos los contratos `/wa`, permisos `WA_*` y roles de Gestión CC (C-00.10, D-11), tiempo real (C-00.9), campanita (C-31), origen de cada evento (D-08) y alojamiento de la página pública (D-06). La etapa 2 no necesitó ninguno: usa solo `auth.company.stores` (C-E1). La etapa 4 usa además couriers (C-E2), canales (C-E3) y tipos de envío (C-E8), todos existentes. La etapa 5 deja listo el uso de asesoras por tienda (C-E4), que solo se pide si hay permiso y backend para reasignar.

## Hallazgos principales

1. **No hay backend de WhatsApp.** Ni en `main` ni en ramas remotas.
2. **Existe una segunda "configuración" falsa:** `WhatsAppNotificationsSection` en Operaciones › Guías guarda plantillas en `useState` y no envía nada (D-22, [screens/10](screens/10-seccion-local-operaciones-guias.md)). Sigue sin tocar.
3. **El rastreo público vive en la landing** con el número de pedido (adivinable); el PDF pide token (D-06).
4. **Los eventos del PDF no son estados reales del pedido** (D-08).
5. **Los roles del PDF no existen en el JWT**; lo más cercano es `ccRol` de Gestión CC (D-11).
6. **Catálogos distintos** de canal, tipo de envío y courier entre el PDF y el repo (D-09).
7. **El PDF tiene huecos** (falta el capítulo 7; mockup de la ficha no entregado) (D-23).
8. **Tres normalizadores de teléfono** distintos en el repo (D-29).
9. **No hay campanita de notificaciones** (C-31).

## Verificaciones y limitaciones

### Etapa 6 (2026-10-09)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npx biome check` sobre el módulo | Sin errores (171 archivos) |
| `npx eslint` sobre los 177 archivos nuevos y modificados | 0 errores; las mismas 7 advertencias que ya tiene `main` en `configuracion/page.tsx`, `HeaderConfig.tsx` y `Sidebar.tsx` |
| `npx jest` del módulo | 26 suites, 314 tests, sin advertencias en consola. Etapa 6 cubre periodos en Lima (noche, cambio de año y de mes), métricas sin datos y con ceros, filtros, asistidos, rastreo sin lectura, validaciones de teléfono y umbrales, descarte, refetch, secretos ocultos, permisos y ausencia de mutaciones ficticias |
| `npx jest` (suite completa) | 132 suites, 1772 tests, todos pasan (48 s). No se comparó con `main` |
| `npx storybook build` | Compila; 115 stories bajo "WhatsApp/" (9 de Historial y 9 de Ajustes nuevas) |
| Revisión visual | **No realizada**: no hay navegador. Pendiente en desktop, mobile, 320 px, teclado y modo oscuro: indicadores y embudo, tabla con fila expandida y scroll horizontal, tablas de bajas y permisos, formularios de alertas, modales de alta y reactivación |

**Advertencia de Suspense/act de Conversaciones (resuelta).** Se reproducía solo con texto escrito en un cuadro que conservaba el foco cuando la conversación cambiaba desde la URL. Al abrirse la confirmación, Radix mueve el foco durante el commit de React; user-event, al perder el foco, emite el `change` que los navegadores disparan tras escribir, envuelto en el `act` sincrónico de Testing Library. Ese `act` anidado no se vacía mientras React ya está vaciando su cola, y React lo informa como "suspendido". Se verificó que no hubo ninguna suspensión real (trampa sobre `didUsePromise`). El test ahora quita el foco del cuadro antes del cambio externo, como haría un usuario; no se silenció nada ni se subieron timeouts.

### Etapa 5 (2026-10-09)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npx biome check` sobre el módulo | Sin errores (142 archivos) |
| `npx eslint` sobre los archivos nuevos y modificados | 0 errores. 7 advertencias de variables sin usar en `configuracion/page.tsx`, `HeaderConfig.tsx` y `Sidebar.tsx`, iguales en `main` |
| `npx jest` del módulo | 23 suites, 263 tests. Conversaciones cubre filtros, prioridad de Respondió, atención frente a lectura, contadores de backend, vencimiento de la ventana con el panel abierto, ventana desconocida, borradores (cierre, cambio por URL, refetch, sin `localStorage`), errores y envío pendiente que conservan el texto, y ausencia de mutaciones ficticias |
| `npx jest` (suite completa) | Últimas dos corridas: 129 suites y 1721 tests pasan (46-47 s). Antes de aligerar los tests, cuatro corridas tuvieron entre 2 y 8 fallos por timeout de 5 s en `SchedulingView` y `TemplateEditorDialog`, y en esas mismas corridas también en `inventario` y `registrar-venta` (fuera del módulo); una pasó completa. No se comparó con `main` |
| `npx storybook build` | Compila; 97 stories bajo "WhatsApp/" (29 de Conversaciones y 3 nuevas del hilo) |
| Revisión visual | **No realizada**: no hay navegador. Queda sin verificar a ojo: tablero con scroll horizontal y tarjetas en desktop, mobile y 320 px; panel lateral a pantalla completa en móvil con pie de composición; teclado (foco al abrir y cerrar el panel, respuestas rápidas, radios de modo); modo oscuro de columnas, burbujas, notas y avisos |

**Timeouts de tests (revisión del cambio de la etapa 4).** Se quitaron el `jest.setTimeout(15000)` de `TemplateEditorDialog` y `SchedulingView` y el timeout de 20 s por test. Medición: los tests lentos tipeaban tecla por tecla textos largos (cada tecla revalida todo el formulario y espera un tick) y hacían búsquedas por rol o etiqueta sobre toda la página con nueve tarjetas; además, tests de campañas, horario y cola renderizaban las nueve reglas sin necesitarlas. Cambios: `userEvent.setup({ delay: null })`, `paste` para valores completos, búsquedas dentro de su sección o diálogo, y renders solo con los datos que cada test usa. El test más lento bajó de 7,2 s a 1,4 s en aislado; las dos suites pasan sin timeouts propios. Al quitar el retraso apareció una carrera real en el modal de respuesta automática (Cancelar justo después de un cambio cerraba sin confirmar); se corrigió con una comprobación sincrónica de cambios. Queda una advertencia de React ("A component suspended inside an `act` scope…") en un único test (cambio de conversación por URL con texto sin enviar); el test pasa y el origen no se determinó.

Limitaciones de la etapa 5: sin backend no hay conversaciones reales; las respuestas rápidas son un catálogo propuesto (C-23); la columna de una conversación atendida difiere del PDF hasta que producto confirme D-55; la foto de entrega no tiene fuente (D-56); los permisos `WA_*` no existen, así que en la app nadie puede responder aunque hubiera datos.

### Etapa 4 (2026-10-08)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npx biome check` sobre el módulo | Sin errores (114 archivos) |
| `npx eslint` sobre la lista de archivos del módulo | 0 errores, 0 advertencias |
| `npx jest` del módulo | 20 suites, 188 tests. Programación cubre alcance, fechas, horario, recurrencia y fecha pasada de campañas, descarte, enlace desde Plantillas (cada caso) y que no haya activaciones ni encolados ficticios |
| `npx jest` (suite completa) | Tres corridas, resultados distintos: (1) fallaron `TemplateEditorDialog` y `SchedulingView` (2 tests, suites de 26 s y 44 s bajo carga); (2) falló solo `src/app/inventario/__tests__/page.test.tsx`; (3) después de subir a 15 s el timeout por test de esas dos suites, 126 suites y 1646 tests pasan. Las dos suites del módulo también pasan solas. La causa de los fallos no se determinó y no se comparó con `main` |
| `npx storybook build` | Compila; 65 stories bajo "WhatsApp/" |
| Revisión visual | **No realizada**: no hay navegador en este entorno. Queda sin verificar a ojo: tarjetas de regla y alcance en desktop, mobile y 320 px, chips y switches en modo oscuro, modales de activación y de envío programado con scroll interno, y la lista de envíos programados |

Limitaciones de la etapa 4: `fetchCouriers` usa `axios` sin token (C-E2) y se reutiliza tal cual; las equivalencias de catálogos con el PDF siguen pendientes (D-09); `es_PE` figura en la lista pública de Meta pero no está confirmado en integración (D-39); dos restricciones de Meta (pie y botón sin variables) siguen sin fuente comprobada (D-44).

### Etapa 3 (2026-10-08)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npx biome check src/features/whatsapp src/components/whatsapp src/app/configuracion/whatsapp src/mocks/whatsapp` | Sin errores (74 archivos). Se aplicó formato solo a esos archivos; se reemplazaron dos `div role="group"` por `fieldset` a pedido de la regla `useSemanticElements` |
| `npx eslint` sobre la lista de archivos del módulo | 0 errores, 0 advertencias. Una corrida anterior por carpetas no terminó en 12 minutos y se detuvo; con la lista explícita terminó bien |
| `npx jest` del módulo | 16 suites, 145 tests. Incluye inserción en el cursor con ratón y teclado, ambas variantes A/B, validaciones junto al campo, descarte, reapertura limpia, botones de guardado sin efecto y sin `localStorage`, estados de Meta y guarda de contratos |
| `npx jest` (suite completa) | 122 suites, 1603 tests, todos pasan en esta corrida. En la etapa 2 hubo fallos intermitentes en `inventario` y `registrar-venta`; no se repitieron y su causa no se determinó |
| `npx storybook build` | Compila; 42 stories bajo "WhatsApp/" (17 de la etapa 2 + 25 nuevas) |
| Revisión visual | **No realizada**: no hay navegador en este entorno. Queda sin verificar a ojo: el editor en desktop, en mobile y a 320 px (apilado de campos, botones del pie, chips de variables y teléfono de vista previa), el desplazamiento interno del modal con header y footer fijos, el modo oscuro de la vista previa y de las insignias, y la tabla con su scroll horizontal propio |

Limitaciones de la etapa 3: las pruebas de foco y teclado se hicieron en jsdom, que no reproduce el dibujado real del navegador; los polyfills de `ResizeObserver` y de captura de puntero se agregan solo en el test del editor.

### Etapa 2 (2026-10-08)

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npx biome check src/features/whatsapp src/components/whatsapp src/app/configuracion/whatsapp src/mocks/whatsapp` | Sin errores (45 archivos). Formato aplicado solo a archivos nuevos |
| `npx eslint` sobre archivos nuevos y modificados | 0 errores; 7 advertencias **preexistentes** de imports sin usar en `Sidebar.tsx`, `configuracion/page.tsx` y `HeaderConfig.tsx` (líneas no tocadas) |
| `npx jest src/features/whatsapp src/components/whatsapp src/app/configuracion/whatsapp` | 11 suites, 89 tests, todos pasan |
| `npx jest` (suite completa, 117 suites) | Dos corridas: 1546/1547 y 1545/1547. Fallaron `src/app/inventario/__tests__/page.test.tsx` (ambas) y `src/app/registrar-venta/__tests__/page.test.tsx` (la segunda); las dos pasan aisladas (14/14). Son pruebas sensibles a tiempos bajo carga y no usan código del módulo. No se compararon contra `main` en las mismas condiciones |
| Guardas | Test que falla si el código de producción del módulo importa `@/mocks`, apunta a `/wa/`, usa `axios`, `fetch(` o `NEXT_PUBLIC_API_WHATSAPP` |
| `npx storybook build` | Compila; 17 stories bajo "WhatsApp/" en el índice |
| Revisión visual | **No realizada**: no hay navegador disponible en este entorno. Queda sin verificar el aspecto en desktop y mobile de la página y de las stories (en particular el desborde horizontal de las seis pestañas en pantallas angostas y los colores en modo oscuro) |

### Etapa 1

| Verificación | Resultado |
|---|---|
| `git status` inicial | Árbol limpio en `main`; `main` = `origin/main` = `a898173`. `develop` está 198 commits detrás de `main` |
| `npx biome ci src/features` | Falla con 99 errores **preexistentes** de formato por CRLF (`core.autocrlf=true`) en archivos de `main`. Los archivos nuevos se escribieron con LF y pasan |
| Búsqueda de contratos `/wa` | Sin resultados en `main` ni en ramas remotas |

Limitaciones: el repositorio de la landing no está en este equipo; no se consultó documentación vigente de Meta (D-05, D-32).

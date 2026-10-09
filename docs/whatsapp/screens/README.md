# Pantallas, pestañas, modales y cajón

Cada documento cubre una página o pestaña y tiene una sección identificable por cada sección, modal, cajón y acción. Los contratos (`C-xx`) están en [../backend-contract.md](../backend-contract.md); las decisiones (`D-xx`), en [../decisiones-y-contradicciones.md](../decisiones-y-contradicciones.md).

| Doc | Alcance |
|---|---|
| [00-pagina-y-navegacion.md](00-pagina-y-navegacion.md) | Entrada en el menú, tarjeta en Configuración, cabecera, selector de tienda, pestañas |
| [01-conexion.md](01-conexion.md) | Pestaña Conexión y sus modales |
| [02-plantillas.md](02-plantillas.md) | Pestaña Plantillas y editor |
| [03-programacion.md](03-programacion.md) | Pestaña Programación, activación y envíos programados |
| [04-conversaciones.md](04-conversaciones.md) | Pestaña Conversaciones, cajón de chat y respuesta automática |
| [05-historial-de-envios.md](05-historial-de-envios.md) | Pestaña Historial de envíos |
| [06-bajas-alertas-permisos.md](06-bajas-alertas-permisos.md) | Pestaña Bajas, alertas y permisos |
| [07-ficha-pedido-seguimiento.md](07-ficha-pedido-seguimiento.md) | Hilo en la ficha del pedido › Seguimiento |
| [08-indicador-ultimo-aviso.md](08-indicador-ultimo-aviso.md) | Indicador del último aviso en botones WhatsApp |
| [09-pagina-publica-rastreo.md](09-pagina-publica-rastreo.md) | Página pública del pedido y acortador |
| [10-seccion-local-operaciones-guias.md](10-seccion-local-operaciones-guias.md) | Sección local actual en Operaciones › Guías |

## Estado de implementación (etapas 2 y 3)

| ID | Estado | Detalle |
|---|---|---|
| NAV-1 | Implementado | Ítem "WhatsApp" en Configuración del menú, etiqueta "Nuevo" hasta 2026-12-08 |
| NAV-2 | Implementado | Tarjeta "Notificaciones por WhatsApp" en `/configuracion` |
| PG-1 | Implementado | Título, descripción, botón "Volver", sin llamadas de red |
| PG-1.1 | Reemplazado | Aviso fijo "Integración pendiente" hasta que exista C-01 (D-36) |
| PG-1.2 | No implementado | Sin datos por tienda; Conexión lista las tiendas reales (D-36) |
| PG-1.3 | Implementado sin contadores | `?tab` + preferencia; los contadores esperan C-12 y C-01/C-22.2 |
| PG-1.4 | No se implementa | D-18 |
| T1 | Estado pendiente | Descripción y `PendingIntegrationNotice` con sus secciones; nota de acceso para no administradores |
| T2 | Frontend completo (etapa 3) | Listado con estados, filtros, tabla, edición, duplicación y editor completo; todo lo persistente pendiente de C-12/C-13/C-14. Detalle en [02-plantillas.md](02-plantillas.md) |
| T2.S1 | Implementado; datos pendientes | En la app muestra "Listado de plantillas pendiente de integración"; con datos (stories) muestra tabla y filtros |
| T2.A1 | Implementado sin persistencia | Abre el editor "Duplicar plantilla" (D-40) |
| T2.S2 | Componente listo | `TemplateApprovedBanner`, solo con datos reales; "Activar en una regla" navega a Programación con `rule` y `template` (etapa 4, D-49) |
| T2.M1 | Implementado sin persistencia | Editor completo; guardar y enviar con `aria-disabled` y explicación (D-42) |
| T3 | Frontend completo (etapa 4) | Secciones con estados propios; todo lo persistente pendiente de C-16/C-18/C-20/C-21/C-24. Detalle en [03-programacion.md](03-programacion.md) |
| T3.S1, T3.S2, T3.S2.1, T3.A1 | Implementado; datos pendientes | Tarjetas de regla con plantilla, cuándo, recordatorio, alcance con catálogos reales, resumen y vista previa; guardar bloqueado |
| T3.M1 | Implementado sin persistencia | Conteo y costo solo con datos; activar bloqueado, sin encolados ficticios (D-51) |
| T3.S3, T3.S4 | Implementado sin persistencia | Valores sugeridos rotulados (D-52); horario rechaza la medianoche (D-48); "Corregir" abre la ficha real |
| T3.S5 | Implementado; datos pendientes | Solo con C-20 |
| T3.S6, T3.M2, T3.M3 | Implementado sin persistencia | Lista con los cuatro estados; modal con segmento y una vez/se repite; mutaciones bloqueadas; resultados solo con datos (C-21) |
| T4 | Frontend completo (etapa 5) | En la app, "Conversaciones pendientes de integración" sin contadores ni conversaciones. Detalle en [04-conversaciones.md](04-conversaciones.md) |
| T4.S1 | Implementado | Búsqueda, tienda e "Asignadas a mí" por ID; filtros locales; vista como preferencia |
| T4.S2, T4.S3 | Implementado; datos pendientes | Tablero (Respondió por atención pendiente, D-55) y lista; contadores solo de C-22.2 |
| T4.C1 | Implementado sin persistencia | Panel con ventana de 24 h según backend, hilo, composición, notas, asignación y acciones bloqueadas; borradores protegidos |
| T4.M1 | Implementado sin persistencia | Respuesta automática con sugeridos rotulados; guardar bloqueado |
| T4.M2 | Implementado sin persistencia | Confirmación de baja; bloqueada sin C-25 |
| T5 | Frontend completo (etapa 6) | Indicadores, embudo, leyenda y tabla con estados; en la app, pendiente sin ceros ni filas. Detalle en [05-historial-de-envios.md](05-historial-de-envios.md) |
| T5.S1, T5.A1 | Implementado sin persistencia | Exportar (todas las páginas, D-64) y Reenviar bloqueados con explicación |
| T6 | Frontend completo (etapa 6) | Sugeridos rotulados y acciones bloqueadas; nota de acceso para no administradores. Detalle en [06-bajas-alertas-permisos.md](06-bajas-alertas-permisos.md) |
| T6.S1, T6.M1, T6.M2 | Implementado sin persistencia | Bajas, alta manual y reactivación auditada |
| T6.S2, T6.S3, T6.S4 | Implementado sin persistencia | Alertas, últimas alertas y números extranjeros |
| T6.S5, T6.S6 | Implementado; datos pendientes | Registro de solo lectura; permisos efectivos y matriz |
| T1.S4 | Parcial | Tiendas reales (C-E1) con "Estado de WhatsApp pendiente de integración"; sin número, estado ni botones |
| Resto de secciones, modales y cajón | No implementado | Etapas 4 a 7 |
| X1 a X5 | No implementado | Etapas 8 y 9; `WhatsAppNotificationsSection` sin cambios |

Componentes compartidos listos para las etapas siguientes: `WhatsAppPhonePreview` (T2.M1, T3.A1, T4.M1), `WhatsAppThread` (T4.C1, X1), `MessageStatusTicks` (T4, T5, X2), `PendingIntegrationNotice` (todas), `WhatsAppResourceState` (todas las listas, desde la etapa 3).

## Plantilla de cada ficha

Cada sección, modal o acción documenta, en este orden: identificador; ruta y ubicación; disparador; referencia (PDF y mockup); componente existente o propuesto; campos, datos y catálogos; estados (carga, vacío, error, sin permisos, pendiente de integración); lecturas y mutaciones con método, ruta, parámetros, payload y respuesta; errores y comportamiento; validaciones del frontend y garantías de backend; permisos y separación por empresa/tienda; paginación, filtros, orden y exportación; actualización en vivo o invalidación; criterios de aceptación; estado del contrato.

Cuando un campo no aplica se escribe "—". Los estados comunes se resuelven con `WhatsAppResourceState` ([../frontend-plan.md §4](../frontend-plan.md#4-componentes-clave)); en cada ficha se describe solo lo particular.

## Inventario completo

Tipos: **P** página · **T** pestaña · **S** sección · **M** modal · **C** cajón · **A** acción · **X** integración fuera de la página.

| ID | Tipo | Nombre | Ubicación | Disparador | PDF | Mockup | Contratos |
|---|---|---|---|---|---|---|---|
| NAV-1 | A | Ítem "WhatsApp" en el menú | Sidebar › Configuración | Clic | §6 | `.subnav` | — |
| NAV-2 | A | Tarjeta "WhatsApp" | `/configuracion` | Clic | — | — | — |
| PG-1 | P | Notificaciones por WhatsApp | `/configuracion/whatsapp` | Navegación | §6 | `.page-head` | C-01 |
| PG-1.1 | S | Etiqueta de estado de conexión | Cabecera | Carga | §6, §6.1.1 | `.conn-pill` | C-01 |
| PG-1.2 | S | Selector de tienda | Cabecera | Cambio | §1.1 | — (propuesto) | C-E1 |
| PG-1.3 | S | Pestañas y contadores | Bajo la cabecera | Clic, `?tab` | §6 | `.tabs` | C-12, C-22.2 |
| PG-1.4 | — | "Notas para devs" | — | — | §0.2 | `#devToggle` | No se implementa (D-18) |
| T1 | T | Conexión | `?tab=conexion` | — | §6.1 | `#p-conexion` | — |
| T1.S1 | S | Tipo de conexión | T1 | Selección | §6.1.1 | `#ctypes` | C-03 |
| T1.M3 | M | Confirmar cambio de tipo | T1.S1 | Elegir otra tarjeta | — (D-04) | — | C-03 |
| T1.S2 | S | Número conectado | T1 | — | §6.1.2 | card "Número conectado" | C-02 |
| T1.A1 | A | Actualizar desde Meta | T1.S2 | Botón | §6.1.2 | `data-toast` | C-04 |
| T1.M2 | M | Desconectar número | T1.S2 | Botón Desconectar | §6.1.2 | `#mDisc` | C-05 |
| T1.S3 | S | Enviar mensaje de prueba | T1 | Botón | §6.1.3 | `#btnTest` | C-07, C-12 |
| T1.S4 | S | Números por tienda | T1 | — | §6.1.4 | card "Números por tienda" | C-02, C-E1 |
| T1.A2 | A | Ver detalle (tienda) | T1.S4 | Botón | §6.1.4 | sin comportamiento | C-02 |
| T1.M1 | M | Conectar número (Embedded Signup) | T1.S4 | "Conectar número" | §6.1.4, §10.1 | `#mConn` | C-06 |
| T1.S5 | S | Número de contingencia | T1 | — | §6.1.5 | card "Número de contingencia" | C-10, C-E4 |
| T1.S6 | S | Bandeja de envío asistido | T1.S5 | — | §6.1.5 | `#assistList` | C-11 |
| T1.A3 | A | Abrir en WhatsApp / Ya lo envié / Descartar | T1.S6 | Botón | §6.1.5 | `[data-assist]` | C-11 |
| T1.S7 | S | Costo de los mensajes | T1 | — | §6.1.6, §12 | card "Costo" | C-08, C-09 |
| T2 | T | Plantillas | `?tab=plantillas` | — | §6.2 | `#p-plantillas` | — |
| T2.S1 | S | Lista y filtros | T2 | — | §6.2.1 | `#tplFilters`, `#tplBody` | C-12 |
| T2.A1 | A | Duplicar | Fila | Ícono | §6.2.1 | `[data-dup]` | C-12 |
| T2.S2 | S | Aviso "Meta aprobó" + Activar en una regla | T2 | Cambio de estado | §6.2.4 | `#apprBanner` | C-12, C-16 |
| T2.M1 | M | Editor de plantilla (nueva / editar) | T2 | "Nueva plantilla", fila, lápiz, "Ver mensaje" | §6.2.3 | `#mTpl` | C-12, C-13, C-14 |
| T2.M1.A1 | A | Guardar borrador | T2.M1 | Botón | §6.2.3 | `data-toast` | C-12 |
| T2.M1.A2 | A | Enviar / Guardar y reenviar a revisión | T2.M1 | Botón | §6.2.3-6.2.4 | `#btnSubmitTpl` | C-12 |
| T3 | T | Programación | `?tab=programacion` | — | §6.3 | `#p-programacion` | — |
| T3.S1 | S | Resumen (costo del mes, activos) | T3 | — | §6.3.1 | `#costMonth`, `#rulesOnCount` | C-16 |
| T3.S2 | S | Tarjeta de regla | T3 | — | §6.3.1 | `.rule` | C-16 |
| T3.S2.1 | S | Alcance "A qué pedidos" | T3.S2 | Desplegar | §6.3.2 | `details.rf` | C-16, C-E1..E3 |
| T3.M1 | M | Activar regla (vista previa) | T3.S2 | Encender / "Ver a cuántos…" | §6.3.3 | `#mApply` | C-16 |
| T3.A1 | A | Ver mensaje | T3.S2 | Botón | §6.3.1 | `[data-pv]` | C-12 |
| T3.S3 | S | Si al pedido le faltan datos + Hoy no se enviaron | T3 | — | §6.3.4 | card "Si al pedido…" | C-18, C-24 |
| T3.S4 | S | Horario permitido | T3 | — | §6.3.5 | `#days` … | C-18 |
| T3.S5 | S | Próximas 24 horas | T3 | — | §6.3.6 | `.queue` | C-20 |
| T3.S6 | S | Envíos programados | T3 | — | §6.3.7 | `#schedList` | C-21 |
| T3.M2 | M | Programar / editar envío | T3.S6 | "Programar envío", lápiz | §6.3.7 | `#mSched` | C-21 |
| T3.M3 | M | Resultados de envío | T3.S6 | "Ver resultados" | §6.3.7 | toast | C-21 (SIN DEFINIR) |
| T4 | T | Conversaciones | `?tab=conversaciones` | — | §6.4 | `#p-conversaciones` | — |
| T4.S1 | S | Barra: buscar, tienda, asignadas a mí, vista | T4 | — | §6.4.1 | `.filters`, `#cvView` | C-22.1 |
| T4.S2 | S | Tablero por estado | T4 | — | §6.4.2 | `#kanban` | C-22.1, C-22.2 |
| T4.S3 | S | Lista | T4 | — | §6.4.3 | `#cvList` | C-22.1 |
| T4.C1 | C | Chat de la conversación | T4 | Tarjeta o fila | §6.4.4-6.4.5 | `#drawer` | C-22.3..8, C-23, C-25 |
| T4.M1 | M | Respuesta automática | T4.S1 | Botón | §6.4.8 | `#mAuto` | C-18 |
| T4.M2 | M | Confirmar dar de baja | T4.C1 | "Dar de baja" | §6.4.4 | — (propuesto) | C-25 |
| T5 | T | Historial de envíos | `?tab=historial` | — | §6.5 | `#p-historial` | — |
| T5.S1 | S | Periodo + Exportar Excel | T5 | — | §6.5 | `#range` | C-24 |
| T5.S2 | S | Indicadores | T5 | — | §6.5.1 | `.kpis` | C-24 |
| T5.S3 | S | Embudo | T5 | — | §6.5.1 | `.funnel` | C-24 |
| T5.S4 | S | "Así se ve en Ventas" | T5 | — | §6.5.1 | `.mini-ventas` | — (ilustrativo) |
| T5.S5 | S | Leyenda de estados | T5 | — | §6.5.1 | `.legend` | — |
| T5.S6 | S | Tabla de mensajes + línea de tiempo | T5 | Fila | §6.5.2 | `#msgBody` | C-24 |
| T5.A1 | A | Reenviar | Fila "No enviado" | Botón | §6.5.2 | `[data-resend]` | C-24 |
| T6 | T | Bajas, alertas y permisos | `?tab=ajustes` | — | §6.6 | `#p-ajustes` | — |
| T6.S1 | S | Clientes que no quieren avisos | T6 | — | §6.6.1 | `#optBody` | C-25, C-18 |
| T6.M1 | M | Agregar número | T6.S1 | Botón | §6.6.1 | toast (sin modal) | C-25 |
| T6.M2 | M | Confirmar reactivación | T6.S1 | "Reactivar" | §6.6.1 | — (propuesto) | C-25 |
| T6.S2 | S | Alertas de salud | T6 | — | §6.6.2 | card "Alertas de salud" | C-26 |
| T6.S3 | S | Últimas alertas | T6 | — | §6.6.2 | card "Últimas alertas" | C-26 |
| T6.S4 | S | Números extranjeros | T6 | — | §6.6.4 | card "Números extranjeros" | C-18 |
| T6.S5 | S | Registro de cambios | T6 | — | §6.6.5 | card "Registro de cambios" | C-27 |
| T6.S6 | S | Permisos | T6 | — | §6.6.3 | `#permBody` | C-28 |
| X1 | X | Mensajes de WhatsApp en la ficha | `CustomerServiceModal` › Seguimiento | Abrir ficha | §6.4.7 | mockup Gestión CC (no entregado) | C-22.7 |
| X2 | X | Indicador del último aviso | Botones WhatsApp de Ventas, Operaciones, Gestión CC | Carga de lista | §1.3, §6.5.1 | `.wa-act` | C-29 |
| X3 | X | Página pública + acortador | `{tienda}.powip.lat/p/{token}`, `powip.lat/r/{codigo}` | Botón del aviso | §5.1, §6.4.4 | — | C-30 |
| X4 | X | Sección local actual | `/operaciones/guias?tab=config` | — | — | — | — (D-22) |
| X5 | X | Campanita de alertas | Global | — | §6.6.2 | — | C-31 |

Total: 1 página, 6 pestañas, 34 secciones, 11 modales (6 del mockup: T1.M1, T1.M2, T2.M1, T3.M1, T3.M2, T4.M1; 2 que la spec implica sin dibujar: T3.M3, T6.M1; 3 propuestos: T1.M3, T4.M2, T6.M2), 1 cajón, 2 entradas de navegación y 5 integraciones fuera de la página.

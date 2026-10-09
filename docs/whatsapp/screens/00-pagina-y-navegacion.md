# 00 · Página y navegación

Referencias: PDF §6 (introducción), §1.5; mockup `.side`, `.page-head`, `.tabs`.

---

## NAV-1 · Ítem "WhatsApp" en el menú

| Campo | Detalle |
|---|---|
| Ruta / ubicación | `src/components/layout/Sidebar.tsx`, grupo "Configuración" (`:237-243`) |
| Disparador | Clic → `/configuracion/whatsapp` |
| Referencia | PDF §6 "Configuración › WhatsApp (con etiqueta Nuevo)"; mockup `.subnav a.active` |
| Componente | Existente: entrada en `navigation` con `badge: "Nuevo"` y `badgeUntil` (mecanismo de `:85-86`, `NavItemBadge`) |
| Datos | Ninguno |
| Estados | — |
| Lecturas / mutaciones | — |
| Permisos | Visible para quien tenga `WA_VIEW`; mientras no exista, para todos los autenticados de una empresa (igual que `/configuracion`). Plan: D-30 |
| Criterios de aceptación | Aparece en Configuración; activo en `/configuracion/whatsapp`; etiqueta "Nuevo" según `badgeUntil`; no aparece para usuarios sin empresa |
| Contrato | No requiere |
| Estado (etapa 2) | Implementado en `Sidebar.tsx`, etiqueta "Nuevo" hasta 2026-12-08. Visible para quien ve el grupo Configuración (todos los autenticados); los usuarios sin empresa ya son redirigidos por `subscriptionGate` |
| Riesgo | La rama `origin/feat/usuarios-roles-permisos` también toca `Sidebar.tsx` (D-31) |

## NAV-2 · Tarjeta "WhatsApp" en Configuración

| Campo | Detalle |
|---|---|
| Ruta / ubicación | `src/app/configuracion/page.tsx`, arreglo `configSections` (`:13-46`) |
| Disparador | Clic → `/configuracion/whatsapp` |
| Componente | Existente: misma tarjeta `Card` + ícono (`WhatsAppIcon`) |
| Datos | Título "Notificaciones por WhatsApp", descripción "Avisos automáticos de envío y conversaciones" |
| Estados | — |
| Criterios de aceptación | La grilla pasa de 4 a 5 tarjetas sin romper el diseño en `lg` |
| Contrato | No requiere |
| Estado (etapa 2) | Implementado en `src/app/configuracion/page.tsx` (quinta tarjeta; la grilla `lg:grid-cols-4` pasa la quinta a una segunda fila) |

---

## PG-1 · Página "Notificaciones por WhatsApp"

| Campo | Detalle |
|---|---|
| Ruta | `/configuracion/whatsapp` → `src/app/configuracion/whatsapp/page.tsx` |
| Referencia | PDF §6; mockup `.page-head` |
| Componente | Propuesto: `WhatsAppPageHeader` sobre `HeaderConfig` (`src/components/header/HeaderConfig.tsx`) |
| Datos | Título "Notificaciones por WhatsApp"; subtítulo del mockup ("Conecta tu número de WhatsApp Business y avisa a tus clientes en cada etapa del envío con su link de rastreo POWIP."); breadcrumb Configuración › WhatsApp |
| Estados | Carga de sesión: lo resuelve `AuthGuard`. Usuario sin empresa: lo resuelve `subscriptionGate`. Sin `WA_VIEW`: estado "sin permisos" a página completa |
| Lecturas | C-01 (`GET /wa/status?storeId=`) |
| Permisos | `WA_VIEW` para ver; cada pestaña refina |
| Tenant | Todo cuelga de la tienda elegida (PG-1.2) y de la empresa del JWT |
| Criterios de aceptación | Carga sin errores con todos los contratos en `false`; no hace ninguna llamada a `/wa/`; muestra 6 pestañas |
| Contrato | C-01 PROPUESTA |
| Estado (etapa 2) | Implementado: `src/app/configuracion/whatsapp/page.tsx` y `_components/WhatsAppSettingsContent.tsx`, con `HeaderConfig` y botón "Volver". Accesible para autenticados con empresa; nota "solo un administrador" en pestañas de configuración (D-33) |

## PG-1.1 · Etiqueta de estado de conexión

| Campo | Detalle |
|---|---|
| Ubicación | Cabecera, a la derecha |
| Disparador | Carga de la página y cambio de tienda |
| Referencia | PDF §6 ("Conectado · LIVII"), §6.1.1 (textos por tipo); mockup `.conn-pill` |
| Componente | Propuesto: `WhatsAppConnectionPill` |
| Datos | `state`, `displayLabel`, `connectionType`, `contingencyActive` de C-01 |
| Estados | Pendiente: "WhatsApp · pendiente de integración" en gris. Carga: skeleton. Error: "Estado desconocido" + tooltip. Sin conectar: "Sin conectar" (neutral). Nombre en revisión: ámbar. Restringido/calidad roja: rojo. Contingencia activa: ámbar "Envío asistido activo" |
| Lecturas | C-01 |
| Actualización | Polling 30 s con la página visible; invalidada por conectar/desconectar/cambiar tipo/contingencia |
| Criterios de aceptación | El texto cambia solo con datos de backend (no al tocar las tarjetas de tipo, D-04); los colores tienen texto, no solo color |
| Contrato | C-01 PROPUESTA |
| Estado (etapa 2) | Reemplazado por un aviso fijo "Integración pendiente" (D-36) |

## PG-1.2 · Selector de tienda

| Campo | Detalle |
|---|---|
| Ubicación | Cabecera |
| Disparador | Cambio de valor |
| Referencia | PDF §1.1 (multi-tienda), §6.1.4; no está en el mockup (el mockup fija LIVII) |
| Componente | Propuesto: `WhatsAppStoreSelect` sobre `Select` |
| Datos | `auth.company.stores` (C-E1); valor inicial `selectedStoreId` |
| Estados | Una sola tienda: se muestra como texto, sin selector. Sin tiendas: estado vacío "Crea una tienda" con enlace a `/configuracion/tiendas` |
| Mutaciones | Ninguna en backend. Decidir si cambia `selectedStoreId` global (`setSelectedStore`) o solo el de la página: propuesta, solo el de la página para no afectar otros módulos |
| Tenant | Solo tiendas de la empresa del JWT |
| Alcance | Aplica a Conexión (número, tipo, contingencia, bandeja, costo), Programación (si D-07 se resuelve por tienda), Plantillas (si son por WABA/tienda). Conversaciones, Historial y Bajas tienen su propio filtro de tienda con opción "Todas" |
| Criterios de aceptación | Cambiar de tienda refresca las secciones dependientes y conserva la pestaña |
| Contrato | C-E1 CONFIRMADO |
| Estado (etapa 2) | No implementado (D-36) |

## PG-1.3 · Pestañas y contadores

| Campo | Detalle |
|---|---|
| Ubicación | Bajo la cabecera |
| Disparador | Clic; `?tab=` en la URL |
| Referencia | PDF §6 (tabla de pestañas; "se recuerda en el navegador"); mockup `.tabs`, `#tplCount`, `#cvTabCount` |
| Componente | Propuesto: `WhatsAppTabs` sobre `Tabs` (`src/components/ui/tabs.tsx`) |
| Datos | Pestañas: `conexion`, `plantillas`, `programacion`, `conversaciones`, `historial`, `ajustes`. Contadores: total de plantillas (C-12 `total`), respuestas sin atender (C-01 `unattendedReplies` o C-22.2) |
| Estados | Contador sin contrato: no se muestra (no "0"). Con contrato y 0: el contador de Conversaciones se oculta; el de Plantillas muestra 0 |
| Persistencia | `?tab` manda; si falta, `localStorage["powip:wa:tab"]` (lectura/escritura en `try/catch`); si falta, `conexion` (D-19) |
| Permisos | Una pestaña sin permiso de lectura se muestra deshabilitada con tooltip; la de Conversaciones la ven todos los que tengan `WA_VIEW` |
| Accesibilidad | `role="tablist"`; el contador rojo tiene texto accesible "3 respuestas sin atender" |
| Actualización | Contador de Conversaciones: polling 30 s (C-01) |
| Criterios de aceptación | Recargar con `?tab=historial` abre Historial; sin `?tab` abre la última usada; un valor inválido abre Conexión |
| Contrato | C-12 SPEC, C-01/C-22.2 PROPUESTA |
| Estado (etapa 2) | Implementado en `WhatsAppTabs.tsx` sin contadores. Un `?tab` inválido usa la preferencia guardada y, si no hay, Conexión (D-35). Cubierto por `src/app/configuracion/whatsapp/__tests__/page.test.tsx` |

## PG-1.4 · "Notas para devs"

No se implementa (D-18). Su contenido está en estos documentos.

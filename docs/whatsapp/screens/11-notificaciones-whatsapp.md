# 11 · Alertas de WhatsApp dentro de POWIP (X5, campanita)

Referencias: PDF §6.6.2 ("Administradores por campanita de POWIP y WhatsApp"), §11; contrato C-31 (sin definir).

**Estado (etapa 8, 2026-10-10):** componente listo, **no montado**. El shell (`Sidebar`, `AppContainer`) no tiene campanita ni sistema de notificaciones; no se crea uno general (D-75). No se muestra ninguna campanita operativa ni contadores.

| Campo | Detalle |
|---|---|
| Componentes | `WhatsAppNotificationsList` (lista) y `WhatsAppNotificationsButton` (botón con campana y `Popover`), en `src/components/whatsapp/WhatsAppNotificationsPanel.tsx` |
| Datos | `{ items: [{ id, type, message, createdAt, relatedTab, readAt }], unreadTotal }` |
| Estados | Pendiente ("Las alertas de WhatsApp aparecerán aquí cuando exista la campanita de POWIP"), carga, error con Reintentar, vacío ("No hay alertas de WhatsApp"), contenido; sin leer en negrita con texto oculto "Sin leer" |
| Contador | Solo con `unreadTotal` de backend; sin dato no hay número (nunca se cuenta la página cargada) |
| Ver | Enlace a `/configuracion/whatsapp?tab={relatedTab}` solo si es una pestaña válida; nunca a un objeto inventado. Sin pestaña válida: "Sin pestaña relacionada" |
| Marcar todo como leído | Bloqueado sin contrato |
| Punto de montaje propuesto | Cabecera del `Sidebar` (`src/components/layout/Sidebar.tsx`), junto al nombre de la empresa, visible solo para administradores mientras C-28 no defina otro permiso |
| Contrato propuesto (C-31) | `GET /notifications?module=whatsapp&storeId&limit=20` → `{ items, unreadTotal }`; `POST /notifications/read` `{ ids }` o `{ all: true }`. Deduplicación (6 h) y destinatarios los decide backend (C-26) |
| Pruebas | `src/components/whatsapp/__tests__/integrations.test.tsx`; stories `WhatsApp/Integraciones/WhatsAppNotifications` |

Bloqueo externo: infraestructura global de notificaciones (C-31). Envío de alertas por WhatsApp al administrador: backend (D-26).

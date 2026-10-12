# 10 · Sección local en Operaciones › Guías (X4)

**Estado (etapa 8, 2026-10-10):** reemplazada (D-22).

| Campo | Detalle |
|---|---|
| Archivo | `src/app/operaciones/guias/_components/WhatsAppNotificationsSection.tsx` |
| Antes | Cuatro plantillas con interruptor y texto en `useState`, sin guardar ni enviar, con permiso `OPS_MANAGE_TARIFARIO` y nombres distintos al PDF |
| Ahora | Tarjeta de solo lectura: "Notificaciones automáticas por WhatsApp · Los avisos por WhatsApp se configuran en un solo lugar: Configuración › WhatsApp" y botón "Ir a WhatsApp" → `/configuracion/whatsapp?tab=programacion`. Sin estado local ni permisos de Operaciones |
| Montaje | Igual que antes en `CouriersTarifasTab.tsx` (pestaña Config de Guías); tarifas, transportes y mapeo de estados sin cambios |
| Pruebas | `src/components/whatsapp/__tests__/integrations.test.tsx` (sin cuadros de texto ni interruptores; enlace correcto) |
| Pendiente | Con C-16, la tarjeta podría listar las reglas activas de la tienda en solo lectura |

Criterio cumplido: no queda ningún lugar fuera de `/configuracion/whatsapp` donde se editen plantillas o interruptores de avisos.

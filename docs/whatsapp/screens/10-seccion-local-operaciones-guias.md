# 10 · Sección local en Operaciones › Guías (X4)

## Situación actual

| Campo | Detalle |
|---|---|
| Archivo | `src/app/operaciones/guias/_components/WhatsAppNotificationsSection.tsx` (107 líneas) |
| Dónde se monta | `CouriersTarifasTab.tsx:22`, que es el contenido de la pestaña `config` de `/operaciones/guias` (`src/app/operaciones/guias/page.tsx:112`) |
| Qué hace | Cuatro plantillas (`guia_creada`, `en_camino`, `entregado`, `recordatorio_pago`) con interruptor y texto editable en `useState`. Todas apagadas por defecto |
| Persistencia | Ninguna: se pierde al recargar. No envía nada |
| Permiso | Edición con `OPS_MANAGE_TARIFARIO` (`useOperationsRole`), que no tiene relación con WhatsApp |
| Diferencias con el PDF | Nombres distintos (`en_camino` vs `pedido_en_camino`, `entregado` vs `pedido_entregado`, `recordatorio_pago` vs `saldo_pendiente`); textos distintos; sin categoría, horario, alcance ni estado de Meta |
| Tests | No tiene tests propios |

## Problema

Si se publica `/configuracion/whatsapp` y esta sección sigue igual, el negocio ve dos lugares para "configurar" avisos; uno no guarda ni envía nada. Es una segunda configuración independiente.

## Propuesta (D-22; se ejecuta en la etapa 7, no ahora)

1. **Cuando exista la página nueva (etapa 1 publicada):** reemplazar el contenido por una tarjeta de solo lectura: título "Notificaciones automáticas por WhatsApp", texto "Se configuran en Configuración › WhatsApp", botón "Ir a WhatsApp" → `/configuracion/whatsapp?tab=programacion`. Sin `useState` ni textareas.
2. **Cuando exista C-16:** la tarjeta lista las reglas activas de la tienda (nombre, plantilla, cuándo) en solo lectura, con el mismo hook `useWhatsAppRules`.
3. **Eliminar** las plantillas locales y el permiso `OPS_MANAGE_TARIFARIO` como control de esta sección.

## Criterios de aceptación

- No queda ningún lugar fuera de `/configuracion/whatsapp` donde se editen plantillas o interruptores de avisos.
- La pestaña Config de Guías sigue mostrando tarifas y mapeo de estados sin cambios.
- Test de render de la tarjeta (con y sin reglas, y con contrato pendiente).

## Contrato

Ninguno nuevo; reutiliza C-16.

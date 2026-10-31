# Despliegue coordinado de las correcciones de POWIP Live

Los cambios de este PR requieren los PR de `ms-company`, `ms-logistics`, `ms-ventas`, `ms-integrations`, `ms-gateway` y `frontend` de la rama `codex/live-correcciones-20261031`.

1. Revisar con el negocio las tarifas/agencias de entrega y la plantilla WhatsApp aprobada. Preparar el dominio de las tiendas y el frontend de Vercel antes de habilitar enlaces.
2. Ejecutar las migraciones de compañía (`StoreDeliverySettings1793400000000`, runner explícito `migration:partners:prod:run`), logística (`LiveReservationQuantity1793400000000`), ventas (`LivePurchaseCorrections1793400000000`) e integraciones (`LivePaymentNotifications1793401000000`) mediante sus runners de producción. Se ensayaron en PostgreSQL local; no usar `synchronize` en producción.
3. Desplegar compañía, logística e integraciones; después ventas, gateway y frontend. La aprobación crea una notificación durable. Integraciones requiere `LIVE_PAYMENT_CONFIRMED_TEMPLATE`, `LIVE_PAYMENT_CONFIRMED_LANGUAGE` y `LIVE_PUBLIC_WEB_BASE` (HTTPS). Plantilla: nombre, pedido, monto, URL en cuatro parámetros de cuerpo.
4. Configurar coberturas de tienda, activar «Sumar compras al mismo envío» y «Acumulados de clientes de confianza» para las tiendas que conservan las opciones deshabilitadas de la versión anterior, y comprobar readiness. Los pedidos y pagos anteriores deben seguir consultables aunque no se admitan compras nuevas. Confirmar con una cuenta del negocio que las variantes, stock y Yape son correctos.
5. Ejecutar una compra autorizada publicada: separar, cambiar cantidad, cotizar, enviar operación, comprobar pedido/pago pendiente, rechazar, reenviar, aprobar, seguir pedido y añadir otra compra. Comprobar una anulación sin pago y que el stock se libera una sola vez.

Las notificaciones con `status=REVIEW_REQUIRED` en `integrations.live_payment_notifications` requieren revisar la entrega y el registro del proveedor antes de reenviar; no borrar la clave única ni reintentar a ciegas una respuesta ambigua de Meta. `NOT_CONFIGURED` identifica falta de configuración, sin envío intentado. No se envían mensajes de guía creada al registrar un pedido Live pendiente.

El inventario conserva el protocolo Core (reserva/adopción/descuento al entregar). La consulta de una dirección completa requiere la credencial privada del comprador; no basta conocer su teléfono. Estas dos diferencias respecto del texto literal del Word están documentadas para revisión.

El acceso al proyecto Vercel real, DNS, tarifas y plantilla siguen pendientes al preparar este PR; todavía no hay verificación de producción de esta versión.

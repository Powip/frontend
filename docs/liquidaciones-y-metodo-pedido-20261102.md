# Liquidaciones y corrección del método dentro del pedido

## Alcance

Esta publicación financiera es posterior a Despachado, ya publicado mediante frontend PR 270. Coordinar primero las migraciones y backends de Ventas/Courier y después este frontend.

## Courier → negocio

- `/operaciones/liquidaciones` consulta registros persistentes de `/courier-settlements/company/:companyId`. `/administracion/liquidaciones` redirige al mismo módulo. No se importan marcas locales antiguas como evidencia de cobro.
- Confirmar cobro exige pedido entregado, courier, importe explícito, fecha y nota de verificación. Los reportes EVA son evidencia pendiente; vincular uno no rellena ni aprueba automáticamente el importe. Las fotografías se abren únicamente mediante una acción del usuario.
- Depósitos agrupan cobros del mismo courier/moneda y asignan importes por cobro. Un depósito parcial conserva remanentes. Asignaciones pendientes reservan importe hasta revisión; el servidor controla concurrencia, pertenencia e idempotencia.
- Registrar un depósito deja `PENDIENTE_REVISION`. Finanzas acepta o rechaza con nota y versión vigente. El exceso sin asignar y las diferencias permanecen visibles. Que dos importes coincidan no ejecuta una revisión automática.
- Comprobantes JPEG/PNG/WebP/PDF, hasta 10 MB, se suben realmente. Si falla el archivo, el registro ya guardado sigue visible; reintentar no crea otro cobro o depósito. Los enlaces privados se solicitan al abrir un comprobante y caducan.
- Colecciones, depósitos, asignaciones, eventos y comprobantes se vuelven a consultar al recargar. No hay fallback financiero a memoria o `localStorage`.

Este módulo concilia únicamente courier → negocio. No modifica `Payments.status`, `amount`, `paymentMethod`, saldo del cliente ni la protección de claves de retiro. Finanzas verifica los pagos del cliente en su flujo existente.

## Método de pago en el pedido

Desde editar pedido o su detalle, **Corregir método o ver historial** abre la proyección autorizada de cada pago: importe, fecha, estado, método efectivo en el pedido y método original registrado en recaudo. La corrección exige un motivo y usa `requestId` y `expectedVersion`. Un conflicto obliga a refrescar; un reintento de red conserva la identidad del comando.

`GET /order-header/:orderId/payment-method-corrections` controla capacidades y métodos permitidos. `POST /order-header/:orderId/payments/:paymentId/method-corrections` guarda la corrección auditada. No se reutiliza la edición de pagos pendientes ni se reescriben pagos aprobados. Las vistas de Finanzas y sus exportaciones siguen mostrando el método del recaudo.

## Verificación

Pruebas de UI cubren importes explícitos, depósitos parciales, fallo/reintento de comprobantes, revisión versionada y permisos, persistencia al recargar, enlaces de evidencia bajo acción del usuario y corrección de un pago aprobado conservando el método original. El backend debe aplicar y verificar sus migraciones antes de publicar este frontend. No se utilizan pagos o pedidos reales para estas pruebas.

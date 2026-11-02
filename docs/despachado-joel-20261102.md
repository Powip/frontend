# Despachado: acuerdo de Joel y revisión del 2 de noviembre de 2026

## Regla confirmada

Fuente: mensajes de Joel del 29 de octubre, compartidos por Andrea en este chat.

| Momento | Estado del pedido | Cobro |
| --- | --- | --- |
| Guía aprobada, stock reservado, pendiente de entrega física al courier | `EN_ENVIO` / En envío | Independiente |
| Pedido físico entregado al courier | `DESPACHADO` / Despachado | Independiente |
| Producto recibido por la clienta | `ENTREGADO` / Entregado | Si no está aprobado, cobro por verificar |

Desde En envío se ofrecen **Despachado y Entregado**. Confirmar una entrega directamente no debe inventar un registro previo de despacho. El comprobante y la aprobación financiera siguen su flujo propio; la entrega no aprueba pagos ni confirma la liquidación del courier.

## Situación encontrada en producción

El frontend publicado no tenía `DESPACHADO` como estado de pedido. Aprobar una guía y registrar la salida física terminaban en `EN_ENVIO`. Existía la palabra «Despachado» en mensajes y agrupaciones de reportes, pero no como una etapa persistida independiente. Además, Ventas y Courier bloqueaban la entrega final con saldo sin aprobar.

Se revisaron el frontend público y los despliegues de Railway: ms-ventas `b21b18f6f3675930e71254399e3477ff57901af1` y ms-courier `a874e97b465f6bfbc8e71d641b059fe17ab47127`.

## Cambio preparado

- Estado nuevo en Ventas, migración del enum y protecciones de stock; transición En envío → Despachado → Entregado, conservando la entrega directa desde En envío.
- Pedidos, escáner, seguimiento, comprobantes y reportes reconocen la nueva etapa. La aprobación de guía mantiene En envío; la salida física registra Despachado.
- Entregado deja de depender del pago aprobado. El saldo pendiente se presenta como cobro por verificar y se conserva la privacidad de las claves de recojo.
- Las señales de tránsito de EVA y Aliclik reconocen el despacho sin hacer retroceder pedidos ya avanzados.
- Courier admite el nuevo estado y la confirmación de entrega con cobro pendiente.

## Stock y compatibilidad

No se reclasifican automáticamente pedidos históricos En envío: ese estado ya mezclaba guías aprobadas y paquetes físicamente despachados. Las protecciones de devolución de IMEI/series se conservan para esos pedidos y se extienden a Despachado.

Se conserva el protocolo actual de inventario: la mercadería reservada sigue reservada durante Despachado y se confirma el movimiento al entregar. Aprobar o despachar no genera una segunda reserva ni un segundo descuento. El sistema ya puede reservar antes de aprobar la guía, al preparar/confirmar una venta; hacer que **todas** las reservas nazcan exclusivamente en la aprobación es otro cambio y no se incluye aquí.

## Otros puntos de Joel que siguen pendientes

1. **Liquidación del courier.** Existe la pantalla de Operaciones, pero sus registros se mantienen en memoria de la sesión. Faltan persistencia, carga real del comprobante, conciliación e historial en backend. Un pedido entregado con saldo no demuestra que el courier haya cobrado. La pantalla debe identificarlo como cobro por verificar, sin inferir liquidación ni mora a partir de la entrega.
2. **Corrección del método de pago solo en el pedido.** La edición actual modifica pagos pendientes; no permite corregir de forma independiente el método de un pago ya aprobado. Completar ese punto requiere un dato/auditoría propios del pedido para no reescribir el recaudo o cobranza del negocio. No se modifican importes ni pagos aprobados como parte de Despachado.
3. **Confirmaciones por API.** La etapa de entrega y los estados logísticos se sincronizan. No debe suponerse que un estado de entrega confirma el monto cobrado: falta definir/persistir la evidencia de cobro específica de cada courier y conciliarla en el módulo de liquidaciones.

## Publicación

Esta revisión prepara código; no constituye una publicación en producción. Orden requerido: aplicar la migración `OrderDispatched1793649600000` de ms-ventas, desplegar ms-ventas y ms-courier compatibles, y después publicar el frontend. El arranque actual de ms-ventas no ejecuta migraciones automáticamente. No debe publicarse solo el selector del frontend antes de habilitar el estado en backend/base de datos.

La validación debe cubrir guía aprobada → En envío, salida física → Despachado, entrega con saldo → Entregado/cobro por verificar, entrega directa desde En envío, protección de claves y devolución de unidades serializadas.

## Evidencia de revisión

- Ventas: 2.800 pruebas unitarias aprobadas, 155 pruebas PostgreSQL/HTTP aprobadas y comprobaciones de tipos/compilación correctas. Incluye la ejecución real de la migración en una base local desechable y las protecciones de devolución. PR borrador: https://github.com/Powip/ms-ventas/pull/172.
- Courier: 169 pruebas aprobadas, comprobaciones de tipos/compilación correctas y revisión independiente. PR borrador: https://github.com/Powip/ms-courier/pull/27.
- Frontend: suite requerida por el proyecto aprobada (415 pruebas), regresiones específicas de estados, escáner, guías, privacidad, devoluciones y liquidación, y comprobación de tipos correcta.

No se utilizaron pedidos ni pagos reales para las pruebas. La base temporal de PostgreSQL se cerró al terminar la verificación.

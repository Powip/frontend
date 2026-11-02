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

## Puntos financieros preparados en una publicación posterior

Estos puntos se implementan en la rama financiera separada y requieren su propia verificación y publicación. No forman parte del despliegue inicial de Despachado. El contrato y el alcance se documentan en `liquidaciones-y-metodo-pedido-20261102.md`.

1. **Liquidación del courier.** Cobro explícito, depósitos agrupados/parciales, comprobantes privados, revisión versionada e historial persistente. Un pedido entregado no crea un cobro ni una liquidación.
2. **Corrección del método de pago solo en el pedido.** Corrección por pago con motivo y auditoría, incluso después de aprobación. El método original del recaudo, los importes y la aprobación financiera se conservan.
3. **Reportes de courier.** La evidencia e importe reportados por EVA quedan por verificar. Finanzas puede vincular un reporte a un cobro explícitamente confirmado, sin convertir una entrega o un webhook en pago aprobado.

## Publicación

**Despachado ya está publicado y verificado en producción.** Se aplicó primero la migración `OrderDispatched1793649600000` de ms-ventas, luego los backends compatibles y finalmente el frontend. La publicación financiera posterior sigue separada de esta evidencia.

- **Ventas:** despliegue Railway `55e945c1` del commit `bcd3eb5` saludable. La verificación remota de solo lectura confirmó `alreadyApplied: true`, `enumPresent: true` y seis protecciones verificadas. El hook específico de `railway.json` debe retirarse o coordinarse con futuras migraciones, porque valida cuerpos exactos de funciones.
- **Courier:** PR 27 fusionado en `e2192b34`; despliegue Railway `90a2d0d2` aprobado, exitoso y saludable.
- **Frontend:** PR 270 fusionado en `caf6630278742fde1193ecaacf661977adfb2015`; deployment GitHub `7500867416` y Vercel `DqENJYwCnru9mnLKonyWC6i4jsXy` exitosos a las 19:05:38 UTC del 2 de noviembre. `www.powip.tech` coincide en sus 39 assets estáticos con el deployment de producción `powip-jv5ev7p8c-powipsystems-orgs-projects.vercel.app`.

La validación debe cubrir guía aprobada → En envío, salida física → Despachado, entrega con saldo → Entregado/cobro por verificar, entrega directa desde En envío, protección de claves y devolución de unidades serializadas.

## Evidencia de revisión

- Ventas: 2.800 pruebas unitarias aprobadas, 155 pruebas PostgreSQL/HTTP aprobadas y comprobaciones de tipos/compilación correctas. Incluye la ejecución real de la migración en una base local desechable y las protecciones de devolución. PR borrador: https://github.com/Powip/ms-ventas/pull/172.
- Courier: 169 pruebas aprobadas, comprobaciones de tipos/compilación correctas y revisión independiente. PR fusionado: https://github.com/Powip/ms-courier/pull/27.
- Frontend: CI del commit `6b3423f` aprobó 552 suites y 6.085 pruebas en los cuatro shards de regresión. La suite comercial también pasó (415 pruebas; no se suman nuevamente al total de regresión). Incluye estados, escáner, guías, privacidad, devoluciones, liquidación y seguimiento público. Comprobación de tipos y build de producción correctos. PR: https://github.com/Powip/frontend/pull/270.

No se utilizaron pedidos ni pagos reales para las pruebas. La base temporal de PostgreSQL se cerró al terminar la verificación.

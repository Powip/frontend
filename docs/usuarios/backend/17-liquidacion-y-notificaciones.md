# 17 — Liquidación y notificaciones de referidos

Estado: sin pantalla propia · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

Alimenta las estadísticas de Referidos (Ganado este mes, Total histórico, Descuento acumulado), el saldo pendiente y los avisos «Notificación automática por WA» y «Confirmación por email y WA» del proceso de cobro.

## 2. Estado actual y evidencia

- No hay en el frontend ningún dato de liquidaciones ni de notificaciones de referidos.
- [FE] `ReferralsTab.tsx` muestra los pasos y plazos del mockup (24 h, día 1, mínimo S/ 50, WhatsApp y email) como propuesta pendiente de confirmación.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `rewardId` | Identificador único por recompensa (idempotencia). |
| `referralId`, `paymentEventId` | Origen verificado. |
| `amountMinor`, `currency` | Importe. |
| `status` | `pending`, `eligible`, `processing`, `paid`, `failed`, `reversed`. |
| `period` | Período de corte (zona horaria definida). |
| `transferReference` | Referencia del abono, solo cuando se pagó. |
| `notifications[]` | Canal, estado de entrega y fecha, separado del estado de pago. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| Consumo de eventos de suscripción/pago verificados | [PROPUESTA] |
| Job mensual idempotente de corte y liquidación | [PROPUESTA] |
| `GET /api/v1/referrals/rewards?period=` (historial para la empresa) | [PROPUESTA] |

## 5. Ejemplos

```json
{
  "rewardId": "rwd_01",
  "referralId": "ref_05",
  "paymentEventId": "pay_evt_77",
  "amountMinor": 5000,
  "currency": "PEN",
  "status": "eligible",
  "period": "2026-10",
  "transferReference": null,
  "notifications": [{ "channel": "whatsapp", "status": "sent", "at": "2026-10-07T15:00:00Z" }]
}
```

## 6. Validaciones, permisos y aislamiento por empresa

- La empresa solo ve sus recompensas.
- Solo eventos de pago verificados generan recompensas; reembolsos generan reversos.
- Saldo retenido bajo el mínimo; se paga solo a un destino verificado (bloques 15/16).

## 7. Errores y comportamiento esperado en frontend

- Mostrar «procesando» o «pagado» según `status`, nunca «pagado» por haber encolado un job.
- Fallo de pago: estado `failed` visible y reintento según política.

## 8. Transacciones, concurrencia e idempotencia

- Ledger con `rewardId` único; un evento repetido no duplica la recompensa.
- Job de corte idempotente; un callback repetido no ejecuta dos transferencias.
- Notificaciones con deduplicación y reintentos, independientes del navegador.
- Proceso manual documentado si no hay proveedor de desembolsos.

## 9. Dependencias mínimas

Bloques 14, 15 y 16, y la fuente de pagos.

## 10. Pruebas de aceptación

- Un evento repetido recompensa una sola vez.
- El job repetido no duplica el pago.
- Un fallo permite reintentar.
- Un reverso actualiza el saldo.
- El importe coincide con el resumen del bloque 14.
- Email y WhatsApp no exponen el destino completo.

## 11. Decisiones pendientes y desviaciones del mockup

- Plazos (24 h, día 1), mínimo y canales: requieren contrato comercial y proveedores reales.
- Proveedor de WhatsApp y de desembolsos.

## 12. Checklist de entrega e integración

- [ ] Ledger, job y estados documentados con OpenAPI de lectura.
- [ ] Integraciones de email y WhatsApp autorizadas.
- [ ] Frontend: estadísticas y estados de pago reales en Referidos.

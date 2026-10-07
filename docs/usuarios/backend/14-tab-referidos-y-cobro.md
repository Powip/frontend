# 14 — Pestaña Referidos y cobro

Estado: UI preparada · backend pendiente de confirmar · servicio dueño sin definir · todo deshabilitado.

## 1. Pantalla y controles que desbloquea

- «¿Cómo funciona el cobro de referidos?» con cuatro pasos.
- Elección de recompensa: «Descuento en tu suscripción» (10 % por referido) o «Monto en efectivo» (S/ 50 por referido activado).
- Con efectivo: proceso de cobro y registro de cuenta (bloques 15 y 16).
- Estadísticas: Referidos activos, Ganado este mes, Total histórico, Descuento acumulado.
- Link de referido con Copiar y Compartir por WhatsApp.

## 2. Estado actual y evidencia

- [FE] `src/components/users/referrals/ReferralsTab.tsx`: la elección de recompensa y el método de cobro cambian la vista, pero **no se guardan**.
- [FE] Estadísticas en «—» (nunca `0` ni `S/ 0`); link «no disponible todavía»; Copiar y Compartir deshabilitados.
- [FE] Beneficios y plazos (10 %, S/ 50, 24 h, «1ro de cada mes», mínimo S/ 50, avisos por WhatsApp y email) se muestran como **propuesta del diseño, pendiente de confirmación**.
- No hay en el frontend ninguna llamada de referidos. El dueño de estos datos no está definido: no se asume ms-auth. Revisar contratos existentes de partners y subscriptions (`src/components/superadmin/`, ms-subscription) antes de crear rutas.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `referralUrl` | Link único generado en el servidor. |
| `rewardMode` | `discount` o `cash`. |
| `currency` | Moneda (PEN). |
| `activeReferrals` | Referidos activos según la política. |
| `earnedThisMonth`, `totalEarned` | Importes en unidades menores. |
| `discountPercent` | Descuento acumulado vigente. |
| `pendingPayout`, `nextPayoutAt` | Saldo y próxima liquidación. |
| `policy` | Reglas vigentes (porcentaje, monto, mínimo, plazos) para mostrar textos reales. |
| `version` | Para cambiar `rewardMode`. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `GET /api/v1/referrals/program` (resumen y política de la empresa) | [PROPUESTA] |
| `PUT /api/v1/referrals/program/reward-mode` con `version` | [PROPUESTA] |

## 5. Ejemplos

```json
{
  "referralUrl": "https://example.com/ref/abc123",
  "rewardMode": "discount",
  "currency": "PEN",
  "activeReferrals": 2,
  "earnedThisMonthMinor": 0,
  "totalEarnedMinor": 10000,
  "discountPercent": 20,
  "pendingPayoutMinor": 0,
  "nextPayoutAt": "2026-11-01T05:00:00Z",
  "policy": { "discountPerReferralPercent": 10, "cashPerReferralMinor": 5000, "minimumPayoutMinor": 5000, "confirmationHours": 24, "payoutDay": 1, "timezone": "America/Lima" },
  "version": 3
}
```

```json
{ "rewardMode": "cash", "version": 3 }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Empresa desde el token; capacidad `referrals.read/write`.
- Link y atribución validados en el servidor; evitar autorreferidos y duplicados.
- Descuento nunca genera saldo negativo; definir acumulación con promociones.
- Cambios de modo no retroactivos.
- No sumar descuento y efectivo por el mismo evento salvo política explícita.

## 7. Errores y comportamiento esperado en frontend

- Sin programa: mantener el aviso de pendiente.
- Error de carga: alerta con Reintentar; nunca mostrar `S/ 0` como resultado real.
- `409` de versión al cambiar modo: recargar.
- Los textos de beneficios salen de `policy`, no del mockup.

## 8. Transacciones, concurrencia e idempotencia

- Cambio de modo con `version`.
- Atribución de referidos idempotente por evento de pago (bloque 17).

## 9. Dependencias mínimas

Bloque 00 y la fuente de suscripciones/pagos.

## 10. Pruebas de aceptación

- El link real se copia y comparte.
- Un alta sin pago no genera recompensa; un pago confirmado suma una sola vez.
- Una cancelación sigue la política.
- Las estadísticas no incluyen datos de otras empresas.

## 11. Decisiones pendientes y desviaciones del mockup

- Servicio dueño (D8).
- Validación comercial de 10 %, S/ 50, 24 h, día 1 y mínimo S/ 50.
- Cuándo un referido es «activo»; bajas y reactivaciones.
- Modo por empresa o por referido.

## 12. Checklist de entrega e integración

- [ ] Servicio dueño definido y contrato OpenAPI.
- [ ] Política comercial validada.
- [ ] Frontend: cargar el programa, mostrar `policy` real, habilitar link y cambio de modo.

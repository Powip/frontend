# 15 — Formulario Cuenta bancaria

Estado: UI preparada · backend pendiente de confirmar · guardado deshabilitado.

## 1. Pantalla y controles que desbloquea

Dentro de Referidos (modo efectivo): selección de banco (BCP, Interbank, BBVA, Scotiabank, Nación, Otro) y formulario con Número de cuenta, Tipo de cuenta, Titular, DNI/RUC del titular, CCI, Email de confirmación y «Guardar cuenta bancaria».

## 2. Estado actual y evidencia

- [FE] `src/components/users/referrals/BankAccountForm.tsx`: campos editables en memoria, botón deshabilitado con aviso; nada se envía.
- [FE] El texto del mockup «Tus datos bancarios están cifrados…» **no se muestra**: no hay evidencia de cifrado.
- No existe servicio de destinos de cobro en el frontend.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `type` | `bank_account`. |
| `bankCode` | Del catálogo de métodos aceptados. |
| `accountType` | `savings` o `checking`. |
| `accountNumber` | Validado según banco. |
| `holderName`, `holderDocument` | Titular y DNI/RUC. |
| `cci` | 20 dígitos. |
| `confirmationEmail` | Para avisos de abono. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `GET /api/v1/referrals/payout-methods` (catálogo) | [PROPUESTA] |
| `GET /api/v1/referrals/payout-destination` (enmascarado) | [PROPUESTA] |
| `PUT /api/v1/referrals/payout-destination` | [PROPUESTA] |

## 5. Ejemplos

```json
{
  "type": "bank_account",
  "bankCode": "BCP",
  "accountType": "savings",
  "accountNumber": "<número>",
  "holderName": "Empresa Ejemplo SAC",
  "holderDocument": "<RUC>",
  "cci": "<CCI>",
  "confirmationEmail": "pagos@example.com",
  "version": 2
}
```

Respuesta `200`:

```json
{ "maskedDestination": "BCP ••••0123", "verificationStatus": "pending", "updatedAt": "2026-10-07T15:00:00Z", "version": 3 }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Empresa desde el token; capacidad específica para datos de cobro.
- `type` no admite campos de otro método.
- Validación por banco (largo, dígitos de control, CCI).
- Cifrado en reposo con claves gestionadas **antes** de mostrar cualquier promesa de cifrado; nunca registrar cuentas completas en logs.
- Otra empresa → `404`.

## 7. Errores y comportamiento esperado en frontend

- `400` con `fields`: error por campo; el destino previo no se borra.
- Éxito: mostrar el destino enmascarado y su estado de verificación.

## 8. Transacciones, concurrencia e idempotencia

- Reemplazo con `version`.
- Un cambio no redirige liquidaciones ya cerradas (bloque 17).

## 9. Dependencias mínimas

Bloque 14.

## 10. Pruebas de aceptación

- Guardar y reabrir muestra el método enmascarado.
- Banco o cuenta inválidos → error de campo.
- El cambio no afecta una liquidación cerrada.
- Otra empresa → `404`.
- Elegir descuento no requiere destino.

## 11. Decisiones pendientes y desviaciones del mockup

- Verificación del titular y cuándo un destino queda habilitado.
- Bancos aceptados y «Otro».

## 12. Checklist de entrega e integración

- [ ] OpenAPI, catálogo de métodos y cifrado confirmado.
- [ ] Frontend: habilitar el guardado, mostrar el destino enmascarado y el estado de verificación.

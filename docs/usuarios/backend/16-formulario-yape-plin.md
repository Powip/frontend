# 16 — Formulario Yape / Plin

Estado: UI preparada · backend pendiente de confirmar · guardado deshabilitado.

## 1. Pantalla y controles que desbloquea

Dentro de Referidos (modo efectivo), al elegir Yape o Plin: «Número de celular» con prefijo +51, «Nombre en Yape/Plin» y «Guardar Yape/Plin».

## 2. Estado actual y evidencia

- [FE] `src/components/users/referrals/WalletForm.tsx`: campos en memoria, botón deshabilitado con aviso; nada se envía.
- [FE] El prefijo +51 es solo visual.
- El mockup usa el mismo formulario para Yape y Plin; el frontend cambia los textos según el método.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `type` | `yape` o `plin`. |
| `phoneNumber` | Celular en formato documentado (E.164 recomendado). |
| `holderName` | Nombre como aparece en la billetera. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `PUT /api/v1/referrals/payout-destination` (mismo recurso del bloque 15, tipo billetera) | [PROPUESTA] |

## 5. Ejemplos

```json
{ "type": "yape", "phoneNumber": "+51900000000", "holderName": "Clara Mejía", "version": 3 }
```

Respuesta `200`:

```json
{ "maskedDestination": "Yape •••••0000", "verificationStatus": "pending", "updatedAt": "2026-10-07T15:00:00Z", "version": 4 }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Igual que el bloque 15: empresa del token, capacidad específica, `type` sin campos ajenos.
- Validar número peruano; no duplicar el prefijo si ya viene internacional.
- No registrar celulares completos en logs.

## 7. Errores y comportamiento esperado en frontend

- `400` por campo; no se borra el destino previo.
- Éxito: destino enmascarado y estado de verificación.

## 8. Transacciones, concurrencia e idempotencia

Reemplazo con `version`; no afecta liquidaciones cerradas.

## 9. Dependencias mínimas

Bloques 14 y 15.

## 10. Pruebas de aceptación

- Guardar y reabrir muestra el número enmascarado.
- Número inválido → error de campo.
- Cambiar de Yape a cuenta bancaria reemplaza el destino sin dejar campos mezclados.

## 11. Decisiones pendientes y desviaciones del mockup

- Si Yape y Plin tienen reglas o verificaciones distintas.
- Cómo se paga a billeteras (manual o proveedor).

## 12. Checklist de entrega e integración

- [ ] OpenAPI con el tipo billetera.
- [ ] Frontend: habilitar guardado y mostrar el destino enmascarado.

# 12 — Modal Invitar por email

Estado: UI preparada · backend pendiente de confirmar · envío deshabilitado.

## 1. Pantalla y controles que desbloquea

Botón «Invitar por email» y modal con Email del colaborador, Nombre completo, Rol a asignar, texto sobre el enlace y «Enviar invitación».

## 2. Estado actual y evidencia

- [FE] `src/components/users/InviteUserModal.tsx`: campos interactivos; el selector de rol usa los roles de E2 elegibles (`COMPANY_USER_ROLES`); «Enviar invitación» deshabilitado con aviso.
- [FE] El mockup dice en el subtítulo que el colaborador recibe «sus credenciales» y en el cuerpo que recibe un enlace para definir su contraseña. El frontend adopta el **enlace** y nunca menciona enviar una contraseña.
- [FE] La vigencia de 48 h del mockup no se promete: el texto dice que la define backend.
- [FE] El mockup ofrece «Solo lectura» en este selector; el frontend solo muestra roles reales.
- [SPEC] Spec v2 §3.6: token UUID con HMAC y 48 h; §1.1 menciona 24 h (D7).

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `email` | Destinatario. |
| `fullName` | Para personalizar el email. |
| `roleIds[]` | Roles asignables por el actor. |
| `status` | `pending`, `accepted`, `revoked`, `expired`. |
| `expiresAt` | Vencimiento según reloj del servidor. |
| `deliveryStatus` | `queued`, `sent`, `failed` (separado del estado de la invitación). |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `POST /api/v1/auth/invitations` | [PROPUESTA] |
| `GET /api/v1/auth/invitations?status=pending` | [PROPUESTA] |
| `POST /api/v1/auth/invitations/{id}/resend` | [PROPUESTA] |
| `DELETE /api/v1/auth/invitations/{id}` (revocar) | [PROPUESTA] |

## 5. Ejemplos

```json
{ "email": "colaborador@example.com", "fullName": "Clara Mejía", "roleIds": ["rol_ventas"] }
```

Respuesta `201`:

```json
{ "id": "inv_01", "status": "pending", "expiresAt": "2026-10-09T15:00:00Z", "deliveryStatus": "queued" }
```

La respuesta nunca incluye el token.

## 6. Validaciones, permisos y aislamiento por empresa

- Empresa y actor desde el token; permiso `users.invite`.
- Rol no asignable → `422 ROLE_NOT_ASSIGNABLE`.
- Email con invitación pendiente o usuario existente: política explícita (`409 INVITATION_PENDING`, `409 USER_EXISTS`); nunca alta duplicada ni acceso accidental a otra empresa.
- Token aleatorio de alta entropía; solo se guarda su hash; un solo uso; vigencia configurable.
- Rate limit por actor y por email (`429`).

## 7. Errores y comportamiento esperado en frontend

- `201` con `deliveryStatus: queued`: «Invitación creada; el envío está en curso». Solo «enviada» cuando `deliveryStatus` sea `sent`.
- `failed`: mostrar el fallo y ofrecer reenviar.
- `409/422/429`: mensaje por `code`.

## 8. Transacciones, concurrencia e idempotencia

- Crear invitación y encolar el email en la misma transacción (outbox).
- Reenviar invalida el token anterior y renueva la vigencia.
- Idempotencia por `Idempotency-Key`.

## 9. Dependencias mínimas

Bloques 00 y 08. Página de aceptación: bloque 13.

## 10. Pruebas de aceptación

- El correo recibido permite completar el bloque 13.
- Un fallo del emisor se distingue de un envío exitoso.
- Rol no asignable rechazado.
- Un actor de otra empresa no reenvía ni revoca.
- La expiración usa el reloj del servidor.
- Ningún token aparece en logs ni en respuestas administrativas.

## 11. Decisiones pendientes y desviaciones del mockup

- Vigencia (D7) y quién emite el email (D11).
- Email existente (D5).
- «Solo lectura» del mockup sin equivalente real (D1).

## 12. Checklist de entrega e integración

- [ ] OpenAPI de invitaciones y estados de entrega.
- [ ] Emisor de email configurado.
- [ ] Frontend: habilitar «Enviar invitación», mostrar el estado de entrega y una lista de pendientes si producto la pide.

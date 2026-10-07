# 18 — Primer ingreso y cambio de contraseña

Estado: UI pendiente · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

- En Crear usuario: «Contraseña temporal» (mínimo 8 en el mockup) y el aviso «El colaborador podrá cambiar su contraseña al primer ingreso».
- Pantalla auxiliar de cambio obligatorio al iniciar sesión con una contraseña temporal (el mockup no la dibuja).

## 2. Estado actual y evidencia

- [FE] `UserForm.tsx` muestra «Contraseña» con la política actual (mínimo 6, una minúscula, un número) y el aviso «Cambio obligatorio al primer ingreso no disponible». La contraseña que se define hoy es la definitiva.
- [FE] `configuracion/editar-usuario` cambia la propia contraseña con `POST /auth/update-password` (E12) y sin `Authorization`.
- [FE] La edición por admin envía `password` en E5 sin pedir la actual.
- No existe en el frontend ninguna marca `mustChangePassword` ni pantalla de cambio obligatorio.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `mustChangePassword` | En el alta y en la sesión. |
| `passwordPolicy` | Reglas únicas para alta, invitación, cambio y reseteo. |
| `currentPassword`, `newPassword` | Para el cambio propio. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E12 `POST /auth/update-password` `{userId, currentPassword, newPassword, confirmPassword}` | [FE] |
| `mustChangePassword` en el alta (bloque 04) y en `/auth/me` (bloque 00) | [PROPUESTA] |
| `POST /api/v1/auth/password/change` con la sesión limitada | [PROPUESTA] |
| `GET /api/v1/auth/password-policy` | [PROPUESTA] |

## 5. Ejemplos

Login con contraseña temporal → `200`:

```json
{ "accessToken": "<token limitado>", "mustChangePassword": true }
```

Cambio:

```json
{ "currentPassword": "<temporal>", "newPassword": "<nueva>" }
```

Respuesta `204`; la sesión limitada se reemplaza por una normal.

## 6. Validaciones, permisos y aislamiento por empresa

- Mientras `mustChangePassword` sea `true`, la sesión solo permite cambiar la contraseña y cerrar sesión.
- La contraseña temporal no se envía por email.
- Una sola política para todos los flujos (D6).
- E12 exige autenticación (P0-07).

## 7. Errores y comportamiento esperado en frontend

- `403 PASSWORD_CHANGE_REQUIRED` en cualquier otra ruta: redirigir a la pantalla de cambio.
- `400` con `fields.newPassword`: error de política.

## 8. Transacciones, concurrencia e idempotencia

- Cambiar la contraseña revoca las demás sesiones según política.

## 9. Dependencias mínimas

Bloques 00 y 04.

## 10. Pruebas de aceptación

- Un usuario creado con contraseña temporal no accede a nada hasta cambiarla.
- La nueva contraseña cumple la política y la temporal deja de servir.
- Ninguna contraseña aparece en respuestas, emails ni logs.

## 11. Decisiones pendientes y desviaciones del mockup

- Mínimo 8 del mockup vs. 6 actual (D6).
- Si el admin puede definir la contraseña definitiva o solo temporal.
- Si el cambio de contraseña por admin se separa en un reseteo (O-06).

## 12. Checklist de entrega e integración

- [ ] OpenAPI de `mustChangePassword`, sesión limitada y cambio.
- [ ] Política única publicada.
- [ ] Frontend: «Contraseña temporal» en el alta, pantalla de cambio y guardia de rutas.

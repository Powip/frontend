# 13 — Página Aceptar invitación

Estado: UI pendiente · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

Pantalla auxiliar que abre el enlace del email (el mockup no la dibuja): empresa, datos permitidos del invitado, definir contraseña y, si se decide, login. Estados: válida, vencida, usada, revocada, inválida.

## 2. Estado actual y evidencia

- No existe la página en el frontend. `AuthGuard` (`src/components/auth/AuthGuard.tsx`) tiene una lista de rutas públicas; la nueva ruta tendría que agregarse ahí.
- [SPEC] Spec v2 §3.6: `GET /api/auth/validate-invitation?token=` y `POST /api/auth/activate-account { token, password, usuario? }`.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `token` | Del enlace; se envía solo al validar y aceptar. |
| `companyName` | Para mostrar a qué empresa se une. |
| `email`, `fullName` | Datos de la invitación (solo lectura). |
| `password` | Política única con el bloque 18. |
| `username` | Opcional según D12. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `GET /api/v1/auth/invitations/validate?token=` (no consume el token) | [PROPUESTA] |
| `POST /api/v1/auth/invitations/accept` | [PROPUESTA] |

## 5. Ejemplos

Validar → `200`:

```json
{ "valid": true, "companyName": "Empresa Ejemplo", "email": "colaborador@example.com", "fullName": "Clara Mejía" }
```

Validar → `410`:

```json
{ "code": "INVITATION_EXPIRED", "message": "La invitación venció", "fields": null }
```

Aceptar:

```json
{ "token": "<token>", "password": "<contraseña>", "username": "cmejia" }
```

Respuesta `201`: `{ "userId": "usr_20" }` (o sesión iniciada, según decida backend). Nunca devuelve la contraseña.

## 6. Validaciones, permisos y aislamiento por empresa

- Ruta pública con rate limit.
- Empresa y roles salen de la invitación guardada, **nunca** del body.
- Usuario existente o con otra empresa: política explícita (D5).

## 7. Errores y comportamiento esperado en frontend

- `410 INVITATION_EXPIRED/USED/REVOKED`: pantalla específica con contacto del administrador.
- `400` de contraseña: error de campo.
- Éxito: borrar el token de la URL (`history.replaceState`) e ir a login o al panel.

## 8. Transacciones, concurrencia e idempotencia

- Crear o activar el usuario y consumir el token en una transacción; dos aceptaciones simultáneas: como máximo una exitosa.

## 9. Dependencias mínimas

Bloques 12 y 18.

## 10. Pruebas de aceptación

- Token vigente activa al usuario correcto en la empresa correcta.
- Usado o vencido → `410`.
- Manipular empresa o roles en el body no cambia el destino.
- La contraseña no aparece en respuestas ni logs.

## 11. Decisiones pendientes y desviaciones del mockup

- Login propio en la aceptación (D12).
- Pertenencia a varias empresas.
- Si la aceptación inicia sesión directamente.

## 12. Checklist de entrega e integración

- [ ] OpenAPI de validar y aceptar.
- [ ] Frontend: crear la ruta pública, sus estados y el limpiado del token.
- [ ] Prueba de concurrencia de aceptación.

# 00 — Sesión, empresa y reglas comunes

Estado: backend pendiente de confirmar. Sin pantalla propia: condiciona todos los bloques.

## 1. Pantalla y controles que desbloquea

No tiene pantalla. Sin este bloque, ningún control de `/usuarios` es seguro aunque la UI funcione: acceso a la página, listado, alta, edición, baja, roles, permisos, invitaciones y referidos.

## 2. Estado actual y evidencia

- [FE] El acceso a `/usuarios` lo decide el cliente: `hasRouteAccess` en `src/config/permissions.config.ts` exige un rol de `ADMIN_ROLES` o un correo de `SUPERADMIN_EMAILS` (lista en el bundle). `AuthGuard` y `Sidebar` usan esa regla.
- [FE] El rol sale del JWT decodificado en el cliente (`src/lib/jwt.ts`, `src/contexts/AuthContext.tsx`): claim `role` singular y `permissions?: string[]`. No se verifica la firma en el cliente.
- [FE] El `companyId` de E1/E3 viene de `auth.company.id` (ms-company), es decir, lo envía el cliente en la URL.
- [FE] `configuracion/editar-usuario` llama a `GET/PUT /auth/user/{id}` y `POST /auth/update-password` sin `Authorization` (E12).
- No hay evidencia [BE] de que ms-auth compare empresa, rol o permiso del token con el recurso.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `id` | Usuario autenticado. |
| `companyId` | Empresa de la sesión. Es la única fuente válida para operaciones de empresa. |
| `roles[]` | Roles del usuario (`{id, name}`). Mientras exista el claim `role` singular, mantenerlo por compatibilidad. |
| `effectivePermissions[]` | Permisos efectivos calculados en el servidor. |
| `permissionsVersion` | Versión para invalidar permisos en caché. |
| `capabilities` | Qué puede hacer el actor en este módulo (por ejemplo `users.write`, `roles.write`, `referrals.read`). |
| `isSuperadmin` | Calculado en el servidor; reemplaza la lista de correos del frontend. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `POST /api/v1/auth/refresh` (E10) | [FE] |
| `GET /api/v1/auth/me` → identidad, empresa, roles, permisos y capacidades | [PROPUESTA] |

Antes de crear `/auth/me`, confirmar si ms-auth ya expone algo equivalente.

## 5. Ejemplos

`GET /api/v1/auth/me` → `200`

```json
{
  "id": "usr_01",
  "companyId": "cmp_01",
  "roles": [{ "id": "rol_admin", "name": "ADMINISTRADOR" }],
  "role": "ADMINISTRADOR",
  "effectivePermissions": ["users.read", "users.write", "roles.read"],
  "permissionsVersion": 7,
  "capabilities": { "users": ["read", "write"], "roles": ["read"], "referrals": [] },
  "isSuperadmin": false
}
```

Formato de error común:

```json
{ "code": "FORBIDDEN", "message": "No tenés permiso para esta acción", "fields": null }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Ningún servicio confía en `companyId`, `userId`, rol o permiso enviados por el cliente sin compararlos con la sesión.
- Toda operación de empresa toma la empresa del token. Si la URL conserva `{companyId}` por compatibilidad, debe coincidir con el token o responder `403` (salvo superadmin verificado en el servidor).
- Un recurso de otra empresa responde `404`, para no revelar que existe.
- El `refresh` recalcula rol y permisos y rechaza usuarios inactivos o eliminados.
- La lista de correos del frontend no se usa como autorización en el servidor.
- E12 exige autenticación con el mecanismo que backend documente (Bearer o cookie).

## 7. Errores y comportamiento esperado en frontend

| Código | Significado | Frontend |
|---|---|---|
| `400` | Validación (`fields` por campo) | Error junto al campo |
| `401` | Sin sesión | Intenta refresh; si falla, login |
| `403` | Sin permiso | Mensaje de acceso denegado, sin reintentar |
| `404` | No visible para la empresa | «No encontrado» |
| `409` | Conflicto (duplicado, versión) | Pide recargar o corregir |
| `410` | Invitación vencida o usada | Pantalla específica (bloque 13) |
| `422` | Regla de negocio | Mensaje del `code` |
| `429` | Límite de intentos | Reintento más tarde |

Las respuestas y los errores nunca incluyen contraseñas, hashes, refresh tokens ni datos bancarios completos.

## 8. Transacciones, concurrencia e idempotencia

- Reglas de integridad en transacción y resistentes a concurrencia: no cambiar el propio rol, no desactivarse, no dejar la empresa sin administrador activo.
- Anti-escalada: nadie asigna un rol o permiso que no puede delegar; un rol de otra empresa nunca es asignable.
- Auditoría con actor, empresa, objetivo, antes/después y fecha, con datos sensibles redactados.
- Documentar el desfase máximo entre un cambio de rol o permiso y su aplicación en **todos** los servicios antes de prometer cambios inmediatos.

## 9. Dependencias mínimas

Ninguna. Todos los demás bloques dependen de este.

## 10. Pruebas de aceptación

- Token de la empresa A no lista, edita ni borra recursos de la empresa B (`403`/`404`, sin cambios en B).
- Usuario sin permiso recibe `403` en cada operación del módulo.
- Dos degradaciones simultáneas no dejan la empresa sin administrador.
- Un permiso retirado deja de funcionar en llamadas directas al servicio dentro del plazo documentado.
- Un correo de la lista del frontend sin rol superadmin en el servidor no obtiene acceso de superadmin.
- Ninguna respuesta del módulo contiene contraseñas, hashes ni tokens.

## 11. Decisiones pendientes y desviaciones del mockup

- Plazo de propagación de permisos (contrato general D9).
- Un rol o varios por usuario (D14) y su efecto en el JWT.
- Nombres reales de permisos (D3) y modelo de permisos del rol (D4).
- Migración de `SUPERADMIN_EMAILS` a un claim verificado sin cortar la activación de leads (P0-03).

## 12. Checklist de entrega e integración

- [ ] OpenAPI de `/auth/me` (o equivalente existente) y de los errores comunes.
- [ ] Pruebas de aislamiento A/B en E1, E3, E5, E6 y E8.
- [ ] Regla de integridad y anti-escalada con pruebas de concurrencia.
- [ ] Plazo de propagación documentado.
- [ ] Frontend: `hasRouteAccess` usa capacidades del servidor; se elimina `SUPERADMIN_EMAILS`.
- [ ] Frontend: E12 envía la credencial que backend exija.

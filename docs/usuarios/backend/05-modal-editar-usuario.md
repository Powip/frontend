# 05 — Modal Editar usuario

Estado: UI preparada · datos y rol integrados en frontend con E5 · estado y email sin contrato · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

Modal compacto «Editar — Nombre Apellido» con dos pestañas:

- **Datos principales**: Nombre, Apellidos, Email, Teléfono, Rol, Estado y la ayuda sobre el cambio de rol.
- **Más datos**: Documento, Contraseña, Dirección, departamento, provincia y distrito.

Pie fijo con Cancelar / Guardar cambios.

## 2. Estado actual y evidencia

- [FE] `src/components/forms/UserForm.tsx` → `updateUser` (E5 `PUT /api/v1/auth/user/{userId}`) con `name, surname, address, city?, province, district, phoneNumber, roleName, password?`.
- [FE] El rol se elige con un select, como en el mockup: muestra los roles asignables de E2 y, si el rol actual no es asignable, lo conserva como opción deshabilitada. El select se bloquea cuando el usuario se edita a sí mismo.
- [FE] Email y documento son de solo lectura: `UpdateUserRequest` no los incluye.
- [FE] Estado: se muestra el valor real en un selector **deshabilitado** con aviso; no hay contrato que lo persista (P0-04).
- [FE] `roleName` se reenvía siempre (también sin cambios), porque no está confirmado que omitirlo signifique «sin cambio».
- [FE] `city` vacío no se envía: hoy no se puede borrar el departamento desde la edición (Q-01/Q-02).
- [FE] El usuario no puede cambiar su propio rol; si no tiene rol, no puede asignárselo.
- [FE] El aviso del mockup «afecta… de forma inmediata» se reemplazó por uno que dice que el plazo depende de backend (D9).
- [FE] Documento, contraseña y dirección, que el mockup no muestra en edición, quedan en la pestaña «Más datos» para no perder funciones existentes. Si un error de validación está en esa pestaña, el formulario la abre y lleva el foco al campo.
- [FE] Al abrir la edición se conservan departamento, provincia y distrito del usuario; antes, el Select de ubicación los vaciaba al montarse.
- [FE] Guardado protegido: un solo envío, sin cierre durante el guardado, sin éxito sin respuesta.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `name`, `surname`, `phoneNumber`, `address`, `district`, `province`, `department` | Datos personales editables. |
| `email` | Editable solo si backend define la reverificación (D5). |
| `roleIds[]` / `roleName` | Rol(es) asignables. |
| `status` | Habilitado/deshabilitado. |
| `password` | Solo si se mantiene el cambio por admin (O-06 propone separarlo). |
| `version` | Control de concurrencia. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E5 `PUT /api/v1/auth/user/{userId}` con `UpdateUserRequest` | [FE] |
| `PATCH /api/v1/auth/users/{userId}` parcial con `version` (o `If-Match`), incluyendo `status` y `roleIds[]` | [PROPUESTA] |
| `PATCH /api/v1/auth/users/{userId}/status` separado (alternativa D17) | [PROPUESTA] |

## 5. Ejemplos

Request actual (E5):

```json
{ "name": "Luis", "surname": "Paz", "address": "Av. Ejemplo 200", "province": "Lima", "district": "Breña", "phoneNumber": "900000001", "roleName": "VENTAS" }
```

Request propuesto (parcial, atómico):

```json
{ "version": 4, "name": "Luis", "phoneNumber": "900000001", "roleIds": ["rol_ops"], "status": false }
```

Respuesta `200`:

```json
{ "id": "usr_03", "name": "Luis", "surname": "Paz", "roles": [{ "id": "rol_ops", "name": "OPERACIONES" }], "status": false, "version": 5 }
```

Conflicto `409`:

```json
{ "code": "VERSION_CONFLICT", "message": "El usuario fue modificado por otra persona", "fields": null }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Usuario de otra empresa → `404`. Permiso `users.write`; `users.status` para el estado.
- No cambiar el propio rol (`403 CANNOT_CHANGE_OWN_ROLE`), no desactivarse (`403 CANNOT_DEACTIVATE_SELF`), no dejar la empresa sin admin (`409 LAST_ADMIN`).
- Reenviar el mismo rol no asignable (por ejemplo ADMINISTRADOR) **no** debe bloquear la edición de datos personales.
- Campo ausente conserva el valor; `null` borra solo si está permitido; string vacío se valida por campo. Confirmar antes de cambiar el payload actual.

## 7. Errores y comportamiento esperado en frontend

- `409 VERSION_CONFLICT`: avisa y recarga el usuario sin pisar cambios ajenos.
- `403/409` de reglas de integridad: mensaje por `code`; ningún otro campo se modifica.
- Si backend mantiene operaciones separadas para datos y estado, el frontend informa éxito parcial y relee el usuario; no muestra un éxito global.

## 8. Transacciones, concurrencia e idempotencia

- Datos + rol + estado en una sola transacción para el único botón del mockup (D17).
- `version`/`If-Match` obligatorio.
- Desactivar revoca refresh tokens; documentar el plazo de los access tokens ya emitidos (P0-04).

## 9. Dependencias mínimas

Bloques 00 y 08.

## 10. Pruebas de aceptación

- Guardar y recargar conserva todos los valores.
- Un conflicto `409` no pisa la edición ajena.
- Un rechazo no modifica ningún otro campo.
- Un usuario desactivado no puede iniciar sesión ni refrescar.
- Un admin con rol no asignable puede editar sus datos sin escalar privilegios.

## 11. Decisiones pendientes y desviaciones del mockup

- Email editable y su reverificación (D5).
- Estado en el mismo formulario (D17).
- Plazo de propagación del cambio de rol (D9): hasta resolverlo no se promete «inmediato».
- El mockup ofrece siete roles en el select de edición (incluidos «Personalizado» y «Solo lectura»); el frontend ofrece solo los roles reales asignables.
- La pestaña «Más datos» es una extensión para conservar funciones existentes.

## 12. Checklist de entrega e integración

- [ ] OpenAPI de la edición parcial con `version`, `status` y `roleIds[]`.
- [ ] Respuestas Q-01 a Q-04 de `backend-contract.md` §1.7.
- [ ] Frontend: habilitar el selector de estado y el email según contrato.
- [ ] Frontend: manejar `409` de versión con recarga.
- [ ] Frontend: actualizar el aviso del rol cuando D9 esté definido.

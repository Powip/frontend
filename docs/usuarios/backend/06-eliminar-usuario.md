# 06 — Eliminar usuario

Estado: UI preparada · backend pendiente de confirmar · acción deshabilitada.

## 1. Pantalla y controles que desbloquea

Botón de papelera en cada fila y confirmación «¿Eliminar a Nombre Apellido?» con «Eliminar usuario». El mockup usa un `confirm` nativo con «Esta acción no se puede deshacer»; el frontend usa un `AlertDialog` equivalente.

## 2. Estado actual y evidencia

- [FE] `src/components/users/DeleteUserDialog.tsx`: el diálogo se abre, el botón «Eliminar usuario» está deshabilitado y un aviso explica por qué.
- [FE] `DELETE /api/v1/auth/user/{userId}` (E8) existe en `userService.deleteUser` y hoy **solo** se usa como reversión en `src/components/superadmin/LeadActivationFlow.tsx`, cuando falla la activación de un lead.
- No se sabe si E8 hace borrado físico o lógico, qué permisos exige ni qué pasa con ventas, auditoría, sesiones y asignaciones. Por eso no se reutiliza para colaboradores.
- El texto «no se puede deshacer» no se muestra hasta confirmar la política.

## 3. Datos necesarios

| Dato | Significado |
|---|---|
| `userId` | Usuario a dar de baja. |
| `version` | Para no borrar una versión que cambió. |
| Política | Física, lógica (soft delete) o solo desactivación (D10). |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E8 `DELETE /api/v1/auth/user/{userId}` (uso actual: rollback de leads) | [FE] |
| Confirmar alcance de E8 para colaboradores, o `DELETE /api/v1/auth/users/{userId}` con `version` | [PROPUESTA] |

**Confirmación previa obligatoria antes de habilitar E8 para colaboradores:**

1. Tipo de baja (física o lógica) y si es reversible.
2. Permiso exigido y comparación con la empresa del token.
3. Efecto en ventas, pedidos, auditoría, comisiones, sesiones y refresh tokens.
4. Que `LeadActivationFlow` siga funcionando si E8 cambia (o separar las dos rutas).

## 5. Ejemplos

`DELETE /api/v1/auth/users/usr_03?version=5` → `204`

Errores:

```json
{ "code": "CANNOT_DELETE_SELF", "message": "No podés eliminar tu propio usuario", "fields": null }
```

```json
{ "code": "LAST_ADMIN", "message": "La empresa necesita al menos un administrador activo", "fields": null }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Permiso `users.delete`; usuario de otra empresa → `404`.
- No eliminarse a uno mismo; no eliminar al último administrador.
- No borrar en cascada ventas ni registros de auditoría.

## 7. Errores y comportamiento esperado en frontend

- Éxito: cierra el diálogo, recarga el listado y los conteos.
- `403/409`: mensaje por `code`; el usuario sigue en la lista.
- Doble baja: comportamiento definido (`404` o `204` idempotente).

## 8. Transacciones, concurrencia e idempotencia

- Baja, revocación de sesiones y limpieza de asignaciones en una transacción.
- Idempotente por `userId`.

## 9. Dependencias mínimas

Bloques 00 y 02.

## 10. Pruebas de aceptación

- La baja conserva históricos y revoca la sesión.
- Una segunda baja tiene el comportamiento documentado.
- Usuario de otra empresa → `404` sin cambios.
- Último admin y autoeliminación rechazados.
- `LeadActivationFlow` sigue revirtiendo altas fallidas.

## 11. Decisiones pendientes y desviaciones del mockup

- Política de baja (D10) y si «Inactivo» y «Eliminado» son estados distintos.
- El texto irreversible del mockup depende de esa política.

## 12. Checklist de entrega e integración

- [ ] Respuesta a las cuatro confirmaciones previas.
- [ ] OpenAPI de la baja para colaboradores.
- [ ] Frontend: habilitar el botón y ajustar el texto según la política.
- [ ] Prueba de regresión de `LeadActivationFlow`.

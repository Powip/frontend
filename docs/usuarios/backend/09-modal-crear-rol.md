# 09 — Modal Crear rol personalizado

Estado: UI preparada · backend pendiente de confirmar · guardado deshabilitado.

## 1. Pantalla y controles que desbloquea

Modal «Crear rol personalizado»: Nombre del rol, Descripción corta, Color identificador (seis colores), matriz de permisos y «Guardar rol personalizado».

## 2. Estado actual y evidencia

- [FE] `src/components/users/CreateRoleModal.tsx`: campos y colores interactivos (radios accesibles); matriz en vista previa (bloque 11); botón de guardado deshabilitado con aviso.
- No existe en el frontend ninguna llamada para crear roles.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `name` | Obligatorio, único por empresa (normalizado), no reservado. |
| `description` | Opcional, con largo máximo. |
| `color` | Uno de los colores permitidos. |
| `permissions` | Grants válidos del catálogo (bloque 11). |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `POST /api/v1/roles` | [PROPUESTA] |
| Header `Idempotency-Key` | [PROPUESTA] |

Confirmar si ms-auth ya tiene creación de roles antes de agregar una ruta.

## 5. Ejemplos

```json
{
  "name": "Asistente de ventas",
  "description": "Atiende pedidos sin ver finanzas",
  "color": "#0f766e",
  "permissions": [{ "permissionId": "ventas.pedidos", "actions": ["read", "create"] }]
}
```

Respuesta `201`:

```json
{ "id": "rol_custom_01", "name": "Asistente de ventas", "isCustom": true, "isSystem": false, "assignable": true, "userCount": 0, "permissionsVersion": 1 }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Empresa desde el token; permiso `roles.write`.
- Nombre duplicado → `409 ROLE_NAME_TAKEN`; reservado → `422`.
- Permiso desconocido → `422 UNKNOWN_PERMISSION`.
- El actor no puede crear un rol con permisos que no puede delegar → `422 PERMISSION_NOT_DELEGABLE`.

## 7. Errores y comportamiento esperado en frontend

- Errores por campo junto a nombre, color o matriz.
- Éxito: cierra el modal, recarga el catálogo, el total de personalizados y los selectores de rol.
- No asigna el rol a nadie automáticamente.

## 8. Transacciones, concurrencia e idempotencia

- Rol y permisos en una transacción: un error no deja un rol vacío.
- Creación idempotente.

## 9. Dependencias mínimas

Bloques 08 y 11.

## 10. Pruebas de aceptación

- El rol persiste al recargar y solo en su empresa.
- Duplicado → `409`; permiso desconocido → `422`.
- Un actor sin delegación no concede `admin`.
- Un error no crea un rol vacío.

## 11. Decisiones pendientes y desviaciones del mockup

- Roles personalizados sí o no (D2) y modelo de permisos (D3/D4).
- Si el color se persiste (el mockup lo elige pero no lo guarda).

## 12. Checklist de entrega e integración

- [ ] OpenAPI de la creación.
- [ ] Catálogo de permisos (bloque 11).
- [ ] Frontend: habilitar el botón, enviar el payload y refrescar el catálogo.

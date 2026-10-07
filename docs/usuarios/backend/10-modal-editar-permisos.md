# 10 — Modal Editar permisos de un rol (extensión del diseño)

Estado: UI preparada · backend pendiente de confirmar · guardado deshabilitado.

## 1. Pantalla y controles que desbloquea

Botón «Editar permisos» de cada tarjeta de rol. **El mockup solo muestra un aviso** («Abriendo matriz de permisos»): el frontend propone un modal que reutiliza la matriz del modal Crear rol.

## 2. Estado actual y evidencia

- [FE] `src/components/users/EditPermissionsModal.tsx`: título «Editar permisos — ROL», matriz en vista previa y «Guardar permisos» deshabilitado.
- No hay en el frontend lectura ni escritura de permisos de un rol.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `roleId` | Rol a editar. |
| `grants[]` | `{permissionId, actions[]}` persistidos. |
| `version` | Concurrencia. |
| `canEditPermissions` | Si el actor puede editar (bloque 08). |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `GET /api/v1/roles/{roleId}/permissions` | [PROPUESTA] |
| `PUT /api/v1/roles/{roleId}/permissions` con `version` | [PROPUESTA] |

## 5. Ejemplos

`GET` → `200`:

```json
{ "roleId": "rol_ventas", "version": 2, "grants": [{ "permissionId": "ventas.pedidos", "actions": ["read", "create", "update"] }] }
```

`PUT`:

```json
{ "version": 2, "grants": [{ "permissionId": "ventas.pedidos", "actions": ["read"] }] }
```

Respuesta `200` con los permisos efectivos persistidos y `version: 3`.

## 6. Validaciones, permisos y aislamiento por empresa

- Permiso `roles.write` y `canEditPermissions`.
- Acciones válidas por permiso; implicaciones documentadas (crear exige ver; si `admin` implica las demás).
- Editar un rol base solo como copia por empresa (D16); nunca afecta a otras empresas.
- No conceder lo que el actor no puede delegar.

## 7. Errores y comportamiento esperado en frontend

- `409 VERSION_CONFLICT`: recargar la matriz.
- `422`: marcar la fila inválida.
- Éxito: refrescar catálogo y `permissionsVersion`.

## 8. Transacciones, concurrencia e idempotencia

- Reemplazo atómico de los grants con `version`.
- Propagación a sesiones dentro del plazo del bloque 00.

## 9. Dependencias mínimas

Bloques 00, 08 y 11.

## 10. Pruebas de aceptación

- Guardar y releer coincide.
- Un actor sin delegación no concede `admin`.
- Modificar un rol base no afecta a otras empresas.
- Un permiso retirado impide la llamada directa al endpoint correspondiente dentro del plazo.
- Dos ediciones concurrentes no se pisan.

## 11. Decisiones pendientes y desviaciones del mockup

- Roles base editables (D16).
- Implicaciones entre acciones y reglas de sección parcial.

## 12. Checklist de entrega e integración

- [ ] OpenAPI de lectura y escritura.
- [ ] Enforcement en todos los servicios (bloque 11).
- [ ] Frontend: cargar grants, habilitar casillas y guardado según `canEditPermissions`.

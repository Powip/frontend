# 11 — Matriz de permisos (rol y usuario)

Estado: UI preparada (vista previa) · backend pendiente de confirmar · sin guardado.

## 1. Pantalla y controles que desbloquea

- Matriz Ver/Crear/Editar/Eliminar/Admin por ruta, con ocho secciones y casilla por sección.
- Aparece en: Crear usuario («Personalizar permisos por módulo y ruta»), Crear rol (bloque 09) y Editar permisos (bloque 10).
- En el mockup la matriz de alta se abre sola al elegir «Personalizado» y también se puede abrir con cualquier rol (permisos por usuario).

## 2. Estado actual y evidencia

- [FE] `src/components/users/PermissionMatrix.tsx` renderiza una tabla accesible (`caption`, encabezados por fila y columna) con todas las casillas **deshabilitadas y sin marcar**.
- [FE] Las rutas vienen de `permissionMatrixPreview.ts`, que copia la estructura del mockup como **ejemplo de diseño**. No coinciden necesariamente con las rutas de Next ni con los endpoints reales.
- [FE] El mockup marca «Ver» por defecto en todas las rutas, incluidas las administrativas; el frontend no marca nada.
- [FE] Hoy el acceso se decide por `ROUTE_PERMISSIONS`, `ADMIN_ROLES` y `SUPERADMIN_EMAILS` en `src/config/permissions.config.ts`; el JWT trae `permissions?: string[]` sin evidencia de contenido real.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `sections[]` | `{id, label, routes[]}`. |
| `routes[]` | `{id, label, path, actions[], delegableActions[]}`. |
| `actions` | `read`, `create`, `update`, `delete`, `admin` (o lo que defina backend). |
| `grants[]` | Concesiones de un rol o de un usuario. |
| Mapeo permiso→endpoints | Qué llamadas de cada servicio protege cada permiso. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| `GET /api/v1/permissions/catalog` | [PROPUESTA] |
| `GET/PUT /api/v1/roles/{roleId}/permissions` (bloque 10) | [PROPUESTA] |
| `GET/PUT /api/v1/auth/users/{userId}/permissions` (overrides por usuario) | [PROPUESTA] |

## 5. Ejemplos

```json
{
  "sections": [
    {
      "id": "ventas",
      "label": "Ventas",
      "routes": [
        { "id": "ventas.pedidos", "label": "Pedidos", "path": "/ventas", "actions": ["read", "create", "update", "delete", "admin"], "delegableActions": ["read", "create", "update"] }
      ]
    }
  ]
}
```

Overrides de un usuario:

```json
{ "version": 1, "grants": [{ "permissionId": "ventas.pedidos", "actions": ["read"] }] }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Solo permisos del catálogo; acciones válidas por permiso.
- `delegableActions` según el actor.
- Ninguna ruta administrativa se marca por defecto.
- **Enforcement:** actualizar los claims no alcanza. ms-ventas, ms-products, ms-logistics, ms-courier y los demás servicios tienen que comprobar el permiso efectivo en cada endpoint. Sin eso el bloque no se considera operativo.
- La URL del navegador no es la única autorización.

## 7. Errores y comportamiento esperado en frontend

- `422` por permiso o acción inválida: marcar la fila.
- Mientras no exista el catálogo, la matriz queda en vista previa con aviso.

## 8. Transacciones, concurrencia e idempotencia

- Reemplazo atómico de grants con `version`.
- Propagación y revocación dentro del plazo del bloque 00; auditoría de cada cambio.

## 9. Dependencias mínimas

Bloques 00 y 08.

## 10. Pruebas de aceptación

- Guardar y releer coincide.
- Un actor sin delegación no concede `admin`.
- Un permiso retirado impide la llamada directa al endpoint en el plazo documentado, en cada servicio.
- Dos ediciones concurrentes no se pisan.
- Ninguna ruta administrativa queda permitida por defecto.

## 11. Decisiones pendientes y desviaciones del mockup

- Permisos solo por rol o también por usuario (D15). Si producto elige solo roles, registrar la desviación del mockup; el frontend no oculta la matriz por su cuenta.
- Resolución con varios roles (unión de grants) y si existen denegaciones explícitas.
- Nombres reales de permisos (D3) y modelo (D4).

## 12. Checklist de entrega e integración

- [ ] OpenAPI del catálogo y de los grants.
- [ ] Mapeo permiso→endpoints por servicio y pruebas de enforcement.
- [ ] Frontend: reemplazar `permissionMatrixPreview.ts` por el catálogo real y habilitar casillas según `delegableActions`.
- [ ] Frontend: migrar `ROUTE_PERMISSIONS` a permisos efectivos.

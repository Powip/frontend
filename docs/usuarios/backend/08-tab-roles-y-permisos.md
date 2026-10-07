# 08 — Pestaña Roles y permisos

Estado: UI preparada · catálogo integrado en frontend con E2 y conteos locales · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

- Barra: «Crear rol personalizado» y texto explicativo.
- Tarjetas de rol: ícono, «N usuarios», nombre, descripción, módulos, «Ver usuarios» y «Editar permisos».
- Tarjeta punteada «Personalizado» con «Crear nuevo».

## 2. Estado actual y evidencia

- [FE] `src/components/users/RolesCatalog.tsx` con datos de E2 (`id, name, description?`).
- [FE] Conteo «N usuarios» calculado con E3 completo, solo cuando E3 cargó bien; si falla, «Sin datos de usuarios».
- [FE] «Ver usuarios» cambia a la pestaña Usuarios con ese rol, sin búsqueda ni filtro de estado, en la página 1.
- [FE] Íconos y colores se eligen en el frontend por nombre de rol, **solo como decoración**; no implican permisos.
- [FE] No se muestran módulos: E2 no los informa.
- [FE] «Editar permisos» abre la extensión del bloque 10 (deshabilitada) y «Crear rol personalizado»/«Crear nuevo» abren el bloque 09 (deshabilitado).
- [FE] La nota «Se puede elegir al crear o editar usuarios» refleja el filtro local `COMPANY_USER_ROLES`, no una autorización de backend.
- [FE] «Personalizado» no es un rol: es una acción de creación sin conteo.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `id` | Estable y el mismo que usa el listado (bloque 02). |
| `name`, `description` | Texto visible. |
| `color`, `iconKey` | Opcionales, de una lista permitida. |
| `isSystem`, `isCustom` | Origen del rol; alimenta la tarjeta «Roles personalizados». |
| `assignable` | Si **el actor** puede asignarlo (reemplaza `COMPANY_USER_ROLES`). |
| `canEditPermissions` | Si el actor puede editar sus permisos. |
| `userCount` | Personas de la empresa con ese rol (documentar si cuenta inactivos). |
| `modules[]` | Etiquetas de módulos para la tarjeta. |
| `permissionsVersion` | Versión de los permisos del rol. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E2 `GET /api/v1/roles` | [FE] |
| E2 ampliado: roles visibles por empresa con los campos de la tabla anterior | [PROPUESTA] |

## 5. Ejemplos

```json
{
  "items": [
    {
      "id": "rol_ventas",
      "name": "VENTAS",
      "description": "Pedidos y clientes",
      "color": "#0f766e",
      "iconKey": "chat",
      "isSystem": true,
      "isCustom": false,
      "assignable": true,
      "canEditPermissions": false,
      "userCount": 3,
      "modules": ["Pedidos", "Clientes"],
      "permissionsVersion": 2
    }
  ],
  "total": 1
}
```

## 6. Validaciones, permisos y aislamiento por empresa

- Solo roles del sistema y personalizados de la empresa del token.
- `assignable` y `canEditPermissions` dependen del actor (bloque 00).
- `iconKey` y `color` de una lista permitida.

## 7. Errores y comportamiento esperado en frontend

- Carga: esqueletos, sin roles ni conteos.
- Error: alerta con Reintentar.
- Vacío: «ms-auth no devolvió roles para mostrar»; nunca roles de ejemplo.

## 8. Transacciones, concurrencia e idempotencia

Lectura. `permissionsVersion` permite detectar cambios de permisos.

## 9. Dependencias mínimas

Bloque 00.

## 10. Pruebas de aceptación

- Roles de otra empresa no aparecen.
- `canEditPermissions` coincide con lo que acepta la API de edición.
- `userCount` coincide con el listado filtrado por ese rol.
- «Ver usuarios» filtra por `id`.
- Catálogo vacío no crea roles de ejemplo.

## 11. Decisiones pendientes y desviaciones del mockup

- Equivalencias Administrador/Ventas/Operaciones/Marketing/Contact Center/Solo lectura con los roles reales (D1).
- Si los roles base se editan por empresa como copia (D16); nunca modificar un rol global para otras empresas.
- Módulos por rol.
- El contador de la pestaña no incluye «Personalizado».

## 12. Checklist de entrega e integración

- [ ] OpenAPI del catálogo ampliado.
- [ ] Decisiones D1, D2, D16.
- [ ] Frontend: usar `assignable` en lugar de `COMPANY_USER_ROLES`, `userCount`, `modules`, `color` e `iconKey`.
- [ ] Frontend: habilitar «Editar permisos» según `canEditPermissions`.

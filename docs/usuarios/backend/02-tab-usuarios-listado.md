# 02 — Pestaña Usuarios: tarjetas, búsqueda, filtros y tabla

Estado: UI preparada · integrado en frontend con E2/E3 (búsqueda, filtros, orden y conteos en el navegador) · backend pendiente de confirmar · presencia y roles personalizados sin datos.

## 1. Pantalla y controles que desbloquea

- Tarjetas: Total usuarios, Activos ahora, Inactivos, Roles personalizados.
- Barra: Nuevo usuario, Invitar por email, «Todos los roles», «Todos los estados», Exportar.
- Tabla: selección, Usuario (avatar + login), Nombre, Apellidos, Dirección, Distrito, Email, Género, Roles, Estado, Teléfono, Acciones (Editar, Eliminar, Resumen).
- Orden por Usuario, Nombre, Apellidos (como el mockup) y Estado.
- Paginación 50/25/10 por página.

## 2. Estado actual y evidencia

- [FE] E3 devuelve **el listado completo** de la empresa (`getUsersByCompany`). Búsqueda, filtros, orden, paginación y conteos se calculan en el navegador (`src/services/userListing.ts`).
- [FE] Tarjetas (`src/components/users/UserSummaryCards.tsx`): Total e Inactivos son reales; **Activos ahora** y **Roles personalizados** muestran «No disponible» porque no hay fuente de presencia ni marca de rol personalizado. `status=true` **no** se presenta como presencia.
- [FE] Usuario/login: muestra `username` si E3 lo trae y «—» si no. El email no se presenta como login (tiene su propia columna), aunque hoy se inicia sesión con email (`LoginForm`). Mientras no haya `username`, el orden por Usuario desempata por nombre, apellido y email.
- [FE] Género: se muestra si llega `gender`; hoy E3 no lo trae y la celda queda «—».
- [FE] Roles: un solo rol (`role: {id, name}`). Identificación por `id` exacto; por nombre solo si falta un id y la coincidencia es única; nombres repetidos se distinguen con «· id …» (ver `backend-contract.md` §1.8).
- [FE] Distrito muestra `district`; provincia y departamento van en Resumen y en la exportación.
- No cambiar silenciosamente E3 a una respuesta paginada: rompería tarjetas, filtros y otros consumidores (superadmin `CompaniesView`).

## 3. Datos necesarios

`UserSummary`:

| Campo | Significado |
|---|---|
| `id` | Identificador estable. |
| `username` | Login, si backend lo separa del email (D12). |
| `name`, `surname` | Nombre y apellidos. |
| `identityDocument` | DNI/RUC según regla que defina backend. |
| `email` | Email de contacto/login. |
| `gender` | Valor de un catálogo cerrado o `null` (D12). |
| `phoneNumber` | Teléfono, formato documentado. |
| `address`, `district`, `province`, `department` | Ubicación. Unificar `department` vs `city` (P1-02). |
| `roles[]` | `{id, name, color?}`. Mantener `role` singular durante la transición (D14). |
| `status` | Cuenta habilitada. **No es presencia.** |
| `version` | Para concurrencia en edición (bloque 05). |

Conteos de empresa: `total`, `inactive`, `activeNow` (solo con fuente de presencia), `customRoles` (solo con `isCustom` explícito).

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E3 `GET /api/v1/auth/company/{companyId}/users` | [FE] |
| E2 `GET /api/v1/roles` (filtro y nombres de rol) | [FE] |
| `GET /api/v1/auth/users/company?q&roleId&status&sort&page&pageSize` (o E3 versionado con esos parámetros) | [PROPUESTA] |

## 5. Ejemplos

`GET /api/v1/auth/users/company?q=ana&status=active&sort=name:asc&page=1&pageSize=50`

```json
{
  "items": [
    {
      "id": "usr_02",
      "username": null,
      "name": "Ana",
      "surname": "Torres",
      "identityDocument": "00000000",
      "email": "ana@example.com",
      "gender": null,
      "phoneNumber": "900000000",
      "address": "Av. Ejemplo 100",
      "district": "Breña",
      "province": "Lima",
      "department": "Lima",
      "roles": [{ "id": "rol_ventas", "name": "VENTAS" }],
      "role": { "id": "rol_ventas", "name": "VENTAS" },
      "status": true,
      "version": 3
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50,
  "counts": { "total": 12, "inactive": 2, "activeNow": null, "customRoles": null }
}
```

`total` es el resultado filtrado; `counts` es la empresa completa y no cambia con los filtros.

## 6. Validaciones, permisos y aislamiento por empresa

- Solo usuarios de la empresa del token; permiso `users.read`.
- `pageSize` en {10, 25, 50} (máximo documentado); `sort` con lista blanca (`username`, `name`, `surname`, `status`), desempate por `id`.
- Búsqueda en: username, nombre, apellido, email, documento, teléfono, rol, distrito y dirección. Documentar el criterio de tildes y mayúsculas (el frontend ignora ambos).
- `roleId` filtra por pertenencia (con varios roles, D14).
- Nunca devolver contraseñas, hashes ni tokens.

## 7. Errores y comportamiento esperado en frontend

- `400 INVALID_QUERY`: el frontend vuelve a los valores por defecto.
- Error de carga: alerta con Reintentar; tarjetas con «—»; contadores ocultos.
- Lista vacía con éxito: «No se encontraron usuarios» y «Limpiar filtros» si hay filtros.

## 8. Transacciones, concurrencia e idempotencia

- Lectura. Orden estable para que paginar no repita ni pierda filas.
- El frontend descarta respuestas viejas y vacía la lista al cambiar de empresa.

## 9. Dependencias mínimas

Bloque 00. Para «Roles personalizados»: bloque 08 (`isCustom`). Para «Activos ahora»: fuente de presencia.

## 10. Pruebas de aceptación

- Búsqueda por cada campo del mockup, incluidos teléfono, distrito, dirección y login.
- Filtros combinados (rol + estado + búsqueda) con resultados correctos en varias páginas.
- `counts` no cambian al filtrar ni paginar.
- Usuarios con varios roles aparecen al filtrar por cualquiera de ellos (si D14 los habilita).
- Los `id` de rol coinciden entre E2 y el listado.
- `activeNow` es `null` si no hay fuente de presencia; nunca igual a `status=true`.

## 11. Decisiones pendientes y desviaciones del mockup

- **Presencia** («Activos ahora»): definir fuente, ventana temporal, heartbeat y TTL. Sin eso, la tarjeta queda «No disponible».
- **Roles personalizados**: requiere `isCustom`/`isSystem` explícitos (bloque 08).
- **Varios roles** (D14): el mockup muestra «Ventas/Operaciones».
- **Login y género** (D12).
- Equivalencias de nombres (Marketing, Contact Center, Solo lectura) con los roles reales (D1): no se convierten nombres sin una tabla validada.
- El frontend agrega «Estado» como columna ordenable (el mockup ordena solo Usuario, Nombre y Apellidos).

## 12. Checklist de entrega e integración

- [ ] OpenAPI del listado paginado con `counts` y orden estable.
- [ ] Decisión sobre presencia y `isCustom`.
- [ ] Unificación `department`/`city` y `roles[]`.
- [ ] Frontend: pasar búsqueda, filtros, orden y paginación al servidor manteniendo los conteos de empresa.
- [ ] Frontend: activar «Activos ahora» y «Roles personalizados» con datos reales.

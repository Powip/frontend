# 01 — Página /usuarios y contadores de pestañas

Estado: UI preparada · integrado en frontend (contadores con E2/E3) · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

- Cabecera «Usuarios y Roles» con búsqueda «Buscar usuario...».
- Pestañas «👥 Usuarios (N)», «🔑 Roles y permisos (N)» y «🎁 Referidos y cobro».
- Se conserva el shell global de Powip (sidebar y navegación). La campana de notificaciones del mockup pertenece al shell y no se reproduce en la página.

## 2. Estado actual y evidencia

- [FE] `src/app/usuarios/page.tsx`: «Usuarios (N)» usa el largo de E3 cuando cargó bien; «Roles y permisos (N)» usa la cantidad de roles de E2 (sin roles que solo aparecen en E3). Durante la carga o si falla, el contador no se muestra: nunca aparece `(0)` por error.
- [FE] Sin empresa en la sesión, la página muestra un aviso y no hace ninguna consulta.
- [FE] Al cambiar de empresa o perder la sesión, se invalidan las cargas en curso y se vacía el listado.
- El mockup cuenta «Personalizado» como un rol (6); el frontend no lo cuenta porque es una acción de creación.

## 3. Datos necesarios

| Dato | Significado |
|---|---|
| `usersTotal` | Usuarios de la empresa, sin filtros. |
| `rolesTotal` | Roles visibles para la empresa (sistema + personalizados). |
| `capabilities.users/roles/referrals` | Si el actor puede ver cada pestaña (bloque 00). |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E3 `GET /api/v1/auth/company/{companyId}/users` (largo de la respuesta) | [FE] |
| E2 `GET /api/v1/roles` (largo de la respuesta) | [FE] |
| `counts.total` de O-01 (bloque 02) y `total` del catálogo (bloque 08) | [PROPUESTA] |

No hace falta un servicio nuevo si los totales llegan con los bloques 02 y 08.

## 5. Ejemplos

Fragmento esperado del listado paginado (bloque 02):

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 50, "counts": { "total": 12, "inactive": 2, "activeNow": null, "customRoles": null } }
```

Fragmento esperado del catálogo (bloque 08):

```json
{ "items": [{ "id": "rol_ventas", "name": "VENTAS" }], "total": 6 }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Los totales son siempre de la empresa del token.
- Una pestaña sin capacidad de lectura no se muestra o queda deshabilitada con aviso; nunca se rellena con datos de otra empresa.
- Sin empresa en la sesión: estado específico, sin consultas globales como respaldo.

## 7. Errores y comportamiento esperado en frontend

- Error en usuarios: la pestaña Usuarios muestra «No se pudieron cargar los usuarios» con Reintentar; el contador desaparece. Las otras pestañas siguen funcionando.
- Error en roles: la pestaña Roles muestra error con Reintentar; el contador desaparece.
- `401/403`: comportamiento del bloque 00.

## 8. Transacciones, concurrencia e idempotencia

- Solo lectura. El frontend descarta respuestas de peticiones viejas (número de petición) y vacía los datos al cambiar de empresa.

## 9. Dependencias mínimas

Bloque 00. Totales con los bloques 02 y 08.

## 10. Pruebas de aceptación

- Cambiar de empresa vacía los datos previos antes de mostrar los nuevos.
- Un error de una pestaña no rompe las demás.
- Ningún total muestra cero cuando la carga falló.
- Los totales no cambian al buscar ni filtrar.
- No se usan los números de ejemplo del mockup (12, 6).

## 11. Decisiones pendientes y desviaciones del mockup

- Si «Roles y permisos (N)» debe incluir la acción «Personalizado» (el mockup la cuenta). El frontend no la cuenta.
- La campana y el título global quedan en el shell de Powip.
- La tipografía Syne/DM Sans del mockup no se carga en esta página: se usa la del proyecto.

## 12. Checklist de entrega e integración

- [ ] Backend confirma de dónde salen `usersTotal` y `rolesTotal` (respuestas de 02/08).
- [ ] Capacidades por pestaña en `/auth/me` (bloque 00).
- [ ] Frontend: usar `counts.total` y `total` cuando E3/E2 se paginen.
- [ ] Revisión visual desktop/mobile de pestañas y cabecera.

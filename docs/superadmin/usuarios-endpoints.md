# Usuarios (directorio de empresas) — contrato de endpoints

> Ojo con el nombre: esta página es el directorio de **usuarios finales de las empresas cliente** (dueños/vendedores/soporte de los negocios que usan Powip) — no el equipo interno de Powip, que es `/superadmin/equipo` (módulo aparte, en curso en paralelo, no tocado acá).

## 🟡 Real pero incompleto — listado de usuarios

`userService.getAllUsers(token)` → `GET {NEXT_PUBLIC_API_USERS}/api/v1/auth/users` (ms-auth, coincide con `CLAUDE.md`: "ms-auth — login, registro, refresh token") **ya existe y ya se usa** — es el mismo que arma el dashboard legacy `src/app/metricas/superadmin/page.tsx`. Trae usuarios de **toda la plataforma** en un solo array, sin paginar y sin ningún query param de filtro (`q`, `rol`, `companyId` no existen).

```
GET {NEXT_PUBLIC_API_USERS}/api/v1/auth/users
```

```jsonc
// Forma real no 100% confirmada (ver punto 3 abajo) — el hook prueba
// ambas variantes con `??` (role.name vs roleName, companyId vs company_id,
// createdAt vs created_at). Ejemplo con los campos vistos en uso real:
[
  {
    "id": "usr-101",
    "name": "Rosa",
    "surname": "Delgado",
    "email": "rosa.delgado@tecnohogar.pe",
    "status": true,
    "companyId": "emp-14",
    "roleName": "VENTAS",
    "role": { "id": "role-3", "name": "VENTAS" },
    "created_at": "2026-07-02T00:00:00Z"
  }
]
```

El frontend (`src/hooks/superadmin/useUsuarios.ts`) lo usa así: trae el array completo una vez (cacheado, `staleTime` largo), lo filtra a solo usuarios con `companyId` (para no mezclar equipo interno) y pagina/filtra en memoria. Mismo patrón y misma limitación que ya documentamos en `empresas-endpoints.md` para `GET /company`.

**Gaps concretos:**

1. **Sin paginación ni filtros server-side.** Pedido: `GET /api/v1/auth/users?page=&page_size=&q=&companyId=&roleName=`.
2. **Sin `empresaNombre` resuelto.** El front tiene que cruzar `companyId` contra `companyService.getAllCompanies()` (que tampoco pagina — mismo problema de antes, duplicado). Pedido: que la respuesta traiga `companyId` + `companyName` ya resueltos (o un objeto `company: {id, name}` anidado), para no depender de un segundo fetch completo de empresas solo para armar un nombre.
3. **La forma exacta del objeto usuario no está documentada en ningún lado del repo, y hay dos versiones que no coinciden.** El contrato tipado que sí se usa en producción (`src/interfaces/IUser.ts`, consumido por `/usuarios` — la página real de la empresa cliente vía `getUsersByCompany`) declara `role: Role | null` (anidado) y **no tiene `companyId` ni fecha de creación**. El dashboard legacy (`UserDetailModal.tsx`, `metricas/superadmin/page.tsx`), en cambio, lee `user.companyId`, `user.roleName` (plano) y `user.created_at` directo de la respuesta de `getAllUsers`, sin tipar (`any[]`). Ambos casos leen la misma familia de endpoints de ms-auth pero nadie los concilió. El hook nuevo intenta ambas variantes (`role?.name ?? roleName`, `companyId ?? company_id`, `createdAt ?? created_at`) a modo de mejor esfuerzo, pero **no está confirmado con backend cuál es la forma real** — no quisimos "inventar" una sola verdad cuando el propio código ya se contradice.
4. **Taxonomía de roles no coincide — esto es lo más serio.** El panel asumía (`RolUsuarioEmpresa` en el mock) que un usuario de empresa tiene rol `"Administrador" | "Vendedor" | "Soporte"`. Los roles reales que expone `ms-auth` (confirmados en `src/components/forms/UserForm.tsx`, que sí carga roles reales vía `getRoles()` y los usa para crear/editar usuarios de compañía) son **`AGENTES`, `VENTAS`, `OPERACIONES`, `COURIER`, `CALLER`** — más `ADMIN`/`ADMINISTRADOR` para dueños/admins. No existe un rol `"Soporte"` ni `"Vendedor"` tal cual. En vez de inventar un mapeo 1:1 que puede quedar mal, el hook ahora muestra el **nombre de rol real tal cual lo devuelve el backend** (`rol` pasó de union cerrada a `string` en `IEmpresa.ts`) y el filtro/creación de usuario usan `getRoles(token)` (real) en vez del enum viejo. Falta que producto confirme si quiere relabelear estos roles para el panel o mostrarlos tal cual.
5. **No hay estado "invitado".** `createCompanyUser`/`createPlatformUser` crean el usuario con contraseña ya seteada — no hay flujo de invitación por email en ningún lado del repo. El único estado real es `status: boolean` (activo/inactivo). El front deja de emitir `"invitado"` para datos reales; ese valor solo existía en el mock.
6. **No hay "último acceso".** Ningún servicio de auth expone last-login. Queda sin mostrar (`—`) en vez de simulado con una fecha inventada.

## 🟢 Real — KPI "Totales"

`length` del listado ya filtrado a usuarios-con-empresa. Real.

## 🟡 Real, con la misma incertidumbre de rol — KPI "Admins vinculados"

Cuenta usuarios cuyo rol resuelto (`role?.name ?? roleName`) es `ADMIN`/`ADMINISTRADOR`. Correcto en la medida en que el nombre de rol se lea bien (ver punto 3 arriba).

## 🔴 Simulado — KPI "Super Admins"

En el mock este número estaba **hardcodeado en `3`**, sin ninguna fórmula (`getKpisUsuarios` en `empresasService.ts`). No hay una definición de negocio de qué es un "Super Admin" dentro del directorio de usuarios de empresas (ese concepto pertenece más bien a `/superadmin/equipo`, el equipo interno). Se deja marcado `simulado` en vez de inventar una fórmula nueva sin que producto la confirme.

## 🟡 Real, best-effort — KPI "Nuevos 7d"

Se calcula sobre `createdAt ?? created_at` del usuario, igual que ya lo hacía el dashboard legacy. No está confirmado formalmente que ese campo exista siempre (ver punto 3) — si no viene, ese usuario simplemente no cuenta como "nuevo" (degrada a menos, no a error).

## 🟢 Real — Crear usuario

`userService.createCompanyUser(companyId, request, token)` → `POST {API_USERS}/api/v1/auth/company/{companyId}/user`. Ya es el mismo endpoint real que usa `UserForm.tsx` en el lado empresa. El modal ahora pide empresa (real, de `companyService.getAllCompanies`), rol real (de `getRoles`) y genera una contraseña temporal si no se especifica una — no hay invitación por email, así que se le tiene que poder comunicar la contraseña al usuario por otro canal (fuera del alcance de este panel).

```
POST {NEXT_PUBLIC_API_USERS}/api/v1/auth/company/{companyId}/user
```

**Body** (`CreateCompanyUserRequest`, `src/services/userService.ts`):
```jsonc
{
  "identityDocument": "00000000",
  "name": "Renato",
  "surname": "Chávez",
  "email": "renato@tecnohogar.pe",
  "password": "Powipx7k92q1",
  "phoneNumber": "999888777",
  "roleName": "VENTAS"
}
```

**Response:** devuelve el usuario creado (mismo shape que un elemento de `GET /auth/users`, con `id` nuevo).

## 🟢 Real — Editar rol de usuario

`userService.updateUser(userId, { roleName }, token)` → `PUT {API_USERS}/api/v1/auth/user/{userId}`. Real. La interfaz tipada (`UpdateUserRequest`) no incluye `status` ni `companyId` — no hay forma confirmada de reasignar la empresa de un usuario ni de activar/desactivar sin borrar (ver abajo).

```
PUT {NEXT_PUBLIC_API_USERS}/api/v1/auth/user/{userId}
```

**Body:**
```jsonc
{ "roleName": "OPERACIONES" }
```

**Response:** devuelve el usuario actualizado (mismo shape que `GET /auth/users`).

## 🟡 Real pero es un borrado duro, no una baja — "Desactivar" usuario

`userService.deleteUser(userId, token)` → `DELETE {API_USERS}/api/v1/auth/user/{userId}`, real. El menú de la tabla lo etiqueta "Desactivar", pero **no existe un endpoint de baja lógica** — `UpdateUserRequest` no tiene campo `status`, así que no hay forma confirmada de desactivar sin eliminar. Se conecta igual (con confirmación) porque es la única mutación real disponible, pero queda documentado que es destructivo de verdad.

```
DELETE {NEXT_PUBLIC_API_USERS}/api/v1/auth/user/{userId}
```

Sin body. **Response:** no se documenta ni se usa acá — `useDeleteUsuarioEmpresa` no lee el valor de retorno, solo invalida la lista al resolver sin error.

**Pedido concreto**: exponer `status` en `PUT /api/v1/auth/user/{id}` para poder desactivar sin borrar — hoy la única opción real es borrar la cuenta.

## 🔴 Simulado — "Resetear contraseña"

No hay ningún endpoint de reset-por-link en `userService.ts` ni en ningún otro servicio del repo. El botón queda como aviso (`toast`) en vez de una llamada real.

## 🔴 Simulado — Permisos por rol (drawer de detalle)

El drawer mostraba una lista fija de permisos por rol (`PERMISOS_POR_ROL`) basada en los roles inventados (`Administrador`/`Vendedor`/`Soporte`). Con los roles reales (`AGENTES`, `VENTAS`, etc.) ese mapeo ya no aplica y no hay ningún endpoint de matriz de permisos por rol en ms-auth. Se deja explícitamente marcado como simulado/ilustrativo en vez de mapear roles reales a permisos inventados.

## Resumen

| Ítem | Estado |
|---|---|
| Listado de usuarios de empresas (`getAllUsers` + filtro `companyId` + join manual con `companyService`) | 🟡 Real, sin paginar/filtrar server-side, forma del objeto no confirmada del todo |
| Paginación + filtros (`q`, `roleName`, `companyId`) en `GET /auth/users` | 🟡 Pedido — hoy se pagina/filtra en memoria |
| `companyName` resuelto en la respuesta de usuarios | 🟡 Pedido — hoy requiere un segundo fetch completo de empresas |
| Confirmar forma real del objeto usuario (`companyId`, `role` anidado vs `roleName`, `createdAt`) | 🔴 Bloqueante para dejar de hacer "mejor esfuerzo" — el propio repo se contradice |
| Taxonomía de roles para usuarios de empresa | 🔴 El panel mostraba roles inventados; ahora muestra los reales (`AGENTES`/`VENTAS`/`OPERACIONES`/`COURIER`/`CALLER`/`ADMIN`) sin relabelear |
| KPI Totales | 🟢 Real |
| KPI Admins vinculados | 🟡 Real, sujeto a la misma incertidumbre de rol |
| KPI Super Admins | 🔴 Simulado — sin definición de negocio para este directorio |
| KPI Nuevos 7d | 🟡 Real, best-effort sobre un campo de fecha no confirmado formalmente |
| Crear usuario de empresa | 🟢 Real (`createCompanyUser`) |
| Editar rol | 🟢 Real (`updateUser`) |
| Reasignar empresa / activar-desactivar sin borrar | 🔴 No existe — `UpdateUserRequest` no tiene `status` ni `companyId` |
| "Desactivar" (conectado a `deleteUser`) | 🟡 Real, pero es borrado duro — pedido: soporte de `status` en el backend |
| Resetear contraseña por link | 🔴 Simulado — no existe endpoint |
| Permisos por rol en el detalle | 🔴 Simulado — no hay matriz de permisos real, y los roles inventados que la alimentaban ya no aplican |

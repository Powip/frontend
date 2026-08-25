# Equipo & Permisos — contrato de endpoints

> Esta página es el roster del equipo INTERNO de Powip (SDRs, CSMs, soporte, admins — quienes usan este panel), con su rol interno (`RolInterno`: `super/ventas/soporte/onboarding/finanzas/csm`, definido en `src/interfaces/superadmin/IPlataforma.ts`). No confundir con la página "Usuarios" (`/superadmin/usuarios`), que administra usuarios de las EMPRESAS clientes — esa es otra pantalla, con otro modelo, y no se toca acá.

## 🔴 Simulado — listado de miembros + KPIs

Lo único remotamente parecido a "listar usuarios" que existe hoy es `getAllUsers()` (`src/services/userService.ts`, `GET {API_USERS}/api/v1/auth/users`) — pero trae **todos** los usuarios de la plataforma (dueños y staff de cada empresa cliente incluidos), sin ningún campo que distinga "es equipo interno Powip" de "es usuario de una empresa cliente", y sin ningún concepto de `RolInterno`. `ms-auth` tiene su propia tabla de roles (`getRoles()` → `GET /api/v1/roles`, valores reales vistos en uso: `AGENTES`, `VENTAS`, `OPERACIONES`, `COURIER`, `CALLER`, `ADMINISTRADOR`, `USUARIO` — ver `src/components/forms/UserForm.tsx:35-39,72-76`) que es un sistema **totalmente distinto** al `RolInterno` de este panel: no existe rol `csm`, `onboarding`, `soporte` ni `super` en `ms-auth`, y el `ventas`/`VENTAS` que sí coincide en nombre es casualidad, no el mismo dato (uno es rol de staff de una tienda, el otro es acceso al panel de superadmin).

Armar el roster filtrando `getAllUsers()` client-side (que puede devolver miles de usuarios de empresas clientes) para adivinar cuáles son "del equipo Powip" es exactamente el anti-patrón que este proyecto evita — no hay ninguna señal confiable en el dato para hacer ese filtro, y sería una carga de N+1/todo-el-dataset para mostrar una tabla de una docena de filas.

**Pedido concreto**: una tabla propia (`miembro_powip` o un flag `es_staff_interno` + `rol_interno` sobre la tabla de usuarios de `ms-auth`) expuesta por un endpoint agregado del propio backend de superadmin:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/equipo
```

```jsonc
{
  "data": [
    { "id": "uuid", "nombre": "Heidy Medina", "email": "heidy@powip.pe", "rol": "ventas", "estado": "activo", "creadoEn": "2026-01-15T00:00:00Z" }
  ]
}
```

`rol` usa los valores de `RolInterno`. Los KPIs (total, roles en uso, invitaciones pendientes, super admins) se derivan client-side de esta misma lista — a diferencia de Empresas/Operación, acá **sí** es razonable calcularlos en el frontend: el roster interno son decenas de filas, no miles, así que no hay problema de escala en recorrerlo una vez ya traído.

## 🟡 Simulado — invitar miembro (existe una primitiva real, pero no calza)

`createPlatformUser()` (`src/services/userService.ts:114`, `POST {API_USERS}/api/v1/auth/admin/register`) es real y de hecho crea cuentas "sin empresa" — es la primitiva más cercana a "usuario de plataforma". Pero no sirve tal cual para este flujo:

1. **Pide de más**: exige `password`, `identityDocument`, `address`, `district` y `phoneNumber` en el mismo paso (ver validación en `userService.ts:134-149`) — crea una cuenta ya activa con contraseña puesta por quien invita, no una invitación real por email con estado "pendiente" (que es justo lo que el modal actual, liviano — solo nombre/email/rol — y el estado `"invitado"` de `IMiembroPowip` esperan).
2. **`roleName` es del sistema equivocado**: espera un nombre de `GET /api/v1/roles` (el de `ms-auth`, ver sección anterior), no un `RolInterno`. Hoy no hay forma de, a través de este endpoint, dejarle a alguien acceso de `csm` o `finanzas` al panel de superadmin — esos roles no existen del lado de `ms-auth`.
3. Ya se usa para otra cosa (`useEmpresas.ts` → `useCreateEmpresa`, para registrar al dueño de una empresa nueva), así que reusarlo tal cual acá mezclaría "cuenta de dueño de empresa recién creada" con "cuenta de staff interno Powip" — ambas quedan como "usuario sin `companyId`" en `ms-auth`, indistinguibles entre sí.

**Pedido concreto**: un endpoint propio de superadmin, liviano, que el backend pueda resolver como quiera puertas adentro (reusar `admin/register` de ms-auth internamente + guardar `rol_interno` en la tabla nueva de arriba + mandar el email de invitación de verdad):

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/equipo/invitar
```

```jsonc
// body
{ "nombre": "Renato Chávez", "email": "renato@powip.pe", "rol": "ventas" }
```

```jsonc
// respuesta
{ "id": "uuid", "nombre": "Renato Chávez", "email": "renato@powip.pe", "rol": "ventas", "estado": "invitado", "creadoEn": "2026-08-24T00:00:00Z" }
```

Mientras tanto, el frontend intenta este POST y, si falla (hoy siempre, 404/network error), cae a simular la invitación en memoria sobre el mock — mismo patrón que `useMarcarTareaHecha` en `useDashboard.ts`.

## 🔴 Simulado a propósito — matriz de permisos (rol × módulo)

Acá no hay ni siquiera un endpoint que "falte": `ROL_VISTAS` (`src/config/superadminNav.config.ts`) **ya es hoy la fuente de verdad real** que decide qué ve cada rol en el sidebar (`navForRole()`, usado para armar el nav). No es un dato de ejemplo esperando conexión — es una constante de frontend que efectivamente gobierna el acceso.

Antes de este pase, además, ese mismo mapeo estaba **duplicado**: `ROL_MODULOS` en `src/mocks/superadmin/plataforma.ts` tenía los mismos valores copiados a mano (fácil que diverjan con el tiempo). Este pase lo consolida: `MatrizPermisos` y la columna "Acceso a" de la tabla ahora leen `ROL_VISTAS` directamente (vía `src/hooks/superadmin/useEquipo.ts`), no una copia separada.

La pregunta real de negocio es otra: ¿el control de acceso al panel debería moverse de una constante de frontend a algo que el backend decida (vía claim del JWT, por ejemplo)? Eso es un cambio de arquitectura — tocaría auth/JWT, este config, y el chequeo de acceso de cada página — no un simple `GET`. Por eso esta sección queda marcada como simulada a propósito (el toggle de la UI es y sigue siendo una demo visual en memoria, como ya decía el comentario original del componente) hasta que el equipo decida si vale la pena hacer ese cambio.

## Resumen

| Sección | Estado | Bloqueado por |
|---|---|---|
| Listado de equipo + KPIs | 🔴 Simulado | No existe "staff interno" ni `RolInterno` en `ms-auth`; hace falta tabla + endpoint agregado propio de superadmin |
| Invitar miembro | 🟡 Simulado (hay una primitiva real parcialmente aplicable) | `createPlatformUser` existe pero pide campos de más, usa el sistema de roles equivocado (`ms-auth` en vez de `RolInterno`), y ya está tomado para otro flujo (alta de dueño de empresa) |
| Matriz de permisos (rol × módulo) | 🔴 Simulado a propósito | No falta un endpoint — `ROL_VISTAS` ya es la fuente de verdad real hoy; moverla a backend es una decisión de arquitectura (JWT/auth), no una conexión de datos |

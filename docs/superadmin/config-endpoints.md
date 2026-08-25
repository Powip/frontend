# Configuración — contrato de endpoints

> A diferencia de las páginas de analítica ya migradas (Dashboard, Adquisición, Seguimiento, Empresas, Oportunidades, Operación), esta es una página de **ajustes**: 7 tabs, cada uno un recurso CRUD chico (planes, cupones, alertas configurables, anuncios, parámetros, branding, seguridad), no un problema de agregación de datos. Por eso este doc no tiene KPIs ni tablas agregadas — es, para cada tab, "¿existe este recurso en algún backend hoy?" y si no, el CRUD mínimo que necesita.
>
> Veredicto corto: de los 7 tabs, solo **Planes y precios** tiene algo real detrás (el catálogo de `ms-subscription`, y solo parcialmente). Los otros 6 son simulados — 4 ya lo eran a través de un servicio mock (`configService.ts` + `mockDelay`), y 2 (**Seguridad** y **Branding**) ni siquiera llegaban a eso: eran `useState` local que se resetea al refrescar la página.

## 🟡 Planes y precios — parcialmente real

`subscriptionService.getAllPlans(token)` → `GET {API_SUBS}/plans` **es real** y ya está en uso activo en dos lugares: la página pública de precios (`src/app/subscriptions/page.tsx`) y `usePlanesCatalogo` en `useSuscripciones.ts`. Devuelve un catálogo plano:

```jsonc
[{ "id": "uuid", "name": "SCALE", "description": "...", "price": 349, "durationInDays": 30 }]
```

Confirmado por cómo lo consume `subscriptions/page.tsx` (`adaptPlans`): matchea por **nombre** (`BASIC`/`MEDIUM`/`SCALE`/`ENTERPRISE`) y arma la ficha de marketing (features, límites) a mano en el frontend — no hay evidencia de que el backend tenga una variante anual del mismo plan, solo un precio mensual por fila.

**Lo que la tabla de este tab pide y el backend NO tiene:**

| Columna del tab | ¿Existe en `GET /plans`? |
|---|---|
| Plan (nombre) | 🟢 Sí (`name`) |
| Precio mensual | 🟢 Sí (`price`, asumiendo `durationInDays` ≈ 30) |
| Precio anual | 🔴 No — no hay tier anual en el catálogo, es un campo inventado |
| Límite de usuarios | 🔴 No — "2 usuarios" etc. hoy es una bala de marketing hardcodeada en `adaptPlans`, no un campo numérico consultable |
| Activo (switch) | 🔴 No — no hay ningún campo tipo `isActive`, y no existe **ningún** endpoint de escritura sobre `/plans` (`POST`/`PUT`/`PATCH`) en todo el repo — se buscó explícitamente y no aparece |

**Pedido concreto**: agregar al recurso `Plan` de `ms-subscription` (no crear un catálogo paralelo bajo el API propio del panel — el dueño real de "plan" es `ms-subscription`):

```
PATCH {API_SUBS}/plans/{id}
```
**Body:**
```jsonc
{ "isActive": true, "maxUsers": 5, "annualPrice": 1790 }
```
**Response:** el `Plan` actualizado — mismo shape que `GET /plans` (`id`, `name`, `description`, `price`, `durationInDays`) con estos 3 campos nuevos incorporados.

**WHY**: mantener la escritura pegada al mismo recurso que ya expone la lectura evita otra vez el problema de "dos fuentes de verdad" ya señalado en otras páginas (Seguimiento, Empresas) — si el límite de usuarios y el precio anual terminan viviendo en una tabla aparte del panel de superadmin, cualquier otro consumidor de `/plans` (la página pública de precios, el flujo de alta de negocio) se queda desactualizado.

## 🔴 Parámetros generales — no existe

No hay ningún store de configuración genérico (feature flags / key-value) en el backend — se buscó `trial_dias`, `2fa`, `ip_whitelist`, `dunning` y solo aparecen en el mock de este tab. Endpoint propuesto:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/parametros
```
```jsonc
{ "data": [{ "clave": "trial_dias", "label": "Duración del trial", "descripcion": "14 días de prueba gratuita por defecto.", "activo": true }] }
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/parametros/{clave}
```
Sin body — es un toggle (el frontend lo llama con `{}`, ver `useToggleParametro`): el backend invierte el `activo` de esa `clave` y responde con el `IParametroGeneral` actualizado (mismo shape que arriba).

**Ojo con esto una vez exista**: guardar el flag acá no alcanza. `trial_dias` solo tiene efecto si `ms-subscription` lo lee al crear una suscripción nueva; `2fa_dinero`/`ip_whitelist` solo si `ms-auth` los aplica en el login. Este endpoint resuelve la mitad "guardar la config"; falta, por cada parámetro, que el microservicio dueño del comportamiento lo consuma — si no, el switch queda decorativo aunque el dato ya sea "real".

## 🔴 Seguridad — no existe (ni siquiera simulado con persistencia)

Este es el más crudo de los 7: `SeguridadTab.tsx` no llama a ningún servicio, ni siquiera al mock — son 4 items en un `useState` local (`ITEMS_INICIALES`) que se pierden al refrescar la página. No hay ninguna noción de política de seguridad (2FA, expiración de sesión, whitelist de IP, política de contraseña) en ningún `ms-*`.

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/seguridad
```
```jsonc
{ "data": [{ "clave": "2fa_dinero", "label": "Exigir 2FA para roles con acceso a dinero", "descripcion": "Finanzas y Super Admin deben confirmar con doble factor en cada login.", "activo": true }] }
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/seguridad/{clave}
```
Sin body — es un toggle (el frontend lo llama con `{}`, ver `useToggleSeguridad`): el backend invierte el `activo` de esa `clave` y responde con el item actualizado (mismo shape que arriba).

**WHY / misma advertencia que Parámetros**: estas políticas solo importan si `ms-auth` las hace cumplir de verdad (rechazar login sin 2FA, expirar sesión, filtrar por IP). Documentar el endpoint de guardado es la parte fácil; la parte que le da valor real a este tab es que el servicio de auth las lea.

## 🔴 Branding — no existe (tampoco simulado con persistencia)

Igual que Seguridad: `BrandingTab.tsx` es `useState` local con 3 campos (nombre, color, logo) y un botón "Guardar cambios" que solo muestra un toast — no persiste en ningún lado, ni mock. No hay ningún sistema de white-label / branding en el repo.

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/branding
```
```jsonc
{ "nombrePlataforma": "POWIP", "colorPrimario": "#0F9D8A", "logoUrl": "https://cdn.powip.pe/brand/logo.png" }
```

```
PUT {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/branding
```
**Body:** mismo shape que el `GET` de arriba (`IBrandingConfig` completo, no parcial — el frontend manda los 3 campos siempre, ver `useGuardarBranding`).
**Response:** el `IBrandingConfig` guardado (idéntico al body si el guardado fue exitoso).

**Fuera de alcance de este doc, pero vale dejarlo anotado**: si esto es para white-labeling real (no solo cosmético en el panel de superadmin), en algún momento alguien tiene que definir cómo esto se propaga al resto de la plataforma (login, emails, PDF de comprobantes) — acá solo se documenta el CRUD que necesita este tab puntual.

## 🔴 Cupones — no existe (no confundir con `promos.service.ts`)

Se investigó específicamente si esto se solapaba con el sistema de promos existente (`src/services/promos.service.ts`, `GATEWAY.ventas` + `/promos`) — **no se solapa**. `promos.service.ts` es CRUD real de packs de descuento por volumen/bundle/gift que cada *negocio* configura para sus propios compradores (cuelga de `ms-ventas`, con `companyId`). Los cupones de este tab son a nivel Powip: descuentos sobre el signup/plan (`BIENVENIDA20`, `BLACKFRIDAY26`), sin relación con productos ni con una empresa en particular. No existe ningún sistema para esto último.

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/cupones
```
```jsonc
{ "data": [{ "id": "cup-1", "codigo": "BIENVENIDA20", "beneficio": "20% dcto. primer mes", "aplicaA": "Todos los planes", "estado": "activo", "activo": true, "usosCount": 84, "vigenteHasta": "2026-09-23T00:00:00Z" }] }
```

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/cupones
```
**Body:**
```jsonc
{ "codigo": "BLACKFRIDAY26", "beneficio": "1 mes gratis", "aplicaA": "Plan Pro y Scale" }
```
**Response:** el `ICupon` creado, con `id`, `estado` y `usosCount` asignados por el backend:
```jsonc
{ "id": "cup-9", "codigo": "BLACKFRIDAY26", "beneficio": "1 mes gratis", "aplicaA": "Plan Pro y Scale", "estado": "activo", "activo": true, "usosCount": 0 }
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/cupones/{id}
```
Sin body — es un toggle (el frontend lo llama con `{}`, ver `useToggleCupon`): el backend invierte el `activo` del cupón y responde con el `ICupon` actualizado (mismo shape que el listado).

**Falta más que el CRUD de admin**: `usosCount` solo puede ser real si existe un lado consumidor — hoy no hay ningún flujo (signup, checkout de plan) donde un prospecto pueda ingresar un código de cupón. El CRUD de este tab es la mitad fácil; la otra mitad es que el flujo de alta/checkout lo valide y lo aplique.

## 🔴 Alertas configurables — es el lado "config" de un motor que ya está documentado como faltante

Esto **no es un hallazgo nuevo** — ya está señalado en `docs/superadmin/dashboard-endpoints.md`, sección 11 ("Alertas importantes"): `GET /dashboard/alertas` depende de "el motor de alertas configurables de la Sección 8.24 de la spec (`churn > 3%`, `certificado SUNAT por vencer`, `lead sin abordar > 24h`, etc.)". Este tab es exactamente la UI de administración de esas reglas — el motor no existe, así que tampoco su configuración.

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/alertas
```
```jsonc
{ "data": [{ "id": "al-1", "nombre": "Churn mensual > 3%", "descripcion": "Notifica al equipo de Finanzas cuando el churn supera el umbral.", "activo": true, "severidad": "critical" }] }
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/alertas/{id}
```
Sin body — es un toggle (el frontend lo llama con `{}`, ver `useToggleAlerta`): el backend invierte el `activo` de la regla y responde con el `IAlertaConfig` actualizado (mismo shape que arriba).

**WHY**: no tiene sentido conectar el `PATCH` de "activar/desactivar regla" antes que el motor mismo — un switch en "on" sin motor que lo lea no dispara nada. Este endpoint y el `GET /dashboard/alertas` de la sección 11 deberían construirse juntos, no por separado.

## 🔴 Anuncios & Changelog — no existe

No hay ningún sistema de anuncios/banner/changelog en el backend (se revisaron los `*Banner*` que sí existen en el repo — `BetaBanner`, `RolePreviewBanner` — y son componentes de UI sin relación, no un sistema de contenido).

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/anuncios
```
```jsonc
{ "data": [{ "id": "an-1", "titulo": "Nuevo módulo: Reportes programados", "cuerpo": "Ahora puedes programar el envío automático de tus reportes favoritos.", "fecha": "2026-08-20T00:00:00Z", "estado": "publicado" }] }
```

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/config/anuncios
```
**Body:**
```jsonc
{ "titulo": "Próximamente: Agentes IA para ventas", "cuerpo": "Un asistente que sugiere respuestas a tus SDRs en vivo." }
```
**Response:** el `IAnuncio` creado, con `id`, `fecha` y `estado` (arranca en `"borrador"`) asignados por el backend:
```jsonc
{ "id": "an-9", "titulo": "Próximamente: Agentes IA para ventas", "cuerpo": "Un asistente que sugiere respuestas a tus SDRs en vivo.", "fecha": "2026-08-24T00:00:00Z", "estado": "borrador" }
```

**Pregunta abierta, fuera de alcance de este doc**: dónde se le muestra un anuncio "publicado" a los usuarios finales (¿banner dentro del dashboard principal?, ¿changelog dedicado?) — ese consumidor tampoco existe todavía. Acá solo se documenta el CRUD de administración que este tab necesita.

## Resumen

| Tab | Estado | Nota |
|---|---|---|
| Planes y precios | 🟡 Parcial | `GET {API_SUBS}/plans` real (nombre, precio mensual); precio anual, límite de usuarios y activo son simulados — falta `PATCH {API_SUBS}/plans/{id}` |
| Parámetros generales | 🔴 Simulado | No existe store de config genérico; además, cada flag necesita que su servicio dueño lo lea, no solo que se guarde |
| Seguridad | 🔴 Simulado | El más crudo de los 7 — hoy ni siquiera es mock, es `useState` local que se resetea al refrescar |
| Branding | 🔴 Simulado | Igual que Seguridad — `useState` local, "Guardar" no persiste en ningún lado |
| Cupones | 🔴 Simulado | No confundir con `promos.service.ts` (packs de producto por empresa, real, no relacionado). Falta CRUD de admin + un lado consumidor que valide el código |
| Alertas configurables | 🔴 Simulado | Es la config del motor de alertas ya documentado como faltante en `dashboard-endpoints.md` §11 — no tiene sentido conectarlo antes que el motor |
| Anuncios & Changelog | 🔴 Simulado | No existe sistema de anuncios en el backend; tampoco está definido dónde se consumirían del lado del usuario final |

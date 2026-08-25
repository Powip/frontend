# Suscripciones — contrato de endpoints

> Esta página es la vista de red del mismo dominio MRR/suscripción que ya cubre `docs/superadmin/dashboard-endpoints.md` (serie de 12 meses, top empresas) — no repetimos esa parte acá, solo lo que es específico de Suscripciones: la tabla completa (todas las empresas, paginada), el desglose por plan, el estado agregado y los próximos vencimientos. Comparte dominio con las páginas hermanas `docs/superadmin/finanzas-endpoints.md` (Finanzas POWIP: MRR waterfall, cohortes) y `docs/superadmin/facturacion-endpoints.md` (Facturación: facturas/cobros) — ver esos docs para lo que les corresponde a ellas, no se duplica acá.

## Hallazgo clave antes de proponer nada nuevo

`GET {NEXT_PUBLIC_API_SUBS}/subscriptions` (sin parámetros) **ya se pega hoy en producción**, sin scope por usuario — es la fuente de `src/app/api/superadmin/saas-metrics/route.ts` (línea ~45), que trae **todas** las suscripciones de la red para calcular MRR/churn agregados. Esto es distinto de `subscriptionService.getSubscriptionByUserId(token, userId)` (scoped, ya documentado en `docs/superadmin/empresas-endpoints.md` → tab Suscripción del Perfil 360) y de `getExpiringSubscriptionsAlert` (ver abajo, estado incierto).

**Por qué importa**: significa que las secciones de esta página que necesitan datos de *todas* las empresas a la vez (tabla, estado agregado, MRR por plan) no dependen de un subsistema nuevo — el ingrediente crudo (`GET /subscriptions` de ms-subscription, sin paginar, con `plan.price`/`status`/fechas) ya es alcanzable server-side. Lo que falta es exactamente lo que venimos pidiendo en cada página migrada hasta ahora (Operación, Oportunidades): un endpoint agregado, paginado, que haga el join con nombre de empresa y devuelva ya procesado — nunca que el frontend traiga la lista cruda completa y la pagine/agrupe en el cliente (mismo antipatrón de escala ya señalado en `operacion-endpoints.md` y `oportunidades-endpoints.md`).

Dos caminos igual de válidos para construirlo, y a diferencia de otras páginas esto NO requiere esperar a un equipo de backend distinto:
- **Ruta rápida**: una Next.js API route bajo `/api/superadmin/...`, igual que ya existe `saas-metrics` — reusa el mismo patrón (`GET /company` + `GET /subscriptions`, join por `userId`, paginar/agregar ahí mismo).
- **Ruta "correcta"**: un endpoint real en ms-subscription bajo `{NEXT_PUBLIC_API_SUPERADMIN}/api/v1/suscripciones/...` (join hecho en el microservicio, no en el BFF).

Documentamos las rutas propuestas con el prefijo `SUPERADMIN_API_BASE` (consistente con el resto de la spec), pero cualquiera de los dos caminos de arriba resuelve el mismo contrato.

## 🟢 Ya real — no requiere nada nuevo (referencia, no tocar)

| Sección | Cómo se resuelve hoy |
|---|---|
| MRR total, Tasa de churn, ARR (KPIs) | `useSaasMetrics` → `GET /api/superadmin/saas-metrics` (`mrr`, `churnRate`; ARR = `mrr * 12` client-side) — mismo endpoint que ya usa el Dashboard, ver `docs/superadmin/dashboard-endpoints.md`. No se vuelve a pedir. |
| Catálogo de planes (nombres, precio) | `subscriptionService.getAllPlans(token)` → `GET {API_SUBS}/plans` — real, ya en uso activo en `CompaniesView.tsx`/`metricas/superadmin`. Útil como fuente de nombres/colores de plan, no de MRR por empresa. |

```
GET {API_SUBS}/plans
```
```jsonc
// response.data directo — sin wrapper {data,meta}, shape real de `Plan` en subscriptionService.ts
[
  { "id": "9f1c2b3a-plan-pro", "name": "Pro", "description": "Plan Pro para negocios en crecimiento", "price": 179, "durationInDays": 30 },
  { "id": "7a4d8e21-plan-scale", "name": "Scale", "description": "Plan Scale para operaciones grandes", "price": 349, "durationInDays": 30 }
]
```

## 🟡 P0 — Agregaciones sobre datos que ya existen (el ingrediente ya se pega hoy)

### 1. Tabla de suscripciones por empresa

Reemplaza `getSuscripciones()` (mock puro hoy, en `src/services/superadmin/suscripcionesService.ts`, con paginación/filtro simulados sobre `suscripcionesMock`).

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/suscripciones?page=1&page_size=10&q=&estado=&plan=
```

```jsonc
{
  "data": [
    {
      "id": "uuid", "empresaId": "uuid", "empresaNombre": "Bella Piel Cosmética",
      "plan": "Pro", "mrr": 179, "ciclo": "mensual", "estado": "activa",
      "proximoPago": "2026-09-05T00:00:00Z", "metodoPago": "Tarjeta", "addOns": []
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 214, "totalPages": 22 }
}
```

**Fuente.** `GET /subscriptions` de ms-subscription (ver hallazgo arriba) × `GET /company` de ms-company, join por `userId`. **Filtro y paginación en el backend**, no en el front — con cientos de empresas, traer todo y paginar client-side es la misma regresión de performance que ya se evitó en `top-empresas` del Dashboard.

---

### 2. Estado agregado de suscripciones

Reemplaza `getEstadoSuscripcionesResumen()` (mock, cuenta `suscripcionesMock` client-side).

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/suscripciones/resumen-estado
```

```jsonc
{ "activa": 42, "trial": 5, "vencida": 3, "cancelada": 8, "nuevas30d": 6 }
```

**Fuente.** `COUNT(*) GROUP BY estado` sobre la misma base de suscripciones — barata, cacheable 15 min. `nuevas30d` cuenta por `createdAt` dentro de la ventana, mismo criterio que ya usa `saas-metrics.altas`. Alimenta tanto la card "Estado de suscripciones" como los KPIs "Activas"/"Canceladas"/"Nuevas (30d)" — un solo endpoint para ambos, no dos.

---

### 3. MRR por plan

Reemplaza `getMrrPorPlan()` (mock, agrupa `suscripcionesMock` por plan client-side).

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/suscripciones/mrr-por-plan
```

```jsonc
{ "data": [{ "plan": "Pro", "mrr": 18400, "pct": 41.2 }, { "plan": "Scale", "mrr": 12100, "pct": 27.1 }] }
```

**Fuente.** `SUM(plan.price) GROUP BY plan` sobre suscripciones activas. Es la única de las tres cards de la Sección 1 que **no** se resuelve reusando algo del Dashboard — `growth-series`/`top-empresas` no traen desglose por plan, así que esto sí es un endpoint genuinamente nuevo (aunque barato).

---

## 🟡 Compartido con Dashboard — no duplicar

### 4. MRR histórico

`MrrHistoricoCard` pide exactamente la misma serie de 12 meses que ya documenta el Dashboard en su punto 1 (`GET /dashboard/growth-series`, sección "🟢 P0 — Agregaciones sobre datos existentes"). **No se pide un segundo endpoint** — el hook de esta página reusa `useGrowthSeries()` (`src/hooks/superadmin/useDashboard.ts`) y mapea `{mes, valor}` → `{mes, mrr}` para el shape que espera `StatsChart` acá. Mismo estado que esa sección: bloqueado únicamente por la tabla `mrr_snapshot` mensual que ya se pidió ahí.

---

## 🟡 P1 — Próximos vencimientos: camino real existe, pero sin confirmar

`ProximosVencimientosCard` pide "próximos N pagos", ordenados por fecha, de cualquier empresa de la red.

`subscriptionService.getExpiringSubscriptionsAlert(token, days)` → `GET {API_SUBS}/subscriptions/expiring-soon?days=N` **ya está escrito** y, por firma, no scopea por usuario (a diferencia de `getSubscriptionByUserId`) — sugiere que es justo lo que hace falta acá: vencimientos de **toda** la red, no de una empresa. Pero no hay ninguna certeza de que funcione: es la única función de `subscriptionService.ts` que no se llama activamente en ningún lado del repo — la única referencia es un `Promise.resolve([])` con el comentario `// getExpiringSubscriptionsAlert(token, 7).catch(() => []) // Próximamente si el endpoint existe` en `src/app/metricas/superadmin/page.tsx:65`, es decir, alguien ya lo intentó y lo dejó comentado. No adivinamos por qué (¿404? ¿requiere un rol distinto? ¿nunca se probó?) — lo documentamos como camino plausible, no confirmado.

```
GET {API_SUBS}/subscriptions/expiring-soon?days=30
```
```jsonc
// response.data directo — array de SubscriptionDetail (shape real en subscriptionService.ts).
// Nota: no trae nombre de empresa, solo userId — el hook lo enriquece aparte (ver abajo).
[
  {
    "id": "sub-uuid-1",
    "userId": "user-uuid-1",
    "plan": { "id": "9f1c2b3a-plan-pro", "name": "Pro", "description": "Plan Pro para negocios en crecimiento", "price": 179, "durationInDays": 30 },
    "startDate": "2026-07-26T00:00:00Z",
    "endDate": "2026-08-30T00:00:00Z",
    "status": "ACTIVE",
    "autoRenewal": true,
    "initPoint": "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=..."
  }
]
```

**Lo que el frontend hace con esto (`useProximosVencimientos` en `useSuscripciones.ts`)**: intenta `getExpiringSubscriptionsAlert` igual que cualquier endpoint pendiente — si responde, se usa; si falla, cae al mock y queda marcado `isSimulado`. Un matiz extra: `SubscriptionDetail` (la forma que devuelve esta función) no trae nombre de empresa, solo `userId` — el hook lo resuelve enriqueciendo contra la lista de empresas ya cacheada (`getAllCompanies`, mismo "join manual" que ya documenta `docs/superadmin/empresas-endpoints.md` para el tab Suscripción del Perfil 360).

**Pedido concreto a backend**: confirmar si `GET /subscriptions/expiring-soon` existe y si de verdad es network-wide (no por-usuario) para un caller con rol admin — si existe, ya no hace falta nada más para esta card. Si no, cae bajo el mismo endpoint agregado propuesto arriba (`GET /suscripciones?estado=activa&sort=proximoPago&dir=asc&page_size=8` cubre lo mismo).

---

## Resumen

| # | Sección | Estado | Fuente / bloqueado por |
|---|---|---|---|
| — | KPIs MRR total / Churn / ARR | 🟢 Real | `saas-metrics` (compartido con Dashboard) |
| — | Catálogo de planes | 🟢 Real | `GET {API_SUBS}/plans` |
| 1 | Tabla de suscripciones (por empresa, paginada) | 🟡 Pendiente | Join `GET /subscriptions` (ms-subscription, ya real sin paginar) × `GET /company`, agregado y paginado server-side |
| 2 | Estado agregado (activa/trial/vencida/cancelada + nuevas30d) | 🟡 Pendiente | `COUNT GROUP BY estado` sobre la misma base |
| 3 | MRR por plan | 🟡 Pendiente | `SUM GROUP BY plan` — único endpoint genuinamente nuevo de esta página |
| 4 | MRR histórico (12m) | 🟡 Compartido | Reusa `growth-series` del Dashboard, no se duplica |
| 5 | Próximos vencimientos | 🟡 Incierto | `getExpiringSubscriptionsAlert` ya escrito pero nunca confirmado en uso real; fallback es el mismo endpoint agregado del punto 1 |

**Nota de alcance**: a diferencia de Operación de Red (donde "no hay nada que conectar todavía"), acá el dato crudo ya se pega en producción hoy (`saas-metrics` lo prueba) — lo que falta es exponerlo agregado y paginado, no construir un subsistema nuevo. Es, de las páginas migradas hasta ahora, la que tiene el camino más corto a "real".

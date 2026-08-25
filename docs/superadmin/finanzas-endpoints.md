# Finanzas POWIP — contrato de endpoints pendientes

> Para: Marco (backend). De: Mau (frontend).
> Esta es la vista de **P&L / ingresos SaaS de POWIP como empresa** (`/superadmin/finanzas`) — cuánto factura Powip y con cuánto MRR cierra el mes. **No confundir** con `src/components/finanzas/` (Caja & COD por tienda, otra sección del panel, ya documentada aparte en `BACKEND_REQUERIMIENTOS.md`) — no se toca nada de eso acá.
>
> Mismas convenciones que el resto de la spec: base `{NEXT_PUBLIC_API_SUPERADMIN}/api/v1/finanzas/...`, `Authorization: Bearer <jwt>`, fechas ISO-8601, moneda PEN sin formatear, error `{ "error": { "code", "message" } }`.

## Antes de leer esto: gran parte del MRR ya está resuelto en el dashboard

Esta página comparte dominio con `docs/superadmin/dashboard-endpoints.md` (MRR total, altas, churn — todo vía `GET /api/superadmin/saas-metrics`, 🟢 ya real hoy) y con las páginas hermanas en migración **Suscripciones** (`docs/superadmin/suscripciones-endpoints.md`) y **Facturación** (`docs/superadmin/facturacion-endpoints.md`), que documentan por su cuenta el ciclo de vida de la suscripción y el detalle de facturas/cobros por empresa. Acá **no se repite nada de eso** — solo se documenta lo que esta página agrega que ninguna otra cubre: el *waterfall* de MRR (nuevo/expansión/downgrade/churn), la composición de ingresos por fuente, la meta del mes, y las cohortes de retención.

Verificado antes de escribir esto (no se asume): `src/services/subscriptionService.ts` completo (113 líneas) no tiene ni una función que agregue across empresas — `getExpiringSubscriptionsAlert`, `getSubscriptionByUserId`, `getAllPlans`, `updateSubscription`, `cancelSubscription`, `createSubscription` son todas scoped a un usuario o una suscripción puntual. `src/services/salesService.ts` sí tiene `getGlobalSalesSummary` (ya real, la usa el dashboard para "Ingresos Hoy"), pero es un total de ventas de ms-ventas, no un P&L de SaaS con fuentes categorizadas. No existe en ningún backend hoy: waterfall de MRR, ingresos por fuente, ni cohortes.

| Tier | Significa |
|---|---|
| 🟢 | Ya real, o resuelto en otro doc — no requiere nada nuevo acá |
| 🟡 | Agregación nueva pero directa sobre datos existentes |
| 🔴 | Requiere snapshots históricos o una decisión de negocio antes de poder calcularse bien |

---

## 🟢 Ya real — reusar, no reconstruir

| Dato | Cómo se resuelve |
|---|---|
| MRR actual | `saas.mrr` de `GET /api/superadmin/saas-metrics` — mismo que usa `useBusinessOverview` en el dashboard. `FinanzasKpis` debe consumir esto directo en vez de derivarlo del waterfall mockeado (ver nota en sección 1). |
| Serie histórica de MRR (12m) | Si esta página necesita un gráfico de tendencia además del waterfall, es `GET /dashboard/growth-series` — no crear una segunda serie duplicada. (La serie mensual "MRR histórico" que consume la card de **Suscripciones**, `mrrHistoricoMock`/`getMrrHistoricoSuscripciones`, es de esa página, no de esta — no se toca acá.) |

---

## 🔴 1. Resumen del mes — KPIs (Facturado / Proyección de cierre / MRR actual / MRR proyectado) + Meta

`FinanzasKpis` y `MetaMesCard` hoy leen `getResumenMes()` (mock), que además **calcula mal conceptualmente**: usa el "MRR de cierre" del waterfall mockeado como si fuera "facturado este mes" — pero facturación real (efectivo cobrado: suscripciones + take rate de POWIP Payment + add-ons) y MRR (compromiso recurrente vigente) son cosas distintas y pueden no coincidir ningún mes.

```
GET /api/v1/finanzas/resumen-mes?periodo=2026-08
```

```jsonc
{
  "facturadoMes": 44120,        // efectivo/facturas emitidas en el período — suma real, no el cierre del waterfall
  "proyeccionCierre": 47800,    // proyección a fin de mes — método a definir (ver abajo)
  "mrrActual": 46530,           // idealmente el mismo campo que saas-metrics.mrr — no duplicar la fuente
  "mrrProyectado": 48900,
  "meta": 80000,
  "avancePct": 55
}
```

**MRR actual — no es un endpoint nuevo.** Debería ser literalmente `saas.mrr` de `saas-metrics` (ver tabla de arriba). Documentado acá aparte porque hoy el mock lo recalcula de forma redundante e inconsistente con el dashboard.

**Meta del mes — inconsistencia a resolver antes de construir el endpoint.** El mock de Finanzas hardcodea `META_MES = 50000` (`src/services/superadmin/finanzasService.ts`), pero `saas-metrics` **ya devuelve** `targets.mrr.meta = 80000` (`src/app/api/superadmin/saas-metrics/route.ts`, hoy también hardcodeado del lado del BFF). Son dos números distintos para lo que probablemente debería ser el mismo concepto de negocio. Antes de construir `meta`/`avancePct` acá, confirmar con Producto: ¿la meta de Finanzas es la misma `targets.mrr.meta` del dashboard, o es una meta de *facturación* (no de MRR) con su propio valor? Si son cosas distintas, deberían tener nombres distintos para no confundir a quien lea ambas páginas.

**`facturadoMes` — agregación nueva.** Suma de cobros efectivamente registrados en el período — depende de que exista una fuente real de cobros (ver sección 4, Detalle de cobros / `facturacion-endpoints.md`). Es un `SUM` con `GROUP BY` mes sobre esa tabla, no algo nuevo aparte.

**`proyeccionCierre` / `mrrProyectado` — requieren definir método.** Ninguno de los dos es una simple query: hace falta que Producto decida la fórmula (¿run-rate lineal de lo cobrado hasta la fecha? ¿MRR actual + pipeline de Suscripciones con probabilidad de cierre? ¿promedio de los últimos N meses?). Sin esa definición el número es tan inventado en backend como lo es hoy en el mock — no vale la pena construir el endpoint hasta tener la fórmula.

**Rendimiento.** Si se resuelve con una tabla de snapshots mensuales (ver sección 2), es `O(1)`. Cachear 15-30 min, no cambia dentro del día salvo por nuevos cobros.

---

## 🔴 2. MRR de cierre — Waterfall (Nuevo / Expansión / Downgrade / Churn)

`MrrWaterfallCard` necesita la variación de MRR mes a mes **desagregada por causa** — no solo el total (eso ya lo tiene `growth-series` del dashboard). Esto es estrictamente más granular que lo que `dashboard-endpoints.md` #1 propone.

```
GET /api/v1/finanzas/mrr-waterfall?periodo=2026-08
```

```jsonc
{
  "data": [
    { "label": "MRR inicial", "valor": 42800, "tipo": "inicial" },
    { "label": "Nuevo",       "valor": 5200,  "tipo": "positivo" },
    { "label": "Expansión",   "valor": 1850,  "tipo": "positivo" },
    { "label": "Downgrade",   "valor": -980,  "tipo": "negativo" },
    { "label": "Churn",       "valor": -2340, "tipo": "negativo" },
    { "label": "MRR cierre",  "valor": 46530, "tipo": "cierre" }
  ]
}
```

**Fuente de datos.** Extiende la tabla `mrr_snapshot` que ya propone `dashboard-endpoints.md` #1 (job nocturno mensual) — pero esa tabla solo guarda `{mes, mrr_total, clientes_activos}`. Para el waterfall hace falta que ese mismo job clasifique cada cambio de suscripción del mes (alta nueva, upgrade, downgrade, cancelación) y sume sus deltas de MRR en columnas separadas: `mrr_nuevo`, `mrr_expansion`, `mrr_contraccion`, `mrr_churn`. Es la **misma pieza de infraestructura**, con más columnas — no un sistema aparte. Si `mrr_snapshot` se construye primero solo con el total (como pide el dashboard), agregar estas 4 columnas después es incremental, no un rediseño.

**Alternativa sin snapshot (no recomendada salvo urgencia).** Reconstruir on-the-fly comparando `suscripcion.estado`/`suscripcion.mrr` actual contra su estado hace 30 días vía `updated_at`/`historial_cambios` si existiera una tabla de auditoría de cambios de suscripción — más frágil (depende de que cada cambio quede loggeado con motivo) y no escala.

**Rendimiento.** Con snapshot, `SELECT` de una fila por período — trivial. Cachear 1h.

---

## 🔴 3. Ingresos por fuente (Suscripciones / POWIP Payment / Add-ons)

`IngresosFuenteCard` necesita el ingreso del mes categorizado por origen — hoy no existe ningún concepto de "add-on" como línea de ingreso separada en el backend real (el mock lo modela como `suscripcion.addOns: string[]`, pero no hay pricing ni facturación de add-ons implementada en `ms-subscription`).

```
GET /api/v1/finanzas/ingresos-fuente?periodo=2026-08
```

```jsonc
{
  "data": [
    { "fuente": "Suscripciones",  "monto": 38400, "pct": 71 },
    { "fuente": "POWIP Payment",  "monto": 11200, "pct": 21 },
    { "fuente": "Add-ons",        "monto": 4300,  "pct": 8 }
  ]
}
```

**Fuente por categoría:**
- **Suscripciones** — cobros de `ms-subscription` del período. Ya hay algo de esto (facturas/cobros, ver sección 4).
- **POWIP Payment** — take rate de Powip sobre pagos procesados vía la pasarela propia en `ms-ventas`. Requiere que ms-ventas exponga el monto de comisión retenido por transacción (no el GMV total, que ya se usa para otra cosa) agregado por período — a confirmar si ese dato ya se calcula en algún lado o hay que empezar a registrarlo.
- **Add-ons** — bloqueado por algo más de fondo: **hoy no hay add-ons como entidad facturable real**. Antes de pedir este endpoint hace falta que `ms-subscription` (o donde corresponda) modele add-ons con su propio precio y ciclo de cobro. Mientras tanto, este segmento queda en 0 o simulado, no hay atajo honesto.

**Rendimiento.** `GROUP BY fuente` sobre cobros del período — barata una vez que existan las 3 fuentes reales. Cachear 15-30 min.

---

## 🟡 4. Detalle de cobros

`CobrosTable` es una vista resumida (ID / empresa / monto / estado / fecha) de los mismos cobros que **Facturación** va a manejar en detalle (con reintentos, días vencida, IGV, etc. — ver `docs/superadmin/facturacion-endpoints.md`). No tiene sentido que Finanzas defina su propia fuente de cobros en paralelo a la de Facturación — mismo dato, dos vistas.

**Pedido concreto**: que el endpoint que exponga Facturación para el listado de cobros/facturas soporte también esta vista (mismos campos que ya usa el mock — `id`, `empresaNombre`, `monto`, `estado`, `fecha` — es un subconjunto de lo que Facturación va a necesitar de todos modos), o que Finanzas simplemente reutilice ese mismo endpoint con `page_size` chico en vez de tener uno propio bajo `/finanzas/cobros`. Evita mantener dos fuentes de verdad para lo mismo, el mismo problema que ya se evitó entre Dashboard y esta página para MRR.

**Mientras Facturación no defina su endpoint**, si hace falta destrabar Finanzas primero, el placeholder es:

```
GET /api/v1/finanzas/cobros?periodo=2026-08&limit=20
```

```jsonc
{ "data": [{ "id": "FAC-2026-0001", "empresaNombre": "Bella Piel Cosmética", "monto": 179, "estado": "pagado", "fecha": "2026-08-05T00:00:00Z" }] }
```

`estado` incluye `"proyectado"` además de `pagado`/`pendiente`/`vencido` (cobros esperados pero no vencidos aún) — confirmar si ese estado lo calcula el backend o es puramente derivado en frontend de `fechaVence > hoy`.

---

## 🔴 5. Retención por cohorte de alta (Sección 8.22)

`CohortesTable` necesita, para cada mes de alta de empresas, qué % sigue activo N meses después. Esto es un cálculo de series temporales sobre altas/bajas históricas — no existe en ningún backend hoy, y **no se puede reconstruir bien sin snapshots** (igual que el MRR histórico): para saber si una empresa que se dio de alta en marzo seguía activa en junio hace falta el estado de esa empresa en junio, no solo el estado actual.

```
GET /api/v1/finanzas/cohortes?meses=6
```

```jsonc
{
  "data": [
    { "mes": "Mar 2026", "tamano": 18, "retencion": [100, 94, 89, 83, 78, 78] },
    { "mes": "Abr 2026", "tamano": 22, "retencion": [100, 91, 86, 82, 79] }
    // ... cada array de retención tiene tantos puntos como meses transcurridos desde el alta
  ]
}
```

**Fuente de datos.** Reutiliza la misma tabla `mrr_snapshot` (o su equivalente de "empresas activas por mes") de la sección 2 / `dashboard-endpoints.md` #1, pero cruzada por `mes_alta` de cada empresa en vez de por mes calendario: `SELECT mes_alta, mes_snapshot, COUNT(*) FILTER (WHERE estado = 'activa') FROM empresa JOIN mrr_snapshot_empresa ... GROUP BY mes_alta, mes_snapshot`. Requiere que el snapshot se guarde **por empresa**, no solo el agregado total — un nivel más de detalle que lo mínimo que pide el dashboard. Vale la pena decidir esto de una vez si de todos modos se va a construir la infraestructura de snapshots (secciones 1, 2 y 5 de este doc, más `dashboard-endpoints.md` #1, todas la necesitan).

**Rendimiento.** Con snapshot por empresa, agregación simple pero sobre una tabla que crece con el tiempo (empresas × meses) — indexar por `(mes_alta, mes_snapshot)`. Cachear 1h, no cambia intrames salvo el mes en curso.

---

## Resumen para planificar

| # | Sección | Tier | Bloqueado por |
|---|---|---|---|
| — | MRR actual (KPI) | 🟢 | Nada — reusar `saas-metrics.mrr`, ya real |
| 1 | `GET /finanzas/resumen-mes` (facturado / proyección / meta) | 🔴 | Fórmula de proyección (definición de negocio) + fuente de cobros (#4) + resolver inconsistencia de `meta` con `saas-metrics.targets.mrr.meta` |
| 2 | `GET /finanzas/mrr-waterfall` | 🔴 | Extender `mrr_snapshot` (dashboard #1) con columnas por causa de variación |
| 3 | `GET /finanzas/ingresos-fuente` | 🔴 | Take rate agregado en ms-ventas + add-ons no existen como entidad facturable todavía |
| 4 | Detalle de cobros | 🟡 | Definir con Facturación quién es dueño del endpoint (evitar duplicar fuente) |
| 5 | `GET /finanzas/cohortes` | 🔴 | Snapshot mensual **por empresa** (no solo agregado), mismo esfuerzo base que #2 |

**Nota de secuencia**: 2, 3 y 5 comparten la misma pieza de infraestructura de fondo (snapshots históricos con más detalle del que pide `dashboard-endpoints.md` #1) — vale la pena que backend las planifique juntas en vez de una por una. 1 y 4 dependen de que esas piezas (o las de Facturación) existan primero; no tiene endpoint propio que valga la pena construir antes.

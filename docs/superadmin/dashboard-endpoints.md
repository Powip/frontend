# Dashboard de Super Admin — contrato de endpoints pendientes

> Para: Marco (backend). De: Mau (frontend).
> El frontend de `/superadmin/dashboard` ya está armado y **ya está apuntando a estos endpoints** vía hooks en `src/hooks/superadmin/useDashboard.ts`. Hoy fallan (404 / no existen) y la UI lo muestra con un badge rojo "Simulado" mostrando datos de ejemplo. En cuanto cada endpoint responda con el shape descripto acá, el dato real reemplaza al simulado **sin tocar nada del frontend**.
>
> Base URL nueva: `NEXT_PUBLIC_API_SUPERADMIN` (variable de entorno a crear — hoy no existe ningún microservicio dueño de estos datos, son agregados propios del panel de Super Admin). Todas las rutas de este documento van montadas bajo esa base, versionadas: `{NEXT_PUBLIC_API_SUPERADMIN}/api/v1/dashboard/...`.
>
> Convenciones (igual que el resto de la spec): `Authorization: Bearer <jwt>`, fechas ISO-8601, moneda PEN sin formatear (número plano, el front formatea), paginación `page`/`page_size` (default 25) donde aplica, respuesta de error `{ "error": { "code", "message" } }` con status HTTP correcto.

## Cómo priorizamos esta lista

Dos ejes: **costo de implementación** (¿ya existe el dato en algún lado, o hay que construir algo nuevo?) y **impacto** (¿lo ve el CEO todos los días?). De más barato/alto-impacto a más caro/nuevo-subsistema:

| Tier | Significa |
|---|---|
| 🟢 P0 | Agregación sobre datos que YA existen en ms-company / ms-ventas / ms-subscription. Es "solo" una query nueva. |
| 🟡 P1 | Agregación posible pero requiere una decisión de negocio o un cálculo que hoy no está definido (ej. "riesgo", "salud"). |
| 🔴 P2 | Requiere un subsistema nuevo que hoy no existe en ningún backend (tracking de eventos, tracking de producto, tabla de tareas). No es "una query", es una feature. |

---

## 🟢 Ya real — no requiere nada nuevo (referencia, no tocar)

Estos ya funcionan hoy con datos reales, se listan solo para que quede documentado qué NO hace falta construir:

| Sección | Cómo se resuelve hoy |
|---|---|
| MRR, Clientes activos, Nuevos, Churn | `GET /api/superadmin/saas-metrics` (Next.js BFF ya existente, agrega ms-company + ms-ventas + ms-subscription) |
| Ingresos Hoy | `salesService.getGlobalSalesSummary(token, from, to)` acotado al día — ya real, ms-ventas |
| Embudo comercial | `GET /api/superadmin/conversion-funnel` (Next.js BFF ya existente, Supabase `leads` + ms-company) |

---

## 🟢 P0 — Agregaciones sobre datos existentes

### 1. Serie de crecimiento (MRR + Clientes activos, 12 meses)

Reemplaza a los charts "MRR 12m" y "Clientes activos 12m" del mock.

```
GET /api/v1/dashboard/growth-series?meses=12
```

**Response:**
```jsonc
{
  "mrr": [{ "mes": "Mar", "valor": 38200 }, /* ... 12 puntos */],
  "clientesActivos": [{ "mes": "Mar", "valor": 14 }, /* ... 12 puntos */]
}
```

**Fuente de datos.** Necesita un snapshot mensual de MRR y de clientes activos — **no se puede calcular bien on-the-fly** desde el estado actual de `ms-subscription` (no sabés cuánto MRR había hace 6 meses si no lo guardaste). Dos caminos:
- **Recomendado**: un job nocturno que el día 1 de cada mes guarda `{mes, mrr_total, clientes_activos}` en una tabla propia (`mrr_snapshot` o similar). La query de este endpoint es un `SELECT` trivial sobre esa tabla — barata y rápida para siempre.
- Alternativa (sin tabla nueva): reconstruir aproximado desde `created_at`/`cancelled_at` de suscripciones — funciona pero es una query pesada (recorre histórico completo) y no escala con el tiempo. No lo recomendamos pasado el primer mes de campañas de captación.

**Rendimiento.** Con la tabla de snapshots, este endpoint es O(1) casi siempre (12-24 filas). Cachear 1h en el borde (CDN/edge) es razonable — no cambia más de una vez al día.

---

### 2. Top empresas por MRR

Reemplaza la card "Clientes (Empresas)" — hoy usa `empresasMock`, con nombres reales-parecidos pero MRR y plan inventados. Es la card más engañosa del dashboard actual, priorizarla.

```
GET /api/v1/dashboard/top-empresas?limit=6
```

**Response:**
```jsonc
{
  "data": [
    {
      "empresaId": "uuid",
      "nombre": "Bella Piel Cosmética",
      "logoIniciales": "BP",
      "plan": "Pro",
      "mrr": 179,
      "estado": "activo"
    }
    // ...
  ]
}
```

**Fuente.** JOIN `empresa` × `suscripcion` (ms-company + ms-subscription), `ORDER BY mrr DESC LIMIT :limit`.

**Rendimiento — importante.** El límite lo aplica el backend con `LIMIT` en la query, **nunca** "traer todas las empresas y cortar en el front" — con miles de negocios eso es exactamente el tipo de regresión de performance que hay que evitar. Índice sugerido: `suscripcion(mrr DESC)` o vista materializada si el JOIN es costoso a escala.

---

### 3. Canales de venta de la red

```
GET /api/v1/dashboard/canales-red
```

**Response:**
```jsonc
{
  "canales": [
    { "canal": "WhatsApp", "count": 18, "pct": 75 },
    { "canal": "Web", "count": 9, "pct": 38 }
    // ...
  ],
  "oportunidad": {
    "titulo": "Priorizar integración nativa con TikTok Shop",
    "motivo": "El 21% de los negocios ya vende por TikTok sin integración directa."
  }
}
```

**Fuente.** `empresa.canales_venta` ya existe como campo (`string[]`) según el modelo de datos de la spec — es un `GROUP BY unnest(canales_venta)` sobre `ms-company`. El campo `oportunidad` puede quedar hardcodeado/editorial por ahora (no hace falta que sea calculado), o vincularlo más adelante a integraciones no conectadas.

**Rendimiento.** Agregación simple, cacheable 1h.

---

## 🟡 P1 — Necesitan una definición de negocio antes de la query

### 4. Composición de clientes (donut)

⚠️ **La spec original pide segmentos "Recurrentes / Nuevos / Reactivados / En riesgo / En trial", pero hoy `ms-subscription` no modela el estado "trial" en absoluto** (confirmado: solo `ACTIVE/PENDING_PAYMENT/CANCELLED/INACTIVE/EXPIRED`). Sugerimos redefinir los segmentos a algo que el backend sí puede calcular hoy, y ajustar el nombre del componente si Producto está de acuerdo:

```
GET /api/v1/dashboard/clientes-composicion
```

**Response sugerida:**
```jsonc
{
  "segmentos": [
    { "segmento": "Recurrente (>1 mes activo)", "count": 12, "pct": 50 },
    { "segmento": "Nuevo (alta este mes)",        "count": 6,  "pct": 25 },
    { "segmento": "Pago pendiente / en mora",      "count": 3,  "pct": 12 },
    { "segmento": "Cancelado este mes",            "count": 3,  "pct": 13 }
  ]
}
```

Si Producto insiste en mantener "En trial" tal cual la spec, es un bloqueador: primero hay que modelar `TRIAL` como estado real en `ms-subscription` (con su propia fecha de expiración), no algo que el frontend pueda inventar.

**Rendimiento.** Agregación con `COUNT(*) GROUP BY` sobre suscripciones — barata, cachear 15-30 min.

---

### 5. Clientes en riesgo

```
GET /api/v1/dashboard/clientes-riesgo?limit=10
```

**Response:**
```jsonc
{
  "data": [
    { "empresaId": "uuid", "empresaNombre": "TecnoHogar Express", "motivo": "Pedidos bajaron 40% y tiene una factura vencida" }
  ]
}
```

**Depende de.** El `health_score` que define la Sección 12 de la spec (`f(uso_DAU, pedidos_30d, pagos_al_dia, tickets_abiertos)`) — si ese cálculo no existe todavía, este endpoint no se puede construir "bien". MVP sin health_score: definir riesgo como regla simple y documentada (ej. `pedidos_30d` cayó >30% vs. mes anterior, O tiene factura vencida >7 días) — más tosco pero ya es real y no una lista inventada.

**Rendimiento.** Si se calcula con reglas simples sobre datos existentes, es una query normal con `LIMIT`. Si depende de `health_score`, ese score debería **precalcularse** (job periódico, no on-request) — comparar `pedidos_30d` en tiempo real para miles de empresas en cada carga del dashboard sería costoso.

---

### 6. Salud de la plataforma (integraciones)

Hoy el frontend ya consume `ms-integrations`, pero solo con endpoints de `connection-test` **por vendor y por empresa individual** (Shopify, Shalom, EVA, Aliclik, Yavendio) — no existe un agregado de "estado global de la plataforma".

```
GET /api/v1/dashboard/salud-integraciones
```

**Response:**
```jsonc
{
  "integraciones": [
    { "id": "shopify", "nombre": "Shopify", "categoria": "Ecommerce", "estado": "operativo", "uptimePct": 99.8, "ultimoEvento": "2026-08-20T14:00:00Z" }
    // Meta, Mercado Pago, SUNAT/OSE, Shalom, Olva, WhatsApp Business API...
  ],
  "uptimePromedio": 98.6
}
```

**Fuente.** Esto requiere que `ms-integrations` guarde un log de resultados de sus propios health-checks / webhooks por vendor (no por empresa) para poder calcular uptime — probablemente ya loguea errores en algún lado; la propuesta es exponer un resumen agregado en vez de que el front tenga que pegarle a N endpoints por-empresa (que además no da "salud de la plataforma", da "salud de UNA empresa").

**Rendimiento.** Debe ser un `SELECT` sobre un estado ya mantenido/cacheado en `ms-integrations`, nunca hacer los health-checks reales en el momento del request del dashboard (eso sí sería lento y le pegaría innecesariamente a Shopify/SUNAT/etc. cada vez que alguien abre el panel).

---

## 🔴 P2 — Requieren un subsistema nuevo (no es "una query")

Estos no son endpoints chicos — son features de backend nuevas. Los documentamos igual para que quede explícito el alcance, pero no deberían bloquear el resto.

### 7. Actividad en tiempo real (feed)

```
GET /api/v1/dashboard/actividad?limit=10
```

```jsonc
{
  "data": [
    { "id": "uuid", "actorNombre": "Heidy Medina", "accion": "convirtió el lead", "referencia": "Belleza Andina Store", "ts": "2026-08-20T18:40:00Z" }
  ]
}
```

**Requiere.** Un event log / audit trail real (la spec ya lo pide en Sección 13, "Eventos del sistema" — `empresa_creada`, `plan_cambiado`, `lead_convertido`, etc., cada uno con su `audit_log`). Este endpoint es básicamente "las últimas N filas de esa tabla de eventos, ordenadas por fecha". **Si `audit_log` (Sección 4.15 / 14 de la spec) se construye primero, este endpoint sale casi gratis después.**

**Rendimiento — crítico.** `LIMIT` obligatorio en el backend (nunca traer todo el historial), índice en `(ts DESC)`, y evaluar paginación cursor-based en vez de offset si el volumen de eventos crece mucho (offset pagination se degrada con tablas grandes).

### 8. Centro de Acción (tareas)

```
GET /api/v1/dashboard/centro-accion
PATCH /api/v1/dashboard/centro-accion/{id}   body: { "hecho": true }
```

```jsonc
{ "data": [{ "id": "uuid", "texto": "Contactar a TecnoHogar Express (riesgo alto)", "prioridad": "Alta", "hecho": false }] }
```

**Requiere.** Una tabla `tarea_admin` real con dueño/asignación — hoy no existe. Podría alimentarse en parte de reglas automáticas (ej. auto-generar una tarea cuando una empresa entra en `clientes-riesgo`) más tareas manuales creadas por el equipo.

### 9. KPIs de producto (DAU/WAU/MAU) y Adopción de módulos

```
GET /api/v1/dashboard/producto-kpis
GET /api/v1/dashboard/adopcion-modulos
```

**Requiere.** Tracking de uso real (qué usuario entró, qué módulo tocó, cuándo) — no existe ninguna instrumentación de producto hoy en el stack. Es el ítem más caro de toda la lista; probablemente vale la pena resolverlo con una herramienta de analítica de producto ya armada (Amplitude/Mixpanel/PostHog) antes que construir tracking propio, y que este endpoint simplemente proxyee/agregue esos datos.

### 10. Soporte & Experiencia (tickets, CSAT)

```
GET /api/v1/dashboard/soporte-resumen
```

```jsonc
{ "ticketsAbiertos": 6, "tiempoRespuestaPromedioMin": 38, "csat": 4.6 }
```

**Requiere.** El módulo de Soporte (Sección 8.15 de la spec) todavía no tiene backend real tampoco — este resumen depende de que `ticket` exista como entidad real primero.

### 11. Alertas importantes

```
GET /api/v1/dashboard/alertas
```

```jsonc
{ "data": [{ "id": "uuid", "texto": "TecnoHogar Express bajó sus ventas 40% este mes", "severidad": "critical", "ts": "2026-08-20T16:00:00Z" }] }
```

**Requiere.** El motor de "alertas configurables" de la Sección 8.24 de la spec (`churn > 3%`, `certificado SUNAT por vencer`, `lead sin abordar > 24h`, etc.) — este endpoint es la bandeja de las alertas que ese motor ya disparó. Depende de que ese motor exista; mientras tanto puede devolver un subconjunto simple (ej. solo las derivadas de `clientes-riesgo` del punto 5) sin esperar el motor completo.

---

## Resumen para planificar sprints

| # | Endpoint | Tier | Bloqueado por |
|---|---|---|---|
| 1 | `GET /dashboard/growth-series` | 🟢 P0 | Nada — solo falta la tabla de snapshots |
| 2 | `GET /dashboard/top-empresas` | 🟢 P0 | Nada |
| 3 | `GET /dashboard/canales-red` | 🟢 P0 | Nada |
| 4 | `GET /dashboard/clientes-composicion` | 🟡 P1 | Definir segmentos (no hay "trial" real) |
| 5 | `GET /dashboard/clientes-riesgo` | 🟡 P1 | `health_score` (o una regla simplificada MVP) |
| 6 | `GET /dashboard/salud-integraciones` | 🟡 P1 | Agregación nueva sobre `ms-integrations` |
| 7 | `GET /dashboard/actividad` | 🔴 P2 | `audit_log` / event log (Sección 13/14 de la spec) |
| 8 | `GET/PATCH /dashboard/centro-accion` | 🔴 P2 | Tabla `tarea_admin` nueva |
| 9 | `GET /dashboard/producto-kpis` + `/adopcion-modulos` | 🔴 P2 | Tracking de producto (evaluar herramienta externa) |
| 10 | `GET /dashboard/soporte-resumen` | 🔴 P2 | Módulo Soporte / entidad `ticket` |
| 11 | `GET /dashboard/alertas` | 🔴 P2 (parcial antes) | Motor de alertas configurables (Sección 8.24) |

Sugerencia de orden: **1, 2, 3** primero (una tarde de trabajo cada uno, alto impacto visual inmediato) → **4, 5, 6** (requieren una reunión corta de definición de negocio antes de codear) → **7, 8, 9, 10, 11** se planifican junto con los módulos de los que dependen (Auditoría, Centro de Acción como feature propia, Analítica de producto, Soporte, Alertas configurables), no como parte del sprint de Dashboard.

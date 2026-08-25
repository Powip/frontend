# Auditoría — contrato de endpoints pendientes

> Para: Marco (backend). De: Mau (frontend).
> El frontend de `/superadmin/auditoria` ya está armado y **ya apunta a este endpoint** vía `src/hooks/superadmin/useAuditoria.ts`. Hoy no existe (network error / 404) y la UI lo muestra con badge rojo "Simulado" sobre datos de ejemplo. En cuanto el endpoint responda con el shape descripto acá, el dato real reemplaza al simulado **sin tocar nada del frontend**.

## No es una tabla nueva — es la MISMA que ya pedimos en el Dashboard

`docs/superadmin/dashboard-endpoints.md`, sección 7 ("Actividad en tiempo real"), ya pide un `audit_log` / event log real (la spec lo menciona en Sección 13/14: `empresa_creada`, `plan_cambiado`, `lead_convertido`, etc., cada acción con su propia fila). Ese feed del dashboard es, literalmente, `SELECT * FROM audit_log ORDER BY ts DESC LIMIT 10` — las últimas N filas de esa tabla.

Esta página es la contracara: en vez de "las últimas 10", necesita **browsear/filtrar/buscar el historial completo** de esa misma tabla. No proponemos una tabla nueva ni un subsistema paralelo — es el contrato completo de consulta sobre el `audit_log` que dashboard-endpoints.md ya especificó. Si el backend construye `audit_log` primero para el feed del dashboard, este endpoint sale casi gratis después (mismo query base + filtros + paginación).

## Esto NO es "Logs del sistema"

Hay otra página en curso, `/superadmin/logs` (doc en paralelo: `docs/superadmin/logs-endpoints.md`), que también depende de un "log centralizado" — pero es un animal distinto:

| | Auditoría (esta página) | Logs del sistema (`/superadmin/logs`) |
|---|---|---|
| Qué registra | Acciones de negocio de un **actor humano** (usuario interno de Powip) | Eventos **técnicos/infra** por microservicio |
| Ejemplo de fila | "Mauricio Tognoli cambió el plan de Bella Piel Cosmética de Basic a Pro" | "Timeout al conectar con proveedor de pagos (5000ms) — ms-ventas" |
| Campos clave | `actorId`, `accion`, `entidad`/`entidadId`, `antes`/`despues`, `ip` | `nivel` (info/warn/error), `servicio`, `mensaje` |
| Tabla propuesta | `audit_log` (ver dashboard-endpoints.md §7) | tabla/índice de logs propia de cada `ms-*` (fuera del alcance de este doc) |

Ambas páginas comparten la idea de "necesitamos un log centralizado real en vez de mocks", pero son dos tablas y dos dueños de dato distintos. No las mezclamos: este documento cubre únicamente `audit_log` (acción de negocio).

## Verdict: 🔴 nada de esto es real hoy

Grepeamos `src/services`, `src/api` y `src/app/api/superadmin/**` buscando cualquier lugar que ya escriba una fila de auditoría cuando un admin hace algo (`updateCompany`/`deleteCompany` en `companyService.ts`, cualquier ruta de `src/app/api/superadmin/*`, impersonación, etc.). **No hay ninguno.** Coincide con lo ya confirmado en dashboard-endpoints.md §7: el `audit_log` no existe todavía en ningún backend, ni como tabla ni como side-effect de las acciones actuales. Todo lo que sigue es 🔴 P2 — depende de que ese subsistema se construya.

## Endpoint propuesto — listado filtrado y paginado

Mismo base path que el resto del panel de Super Admin (no el de dashboard, para dejar claro que es un recurso propio con su propio ciclo de filtros/paginación, no un sub-recurso de `/dashboard`):

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/auditoria?actor_id=&entidad=&accion=&desde=&hasta=&q=&cursor=&limit=25
```

Filtros — todos opcionales y combinables:

| Param | Significado |
|---|---|
| `actor_id` | Filtra por el usuario interno que hizo la acción |
| `entidad` | Filtra por tipo de entidad afectada (`empresa`, `comision`, `usuario_empresa`, `config_programa`, ...) |
| `accion` | Filtra por acción exacta (`plan_cambiado`, `impersonacion`, ...) |
| `desde` / `hasta` | Rango de fechas ISO-8601 sobre `ts` |
| `q` | Búsqueda libre (actor, acción, entidad) — mismo criterio que `matchesQuery` usa hoy client-side sobre el mock |
| `cursor` / `limit` | Paginación (ver "Por qué cursor" abajo). Default `limit=25` |

**Response:**
```jsonc
{
  "data": [
    {
      "id": "uuid",
      "actorId": "uuid-interno",
      "actorNombre": "Mauricio Tognoli",
      "accion": "plan_cambiado",
      "entidad": "empresa",
      "entidadId": "uuid-empresa",
      "antes": { "plan": "Basic" },
      "despues": { "plan": "Pro" },
      "ip": "190.23.114.8",
      "ts": "2026-08-20T18:40:00Z"
    }
    // ...
  ],
  "nextCursor": "opaque-cursor-string-or-null"
}
```

El shape de cada fila es exactamente `IAuditLog` (`src/interfaces/superadmin/IPlataforma.ts`), ya usado hoy por el mock (`auditLogMock`, `src/mocks/superadmin/plataforma.ts`).

### No hace falta un endpoint de "detalle" aparte

A diferencia de otras páginas (ej. Perfil 360 de empresa), acá el detalle de un evento (quién, antes/después, IP) **ya viene completo en la fila del listado** — no es un resumen que haya que expandir con un segundo request. `GET /auditoria/{id}` quedaría redundante salvo que a futuro `antes`/`despues` empiecen a guardar diffs muy grandes (ej. el JSON completo de una empresa) y convenga no mandarlos en el listado — si eso pasa, ahí sí tiene sentido separar "fila liviana" de "detalle pesado bajo demanda". No es el caso hoy con los 5 tipos de acción del mock.

### Por qué cursor y no `page`/`page_size`

El resto del panel usa `page`/`page_size` (offset pagination) porque son tablas acotadas (empresas, leads). Un log de auditoría es distinto: crece indefinidamente y de forma append-only, y es exactamente el escenario donde offset pagination se degrada (ir a la página 500 implica que la DB escanee y descarte las primeras ~12,500 filas). Dashboard-endpoints.md §7 ya señala esto mismo para el feed de actividad ("evaluar paginación cursor-based si el volumen crece"); acá, donde el caso de uso es justamente navegar el historial completo, no es "evaluar" — es el diseño correcto desde el día uno. Cursor sugerido: opaco, codificando `(ts, id)` del último registro devuelto, con índice compuesto `(ts DESC, id)` en `audit_log`.

**Rendimiento — importante.** Igual que en dashboard §7: `LIMIT` obligatorio en el backend, nunca "traer todo y filtrar en el front" — con miles de acciones administrativas acumuladas, esa tabla puede volverse grande rápido (cada cambio de plan, impersonación, edición de comisión, etc. es una fila). Los filtros (`actor_id`, `entidad`, `accion`, rango de fechas) deben aplicarse en la query, no client-side, para que sean útiles a escala.

## Resumen

| Ítem | Estado | Bloqueado por |
|---|---|---|
| Listado filtrado + paginado (`GET /auditoria`) | 🔴 P2 | `audit_log` no existe — mismo gap que dashboard-endpoints.md §7 |
| Detalle de un evento (antes/después/IP) | — | Ya viene incluido en cada fila del listado, no hace falta endpoint propio |
| Feed corto del dashboard (`GET /dashboard/actividad`) | 🔴 P2 (ya documentado) | Mismo `audit_log` — se resuelve solo si el backend prioriza esta tabla |
| Página "Logs del sistema" (`/superadmin/logs`) | Fuera de alcance de este doc | Tabla distinta — ver `docs/superadmin/logs-endpoints.md` |

**Sugerencia de orden**: si `audit_log` se prioriza, conviene construir primero el endpoint de este doc (listado filtrado/paginado) y no el de dashboard §7 — es un superset funcional (el feed del dashboard es un caso particular: `GET /auditoria?limit=10` sin filtros). Evita construir dos endpoints para la misma tabla.

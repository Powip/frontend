# Logs del sistema — contrato de endpoints

> Esta página es **logs técnicos/de infraestructura** — eventos por microservicio con severidad (`info`/`warn`/`error`), ej. "ms-ventas: timeout al llamar a ms-courier". **No es lo mismo que Auditoría** (`docs/superadmin/auditoria-endpoints.md`, en progreso en paralelo): Auditoría es la bitácora de negocio de "quién hizo qué a qué entidad" (`plan_cambiado`, `impersonacion`, con `antes`/`despues`) sobre una tabla tipo `audit_log`. Ambas páginas terminan pidiendo el mismo tipo de inversión de backend — "un lugar centralizado donde consultar eventos" — pero el CONTENIDO es distinto (técnico vs. negocio) y, como se explica abajo, la solución correcta probablemente tampoco es la misma pieza de infraestructura. No confundir los dos docs.

## 🔴 Simulado — y no es solo un endpoint que falta

A diferencia de Seguimiento u Operación (donde el dato existe pero no está agregado o expuesto), acá el problema es más de fondo: **no hay ninguna razón para que el backend de Powip construya desde cero un endpoint REST que devuelva logs de aplicación**. Es un tipo de necesidad distinto al resto del panel.

**Qué confirmamos.** Cada microservicio (`ms-auth`, `ms-company`, `ms-products`, `ms-ventas`, `ms-logistics`, `ms-courier`, `ms-subscription`, `ms-integrations`) casi seguro ya loguea internamente (consola / lo que capture su plataforma de hosting), pero no hay ningún rastro en este repo de una integración de observabilidad (grep sin resultados sobre `datadog`, `cloudwatch`, `grafana`, `loki`, `sentry`, `newrelic`, etc.) ni de una variable de entorno para eso. Tampoco existe hoy ninguna tabla/servicio compartido donde un microservicio escriba un log consultable por otro — cada uno vive en su propio proceso/infra.

**Por qué no es "solo otra query agregada".** El resto de páginas migradas piden endpoints agregados porque el dato de negocio YA vive en una base de datos que el backend puede consultar (empresas, leads, suscripciones). Acá el "dato" son líneas de log de N procesos corriendo en N lugares — eso normalmente **no se resuelve con un endpoint REST bespoke que el frontend hace polling**, se resuelve con una plataforma de agregación de logs (Datadog, Grafana Loki, CloudWatch Insights, o similar), que ya está diseñada para ingestión de alto volumen, retención, búsqueda full-text e índices por servicio/severidad/tiempo — cosas que reinventar en un backend propio es caro y, comparado con adoptar una herramienta ya armada, no aporta nada distinto.

**Las dos rutas posibles, honestamente:**

### Opción A (recomendada) — usar una herramienta de observabilidad ya armada

Si Powip adopta (o ya tiene, aunque no esté conectado a este panel) Datadog / Grafana Loki / CloudWatch Insights / similar, y cada microservicio empieza a emitir logs estructurados ahí con tags (`service`, `level`, `empresa_id` cuando aplique), esta página deja de necesitar backend propio de Powip:

- **Mejor caso**: iframe/embed del dashboard de esa herramienta directamente en `/superadmin/logs` (la mayoría de estas plataformas soporta embeds con filtro preconfigurado por severidad/servicio).
- **Alternativa si se quiere mantener el look & feel del panel**: el frontend (o un BFF delgado) consulta la API de esa herramienta (ej. Datadog Logs API, Loki `query_range`) en vez de una base propia — sigue siendo "no construir nada nuevo", solo un proxy fino de autenticación.

Esto también evacúa gratis el problema de "¿dónde vive esto de forma escalable/con retención?" — ya viene resuelto por la herramienta.

### Opción B — endpoint propio (stopgap/MVP, NO la ideal)

Si el equipo decide que no vale la pena adoptar una herramienta externa todavía, la alternativa mínima es que cada microservicio escriba sus logs (o al menos los de nivel `warn`/`error`, o eventos elegidos a mano) en una tabla compartida, y exponer eso vía un endpoint agregado propio del panel — el mismo patrón `NEXT_PUBLIC_API_SUPERADMIN` que el resto de páginas:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/logs?nivel=&servicio=&empresa_id=&page=&page_size=25
```

```jsonc
{
  "data": [
    {
      "id": "uuid",
      "ts": "2026-08-24T14:02:00Z",
      "nivel": "error",
      "servicio": "ms-ventas",
      "mensaje": "Timeout al conectar con proveedor de pagos (5000ms)",
      "empresaId": "uuid-ms-company",
      "empresaNombre": "TecnoHogar Express"
    }
  ],
  "page": 1,
  "totalPages": 12
}
```

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/logs/kpis
```

```jsonc
{ "total": 1840, "info": 1520, "warn": 260, "error": 60 }
```

Filtrado (`nivel`, `servicio`, `empresa_id`) y paginación en el backend — igual que en el resto del panel, nunca traer todo el historial y cortar en el front (acá aplica más que en ningún otro lado: volumen de logs crece rápido).

**Por qué la marcamos "no ideal" igual siendo un endpoint concreto**: aunque se construya, sigue siendo Powip reconstruyendo a mano lo que una plataforma de logs ya resuelve mejor (retención, búsqueda full-text, alertas sobre picos de error, correlación entre servicios). Es aceptable como puente si se necesita algo ya, pero no debería ser el diseño final si en algún momento se adopta una herramienta real.

**Decisión pendiente de Producto/Infra antes de construir cualquiera de las dos**: cuál de las dos rutas se toma. No tiene sentido que el frontend elija — cambia qué se le pide a cada microservicio (tags/SDK de una plataforma vs. escribir filas en una tabla propia).

## Mientras tanto

El frontend ya apunta a la Opción B (`GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/logs` y `/logs/kpis`) como estructura de referencia, con fallback a datos simulados y badge rojo "Simulado" — así el día que exista Opción A o B, conectar es solo hacer que la query deje de fallar, sin tocar componentes. Ver `src/hooks/superadmin/useLogs.ts`.

## Resumen

| Ítem | Estado | Nota |
|---|---|---|
| Tabla de logs (filtrable por servicio/nivel/empresa) | 🔴 Simulado | No es un endpoint que falte — falta decidir si esto vive en una plataforma de observabilidad (recomendado) o en un endpoint propio (Opción B, stopgap) |
| KPIs (total / info / warn / error) | 🔴 Simulado | Depende de la misma decisión — es un `COUNT GROUP BY nivel` sobre lo que sea que termine siendo la fuente |
| Relación con Auditoría (`docs/superadmin/auditoria-endpoints.md`) | — | Páginas distintas, contenido distinto (técnico vs. negocio); no compartir implementación sin confirmar con ese doc primero |

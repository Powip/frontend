# Campañas — contrato de endpoints

> A diferencia de todas las páginas migradas hasta ahora, acá no hay "backend real parcial" que aprovechar — es un dominio que no existe en absoluto todavía. Campañas es una herramienta de marketing-ops **de Powip hacia sus empresas clientes** (broadcast WhatsApp/email segmentado, ej. "reactivación de trials vencidos"), no el marketing que las empresas le hacen a sus propios compradores — eso es otra cosa, no confundir. No hay tabla de campañas, no hay motor de segmentación, y no hay mecanismo de envío. Se investigó todo el repo antes de escribir esto — el detalle de qué se buscó y qué se encontró está en cada sección.

## 🔴 Simulado — todo el módulo

Ninguna de las 4 piezas de esta página (listado, KPIs, crear campaña, métricas de envío/apertura/click) tiene fuente real. `src/services/superadmin/campanasService.ts` opera 100% sobre `campanasMock` (`src/mocks/superadmin/config.ts`) mutándolo en memoria — no hay ningún `axios.get/post` en el archivo.

Se buscó explícitamente en todo `src/` (servicios, API routes, hooks) cualquier cosa parecida a "campaign", "campana", "broadcast", "blast" — lo único que aparece son los archivos de esta misma página (componentes/servicio/mock) y la entrada de navegación. No hay tabla ni endpoint en ningún ms-* que se le parezca.

Faltan, en orden, tres piezas independientes — ninguna existe hoy:

1. **Un dominio de datos "campaña"**: no hay tabla en ningún microservicio (`empresa`, `leads` tienen columnas propias, pero nada de "campaña", "envío", "plantilla", "segmento guardado").
2. **Un motor de segmentación server-side**: la spec pide armar audiencias tipo "Trial vencido 30-60 días" o "Plan Basic/Pro sin SUNAT" — hoy el campo `segmento` de `ICampana` es un string libre que se tipea a mano en el modal (`NuevaCampanaModal.tsx`), no un filtro real evaluado contra la base. Además, campos clave para segmentar como `rubro` y `plan` ni siquiera existen en `ms-company` todavía — ya lo señala `docs/superadmin/oportunidades-endpoints.md` ("Segmentación (rubro/plan)"), es el mismo gap, no lo repetimos.
3. **Un mecanismo de envío + tracking**: no hay ninguna integración de WhatsApp Business API ni de envío de email masivo en el codebase. Se buscó explícitamente (`resend`, `sendgrid`, `nodemailer`, `smtp`, `twilio`, `360dialog`, `graph.facebook`) — cero resultados. Lo único remotamente parecido es `src/app/operaciones/guias/_components/WhatsAppNotificationsSection.tsx`, plantillas de notificación automática de guías de envío (a *compradores* de una empresa, no a empresas de la red) — y el propio archivo se documenta a sí mismo como "funcionalidad NUEVA del mockup... no hay persistencia real ni envío automático de nada". No es una pieza reusable, es otro mock. **Si ese sistema llegara a construirse de verdad** (para notificaciones de guías) sería un buen candidato para reusar como capa de envío de Campañas — vale la pena tenerlo en mente al diseñarlo — pero hoy no existe ninguno de los dos.

### Listado + KPIs

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/campanas?estado=&canal=&page=&limit=
```

```jsonc
{
  "data": [
    { "id": "uuid", "nombre": "Reactivación trials vencidos", "segmento": "Trial vencido, 30-60 días", "canal": "WhatsApp", "estado": "activa", "enviados": 214, "aperturaPct": 68, "conversionPct": 9.3, "mensaje": "Hola {{nombre}}, ...", "creadoEn": "2026-08-18T00:00:00Z" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 4, "total_pages": 1 }
}
```

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/campanas/kpis
```

```jsonc
{ "activas": 2, "enviados": 351, "aperturaProm": 64.7, "conversionProm": 15.3 }
```

**WHY el KPI es su propio endpoint y no un cálculo client-side sobre el listado**: `aperturaProm`/`conversionProm`/`enviados` deben promediarse/sumarse sobre **todas** las campañas, no solo la página visible — el mismo problema de "traer todo para agregar en el frontend" ya evitado en Adquisición y Oportunidades. Server-side es trivial (`AVG`/`SUM` con `GROUP BY` sobre la tabla de campañas); client-side obliga a traer la tabla completa sin paginar.

### Crear campaña

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/campanas
```

```jsonc
// body
{
  "nombre": "Reactivación trials vencidos",
  "canal": "WhatsApp",
  "mensaje": "Hola {{nombre}}, tu prueba de POWIP venció. ¿Seguimos?",
  "segmento": {
    "tipo": "trial_vencido",
    "diasDesde": 30,
    "diasHasta": 60
  }
}
```

```jsonc
// response — se crea como "borrador", nunca envía al crear
{ "id": "uuid", "nombre": "Reactivación trials vencidos", "segmento": "Trial vencido, 30-60 días", "canal": "WhatsApp", "estado": "borrador", "enviados": 0, "aperturaPct": 0, "conversionPct": 0, "mensaje": "...", "creadoEn": "2026-08-24T00:00:00Z" }
```

**WHY `segmento` debe ser un objeto de filtros evaluado en backend, no el string libre de hoy**: si el frontend arma la audiencia trayendo todas las empresas/leads y filtrando en el cliente, es exactamente el anti-patrón de "full-scan client-side" ya señalado en `docs/superadmin/operacion-endpoints.md` y `docs/superadmin/oportunidades-endpoints.md` — acá es peor porque además hay que *enviar* mensajes a esa lista, no solo mostrarla. El conteo/armado de audiencia tiene que pasar por el motor de segmentación del backend, nunca por "traer todas las empresas y contar en el navegador".

### Previsualizar tamaño de audiencia (antes de crear)

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/campanas/segmentos/preview
```

**Body:**
```jsonc
// mismo objeto "segmento" que en "Crear campaña"
{
  "tipo": "trial_vencido",
  "diasDesde": 30,
  "diasHasta": 60
}
```

**Response:**
```jsonc
{ "count": 47 }
```

**WHY hace falta este endpoint aparte**: sin él, el modal "Nueva campaña" no tiene forma de mostrarle al operador "esto le va a llegar a 47 negocios" antes de confirmar — hoy el campo `segmento` es texto libre precisamente porque no hay nada contra qué validarlo. Evita también el caso de crear una campaña con audiencia 0 por un filtro mal armado.

### Activar / pausar

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/campanas/{id}
```

**Body:**
```jsonc
{ "estado": "activa" } // o "pausada"
```

Al pasar a `"activa"` es el backend el que dispara el envío real (encolado, no síncrono) — el frontend solo pide el cambio de estado.

**Response:**
```jsonc
{ "id": "uuid", "nombre": "Reactivación trials vencidos", "segmento": "Trial vencido, 30-60 días", "canal": "WhatsApp", "estado": "activa", "enviados": 214, "aperturaPct": 68, "conversionPct": 9.3, "mensaje": "Hola {{nombre}}, tu prueba de POWIP venció. ¿Seguimos?", "creadoEn": "2026-08-18T00:00:00Z" }
```

### Métricas de envío/apertura/click por campaña

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/campanas/{id}/metricas
```

```jsonc
{
  "enviados": 214,
  "entregados": 208,
  "aperturaPct": 68,
  "clickPct": 22,
  "conversionPct": 9.3,
  "porEmpresa": [
    { "empresaId": "uuid", "empresaNombre": "TecnoHogar Express", "estado": "abierto", "enviadoEn": "2026-08-19T10:00:00Z" }
  ]
}
```

**WHY**: requiere tracking real de entrega/apertura/click, que solo existe si hay una integración real de envío (WhatsApp Business API con webhooks de estado, o email transaccional con tracking pixel/links). No hay forma de simular esto de manera útil — depende 100% de que exista el mecanismo de envío primero.

## Resumen

| Ítem | Estado | Bloqueado por |
|---|---|---|
| Listado de campañas | 🔴 Simulado | No existe tabla "campaña" en ningún ms-* |
| KPIs (activas/enviados/apertura/conversión) | 🔴 Simulado | Mismo — además necesita agregación server-side, no cálculo sobre el listado |
| Crear campaña | 🔴 Simulado | Falta tabla + motor de segmentación server-side |
| Segmentación de audiencia (contar/armar) | 🔴 Simulado | Motor de segmentación nuevo; `rubro`/`plan` ni existen aún en `ms-company` (mismo gap de `docs/superadmin/oportunidades-endpoints.md`) |
| Activar/pausar campaña | 🔴 Simulado | Depende de que la campaña y el envío encolado existan |
| Envío real (WhatsApp/email) | 🔴 Simulado | No hay integración de WhatsApp Business API ni de email masivo en todo el repo — se buscó explícitamente |
| Métricas de entrega/apertura/click | 🔴 Simulado | Depende 100% del mecanismo de envío — no hay tracking sin envío real |

**Nota**: no hay nada parcial para "conectar" acá — a diferencia de Seguimiento o Adquisición, donde hay columnas reales esperando ser usadas, Campañas necesita que se construyan tres sistemas nuevos desde cero (dominio de datos, motor de segmentación, mecanismo de envío+tracking) antes de que cualquier pedazo de esta página deje de ser 🔴. Vale la pena revisarla recién cuando exista al menos la tabla de campañas y la integración de envío por un canal (probablemente WhatsApp primero, dado que ya es el canal principal de contacto con leads en Adquisición).

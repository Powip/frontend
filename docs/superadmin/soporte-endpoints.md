# Soporte — contrato de endpoints

> Chequeado: no hay ninguna entidad `ticket` en ningún microservicio (`ms-*`), ni tabla, ni servicio Next.js BFF que la modele. Tampoco hay integración con una herramienta de helpdesk externa (Zendesk/Intercom/Freshdesk/HelpScout) — no aparece ninguna en `package.json` ni en `src/services`. Todo lo que alimentaba esta página salía de `src/mocks/superadmin/plataforma.ts` (`ticketsMock`, derivado de `empresasMock` con asuntos/estados/prioridades hardcodeados) vía `src/services/superadmin/soporteService.ts`, que ni siquiera distinguía real/simulado — pegaba directo al mock. Ese service ya se eliminó: el frontend ahora apunta a los endpoints propuestos acá vía `src/hooks/superadmin/useSoporte.ts` (mismo patrón real-primero-simulado-después que el resto de `/superadmin`), con `ticketsMock` como fallback visible (badge "Simulado") en vez de dato mezclado sin avisar.
>
> Esto ya está anotado en `docs/superadmin/dashboard-endpoints.md` sección 10 ("Soporte & Experiencia"): el resumen de ese dashboard (`GET /dashboard/soporte-resumen`) depende de que `ticket` exista como entidad real primero. Esa sección no se repite acá — este doc es esa dependencia: la entidad y la cola completa que el resumen del dashboard solo agregaría.

## 🔴 Todo — no es un endpoint que falte, es una feature de backend que no existe

Igual que "Fraude / anomalías" en `docs/superadmin/operacion-endpoints.md`: no hay ningún dato real en ningún lado para adaptar, filtrar o agregar. No se trata de exponer algo que ms-company o ms-ventas ya calculan — hace falta modelar `ticket` desde cero (asunto, empresa, prioridad, estado, asignación, SLA, mensajes, CSAT), con su propio ciclo de vida y probablemente su propia tabla de eventos para medir tiempo de respuesta real. Se documentan los endpoints igual, para dejar el contrato listo, pero ninguno es "una query nueva sobre datos existentes".

### 1. Cola de tickets (listado paginado + filtrable)

Reemplaza a `getTickets()` sobre `ticketsMock` — hoy filtra en memoria sobre un array fijo de 14 tickets; con volumen real (todas las empresas de la red) no se puede traer todo y paginar/filtrar en el cliente.

```
GET /api/v1/soporte/tickets?page=1&page_size=25&prioridad=Alta&estado=Abierto&empresaId=uuid&asignadoId=uuid&q=boletas
```

**Response:**
```jsonc
{
  "data": [
    {
      "id": "TCK-1000",
      "empresaId": "uuid",
      "empresaNombre": "Bella Piel Cosmética",
      "asunto": "No puedo emitir boletas SUNAT",
      "prioridad": "Alta",
      "estado": "Abierto",
      "asignadoId": "team-8",
      "asignadoNombre": "Diego Salazar",
      "slaVence": "2026-08-25T00:00:00Z",
      "creadoEn": "2026-08-22T14:10:00Z"
    }
  ],
  "page": 1,
  "pageSize": 25,
  "total": 340
}
```

**Por qué server-side.** Mismo anti-patrón ya marcado en `operacion-endpoints.md` y `oportunidades-endpoints.md`: la cola es de **toda la red**, no de una empresa. Filtrar/paginar en el front sobre "traer todos los tickets" no escala pasado un puñado de empresas — el `LIMIT`, el filtro por `prioridad`/`estado`/`empresaId`/`asignadoId` y el `ORDER BY` (sugerido: `slaVence ASC` para que lo más urgente aparezca primero) los tiene que aplicar el backend.

### 2. Detalle de ticket (con conversación)

```
GET /api/v1/soporte/tickets/{id}
```

**Response:**
```jsonc
{
  "id": "TCK-1000",
  "empresaId": "uuid",
  "empresaNombre": "Bella Piel Cosmética",
  "asunto": "No puedo emitir boletas SUNAT",
  "prioridad": "Alta",
  "estado": "Abierto",
  "asignadoId": "team-8",
  "asignadoNombre": "Diego Salazar",
  "slaVence": "2026-08-25T00:00:00Z",
  "creadoEn": "2026-08-22T14:10:00Z",
  "mensajes": [
    { "id": "uuid", "autor": "Bella Piel Cosmética", "esEquipoPowip": false, "texto": "Tengo un problema con esto, ¿me ayudan?", "creadoEn": "2026-08-22T14:10:00Z" },
    { "id": "uuid", "autor": "Diego Salazar", "esEquipoPowip": true, "texto": "Ya estamos revisando, te confirmamos en breve.", "creadoEn": "2026-08-22T16:40:00Z" }
  ]
}
```

### 3. Responder ticket (agrega mensaje a la conversación)

```
POST /api/v1/soporte/tickets/{id}/mensajes
```

**Body:**
```jsonc
{ "texto": "Ya estamos revisando tu caso, te confirmamos en breve." }
```

**Response:**
```jsonc
{
  "id": "TCK-1000",
  "estado": "En proceso",
  "mensajes": [
    { "id": "uuid", "autor": "Bella Piel Cosmética", "esEquipoPowip": false, "texto": "Tengo un problema con esto, ¿me ayudan?", "creadoEn": "2026-08-22T14:10:00Z" },
    { "id": "uuid", "autor": "Diego Salazar", "esEquipoPowip": true, "texto": "Ya estamos revisando tu caso, te confirmamos en breve.", "creadoEn": "2026-08-24T18:30:00Z" }
  ]
}
```

**Comportamiento esperado.** Agrega el mensaje con `autor` = usuario interno autenticado (del JWT) y `esEquipoPowip: true`. Si el ticket estaba `Abierto`, el backend lo pasa a `En proceso` automáticamente (mismo comportamiento que hoy simula `responderTicket()` en el mock) — así el estado no depende de que el frontend haga un segundo `PATCH` aparte.

### 4. Cambiar estado / asignar

```
PATCH /api/v1/soporte/tickets/{id}
```

**Body** (uno o ambos campos, según la acción):
```jsonc
// Marcar resuelto
{ "estado": "Resuelto" }
```
```jsonc
// Asignación manual (futura)
{ "asignadoId": "team-8" }
```

**Response:**
```jsonc
{
  "id": "TCK-1000",
  "empresaId": "uuid",
  "empresaNombre": "Bella Piel Cosmética",
  "asunto": "No puedo emitir boletas SUNAT",
  "prioridad": "Alta",
  "estado": "Resuelto",
  "asignadoId": "team-8",
  "asignadoNombre": "Diego Salazar",
  "slaVence": "2026-08-25T00:00:00Z",
  "creadoEn": "2026-08-22T14:10:00Z"
}
```

Cubre tanto "Marcar resuelto" (`{ "estado": "Resuelto" }`) como una futura asignación manual (`{ "asignadoId": "uuid" }`) — hoy la UI solo dispara el primer caso, pero conviene que el mismo endpoint soporte ambos campos para no tener que agregar uno nuevo cuando se agregue el selector de asignación.

**Por qué importa medir esto bien.** Si el backend registra `ts` de cada cambio de estado (no solo el estado final), **de ahí sale gratis** el "Tiempo de respuesta promedio" del KPI (5) — es la diferencia entre `creadoEn` y el primer mensaje/cambio de estado con `esEquipoPowip: true`. Vale la pena modelarlo como un log de transiciones desde el día 1 en vez de guardar solo el estado actual, para no tener que reconstruirlo después.

### 5. KPIs de la cola

Reemplaza a `getKpisSoporte()` — hoy es un `.filter().length` sobre los 14 tickets del mock; con la red completa tiene que ser una agregación en el backend, no `page_size=9999` + contar en el cliente.

```
GET /api/v1/soporte/kpis
```

**Response:**
```jsonc
{
  "abiertos": 6,
  "criticos": 2,
  "tiempoRespuestaPromedioMin": 38,
  "csat": 4.6
}
```

**`abiertos` / `criticos`.** `COUNT(*) GROUP BY estado` / `COUNT(*) WHERE prioridad = 'Alta'` — trivial una vez que la entidad `ticket` existe.

**`tiempoRespuestaPromedioMin`.** Requiere el log de transiciones mencionado en (4) — promedio de `primera_respuesta_ts - creadoEn` sobre una ventana (ej. últimos 30 días). Sin ese log no se puede calcular honestamente, solo inventar.

**`csat`.** Requiere una encuesta post-resolución (`ticket_csat` o similar: `ticketId`, `puntaje 1-5`, `comentario?`) que hoy no existe en ningún lado — ni siquiera hay un flujo de "encuestar al cliente cuando se resuelve un ticket". Es el campo más caro de los cuatro: no es solo backend, involucra a Producto definiendo cuándo/cómo se dispara la encuesta.

**Rendimiento.** Igual que el resto de KPIs de red en los otros docs: agregación precalculada o cacheada corta (1-5 min), nunca recorrer todos los tickets en cada carga de la página.

---

## Resumen

| # | Endpoint | Estado | Bloqueado por |
|---|---|---|---|
| 1 | `GET /soporte/tickets` (cola paginada+filtrable) | 🔴 Simulado | Entidad `ticket` no existe en ningún backend |
| 2 | `GET /soporte/tickets/{id}` (detalle + conversación) | 🔴 Simulado | Entidad `ticket` + `mensajes` |
| 3 | `POST /soporte/tickets/{id}/mensajes` (responder) | 🔴 Simulado | Entidad `ticket` |
| 4 | `PATCH /soporte/tickets/{id}` (estado/asignación) | 🔴 Simulado | Entidad `ticket`; log de transiciones si se quiere medir tiempo de respuesta después |
| 5 | `GET /soporte/kpis` | 🔴 Simulado | `abiertos`/`criticos` salen gratis de (1); `tiempoRespuestaPromedioMin` necesita log de transiciones; `csat` necesita encuesta post-resolución (no existe el flujo) |
| — | `GET /dashboard/soporte-resumen` (dashboard, no esta página) | 🔴 Referencia | Ver `dashboard-endpoints.md` §10 — mismo bloqueo, resumen de lo de acá |

**Nota**: a diferencia de Seguimiento o Empresas (donde parte del dato ya existe y solo falta agregarlo o definir su semántica), acá no hay nada real para adaptar — es la misma situación que `operacion-endpoints.md` documentó para "Fraude/anomalías": vale la pena revisar esto de nuevo recién cuando el módulo de Soporte (ticket como entidad) arranque como proyecto de backend propio, no antes.

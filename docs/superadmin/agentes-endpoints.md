# Agentes IA — contrato de endpoints

> Esta es la página con menos backend real de todas las migradas hasta ahora — incluso menos que Operación de Red. No es "falta agregar una query": no existe ningún subsistema, en ningún microservicio, que sepa qué features de IA tiene Powip, si están prendidas, cuánto se usaron o cuánto costaron. Lo documentamos igual, con el mismo detalle que el resto, para que el día que alguien arranque esto no tenga que re-investigar desde cero.

**Aviso de nombres, para quien lea esto del lado de backend:** ya existe un endpoint `ms-ventas: /atencion-al-cliente/agentes` (`agentesService.ts` en el frontend) — son los **agentes humanos de Centro de Contacto** por tienda (atención al cliente), un dominio totalmente distinto. Esta página es sobre **features de IA propias de la plataforma Powip** (ej. "Chat IA WhatsApp", "Clasificador de Tickets"), on/off a nivel plataforma, no personas. Para no chocar nombres, todo lo de este doc va bajo `/agentes-ia`, nunca `/agentes` a secas.

## 🔴 Simulado — el módulo completo: no hay tracking de uso/costo de IA en ningún lado

Antes de proponer nada, se revisó el repo buscando cualquier rastro de: llamadas a OpenAI/Anthropic/otro proveedor de LLM, logging de tokens/costo, o un config store de features on/off. Resultado:

- **Cero** referencias a `openai`, `anthropic`, `gpt-`, `claude-`, `chatgpt` ni ningún SDK de LLM en todo `src/` (backend de IA no vive en este repo, y no hay evidencia de que viva en ninguno de los `ms-*` documentados en `CLAUDE.md` tampoco — no hay ningún cliente ni proxy hacia un proveedor de LLM).
- El único rastro real de "Agentes IA" en toda la base de código es un **anuncio mock**, literal: `src/mocks/superadmin/config.ts` línea 30 — `{ titulo: "Próximamente: Agentes IA para ventas", ..., estado: "borrador" }`. El propio mock de anuncios ya admite que esto es un roadmap futuro, no una feature que exista.
- Lo único remotamente parecido a "IA" conectado con un backend real es **Yavendio** (`src/services/yavendioService.ts`, `src/app/configuracion/integraciones/yavendio/`) — un vendor externo de venta por WhatsApp que usa su propia IA. Pero es la IA de Yavendio corriendo en la infraestructura de Yavendio, no una feature de Powip con costo/uso propio que este panel pueda medir o apagar. No es lo mismo que "Chat IA WhatsApp" del mock (que se plantea como una feature de Powip, con su propio costo mensual).
- La página hoy (`AgentesGrid.tsx`, `AgentesKpis.tsx`) consume `src/services/superadmin/agentesService.ts`, que es un wrapper 100% mock sobre `agentesIaMock` (`mockDelay(...)` con mutación in-memory del array) — no hay ningún `fetch`/`axios` real ahí tampoco.

**Conclusión.** Esto no es un endpoint que falte: es una feature de producto (instrumentación de IA con toggle + medición de uso/costo por feature) que todavía no se construyó en ningún backend. Antes de que exista, cada feature de IA candidata (chat de WhatsApp, asistente de ventas, clasificador de tickets, detector de churn) tiene que:
1. Correr detrás de un flag server-side consultado en cada request (el toggle de esta página tiene que apagar/prender comportamiento real, no solo una UI).
2. Loguear cada llamada al LLM que hace — tokens de entrada/salida, costo calculado con el pricing del proveedor, y timestamp — en una tabla propia, en el momento en que la llamada ocurre. El costo/uso mensual de este panel **no se puede calcular después, agregando desde otro lado**: si no se logueó en el momento, se perdió.

Se documentan igual los 3 endpoints que la página necesitaría, con su shape propuesto, para que quien retome esto no tenga que re-derivarlo.

---

### 1. Listado de agentes IA (estado, uso, costo, resultados)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/agentes-ia
```

```jsonc
{
  "data": [
    {
      "id": "agt-1",
      "nombre": "Chat IA WhatsApp",
      "descripcion": "Atiende consultas de clientes finales por WhatsApp.",
      "activo": true,
      "usoMes": 18400,          // conteo de invocaciones/mensajes procesados en el mes en curso
      "costoMes": 312,          // PEN, suma de costo real reportado por el proveedor de LLM
      "cierresAsistidos": 89    // opcional — solo aplica a agentes con outcome de venta/ticket asociado
    }
  ]
}
```

**WHY.** `usoMes` y `costoMes` no son calculables client-side ni con una query simple sobre datos existentes — dependen de que cada llamada al LLM se loguee server-side en el momento en que pasa (ver instrumentación arriba). `cierresAsistidos` (para features que participan en un cierre de venta o resolución de ticket) requiere además vincular esa invocación con el outcome real (venta cerrada, ticket resuelto) — otra pieza de tracking que no existe hoy.

**Rendimiento.** Es una tabla chica (4-10 features, no miles de filas) — no hace falta paginación, sí cachear 1-5 min ya que `usoMes`/`costoMes` cambian con cada invocación real.

---

### 2. Activar / desactivar un agente IA

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/agentes-ia/{id}
```

```jsonc
// body
{ "activo": false }
```

```jsonc
// response
{ "data": { "id": "agt-4", "nombre": "Detector de Riesgo de Churn", "activo": false, "usoMes": 0, "costoMes": 0 } }
```

**WHY.** Esto es el toggle real de la card — hoy solo muta el mock in-memory (`agentesIaMock`, se resetea en cada reload). Para que sea real de verdad, el flag que este endpoint escribe tiene que ser el **mismo** que consulta cada feature de IA antes de correr (ej. el servicio de Chat IA WhatsApp consulta este flag antes de responder un mensaje) — si el toggle solo actualiza una fila en una tabla que nadie más lee, es la misma sensación de "funciona" pero sin efecto real.

---

### 3. KPIs agregados (costo total, uso total, activos, cierres asistidos)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/agentes-ia/kpis
```

```jsonc
{
  "data": {
    "total": 4,
    "activos": 3,
    "interaccionesTotales": 24700,
    "costoTotalMes": 456,
    "cierresAsistidos": 110
  }
}
```

**WHY.** Es un `SUM`/`COUNT` trivial sobre la misma tabla de logging del punto 1 — no requiere nada nuevo más allá de que esa tabla exista. Se propone como endpoint agregado aparte (en vez de que el frontend sume el array del punto 1) por la misma razón que el resto del panel: si mañana hay 50 features de IA en vez de 4, sigue siendo una sola query barata en vez de traer todo y sumar en el cliente.

---

## Resumen

| Ítem | Estado | Bloqueado por |
|---|---|---|
| Listado de agentes IA con uso/costo/resultados | 🔴 Simulado | No existe logging de invocaciones a LLM (tokens/costo) en ningún backend |
| Activar / desactivar un agente IA | 🔴 Simulado | El toggle necesita un flag server-side que las features de IA realmente consulten, no solo una fila en una tabla |
| KPIs agregados (costo total, uso total, cierres asistidos) | 🔴 Simulado | Depende de que exista la tabla de logging del punto 1 — es un `SUM` trivial una vez que esa tabla exista |

**Nota:** a diferencia de Operación de Red (donde al menos 2 de 3 secciones tenían datos reales en algún lado, solo faltaba agregarlos), acá no hay ningún dato real en ningún lado — es 100% instrumentación nueva de punta a punta, en la misma categoría que la Sección 9 del dashboard ("KPIs de producto / Adopción de módulos"): "no existe ninguna instrumentación de producto hoy en el stack". Vale la pena resolver esto junto con esa pieza (o con una herramienta externa de analítica/observabilidad de LLM tipo Langfuse/Helicone) en vez de construir tracking de tokens a mano.

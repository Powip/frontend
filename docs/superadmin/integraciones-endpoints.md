# Integraciones (salud de red) — contrato de endpoints

> Esta página (`/superadmin/integraciones`) NO es la pantalla de configuración de integraciones de una empresa (esa ya existe por vendor: Yavendio, Shalom, Aliclik, EVA, cada una con su propio formulario de credenciales por `companyId`). Es la vista de red: "¿cómo está Shopify/Shalom/SUNAT/etc. funcionando across TODAS las empresas de Powip?" — el mismo tipo de dato que `docs/superadmin/dashboard-endpoints.md` sección 6 ("Salud de la plataforma") ya propuso como `GET /dashboard/salud-integraciones`, pero acá con más detalle: esta página es una grilla completa por vendor, no una sola card resumen, y además expone acciones (activar/desactivar, reconectar) que el dashboard no necesita. No repetimos el análisis de esa sección — lo extendemos.

## Confirmado: hoy todo lo real es por-empresa, nunca por-red

Se revisaron los 4 servicios de integración con connection-test real en el repo:

| Vendor | Función | Endpoint real | Scope |
|---|---|---|---|
| Yavendio | `testYavendioConnection(token, companyId)` | `POST /yavendio/config/:companyId/connection-test` | Por empresa (`companyId` explícito) |
| Aliclik | `testAliclikConnection(token, companyId)` | `GET /aliclik/connection-test/:companyId` | Por empresa (`companyId` explícito) |
| EVA | `testEvaConnection(token, companyId)` | `POST /eva/credentials/:companyId/connection-test` | Por empresa (`companyId` explícito) |
| Shalom | `getShalomStatus(token, companyId)` | `GET /shalom/status/:companyId` | Por empresa (`companyId` explícito) |
| Shalom | `testShalomConnection(token)` | `GET /shalom/connection-test` | Global, pero solo pingea que el servidor Shalom responde — no dice nada de ninguna empresa puntual |

A diferencia del bloqueo de `sunatDocumentService` (documentado en `operacion-endpoints.md`), acá el `companyId` sí es un parámetro explícito de la función — technically se podría loopear. El problema no es de scoping por JWT, es de escala: ninguno de estos 4 endpoints persiste histórico ni uptime, son pings síncronos contra el vendor real en el momento del request. No hay ningún endpoint, en ningún lado, que devuelva "estado agregado de Shopify/Shalom/etc. across todas las empresas".

**Response real de cada connection-test** (shapes tal cual están tipados en sus respectivos servicios — no inventadas):

```
POST /yavendio/config/{companyId}/connection-test
```
```jsonc
// Yavendio no devuelve {ok,message} — devuelve la config actualizada, o rechaza con 401 si la Api-Key es inválida.
{
  "id": "yav-cfg-uuid",
  "companyId": "company-uuid",
  "apiKey": "****93fa",
  "importStoreId": "store-123",
  "isActive": true,
  "createdAt": "2026-05-10T00:00:00Z",
  "updatedAt": "2026-08-24T00:00:00Z"
}
```

```
GET /aliclik/connection-test/{companyId}
```
```jsonc
{ "ok": true, "message": "Conexión establecida correctamente" }
```

```
POST /eva/credentials/{companyId}/connection-test
```
```jsonc
// Igual que Yavendio: no devuelve {ok,message} — devuelve la credencial actualizada, o rechaza con 401.
{
  "id": "eva-cred-uuid",
  "companyId": "company-uuid",
  "baseUrl": "https://api.eva.pe",
  "clientType": "ALMACEN",
  "maskedApiKey": "****7c21",
  "hasWebhookSecret": true,
  "isActive": true,
  "createdAt": "2026-05-10T00:00:00Z",
  "updatedAt": "2026-08-24T00:00:00Z"
}
```

```
GET /shalom/status/{companyId}
```
```jsonc
{ "isLoggedIn": true, "username": "powip_bella_piel", "hasInstance": true }
```

```
GET /shalom/connection-test
```
```jsonc
{ "ok": true, "agenciesCount": 214 }
```

## 🟡 Grid de integraciones + KPIs — agregado nuevo, mismo tier que dashboard #6

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/integraciones/salud
```

**Response:**
```jsonc
{
  "integraciones": [
    {
      "id": "shopify",
      "nombre": "Shopify",
      "categoria": "Ecommerce",
      "estado": "operativo",        // "operativo" | "error" | "desconectado"
      "uptimePct": 99.8,
      "ultimoEvento": "2026-08-20T14:00:00Z",
      "activa": true,
      "empresasConectadas": 340,
      "empresasConError": 3
    }
    // ... Meta, Mercado Pago, SUNAT/OSE, Shalom, Olva, WhatsApp Business API,
    // y los 4 vendors con connection-test real hoy: Yavendio, Aliclik, EVA, Shalom
  ],
  "uptimePromedio": 98.6
}
```

Los KPIs de la parte superior (Total integraciones, Activas, Con error, Uptime promedio) se derivan client-side de esta misma lista — es agregación barata porque `integraciones.length` es del orden de vendors (10-20), no de empresas, así que no hay problema de escala en calcularlo en el front.

**Qué agrega sobre `dashboard-endpoints.md` #6.** El dashboard solo necesita `{ id, nombre, categoria, estado, uptimePct, ultimoEvento }` para una card resumen. Esta página necesita además, por vendor: `activa` (flag de si el vendor está habilitado en la plataforma) y `empresasConectadas`/`empresasConError` (cuántas empresas de la red tienen ese vendor conectado y sano vs. roto) — sin esto último la grilla de esta página no dice más que la card del dashboard, solo la repite más grande.

**Fuente.** Igual que en dashboard-endpoints.md #6: requiere que `ms-integrations` guarde un log/estado agregado de sus propios health-checks y webhooks por vendor **y por empresa**, para poder contar cuántas empresas están sanas vs. rotas sin tener que llamarlas una por una. Probablemente ya loguea errores de sync/webhook por empresa en algún lado (son los mismos eventos que alimentarían `logsSistemaMock` / `ILogSistema` si existiera de verdad) — la propuesta es agregar eso por vendor, no agregar tracking nuevo desde cero.

**WHY — por qué no armar esto pegándole a los 4 connection-test por empresa.** Con miles de empresas en la red, construir esta grilla haciendo un loop de `testYavendioConnection`/`testAliclikConnection`/`testEvaConnection`/`getShalomStatus` una vez por empresa conectada es exactamente el anti-patrón N+1 ya señalado en `operacion-endpoints.md` (Caja & COD, Monitor SUNAT) y en `oportunidades-endpoints.md` (radar de upsell): además de no escalar, estaría haciendo miles de llamadas reales a APIs externas (Shopify, SUNAT, etc.) cada vez que alguien abre esta página, cuando lo que se necesita es un estado ya calculado, no un test en vivo por request.

**Rendimiento.** `SELECT` sobre un estado ya mantenido/cacheado en `ms-integrations`, nunca ejecutar los health-checks reales en el momento del request (mismo criterio que dashboard #6). Cacheable unos minutos — el estado de integraciones no cambia segundo a segundo.

---

## 🔴 Acciones por integración (activar/desactivar, reconectar) — subsistema nuevo

La UI actual (`IntegracionesGrid.tsx`) ya tiene un switch "activa" por card y un botón "Reconectar" cuando el estado no es operativo. Hoy pegan contra un mock local (`toggleIntegracion`/`reconectarIntegracion` en `src/services/superadmin/integracionesService.ts`) que solo muta el array en memoria. No hay ningún backend real, ni propuesto en otro doc, que resuelva esto:

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/integraciones/{vendorId}/activa
```
**Body:**
```jsonc
{ "activa": false }
```
**Response:** la entidad `IIntegracion` actualizada:
```jsonc
{
  "id": "int-6",
  "nombre": "Olva Courier",
  "categoria": "Envíos",
  "estado": "desconectado",
  "uptimePct": 0,
  "activa": false,
  "ultimoEvento": "2026-08-24T10:00:00Z"
}
```
*Nota — divergencia entre lo propuesto y el intento real hoy:* `useToggleIntegracion` (`src/hooks/superadmin/useIntegraciones.ts`) manda el PATCH con body `{}` vacío (semántica de toggle, sin mandar el nuevo valor) — si backend prefiere ese contrato en vez de recibir `activa` explícito, avisar para ajustar el hook.

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/integraciones/{vendorId}/reconectar
```
**Body:** ninguno — acción pura, el hook manda `{}`.
**Response:** la entidad `IIntegracion` actualizada (mismo shape que arriba, con `estado: "operativo"` y `ultimoEvento` refrescado):
```jsonc
{
  "id": "int-6",
  "nombre": "Olva Courier",
  "categoria": "Envíos",
  "estado": "operativo",
  "uptimePct": 99.9,
  "activa": true,
  "ultimoEvento": "2026-08-25T00:00:00Z"
}
```

**Por qué es 🔴 y no una query más.** "Activa" acá es un flag a nivel plataforma (¿el vendor está habilitado para toda la red?, no para una empresa puntual) — no existe ninguna tabla de config a ese nivel hoy, solo config por-empresa (`YavendioConfig`, `ShalomConfig`, etc.). Y "Reconectar" a nivel de un vendor completo no puede ser un solo request síncrono: reconectar de verdad significaría volver a intentar el health-check contra **cada empresa** que usa ese vendor, lo cual es trabajo de background job (mismo argumento de escala que la sección anterior), no algo que un botón pueda esperar en el momento.

**Mientras tanto**, estas dos acciones siguen resolviendo contra el mock en memoria (best-effort, mismo patrón que `useMarcarTareaHecha` en `useDashboard.ts`): el intento de PATCH/POST real se hace primero, y si el endpoint todavía no existe, la mutación cae al mock local para que la UI no se sienta rota.

---

## Resumen

| Sección | Estado | Bloqueado por |
|---|---|---|
| Grid de integraciones (por vendor, across red) | 🟡 Simulado | Agregado nuevo en `ms-integrations`, extiende dashboard #6 con `activa`/`empresasConectadas`/`empresasConError` |
| KPIs (total, activas, con error, uptime promedio) | 🟡 Simulado | Se derivan del mismo endpoint de arriba — no es un endpoint aparte |
| Activar/desactivar integración (a nivel red) | 🔴 Simulado | No existe tabla de config a nivel plataforma, solo por-empresa |
| Reconectar integración (a nivel red) | 🔴 Simulado | Requeriría un job que re-testee la conexión de cada empresa que usa ese vendor, no un request síncrono |

**Nota.** Los 4 connection-test reales que sí existen (Yavendio, Aliclik, EVA, Shalom) siguen siendo la herramienta correcta para la pantalla de configuración de UNA empresa — no hay que tocarlos ni deprecarlos. Este doc es sobre la vista de red, que es un problema distinto: agregación, no otro connection-test.

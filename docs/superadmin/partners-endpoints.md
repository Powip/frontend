# Partners — contrato de endpoints

> A diferencia de todos los módulos migrados hasta ahora (Dashboard, Adquisición, Seguimiento, Empresas, Oportunidades, Operación), acá no hay **ninguna** pieza real que rescatar. Partners es un programa de referidos externo a Powip (agencias, developers, creadores que traen negocios y cobran comisión) — no existe como entidad en ningún microservicio (`ms-company`, `ms-ventas`, `ms-subscription`, `ms-auth`): no hay tabla `partner`, `referido`, `comision` ni `liquidacion` en ningún lado.
>
> Se investigó puntualmente si "referido" podía apoyarse en algo que ya existe — sí lo hay, pero no alcanza: `leads.source` (la tabla real de Adquisición, ver `docs/superadmin/adquisicion-endpoints.md`) acepta `'referido'` como uno de sus valores de texto libre, como cualquier otro canal de origen (`instagram`, `whatsapp`, `landing`, ...). Es solo una etiqueta genérica de "de dónde vino este lead" — no tiene `partner_id`, ni código de referido, ni nada que lo vincule a un partner concreto ni a una regla de comisión. Confundir esa columna con el programa de Partners sería inventar una relación que no existe. Por eso todo este documento es 100% propuesta de endpoints nuevos, no un diff sobre algo real (como sí es el caso de Adquisición o Seguimiento).
>
> Hoy el frontend ni siquiera pega contra un endpoint simulado: todo pasa por `src/services/superadmin/partnersService.ts`, una capa que reimplementa filtros/paginación/mutación en memoria sobre los arrays de `src/mocks/superadmin/partners.ts`. Este pase reemplaza esa capa por hooks en `src/hooks/superadmin/usePartners.ts` que ya apuntan a los endpoints propuestos abajo (con el mismo fallback a mock + `isSimulado`), para que conectar el backend real el día de mañana sea solo borrar el `catch`.

## 🔴 Dashboard & KPIs del programa (spec 8.6.1)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/kpis
```

```jsonc
{
  "partnersActivos": 4,
  "partnersTotal": 6,
  "mrrReferido": 8200,
  "comisionesMes": 1140,
  "referidosActivos": 14,
  "referidosTotal": 22,
  "conversionPct": 63.6,
  "cacPartners": 81.4,
  "cacAds": 140,
  "roiPct": 619.3,
  "topPartners": [
    { "id": "uuid", "nombre": "Agencia Digital Norte", "handle": "@agenciadigitalnorte", "nivel": "Oro", "referidosCount": 11, "mrrActivo": 3200 }
  ]
}
```

**Por qué agregado server-side, no calculado en el navegador**: cada número acá cruza varias entidades (partners activos, MRR real de las empresas que cada uno refirió, comisiones del período con sus reversos, referidos por estado) — traer los 3-4 arrays completos al navegador y cruzarlos ahí es exactamente el patrón que este panel evita en cada módulo (mismo argumento que el radar de upsell en Oportunidades). `topPartners` debe venir ya ordenado y acotado (`limit`), no ordenado client-side sobre la lista completa de partners.

## 🔴 Tabla de partners (spec 8.6.2)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners?q&estado&nivel&page&pageSize
```

```jsonc
{
  "data": [
    {
      "id": "par-1",
      "nombre": "Agencia Digital Norte",
      "handle": "@agenciadigitalnorte",
      "tipo": "Agencia",
      "opcionComision": "A",
      "codigo": "REF-001",
      "slugLink": "powip.pe/r/agencia",
      "estado": "activo",
      "metodoCobro": "Transferencia BCP",
      "nivel": "Oro",
      "mrrActivo": 3200,
      "descuentoPartnerPct": 0,
      "acuerdo": { "vigenciaHasta": "2027-02-20T00:00:00Z", "exclusividadRubro": "Cosmética (Lima)", "residualNivel": 3 },
      "referidosCount": 11,
      "creadoEn": "2026-02-05T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 6, "totalPages": 1 }
}
```

Filtro y paginación en la base — hoy `partnersService.getPartners()` pagina en memoria sobre un array de 6 elementos hardcodeados; con partners reales (potencialmente cientos) sería el mismo problema de "traer todo y paginar en JS" que ya se pidió arreglar en `GET /leads` (ver doc de Adquisición).

Acciones sobre un partner:

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/{id}/aprobar
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/{id}/suspender
```

Ambas son acciones puras, sin body (`{}`). **Response:** devuelven el partner actualizado (mismo shape que `GET /partners/{id}` abajo), con `estado: "activo"` (aprobar) o `estado: "suspendido"` (suspender).

## 🔴 Ficha de partner — drawer admin y portal individual (spec 8.6.2 / 8.6.7)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/{id}
```

```jsonc
{
  "id": "par-1",
  "nombre": "Agencia Digital Norte",
  "handle": "@agenciadigitalnorte",
  "tipo": "Agencia",
  "opcionComision": "A",
  "codigo": "REF-001",
  "slugLink": "powip.pe/r/agencia",
  "estado": "activo",
  "metodoCobro": "Transferencia BCP",
  "nivel": "Oro",
  "mrrActivo": 3200,
  "descuentoPartnerPct": 0,
  "acuerdo": { "vigenciaHasta": "2027-02-20T00:00:00Z", "exclusividadRubro": "Cosmética (Lima)", "residualNivel": 3 },
  "referidosCount": 11,
  "creadoEn": "2026-02-05T00:00:00Z"
}
```

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/{id}/referidos
```

```jsonc
[
  {
    "id": "ref-1",
    "partnerId": "par-1",
    "partnerNombre": "Agencia Digital Norte",
    "negocio": "TecnoHogar Express",
    "email": "contacto@tecnohogar.pe",
    "origen": "Link de partner",
    "plan": "Pro",
    "descuentoPct": 0,
    "estado": "activo",
    "creadoEn": "2026-06-01T00:00:00Z"
  }
]
```

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/{id}/comisiones
```

```jsonc
[
  {
    "id": "com-1",
    "partnerId": "par-1",
    "referidoId": "ref-1",
    "referidoNombre": "TecnoHogar Express",
    "tipo": "recurrente",
    "periodo": "2026-07",
    "base": 179,
    "pct": 40,
    "monto": 71.6,
    "estado": "liquidada"
  }
]
```

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/{id}/liquidaciones
```

```jsonc
[
  {
    "id": "liq-1",
    "partnerId": "par-1",
    "partnerNombre": "Agencia Digital Norte",
    "ciclo": "2026-07",
    "montoBruto": 1200,
    "montoReversos": 40,
    "retencion": 92.8,
    "neto": 1067.2,
    "estado": "pagada"
  }
]
```

Nótese que las 4 respuestas de arriba son la entidad/lista directa (sin envolver en `{ "data": [...] }`) — a diferencia de la tabla de partners y el resto de listados de este doc, que sí devuelven `{ data, meta }`.

**Hallazgo importante mientras se investigaba esto**: la página de portal (`src/app/superadmin/partners/[id]/portal/page.tsx`) hoy llama `getLiquidaciones()` — que trae **todas** las liquidaciones de **todos** los partners — y recién después filtra por `partnerId` en el cliente (`liquidaciones?.filter((l) => l.partnerId === id)`). Más allá del problema de escala de siempre, acá es directamente una fuga de datos: el portal de un partner (que en algún momento va a ser self-service, con login propio) recibiría por la red la facturación de todos los demás partners antes de descartarla. El endpoint propuesto ya viene scoped por `{id}` para que esto no pueda pasar ni por accidente.

**Otra pieza a decidir con backend**: `calcularDetalleComision()` (la tabla "Detalle de comisión por referido" del drawer) hoy calcula `comisionPrimerMes`/`comisionRecurrente` en el frontend usando un mapa `PRECIO_LISTA_PLAN` hardcodeado en `partnersService.ts` — una copia del mismo mapa que ya existe (con el mismo riesgo de desincronizarse) en `empresasService`. Lo correcto es que el backend, que es dueño del precio de lista real y de las reglas de `IConfigPrograma`, devuelva el desglose ya calculado dentro de cada referido/comisión — el frontend no debería tener su propia copia de la tabla de precios.

**Nota de seguridad, no solo de datos**: hoy no hay ningún control de acceso en `/superadmin/partners/{id}/portal` — cualquiera con la URL ve la ficha de cualquier partner, porque quien navega ahí siempre es un admin de Powip. El día que esto se abra a que el partner externo entre con su propia sesión, esos mismos endpoints van a necesitar resolverse por el token del partner (`/partners/me/...`), no por un `{id}` libre en la URL — dejarlo anotado para no repetir el mismo bloqueo de impersonación que ya se documentó en Empresas → Facturación.

## 🔴 Cola de referidos (spec 8.6.3)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/referidos?estado&page&pageSize
```

```jsonc
[
  {
    "id": "ref-3",
    "partnerId": "par-2",
    "partnerNombre": "Juan Carlos Devs",
    "negocio": "Bazar LimaTech",
    "email": "contacto@bazarlimatech.pe",
    "origen": "Link de partner",
    "plan": "Basic",
    "descuentoPct": 5,
    "estado": "pendiente",
    "creadoEn": "2026-08-10T00:00:00Z"
  }
]
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/referidos/{id}/aprobar
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/referidos/{id}/rechazar
```

Ambas son acciones puras, sin body (`{}`). **Response:** devuelven el referido actualizado (mismo shape que arriba), con `estado: "aprobado"` o `estado: "rechazado"`.

Es la vista global de referidos de **todos** los partners (a diferencia de `GET /partners/{id}/referidos`, que es de uno solo) — mismo criterio de paginación server-side que el resto. **Nota**: el hook actual (`useColaReferidos`) todavía no reenvía `page`/`pageSize` al backend ni pagina la respuesta con `meta` — hoy trae el array completo filtrado solo por `estado`, igual que el resto de listas de esta sección antes de conectar backend real.

## 🔴 Liquidaciones — vista admin de toda la red (spec 8.6.4)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/liquidaciones
```

```jsonc
[
  {
    "id": "liq-1",
    "partnerId": "par-1",
    "partnerNombre": "Agencia Digital Norte",
    "ciclo": "2026-07",
    "montoBruto": 1200,
    "montoReversos": 40,
    "retencion": 92.8,
    "neto": 1067.2,
    "estado": "pagada"
  },
  {
    "id": "liq-2",
    "partnerId": "par-2",
    "partnerNombre": "Juan Carlos Devs",
    "ciclo": "2026-07",
    "montoBruto": 640,
    "montoReversos": 0,
    "retencion": 51.2,
    "neto": 588.8,
    "estado": "pendiente"
  }
]
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/liquidaciones/{id}/confirmar-pago
```

Acción pura, sin body (`{}`). **Response:** devuelve la liquidación actualizada (mismo shape que arriba), con `estado: "pagada"`.

Cálculo de `retencion`/`neto` por ciclo debe quedar en el backend (hoy `partnersService.ts` lo calcula al vuelo con `retencionPct` del mock) — es dinero real, no debería depender de que el navegador tenga la config correcta cacheada.

## 🔴 Reglas & Comisiones (spec 8.6.5)

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/config
```

```jsonc
{
  "opciones": [
    { "id": "A", "firstPct": 40, "recPct": 6 },
    { "id": "B", "firstPct": 70, "recPct": 3 },
    { "id": "C", "firstPct": 50, "recPct": 8 }
  ],
  "descuentoMaxPct": 10,
  "ventanaAtribucionDias": 60,
  "umbralMinimo": 50,
  "retencionPct": 8,
  "nivelPlataMrr": 500,
  "nivelOroMrr": 1500,
  "antiFraude": true,
  "clawback": true
}
```

```
PUT {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/partners/config
```

**Body:** el objeto `IConfigPrograma` completo, con los valores ya editados (mismo shape que la respuesta de arriba, por ejemplo subiendo `retencionPct` a `10` y `nivelOroMrr` a `2000`):
```jsonc
{
  "opciones": [
    { "id": "A", "firstPct": 40, "recPct": 6 },
    { "id": "B", "firstPct": 70, "recPct": 3 },
    { "id": "C", "firstPct": 50, "recPct": 8 }
  ],
  "descuentoMaxPct": 10,
  "ventanaAtribucionDias": 60,
  "umbralMinimo": 50,
  "retencionPct": 10,
  "nivelPlataMrr": 500,
  "nivelOroMrr": 2000,
  "antiFraude": true,
  "clawback": true
}
```

**Response:** devuelve la config actualizada (mismo shape).

Esta config (`opciones` A/B/C, `retencionPct`, umbrales de nivel, `antiFraude`, `clawback`) es la fuente de verdad que alimenta **todos** los cálculos de comisión de arriba — por eso tiene que vivir en el backend desde el día uno, no como un estado que cada sesión de admin edita en memoria y se pierde al refrescar (que es lo que pasa hoy).

## 🟢 Casuística (spec 8.6.6) — no necesita backend

Es contenido de referencia estático (6 reglas de negocio explicadas en texto, sin datos por empresa/partner) — no hay nada que migrar; se deja tal cual.

## Resumen

| Sección | Estado | Endpoint propuesto |
|---|---|---|
| Dashboard & KPIs del programa | 🔴 Simulado | `GET /partners/kpis` |
| Tabla de partners | 🔴 Simulado | `GET /partners`, `PATCH /partners/{id}/aprobar`, `PATCH /partners/{id}/suspender` |
| Ficha de partner (drawer + portal) | 🔴 Simulado | `GET /partners/{id}`, `/referidos`, `/comisiones`, `/liquidaciones` (scoped, no global) |
| Cola de referidos | 🔴 Simulado | `GET /partners/referidos`, `PATCH .../aprobar`, `PATCH .../rechazar` |
| Liquidaciones (vista de red) | 🔴 Simulado | `GET /partners/liquidaciones`, `PATCH .../confirmar-pago` |
| Reglas & Comisiones | 🔴 Simulado | `GET /partners/config`, `PUT /partners/config` |
| Casuística | 🟢 No aplica | Contenido estático, sin datos |

**Nota**: a diferencia de Seguimiento/Adquisición, acá no hay "lo urgente es arreglar rendimiento de algo real" — lo urgente, si el programa de Partners se lanza de verdad, es que backend modele las 5 entidades nuevas (`partner`, `referido`, `comision`, `liquidacion`, `config_programa`) desde cero. El frontend ya queda apuntando a la forma final para que conectar sea un cambio de infraestructura, no de UI.

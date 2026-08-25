# Facturación (Powip → empresas) — contrato de endpoints

> Para: Marco (backend). De: Mau (frontend).
> Esta página es **la factura que Powip le emite a sus empresas cliente por la suscripción SaaS** (cobro de Powip a sus clientes) — **no tiene nada que ver** con el módulo SUNAT ya existente en el resto de la app (`src/api/Facturacion.ts`, `src/features/sunat/**`, `sunatDocumentService`), que es la facturación electrónica de cada negocio cliente hacia SUS PROPIOS clientes finales. Son dos dominios distintos que comparten la palabra "factura" — `docs/superadmin/operacion-endpoints.md` (sección "Monitor SUNAT global") ya señaló el mismo riesgo de confusión de nombres, esto es la otra mitad: el dominio que ahí se descartó por no aplicar es exactamente el que se documenta acá.
>
> Rutas propuestas bajo `{NEXT_PUBLIC_API_SUPERADMIN}/api/v1/facturacion/...` (misma base e infraestructura que el resto de `/superadmin`, ver `src/hooks/superadmin/superadminApi.ts`). Convenciones iguales al resto de la spec: `Authorization: Bearer <jwt>`, fechas ISO-8601, moneda PEN sin formatear, paginación `page`/`page_size` (default 10-25), error `{ "error": { "code", "message" } }`.
>
> Dos páginas hermanas de este mismo menú (**Finanzas POWIP** y **Suscripciones**) se están documentando en paralelo — `docs/superadmin/finanzas-endpoints.md` (MRR waterfall, cohortes, ingresos por fuente: la foto agregada/histórica del negocio) y `docs/superadmin/suscripciones-endpoints.md` (estado y ciclo de vida de cada suscripción). Esta página es el nivel de detalle por-debajo de esas dos: **el registro individual de cada cobro**, con estado de pago y acciones de cobranza. No se duplica contenido acá — si necesitás MRR o estado de suscripción, son esos otros docs.

## Qué ya es real hoy (referencia, no tocar)

| Dato | Cómo se resuelve hoy |
|---|---|
| MRR total de la red, clientes activos | `GET /api/superadmin/saas-metrics` (ver `docs/superadmin/dashboard-endpoints.md`) — es ingreso **recurrente teórico**, no dice qué se cobró/cobrará en cada ciclo ni si una empresa puntual está al día |
| Estado de una suscripción individual | `subscriptionService.getSubscriptionByUserId()` (real, ms-subscription vía `NEXT_PUBLIC_API_SUBS`) — devuelve `SubscriptionDetail`: `status` (`ACTIVE/PENDING_PAYMENT/CANCELLED/INACTIVE/EXPIRED`), `startDate`, `endDate`, `autoRenewal`, `initPoint` (link de checkout de Mercado Pago) |
| Cobro efectivo | Se delega 100% a Mercado Pago (`subscriptionsModal.tsx` redirige a `initPoint`) — el pago ocurre del lado de MP, no hay evidencia de que el backend persista un registro propio de cada cobro |

**Verificado por grep en todo el repo**: no existe ningún servicio, tipo o mock (fuera de `src/mocks/superadmin/finanzas.ts`, que es 100% inventado) que modele una entidad "factura de Powip a una empresa". `SubscriptionDetail` no tiene monto, fecha de vencimiento, IGV, ni historial de cobros — solo el estado actual de la suscripción. Confirma la hipótesis de partida: Powip hoy cobra vía webhooks de suscripción de Mercado Pago, no vía un sistema de facturación propio con registros individuales.

---

## 🔴 No existe un sistema de facturación real — es un sistema nuevo, no un endpoint que falta

Como en `operacion-endpoints.md` → "Fraude/anomalías": esto no es "el dato existe pero no está agregado", es que **la entidad "factura" no existe en ningún backend**. Hoy la página completa corre sobre `src/mocks/superadmin/finanzas.ts` — `facturasMock` deriva de `suscripcionesMock`, que a su vez deriva de `empresasMock.mrr`, un campo que **ya es simulado en el origen** (ver `docs/superadmin/dashboard-endpoints.md`, "Top empresas por MRR"). Es una simulación sobre otra simulación: ningún número que ves hoy en `/superadmin/facturacion` corresponde a un cobro real.

Documentamos igual el contrato completo para que, el día que se decida construir facturación propia (en vez de depender 100% de los webhooks de MP), el frontend ya esté apuntando a la forma correcta.

### 1. Listado de facturas de la red

```
GET /api/v1/facturacion/facturas?page=1&page_size=10&q=&estado=pendiente
```

```jsonc
{
  "data": [
    {
      "id": "FAC-2026-0001",
      "empresaId": "uuid",
      "empresaNombre": "Bella Piel Cosmética",
      "plan": "Pro",
      "monto": 179,
      "igv": 32.22,
      "fechaEmision": "2026-08-01T00:00:00Z",
      "fechaVence": "2026-08-15T00:00:00Z",
      "metodo": "Tarjeta",
      "estado": "pendiente",
      "diasVencida": null,
      "reintentos": null
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 84, "totalPages": 9 }
}
```

**WHY — paginación server-side, no client-side.** Con cientos/miles de empresas facturando cada ciclo, esta lista crece indefinidamente. Mismo anti-patrón ya evitado en `oportunidades-endpoints.md` (radar de upsell) y `operacion-endpoints.md` (caja & COD): el backend pagina y filtra (`q` sobre empresa/N° factura, `estado`), el frontend nunca trae "todas las facturas" y recorta en memoria — hoy `FacturasTable.tsx` ya está armado para eso (`getFacturas({ q, estado, page, pageSize })`), solo falta que la fuente sea real.

**Fuente.** Requiere que cada ciclo de cobro de `ms-subscription` (webhook de MP confirmado o fallido) genere una fila persistida acá — no se puede reconstruir on-the-fly porque hoy no se guarda `monto`/`igv`/`fechaVence` por ciclo, solo el estado *actual* de la suscripción.

**Acciones sobre una factura** (hoy simuladas en `facturacionService.ts`, mutan el mock en memoria):
- `PATCH /facturacion/facturas/{id}/pagar` — marcar pagado manualmente (conciliación para pagos que no llegan por webhook: transferencia, Yape directo, etc.)
- `POST /facturacion/facturas/{id}/reenviar` — reenviar el comprobante al cliente
- `GET /facturacion/facturas/{id}/pdf` — descargar PDF. Hoy el botón "Descargar PDF" no genera nada real (`toast.success("PDF generado (mock)")` — ni siquiera dispara una descarga simulada), así que ni el endpoint ni la generación del PDF existen todavía.

```
PATCH /facturacion/facturas/{id}/pagar
```
**Body:** ninguno — `useMarcarFacturaPagada` manda `{}` (acción pura, el `id` va en la URL).
**Response:** la entidad actualizada (mismo shape que la Sección 1, `estado` pasa a `"pagado"` y se limpian `diasVencida`/`reintentos`):
```jsonc
{
  "id": "FAC-2026-0004",
  "empresaId": "uuid",
  "empresaNombre": "TecnoHogar Express",
  "plan": "Pro",
  "monto": 129,
  "igv": 23.22,
  "fechaEmision": "2026-07-20T00:00:00Z",
  "fechaVence": "2026-08-04T00:00:00Z",
  "metodo": "Transferencia",
  "estado": "pagado",
  "diasVencida": null,
  "reintentos": null
}
```

```
POST /facturacion/facturas/{id}/reenviar
```
**Body:** ninguno — acción pura, `{}`.
**Response:** el frontend (`useReenviarFactura`) ignora el body de la respuesta y siempre resuelve `{ id }` en el cliente — cualquier ack simple sirve, por ejemplo:
```jsonc
{ "success": true }
```

```
GET /facturacion/facturas/{id}/pdf
```
No es un endpoint JSON — descarga un archivo binario (`application/pdf`), no aplica cuerpo de ejemplo en jsonc.

### 2. KPIs de facturación

```
GET /api/v1/facturacion/kpis
```

```jsonc
{ "facturadoMes": 46530, "cobrado": 38200, "pendiente": 5100, "vencido": 3230 }
```

**WHY.** Distinto del MRR de `saas-metrics` (dashboard): MRR es ingreso recurrente *contratado*, esto es dinero *efectivamente facturado/cobrado/vencido este mes* — dos negocios pueden tener el mismo MRR y un cash flow real muy distinto (mora, downgrades a mitad de ciclo, etc.). Una vez que la Sección 1 exista como entidad real, este endpoint es un `SUM(monto) GROUP BY estado` trivial sobre esa tabla — no requiere trabajo adicional aparte del listado. Cacheable unos minutos, no necesita ser tiempo real.

### 3. Cobranza / dunning (facturas vencidas)

```
GET /api/v1/facturacion/vencidas
POST /api/v1/facturacion/facturas/{id}/recordar-cobro
```

```jsonc
{
  "data": [
    { "id": "FAC-2026-0004", "empresaId": "uuid", "empresaNombre": "TecnoHogar Express", "monto": 129, "diasVencida": 9, "reintentos": 2 }
  ]
}
```

**WHY — es un motor, no un endpoint.** La UI (`CobranzaDunningTable.tsx`) ya referencia una regla de negocio concreta (spec 8.23): recordatorio automático a los 3, 7 y 15 días de vencida, y suspensión automática de la cuenta tras 3 intentos sin pago. Eso no es "una query" — es un **job programado** (cron/scheduler) que recorre facturas vencidas, dispara notificaciones, cuenta reintentos, y en el intento N°3 ejecuta una acción real de negocio (suspender acceso de la empresa). El endpoint `GET /vencidas` de arriba es solo la bandeja que muestra lo que ese motor ya calculó — mismo patrón que dashboard-endpoints.md sección 11 ("Alertas") sobre su propio motor de alertas: la bandeja es barata, el motor detrás es la parte cara. Bloqueado, en orden: (a) que exista la entidad factura (Sección 1), (b) el job de reglas 3/7/15 días, (c) la integración con lo que sea que "suspender cuenta" signifique hoy en ms-company/ms-subscription (no hay evidencia de que ese estado de suspensión por mora exista todavía tampoco — es otro hallazgo a confirmar con Producto antes de codear el paso 3 de la regla).

**Acción manual ya cubierta por el endpoint de la Sección 1**: "Marcar Cobrado" en esta tabla reusa `PATCH /facturacion/facturas/{id}/pagar`, no hace falta un endpoint separado.

```
POST /facturacion/facturas/{id}/recordar-cobro
```
**Body:** ninguno — `useRecordarCobro` manda `{}` (acción pura).
**Response:** la entidad actualizada, con `reintentos` incrementado en 1 (mismo shape que la Sección 1):
```jsonc
{
  "id": "FAC-2026-0004",
  "empresaId": "uuid",
  "empresaNombre": "TecnoHogar Express",
  "plan": "Pro",
  "monto": 129,
  "igv": 23.22,
  "fechaEmision": "2026-07-20T00:00:00Z",
  "fechaVence": "2026-08-04T00:00:00Z",
  "metodo": "Transferencia",
  "estado": "vencido",
  "diasVencida": 9,
  "reintentos": 3
}
```

---

## Resumen para planificar

| # | Endpoint | Tier | Bloqueado por |
|---|---|---|---|
| 1 | `GET /facturacion/facturas` (+ pagar / reenviar / pdf) | 🔴 | La entidad "factura" no existe — requiere persistir un registro por ciclo de cobro de `ms-subscription` |
| 2 | `GET /facturacion/kpis` | 🔴 | Depende de 1 — una vez que exista, es un `SUM/GROUP BY` barato |
| 3 | `GET /facturacion/vencidas` + `POST /recordar-cobro` | 🔴 | Depende de 1, más un job de reglas (3/7/15 días) y, para el paso de suspensión, confirmar si ese estado ya existe en ms-company/ms-subscription |

**Nota**: a diferencia de Dashboard/Empresas/Oportunidades (donde casi todo es "agregar una query sobre datos que ya están"), acá — igual que en Operación — no hay nada parcialmente real para conectar hoy. La prioridad real no es "construir estos 3 endpoints", es decidir primero si Powip va a modelar facturación propia o va a seguir delegando 100% en los webhooks de suscripción de Mercado Pago; este documento asume que sí, para dejar el contrato listo si se decide avanzar.

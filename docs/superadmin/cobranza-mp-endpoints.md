# Cobranza MP (Super Admin) — contrato de endpoints

> Para: Marco (backend). De: Mau (frontend).
> Esta página es la sección **Super Admin** de `POWIP_Hito1_Mockup.html` / `POWIP_Hito1_Especificacion.md` (Cobranza Digital + Operación de Entrega): la comisión de **0.5% que Powip cobra sobre cada pago procesado con Mercado Pago** (tarjeta y Yape *dentro de* MP), las cuentas MP conectadas por negocio, la cola de liquidación del modo `powip_temporal` y el control de métodos de pago (Yape directo) por negocio.
>
> **No confundir con dos módulos que ya existen y suenan parecido:**
> - `docs/superadmin/partners-endpoints.md` (pestaña Liquidaciones / Reglas & Comisiones de **Partners**) es la comisión que Powip **paga** a agencias/developers que refieren negocios — dominio de referidos, no tiene nada que ver con Mercado Pago.
> - `docs/superadmin/finanzas-endpoints.md` (Finanzas POWIP) es el P&L / MRR del SaaS de Powip — ingreso por *suscripción*. Acá el ingreso es por *transacción* (0.5% de cada cobro MP de cada negocio cliente a SUS clientes finales).
>
> Rutas propuestas bajo `{NEXT_PUBLIC_API_SUPERADMIN}/api/v1/admin/...` (misma base e infraestructura que el resto de `/superadmin`, ver `src/hooks/superadmin/superadminApi.ts`), tal como las lista la Sección 8 de la especificación. Convenciones iguales al resto de la spec: `Authorization: Bearer <jwt superadmin>`, fechas ISO-8601, moneda PEN sin formatear, error `{ "error": { "code", "message" } }`.

## 🔴 No existe nada de esto todavía — es el Hito 1 completo, no un endpoint suelto

A diferencia de Empresas/Dashboard (donde gran parte ya es real y falta "agregar una query"), acá — igual que Partners y Facturación — **no hay ninguna tabla creada**: `orders.link_token`, `payment_links`, `delivery_codes`, `mp_accounts`, `mp_transactions`, `guias`, `comision_config` y `liquidaciones` son propuestas de `POWIP_Hito1_Especificacion.md` §5, no schema existente en ningún microservicio (`ms-ventas`, `ms-company`, etc.). Hoy toda la página corre 100% sobre `src/mocks/superadmin/comisionesMp.ts`, derivado de `empresasMock` (que a su vez ya es simulado en el origen, ver `dashboard-endpoints.md`).

El Hito 1 completo tiene 4 superficies (link del cliente, portal del repartidor, panel del negocio, Super Admin — ver el mockup). **Esta página documenta solo la superficie Super Admin**; el resto (checkout MP con split, guías/courier, portal del repartidor) vive en el panel del negocio, fuera de `/superadmin`, y no está cubierto por este doc.

---

### 1. KPIs — comisión del mes y salud de cuentas MP

```
GET /api/v1/admin/comisiones
```

```jsonc
{ "comisionMes": 847, "negociosConMp": 34, "negociosTotal": 38, "negociosModoTemporal": 6, "liquidacionPendienteTotal": 2140 }
```

**WHY.** `comisionMes` es el 0.5% agregado de todos los `mp_transactions` del período (spec §5.4). `negociosModoTemporal` y `liquidacionPendienteTotal` son negocios **sin cuenta MP propia** (§5.7 `modo_temporal`): el 100% de su cobro entra a la cuenta de Powip y se liquida el 99.5% manual cada lunes — son los que aparecen en la Sección 4 (Liquidaciones).

### 2. Comisión por fuente del cobro

```
GET /api/v1/admin/comisiones/por-fuente
```

```jsonc
{ "data": [
  { "fuente": "Cobros deuda link", "pct": 68 },
  { "fuente": "Upsell pre-despacho", "pct": 22 },
  { "fuente": "Catálogo / recompra", "pct": 10 }
]}
```

**WHY.** Distribución informativa (mockup Super Admin, barlist "Por fuente") — de qué tipo de cobro viene la comisión del período: saldo de deuda (flujo principal §7.1), upsell pre-despacho (§7.8) o recompra desde el link ya entregado (§7.10).

### 3. Comisión por negocio

```
GET /api/v1/admin/comisiones/por-negocio?periodo=2026-08
```

```jsonc
{ "data": [
  { "empresaId": "uuid", "empresaNombre": "Bella Piel Cosmética", "modo": "propia", "gmvMp": 18420, "comisionPct": 0.005, "comisionMonto": 92.10 }
]}
```

**Fuente.** `SUM(mp_transactions.comision_powip) GROUP BY empresa_id` del período — trivial una vez que exista la tabla `mp_transactions` (§5.4), que hoy no está creada.

### 4. Cuentas MP por negocio

```
GET /api/v1/admin/cuentas-mp
PATCH /api/v1/admin/cuentas-mp/{empresaId}/desconectar
```

```jsonc
{ "data": [
  { "empresaId": "uuid", "empresaNombre": "Bella Piel Cosmética", "mpEmail": "bellapiel@gmail.com", "modo": "propia", "activa": true, "yapeMpActivo": true, "yapeDirectoActivo": false, "conectadaEn": "2026-01-12T00:00:00Z" }
]}
```

**WHY.** Refleja 1:1 la tabla `mp_accounts` (§5.4): `modo='propia'` cuando el negocio conectó su propia cuenta vía OAuth (access_token/refresh_token encriptados AES-256, nunca expuestos al frontend); `modo='powip_temporal'` cuando no — ese negocio cae en la cola de Liquidaciones (Sección 5). "Desconectar" es gestión manual del Super Admin (soporte/fraude), no algo que el negocio dispare — la desconexión normal del lado del negocio vive en su propio panel MP (`docs/superadmin/finanzas-endpoints.md` no la cubre; sería un endpoint del panel de negocio, no de Super Admin).

### 5. Liquidaciones (modo `powip_temporal`)

```
GET /api/v1/admin/liquidaciones
POST /api/v1/admin/liquidaciones/{id}/ejecutar
```

```jsonc
{ "data": [
  { "id": "uuid", "empresaId": "uuid", "empresaNombre": "Kids Land Perú", "periodo": "2026-08",
    "montoBruto": 3120, "comisionPowip": 15.60, "neto": 3104.40, "estado": "pendiente" }
]}
```

```
POST /admin/liquidaciones/{id}/ejecutar
```
**Body:** `{ "nroOperacion": "OP-800123" }` (opcional — si no se manda, backend genera uno).
**Response:** la entidad con `estado: "pagada"`, `nroOperacion` y `ejecutadaAt` seteados. Escribe en `audit_log` (regla transversal §2 de la especificación: toda acción sobre dinero se audita) y genera `liquidaciones.constancia_url` (PDF).

**WHY — es el job semanal de la spec, no una query suelta.** §4 (glosario, "Modo powip_temporal") especifica liquidación **cada lunes**; este endpoint es la ejecución manual/individual desde Super Admin, pero el flujo real necesita además un cron que arme el lote semanal por negocio antes de que haya algo que "ejecutar" acá — bloqueado por: (a) que exista `mp_transactions` con `liquidado_a_negocio=false` para acumular, (b) el job semanal de corte, (c) la integración bancaria/de transferencia real para el pago (hoy el botón solo marca estado, no mueve dinero).

### 6. Métodos de pago por negocio (Yape directo)

```
PATCH /api/v1/admin/negocios/{empresaId}/metodos
```
**Body:** `{ "yapeMpActivo": true }` o `{ "yapeDirectoActivo": false }` (un campo por llamada — `MetodosPagoTable.tsx` dispara un PATCH por toggle).
**Response:** la cuenta MP actualizada (mismo shape que la Sección 4).

**WHY — regla de negocio no negociable (§10.2).** Yape directo al número = **0% comisión** (no pasa por MP) y es el único método que el Super Admin prende/apaga por negocio o por plan; Tarjeta MP y Yape dentro de MP viajan con la conexión de la cuenta (Sección 4) y sí generan 0.5%. Este toggle es el que en el mockup aparece como "Yape directo al número (manual) — 0% comisión · requiere validar comprobante".

---

## Resumen para planificar

| # | Endpoint | Tier | Bloqueado por |
|---|---|---|---|
| 1 | `GET /admin/comisiones` | 🔴 | Requiere `mp_transactions` (§5.4) — no existe ninguna tabla del Hito 1 Cobranza todavía |
| 2 | `GET /admin/comisiones/por-fuente` | 🔴 | Idem — además requiere clasificar cada transacción por `tipo_cobro` (deuda/upsell/recompra) |
| 3 | `GET /admin/comisiones/por-negocio` | 🔴 | Idem 1, agrupado por `empresa_id` |
| 4 | `GET /admin/cuentas-mp` + `/desconectar` | 🔴 | Requiere `mp_accounts` + integración OAuth MP Marketplace (§9) |
| 5 | `GET/POST /admin/liquidaciones` (+ `/ejecutar`) | 🔴 | Requiere 1 y 4, más el job semanal de corte y la integración de pago real |
| 6 | `PATCH /admin/negocios/:id/metodos` | 🔴 | Requiere 4 — es un `UPDATE` simple una vez que `mp_accounts` exista |

**Nota.** Como en `facturacion-endpoints.md`: la prioridad real no es "construir estos 6 endpoints" sino decidir el orden de build del Hito 1 completo (ver `POWIP_Hito1_Especificacion.md` §14, reparto sugerido Mau/Marco) — este doc documenta el contrato de la superficie Super Admin para que el frontend ya apunte a la forma correcta apenas el backend empiece a levantarla.

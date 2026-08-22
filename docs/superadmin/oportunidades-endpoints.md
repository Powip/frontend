# Oportunidades — contrato de endpoints

> Esta página es casi enteramente una vista agregada sobre datos de OTROS módulos (Empresas, Operación de Red, Finanzas) — no tiene su propio dominio de datos. Por eso casi todo acá depende de que existan agregaciones a nivel de toda la red, no de una empresa a la vez — y ese es justo el tipo de endpoint que más falta en el backend hoy.

## 🟢 Ya real

| Sección | Fuente |
|---|---|
| Canales de venta de la red | `company.sales_channels` (ms-company, real) — agregado client-side sobre la misma lista cacheada que usa el directorio de Empresas (`src/hooks/superadmin/useEmpresas.ts`), sin fetch adicional. Ver `useCanalesRed` en `useDashboard.ts` (se comparte con el Dashboard). |
| GMV de la red | `saas-metrics.gmvTotal` (ya real, ver `docs/superadmin/dashboard-endpoints.md`) |
| Alertas proactivas | Reusa `useAlertasImportantes` del Dashboard — mismo estado (simulado, apunta a `/dashboard/alertas` cuando exista el motor de alertas de la Sección 8.24) |

## 🔴 Simulado — necesita agregación nueva a nivel de red

### Radar de upsell

La spec pide "todas las empresas, ordenado por MRR potencial". El cálculo de "qué ofrecerle a cada empresa" (`getUpsellOportunidades` en `src/mocks/superadmin/empresas.ts`) usa datos por-empresa que sí tenemos reales de a una (ventas, canales, integraciones — ver `docs/superadmin/empresas-endpoints.md`) — el problema es de **escala, no de dato**: calcularlo para todas las empresas de la red significaría N llamadas reales (una por empresa) desde el frontend, exactamente el patrón que venimos evitando en cada módulo por rendimiento.

**Pedido concreto**: un endpoint que YA calcule esto server-side, recorriendo la base una sola vez:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/oportunidades/radar-upsell?limit=20
```

```jsonc
{
  "data": [
    { "empresaId": "uuid", "empresaNombre": "TecnoHogar Express", "plan": "Pro", "mrrPotencial": 120, "motivo": "320 pedidos/mes superan el límite del plan actual.", "caliente": true }
  ]
}
```

Las reglas para calcularlo pueden ser las mismas que ya probamos client-side en `getUpsellOportunidades` (falta módulo SUNAT, falta canal de alta conversión, pedidos por encima del plan) — es portar esa lógica al backend, no inventarla de nuevo.

### Couriers de la red

Mismo problema: `courierService.fetchCouriers(companyId)` es real pero por-empresa. Un agregado "% entrega/devolución por courier, en toda la red" necesita recorrer guías de todas las empresas — no es viable desde el frontend.

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/oportunidades/couriers-red
```

### Segmentación (rubro / plan)

Bloqueado en el origen: ni `rubro` ni `plan` existen como campos en `ms-company` (ver `docs/superadmin/empresas-endpoints.md`). No hay nada que agregar todavía — primero hace falta que esos campos existan por empresa.

### Empresas en riesgo / Adelantos COD en tránsito

Mismos gaps ya documentados: "riesgo" no tiene definición de negocio ni campo real (ver Dashboard/Empresas), y "COD en tránsito" depende de los endpoints de `ms-courier` que ya están pedidos en `src/components/finanzas/BACKEND_REQUERIMIENTOS.md`. No se duplican acá.

## Resumen

| Ítem | Estado | Bloqueado por |
|---|---|---|
| Canales de venta de la red | 🟢 Real | — |
| GMV de la red | 🟢 Real | — |
| Alertas proactivas | 🟡 Compartido con Dashboard | Motor de alertas (8.24) |
| Radar de upsell | 🔴 Simulado | Agregación server-side (la lógica ya existe, falta portarla) |
| Couriers de la red | 🔴 Simulado | Agregación server-side sobre guías de todas las empresas |
| Segmentación (rubro/plan) | 🔴 Simulado | Campos `rubro`/`plan` no existen en ms-company |
| Empresas en riesgo / COD en tránsito | 🔴 Simulado | Mismos gaps ya documentados en Dashboard/Empresas |

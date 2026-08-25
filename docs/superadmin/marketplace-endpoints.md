# Marketplace — contrato de endpoints

> A diferencia de Seguimiento u Operación (donde al menos una porción tenía dato real detrás), acá no encontramos nada: grepeamos `src/services`, `src/api` y `src/interfaces` completos buscando `marketplace`, `app-store`, `developer-app` y el único hit fuera de este módulo es `"MARKETPLACE"` como valor del enum de canal de venta en `src/api/sales/types/order.types.ts` (ecommerce tipo Mercado Libre) — un concepto totalmente distinto, no un backend de apps. Hoy `src/services/superadmin/marketplaceService.ts` (usado por los 3 componentes de la página) lee y **muta en memoria** el array `appsMarketplaceMock` de `src/mocks/superadmin/plataforma.ts`; no hay ningún `ms-*` que sepa qué es una "app" del marketplace, quién la instaló, ni quién la aprobó.
>
> Esto es, en espíritu, el mismo caso que "Fraude / anomalías" en `docs/superadmin/operacion-endpoints.md` (y el doc de Partners que se está escribiendo en paralelo): no es que falte exponer un dato que ya existe en alguna base — es un subsistema entero (catálogo de apps + instalaciones por empresa + workflow de aprobación) que todavía no existe en ningún backend. Por eso este doc es casi enteramente 🔴.

## 🔴 Catálogo de apps publicadas — no existe ninguna tabla de "app" ni de "instalación" en ningún ms-*

La spec pide el catálogo con métricas de adopción reales: cuántas empresas tienen cada app instalada. Hoy `instalacionesCount` es un número fijo hardcodeado en el mock (`app-1` → 312, etc.), no una cuenta de nada.

**El punto que más importa dejar explícito**: el día que exista una tabla tipo `app_instalada` (`empresa_id`, `app_id`, `instalada_en`), la forma correcta de resolver "instalaciones por app" es un `COUNT(*) GROUP BY app_id` hecho en el backend — **no** que este panel liste las apps, y por cada una llame a un endpoint de "empresas con esta app instalada" para contar en el cliente, ni que traiga la lista de apps instaladas de cada una de las ~cientos de empresas y tallee acá. Es exactamente el mismo anti-patrón N+1 ya señalado en `oportunidades-endpoints.md` (radar de upsell) y en `operacion-endpoints.md` (caja/COD de la red): a 10 empresas no se nota, a la base real de Powip sí.

**Pedido concreto**:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/marketplace/apps
```

```jsonc
{
  "data": [
    {
      "id": "uuid",
      "nombre": "Facturador SUNAT Pro",
      "categoria": "Facturación",
      "estado": "publicada", // "publicada" | "pendiente" | "rechazada"
      "instalacionesCount": 312, // COUNT(*) agregado server-side sobre empresas activas
      "revenueSharePct": 15,
      "descripcion": "Emisión automática de boletas y facturas electrónicas.",
      "icono": "🧾"
    }
  ]
}
```

**WHY**: hoy `instalacionesCount` no representa nada real, así que no hay riesgo inmediato de N+1 — pero es el momento de dejar documentado el contrato correcto antes de que alguien, al conectar esto por primera vez, resuelva "instalaciones" con un loop de llamadas por empresa porque es lo que ya tiene a mano (la lista de apps instaladas por empresa, si existe algún día en `ms-integrations` o similar).

## 🔴 Cola de apps pendientes de aprobación — el workflow de aprobar/rechazar no persiste en ningún lado

Hoy "Aprobar"/"Rechazar" en `AppsPendientes.tsx` llama a `aprobarApp`/`rechazarApp` de `marketplaceService.ts`, que solo cambian `estado` sobre el objeto en memoria del array mock — se pierde al refrescar la página, no queda registro de quién aprobó ni cuándo (a diferencia de `audit_log`, que sí existe como mock para otras acciones administrativas del panel, ver `IAuditLog` en `src/interfaces/superadmin/IPlataforma.ts`).

**Pedido concreto** — reusar el mismo listado de arriba con filtro por estado (evita mantener dos fuentes de verdad para lo que es la misma tabla):

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/marketplace/apps?estado=pendiente
```

```jsonc
// misma forma que el catálogo de arriba, filtrada por estado=pendiente
{
  "data": [
    {
      "id": "app-3",
      "nombre": "Sync TikTok Shop",
      "categoria": "Ecommerce",
      "estado": "pendiente",
      "instalacionesCount": 0,
      "revenueSharePct": 15,
      "descripcion": "Sincroniza inventario y pedidos con TikTok Shop.",
      "icono": "🎵"
    }
  ]
}
```

Acciones:

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/marketplace/apps/{id}/approve
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/marketplace/apps/{id}/reject
```

```jsonc
// Respuesta de ambas acciones
{ "data": { "id": "uuid", "estado": "publicada", "aprobadoPorId": "uuid-team", "aprobadoEn": "2026-08-24T15:00:00Z" } }
```

**WHY**: separar `approve`/`reject` de un `PATCH` genérico (en vez de `PATCH /marketplace/apps/{id}` con `{ estado: "publicada" }` a mano) porque son las únicas dos transiciones válidas desde "pendiente" y cada una probablemente dispara efectos distintos del lado backend (aprobar debería habilitar la app para instalación real; rechazar debería, como mínimo, notificar al desarrollador/partner que la envió) — igual que Seguimiento separa "marcar hecho" de un `PATCH` crudo sobre `next_action`.

## 🔴 KPIs — mismo problema de agregación, a menor escala

`getKpisMarketplace()` hoy calcula `total`/`publicadas`/`pendientes`/`instalacionesTotales` sumando sobre el array mock completo ya traído al cliente. Con 6 apps no importa; documentamos igual el endpoint agregado para no repetir acá el mismo patrón que ya se corrigió en Dashboard/Adquisición (traer todo y sumar en el cliente no escala, y una vez que `instalacionesCount` sea un dato real por empresa, sumar "instalaciones totales" en el cliente vuelve a ser el mismo anti-patrón de la sección anterior).

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/marketplace/kpis
```

```jsonc
{ "data": { "total": 6, "publicadas": 4, "pendientes": 1, "instalacionesTotales": 840 } }
```

## Resumen

| Ítem | Estado | Bloqueado por |
|---|---|---|
| Catálogo de apps (`GET /marketplace/apps`) | 🔴 Simulado | No existe ninguna tabla de "app" ni "instalación" en ningún `ms-*` — subsistema nuevo |
| Cola de pendientes (`?estado=pendiente`) | 🔴 Simulado | Mismo endpoint que el catálogo, filtrado |
| Aprobar / Rechazar app | 🔴 Simulado | Hoy solo muta el mock en memoria — no persiste, no audita quién/cuándo |
| KPIs agregados | 🔴 Simulado | Mismo subsistema; hoy se calculan sumando el mock en el cliente |

**Nota**: como en Operación, no hay nada real que conectar hoy — la página funciona 100% sobre datos de ejemplo. El valor de este pase es dejar el contrato propuesto documentado (con el punto de agregación server-side ya señalado) para que, cuando Producto defina el modelo de negocio del marketplace (revenue share, quién puede publicar, etc.), conectar sea swapear la fuente de datos y nada más — sin repensar cómo evitar el N+1.

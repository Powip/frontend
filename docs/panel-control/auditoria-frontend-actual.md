# Auditoría del frontend actual frente al Panel de Control v5

> Fecha: 2026-09-24. Rama: `feat/nuevo-dashboard` (actualizada a `origin/main` en `822aabc`).
> Referencias: `POWIP_Panel_Control_v5_Especificacion` (v1.0, 21-09-2026) y `powip_panel_control_v5_1.html`.
> No hay repositorios de backend en este equipo: la semántica de los endpoints se deduce de los tipos y usos del frontend.

## 1. Dashboard actual (`/dashboard`)

| Aspecto | Estado actual | Dónde |
|---|---|---|
| Ruta | 5 tabs: Resumen General, Análisis Comercial, Geografía, Equipo, Finanzas | `src/app/dashboard/page.tsx` |
| Componentes | `stats.tsx`, `analysis.tsx`, `geography.tsx`, `TeamManagement.tsx`, `FinanceStats.tsx`, `PeriodSelector.tsx`, `DashboardCard.tsx` | `src/components/dashboard/` |
| Datos | `axios` directo con `useEffect`, sin React Query, contra `NEXT_PUBLIC_API_VENTAS/stats/*` | `stats.tsx` |
| Auth | `AuthContext`: silent refresh, `auth.user.role/permissions`, `company.stores`, un solo `selectedStoreId` | `src/contexts/AuthContext.tsx` |
| Roles | `hasAdminAccess` / `isSuperadmin`; `/dashboard` abierto a cualquier autenticado; los no admin mandan `sellerId` desde el cliente | `src/config/permissions.config.ts` |
| "Ver como" | Precedente: `OperationsRoleContext` (ADMIN / DESPACHO / CALLCENTER) | `src/contexts/OperationsRoleContext.tsx` |
| Gráficos | Recharts 3, con doble eje (la especificación lo prohíbe) | `stats.tsx` |
| Arquitectura recomendada | Por feature: `api/dto/mappers/models/services/hooks/keys/schemas` | `src/features/sunat`, `src/features/sales` |

El rediseño previo (PR #137/#138, revertido dos veces en `main`) agrupaba ventas por `ccConfirmadoAt` y usaba `mock-data.ts`; no se usa como base.

## 2. Conflictos entre la especificación y el comportamiento actual

1. **PENDIENTE no es venta.** `/stats/summary` suma todos los estados y el dashboard lo muestra como "Ventas Totales". El flujo real es `PENDIENTE → PREPARADO → LLAMADO` (LLAMADO se muestra como "Contactado"), no existe `RECHAZADO`, `CON_GUIA` se llama `ASIGNADO_A_GUIA`, existen `INCOMPLETE` y `PREVENTA`, y se puede pasar de `ENTREGADO` a `ANULADO` (`src/utils/domain/orders-status-flow.ts`). La confirmación de call center vive en `subEstadoCc` / `ccConfirmadoAt`.
2. **Atribución al canal de origen.** Hay cuatro candidatos (`salesChannel`, `closingChannel`, `canalOrigen`, `externalSource`) y ninguno apunta a un id de la ficha `/config/canales`.
3. **Fecha de Resultado vs Caja.** El rediseño previo usaba `ccConfirmadoAt`; la especificación exige `fecha_ingreso` (`created_at`). Para Caja no se guarda la fecha de liquidación del courier.
4. **Prepago.** Un único `status` no expresa "pagado pero no entregado". El P&L de Administración cuenta solo `ENTREGADO` y deja fuera `PAGADO` (`src/app/administracion/resumen/page.tsx`).
5. **Costos faltantes.** `costAmount` es un string por pedido; no distingue "sin costo" de 0.
6. **Comparación a la misma antigüedad.** No existe. Administración compara contra el periodo anterior completo.
7. **Permisos.** Todo se decide en el cliente; `/order-header/*` devuelve costos a cualquier rol.

## 3. Datos existentes aprovechables

| Dato | Estado | Fuente |
|---|---|---|
| Pedidos con ítems, pagos, logs, costos | Disponible | `GET /order-header/store/{id}`, `getOrdersByCompany` |
| Ficha de canal (parcial) | Disponible parcial | `GET /config/canales?empresaId` (`canalConfigService`) |
| Embudo, aging, intentos, upsell, ranking CC | Disponible | `/atencion-al-cliente/kpis/*`, `/atencion-al-cliente/agentes/kpis` |
| Opciones de asesor(a) | Disponible | `/atencion-al-cliente/agentes/vendedores` |
| Gastos mensuales (incluye PUBLICIDAD) | Disponible | `/company/{id}/gastos` |
| Pauta por canal y día, lives de TikTok | No existe | Cierre del día guarda en `localStorage` |
| Liquidaciones de courier | No se persisten | `src/app/operaciones/liquidaciones/_components/types.ts` |
| Historial de estados | Aproximable con `logs[].data.status` | `src/app/metricas/operaciones/page.tsx` |

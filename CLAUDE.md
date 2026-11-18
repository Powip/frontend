# frontend — Contexto Local

## Stack

- Lenguaje: TypeScript 5
- Framework: Next.js 15.5.9 (App Router) + React 19.1.0
- Estilos: Tailwind CSS 4
- Componentes: Radix UI + Shadcn/ui
- Estado servidor: TanStack React Query
- Auth: Supabase SSR
- Pagos: Mercado Pago SDK React
- Reportes: jsPDF, ExcelJS
- Agentes: nextjs-logic-writer, nextjs-test-writer

## Responsabilidad

Interfaz principal de Powip: dashboard empresarial, catálogo de productos, gestión de órdenes de venta, pagos, logística y seguimiento de envíos.

## Estructura de directorios

```
src/
├── app/           ← App Router (layouts, pages, loading, error)
├── components/    ← Componentes React reutilizables
├── api/           ← Funciones de llamadas HTTP a backends
├── contexts/      ← Contextos de estado global (React Context)
├── services/      ← Lógica de negocio en cliente
├── types/         ← Tipos TypeScript
└── interfaces/    ← Interfaces de dominio
```

## Contratos con otros servicios

Llama via HTTP:

- ms-auth — login, registro, refresh token
- ms-company — empresas, tiendas, canales
- ms-products — catálogo de productos
- ms-ventas — órdenes, carrito, pagos
- ms-logistics — inventario y movimientos
- ms-courier — guías de envío y seguimiento
- ms-subscription — planes y suscripción activa
- ms-integrations — estado de integraciones

**FEAT-24 SEC — `order-header` de ms-ventas pide sesión:** toda llamada a `${NEXT_PUBLIC_API_VENTAS}/order-header/...` va con `axiosAuth` (`@/lib/axiosAuth`, que agrega el `Bearer` y lo renueva ante un 401), nunca con `axios` pelado: ms-ventas toma la empresa y el usuario del token (404 si el pedido es de otra empresa, 403 si la tienda o la empresa de la URL no son de tu sesión) e ignora `userId`/`requestingUserId` del cuerpo. Los que mandaban sin token (`src/api/Ventas.ts`, `bulkStatusUtils.ts` en `bulk-status` y su respaldo por pedido, `ScheduledDeliverySection.tsx`, el costo cotizado de `SendToShalomModal.tsx`) se pasaron a `axiosAuth`. Este cambio tiene que estar en producción ANTES de la rama de cierre de ms-ventas (`feat/feat24-sec1-ventas-cierre`).

## Puertos expuestos

- HTTP: 3000 (desarrollo)
- Producción: Vercel

## Variables de entorno requeridas

```
NEXT_PUBLIC_API_COMPANY
NEXT_PUBLIC_API_VENTAS
NEXT_PUBLIC_API_PRODUCTOS
NEXT_PUBLIC_API_USERS
NEXT_PUBLIC_API_SUBS
NEXT_PUBLIC_API_INVENTORY
NEXT_PUBLIC_API_COURIER
NEXT_PUBLIC_API_INTEGRATIONS
NEXT_PUBLIC_FRONTEND_URL
NEXT_PUBLIC_LANDING_URL
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
```

## Normas aplicables

- **Lógica** (App Router, Server/Client Components, hooks, services HTTP, react-query): skill `nextjs-server-components`
- **Tests** (React Testing Library, renderHook): skill `nextjs-testing-rtl`

## FEAT-24 RMV — «Quitar del almacén» en /inventario

- Papelera en la vista «Por producto» de Stock: una por fila de variante (título «Quitar del almacén») y una en la cabecera del producto («Quitar producto»). Solo con `canEditInventory` (Administrador u Operaciones) y con **un solo almacén en la vista** (el elegido en el filtro o el único que ve el usuario); con varios, una pista pide elegir el almacén. No se ofrece con IMEI/serie ni en «Por almacén».
- `RemoveFromWarehouseDialog` (`src/components/inventory/`): doble confirmación (paso 1: qué se quita, de qué almacén, que sigue en el catálogo y en los demás almacenes, que el historial queda y que vuelve a aparecer cuando entra stock; paso 2: «Sí, quitar»). El 409/403 del servidor se muestra tal cual dentro del diálogo; tras un 409 la lista se refresca en silencio.
- `removeFromWarehouse(inventoryId, { variantId } | { productId })` en `warehouseOpsService.ts` → `POST {products}/warehouses/:id/remove-items` (fachada JWT; nunca manda empresa ni usuario).
- `fetchBusinessInventoryItems({ excludeRemoved: true })` es opcional a propósito: solo lo pide /inventario (lista y Excel). El catálogo y la ficha siguen viendo las filas quitadas.
- Deploy: después de ms-logistics (que acepta `excludeRemoved` en `/inventory-item/search`) y de ms-products (la ruta nueva). Si el front sale antes, la búsqueda de /inventario puede dar 400 por el parámetro desconocido.

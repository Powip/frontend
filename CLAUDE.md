# frontend — Contexto Local

## Stack

- Lenguaje: TypeScript 5
- Framework: Next.js 15.5.9 (App Router) + React 19.1.0
- Estilos: Tailwind CSS 4
- Componentes: Radix UI + Shadcn/ui
- Estado servidor: TanStack React Query
- Auth: JWT de ms-auth (Supabase solo del lado del servidor, con la service role)
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

## Notas de seguridad

- **Supabase sin anon key (FEAT-23 T16):** desde el 2026-11-27 el rol `anon` (y `authenticated`) no tiene permisos en el schema `public` de Supabase: cualquier lectura o escritura con la anon key da «permission denied». No crear clientes de Supabase en el navegador ni con la anon key. Las tablas del CRM viejo del superadmin (`leads`, `onboarding_progress`, `webhook_logs`, etc.) se tocan solo desde rutas de servidor con `createAdminClient` (`@/utils/supabase/admin`, service role, sin vuelta a la anon key), y el navegador las pide a `/api/superadmin/*` con el `Bearer` de la sesión. Si se crea una tabla nueva en `public`, nace sin permisos para `anon`: no dárselos.
- **OAuth de Shopify (FEAT-24 SEC):** conectar o volver a autorizar una tienda se pide con la sesión: `requestShopifyAuthUrl(shop)` (`src/services/shopifyStockService.ts`, `POST {NEXT_PUBLIC_API_INTEGRATIONS}/shopify/auth-url` con el token de un admin; ms-integrations firma la empresa y el usuario del token). Se navega solo si `isShopifyAuthorizeUrl(url, shop)` (`src/lib/shopifyStock.ts`) y con `goToExternalPage`. Nunca armar `/shopify/auth/<tienda>?companyId=` ni enlazar `/shopify/reauth/<tienda>`: eran sin sesión y se borran en el cierre de ms-integrations. `reauthorizeUrl` de `reauthorization-status` ya no se usa.
- **Rutas de Shopify con sesión (FEAT-24 SEC, sec5):** `GET /shopify/status/:companyId`, `POST /shopify/sync/:tienda`, `POST /shopify/sync` y `POST /shopify/confirm-sync/:tienda` de ms-integrations piden JWT: siempre con `axiosAuth`, nunca con `axios` pelado (la empresa de la ruta tiene que ser la del token; las tres de sincronizar, solo un administrador de la empresa de la tienda). Los rechazos se muestran con `parseShopifySyncError` (`src/lib/shopifyStock.ts`). `/configuracion/tiendas` (estado y los dos botones «Sincronizar») y el modal de sincronización inicial ya van con `axiosAuth`. Este cambio tiene que estar en producción ANTES de la rama de cierre de ms-integrations (`feat/feat24-sec2-integrations-cierre`), que deja de aceptar `status` y `sync/:tienda` sin token.
- **Rutas de Shalom con sesión (FEAT-24 SEC, sec6a):** ms-integrations cierra `/shalom/*` (antes anónimas): la empresa sale del token y nombrar otra (ruta, cuerpo o `companyId` de la query) responde 404. Toda llamada a `${NEXT_PUBLIC_API_INTEGRATIONS}/shalom/...` va con `axiosAuth`, nunca con `axios` pelado: `src/services/shalomService.ts` (manda el `Bearer` que recibe o, si no recibe uno, deja que `axiosAuth` ponga el de la sesión), y en `SendToShalomModal.tsx` la búsqueda de agencias (`/shalom/agencies/search/:q`) y la cotización (`/shalom/quote`), que salían sin token. Los PDF de Shalom (comprobante y rótulo) se piden como blob (`generateShalomTicketPdf` / `generateShalomLabelPdf`) y se abren o descargan con un object URL (`ShalomDocumentModal`, `ShalomPremiumTrackingModal`); nunca un enlace directo (`<a href>`, `window.open`) a `/shalom/ticket-pdf` o `/shalom/label`, que no puede llevar el header: por eso se borraron `getShalomTicketPdfUrl` y `getShalomLabelPdfUrl` (estaban importadas y sin uso). Compartir por WhatsApp manda el archivo (o el enlace público de seguimiento), no un enlace al PDF, así que no hace falta un enlace firmado. Este cambio tiene que estar en producción ANTES de la rama de cierre de ms-integrations (`feat/feat24-sec6a-integrations-cierre`).
- **Shopify, Aliclik y EVA solo para admin donde corresponde (FEAT-24 SEC, sec6b):** el callback de OAuth (`src/app/shopify/callback/page.tsx`) manda al modal de sincronización inicial la tienda de Powip VINCULADA a esa tienda de Shopify (`getShopifyStatus`, `store_id` de la misma `shop_url`); sin vínculo, el modal pide elegir entre `auth.company.stores` (con una sola, queda elegida). Nunca mandar `stores[0]`: ms-integrations usa la vinculada y, sin vínculo, exige una tienda de la empresa (404). «Sincronizar Shopify» de `/inventario` y `/productos` solo con `hasAdminAccess(auth?.user?.role)`. Aliclik y EVA (`/configuracion/integraciones/aliclik|eva`): cargar o actualizar credenciales, la tienda destino de Aliclik y las tarifas de EVA (`EvaShippingRatesSection`, prop `canEdit`) son solo de un admin (ms-integrations responde 403 al resto); quien no es admin ve el estado y un aviso. Al resto de Aliclik el `webhookSecret` le llega en null (no se arma la URL del webhook). Los vínculos de SKU de EVA y el envío de pedidos siguen para cualquier usuario de la empresa.

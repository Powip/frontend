# Empresas + Perfil 360 — contrato de endpoints

> Es el módulo con más servicios reales ya existentes de los 4 que llevamos, pero también el que expone el problema de arquitectura más serio del proyecto: **hay dos fuentes de datos distintas para "empresa"**, y hay que resolverlo antes de seguir construyendo sobre esto.

## 🔴 Bloqueante — dos fuentes de "empresa" que no son la misma cosa

- **`companyService.ts`** (real, HTTP a `ms-company` vía `NEXT_PUBLIC_API_COMPANY`) — es la fuente que documenta `CLAUDE.md` ("Llama vía HTTP: ms-company — empresas, tiendas, canales"). Devuelve `{id, name, userId, stores, cuit, billingAddress, phone, billingEmail, sales_channels, closing_channels, createdAt}`. **Sin campo de estado** (`is_active`, `plan`, `status` no existen acá).
- **`src/app/api/superadmin/businesses/**`** — lee una tabla `company` **directo de Supabase** (bypassea `ms-company` por completo), con campos `is_active`, `plan` (string plano) que `companyService` no tiene. Nadie en todo el repo hace `POST`/`PATCH` a esa tabla — si esos campos tienen datos, no los está poblando esta app.

**Este frontend ya eligió `companyService` (ms-company) como fuente para todo lo nuevo** — es la única consistente con el contrato de `CLAUDE.md` y la que ya usa `saas-metrics` (Dashboard). Las rutas `businesses/**` y `worker/onboarding-alerts` quedan **sin usar desde el nuevo `/superadmin/empresas`** — no se tocaron ni se borraron (podrían tener consumidores externos, ej. el webhook de onboarding), pero es deuda a resolver con backend: o se confirma que apuntan a la misma base y se sincroniza el DTO de `ms-company`, o se depreca ese camino.

## 🔴 Urgente — rendimiento: `GET /company` no pagina

`companyService.getAllCompanies` pega a `{API_COMPANY}/company?includeStores=true` **sin ningún parámetro de paginación** — trae todas las empresas de la plataforma, con sus tiendas anidadas, en un solo request. Es el mismo patrón de riesgo que ya señalamos en `GET /leads` (Adquisición). Con la plataforma creciendo, esto se degrada.

**Pedido concreto**: agregar `page`/`page_size` + filtro `search` server-side a `GET /company`, devolviendo `{data, meta: {page, page_size, total, total_pages}}` como ya hace `GET /businesses` (que sí pagina, aunque sea la fuente equivocada — el patrón ahí está bien). Mientras tanto, el frontend trae la lista completa una sola vez (cacheada con `staleTime` largo) y pagina/filtra en memoria — aceptable con cientos de empresas, no con decenas de miles.

## 🟢 Directorio de Empresas

| Necesidad | Fuente | Estado |
|---|---|---|
| Listar empresas | `companyService.getAllCompanies(token)` | 🟢 Real (sin paginar, ver arriba) |
| KPI "Total" | `length` de la lista | 🟢 Real |
| KPI "Activos / En riesgo / Trials / Inactivos" | — | 🔴 No existe ningún campo de estado en `ms-company` ni en `ms-subscription` (ver `docs/superadmin/dashboard-endpoints.md` sobre "trial"). Mismo problema, otra vez. Sin una definición de negocio + campo real, no hay forma honesta de segmentar esto. |
| Ver Perfil 360 | `companyService.fetchCompanyById(id, token)` | 🟢 Real |
| Cambiar plan / Suspender | `companyService.updateCompany(id, token, data)` | 🟡 El endpoint existe, pero no hay campo `plan` ni `estado` en el DTO — no hay qué mandarle. Bloqueado por lo mismo que el punto anterior. |
| Eliminar empresa | `companyService.deleteCompany(token, id)` | 🟢 Real |
| Entrar como admin (impersonar) | — | 🔴 No existe nada — ni token de otra empresa, ni endpoint admin. Sección 14 de la spec pide que quede auditado; hoy no hay ni la función base. |
| Nueva Empresa | `userService.createPlatformUser` + `companyService.createCompany` | 🟢 Real, pero es un flujo de 2 pasos (ver abajo) |

### Alta de empresa — flujo real (no es un solo POST)

`POST /company` de `ms-company` exige `user_id` — la empresa tiene que tener un dueño que ya exista en `ms-auth`. El flujo real:
1. `userService.createPlatformUser({identityDocument, name, surname, email, password, phoneNumber, roleName: "ADMIN"}, token)` → devuelve `userId`.
2. `companyService.createCompany(token, {name, userId, cuit, billingAddress, phone, billingEmail})`.
3. Si querés setear canales de venta desde el alta: `companyService.updateCompany(id, token, {sales_channels})` — `createCompany` no los acepta, solo `updateCompany`.

El modal "Nueva Empresa" del frontend ahora pide también los datos del usuario dueño (nombre, apellido, email, documento, teléfono) — no es un campo más, es un paso necesario del flujo real.

## Perfil 360 — estado real por tab

| Tab | Estado | Fuente / gap |
|---|---|---|
| **Salud** | 🔴 Simulado | No hay ningún health score en ningún backend. Ver Dashboard/`clientes-riesgo` — mismo problema, sin resolver todavía. |
| **Ventas & GMV** | 🟢 Real | `salesService.getCompanySalesSummary/getCompanyBilling/getCompanyDailyIncome(token, companyId, ...)`. Sin ticket promedio ni recompra nativos — se derivan (`totalSales/orderCount`) o quedan sin mostrar. |
| **Pedidos** | 🟢 Real | `atencionClienteService.getPedidosCC({storeId, ...})` — paginado, filtrable, ya lo usa `/operaciones/pedidos`. |
| **Productos & SKUs** | 🟡 Parcial | `productService.getCompanyProducts(token, companyId)` da catálogo (sin precio/stock en el DTO). "Top vendidos" no existe en ningún endpoint — queda simulado. |
| **Facturación (SUNAT)** | 🔴 Bloqueado | `sunatDocumentService` real existe, pero el scope sale del JWT del usuario logueado, **no acepta `companyId`** — sin impersonación real (ver arriba) el superadmin no puede pedir comprobantes de una empresa que no es la suya. Pedido a backend: variante admin del endpoint que acepte `companyId` explícito. |
| **Pagos & Recaudos** | 🔴 Documentado aparte | Ver `src/components/finanzas/BACKEND_REQUERIMIENTOS.md` (ya existe, del 2026-05-06) — confirma que hoy es 100% mock y lista los endpoints de `ms-courier` que faltan (`/shipping-guides/store/:id/metrics`, `/liquidaciones`, etc.). No lo duplicamos acá. |
| **Envíos & Couriers** | 🟡 Parcial | `courierService.fetchCouriers(companyId)` + `fetchCourierGuides(courierId)`, real. Sin % entrega/devolución agregado — se puede derivar de las guías o queda simulado. |
| **Integraciones & Upsell** | 🟡 Parcial | Conectado real: `evaService`, `shalomService`, `shopifyService`, `aliclikService` — cada uno con `getXStatus/getXCredentials(token, companyId)`, se consultan en paralelo. "Upsell" (qué ofrecer) sigue siendo 100% editorial/simulado — no hay ningún cálculo de oportunidad real. |
| **Suscripción** | 🟡 Real con join manual | `subscriptionService.getSubscriptionByUserId(token, userId)` — la empresa no tiene suscripción propia, hay que resolver primero `companyService.fetchCompanyById(id).userId` y consultar con ese id. Pedido a backend: exponer `getSubscriptionByCompanyId` directo evitaría este join. |
| **Usuarios** | 🟢 Real | `userService.getUsersByCompany(companyId, token)`. |
| **Soporte** | 🔴 Simulado | No existe ningún servicio de tickets real en el repo, ni documentado como pendiente en otro lado. Mismo estado que el módulo `/superadmin/soporte` completo. |

## Resumen para planificar

| Ítem | Prioridad |
|---|---|
| Resolver la doble fuente de "empresa" (ms-company vs Supabase `businesses`) | 🔴 Bloqueante — afecta todo lo demás |
| Paginar `GET /company` en ms-company | 🔴 Urgente — rendimiento |
| Definir "activo/riesgo/trial/inactivo" con un campo real (empresa y/o suscripción) | 🟡 Alto valor, requiere decisión de producto |
| `getSubscriptionByCompanyId` directo (sin pasar por userId) | 🟢 Bajo esfuerzo |
| Variante admin de comprobantes SUNAT con `companyId` explícito | 🟡 Depende de que exista impersonación real primero |
| Impersonación real ("entrar como admin") | 🟡 Alto valor, alto esfuerzo — necesaria para Facturación y para la propia feature del directorio |
| "Top vendidos" por SKU, % entrega/devolución agregado, upsell real | 🟢 Nice-to-have |
| Soporte (tickets) real | Ver el módulo `/superadmin/soporte` — es la misma brecha, no es específica de Empresas |

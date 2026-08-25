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

### Bodies reales — Directorio de Empresas (leídos de `companyService.ts`/`userService.ts`)

**Listar empresas**
```
GET {NEXT_PUBLIC_API_COMPANY}/company?includeStores=true
```
```jsonc
[
  {
    "id": "8a2f1e40-...",
    "name": "Bella Piel Cosmética",
    "user_id": "1c3d4e50-...",
    "stores": [{ "id": "st-01", "name": "Tienda Principal" }],
    "cuit": "20601234567",
    "billing_address": "Av. Javier Prado 1234, San Isidro",
    "phone": "+51987654321",
    "logo_url": "https://cdn.powip.com/logos/bella-piel.png",
    "sales_channels": ["whatsapp", "web", "tiktok"],
    "closing_channels": ["whatsapp"],
    "billing_email": "facturacion@bellapiel.pe",
    "created_at": "2026-02-10T12:00:00.000Z"
  }
]
```
Nota: sin paginación, sin `is_active`/`plan`/`status` — ver bloqueos arriba. `companyService.getAllCompanies` no mapea `iva`/`powipCommissionRate` (a diferencia de `fetchCompanyById`), aunque la API los devuelva.

**Ver Perfil 360 (detalle de empresa)**
```
GET {NEXT_PUBLIC_API_COMPANY}/company/{id}/with-stores
```
```jsonc
{
  "id": "8a2f1e40-...",
  "name": "Bella Piel Cosmética",
  "user_id": "1c3d4e50-...",
  "stores": [{ "id": "st-01", "name": "Tienda Principal" }],
  "cuit": "20601234567",
  "billing_address": "Av. Javier Prado 1234, San Isidro",
  "phone": "+51987654321",
  "logo_url": "https://cdn.powip.com/logos/bella-piel.png",
  "sales_channels": ["whatsapp", "web", "tiktok"],
  "closing_channels": ["whatsapp"],
  "billing_email": "facturacion@bellapiel.pe",
  "iva": 18,
  "powipCommissionRate": 3.5
}
```

**Cambiar plan / Suspender (`updateCompany`)**
```
PATCH {NEXT_PUBLIC_API_COMPANY}/company/{id}
```
**Body** (los únicos campos que el DTO acepta hoy — nótese que no hay `plan` ni `estado`, por eso está bloqueado):
```jsonc
{
  "name": "Bella Piel Cosmética",
  "cuit": "20601234567",
  "billing_address": "Av. Javier Prado 1234, San Isidro",
  "phone": "+51987654321",
  "logo_url": "https://cdn.powip.com/logos/bella-piel.png",
  "sales_channels": ["whatsapp", "web", "tiktok"],
  "closing_channels": ["whatsapp"],
  "powip_commission_rate": 3.5
}
```
**Response:** devuelve la empresa actualizada, mismo shape que "Ver Perfil 360" arriba.

**Eliminar empresa**
```
DELETE {NEXT_PUBLIC_API_COMPANY}/company/{id}
```
Sin body. Response: el body crudo que devuelva `ms-company` (el frontend no lo tipa, solo verifica que el request no rechace).

**Entrar como admin (impersonar)**: no hay endpoint — ver el bloqueo arriba, no se fuerza un ejemplo acá.

### Bodies reales — Alta de empresa (flujo de 2-3 pasos)

**Paso 1 — crear el usuario dueño**
```
POST {NEXT_PUBLIC_API_USERS}/api/v1/auth/admin/register
```
**Body:**
```jsonc
{
  "identityDocument": "45678912",
  "name": "Rosa",
  "surname": "Delgado",
  "email": "rosa@bellapiel.pe",
  "password": "Powipx7k92q1",
  "address": "Pendiente",
  "city": "LIMA",
  "province": "LIMA",
  "district": "LIMA",
  "phoneNumber": "+51987654321",
  "role": { "name": "ADMIN" }
}
```
**Response:**
```jsonc
{ "id": "1c3d4e50-...", "userId": "1c3d4e50-...", "name": "Rosa", "surname": "Delgado", "email": "rosa@bellapiel.pe" }
```

**Paso 2 — crear la empresa**
```
POST {NEXT_PUBLIC_API_COMPANY}/company
```
**Body:**
```jsonc
{
  "name": "Bella Piel Cosmética",
  "user_id": "1c3d4e50-...",
  "cuit": "20601234567",
  "billing_address": "Av. Javier Prado 1234, San Isidro",
  "phone": "+51987654321",
  "billing_email": "rosa@bellapiel.pe"
}
```
**Response:** empresa creada, mismo shape que "Ver Perfil 360" arriba (sin `sales_channels` todavía).

**Paso 3 — opcional, setear canales de venta**
```
PATCH {NEXT_PUBLIC_API_COMPANY}/company/{id}
```
**Body:**
```jsonc
{ "sales_channels": ["whatsapp", "web"] }
```

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

### Bodies reales — por tab del Perfil 360 (leídos de cada `*Service.ts`)

**Ventas & GMV**
```
GET {NEXT_PUBLIC_API_VENTAS}/order-header/summary/company/{companyId}?fromDate=2026-08-01&toDate=2026-08-24
```
```jsonc
{ "totalSales": 18450.5, "orderCount": 132, "income": [{ "date": "2026-08-20", "amount": 1200 }] }
```
```
GET {NEXT_PUBLIC_API_VENTAS}/stats/billing?storeId={companyId}&year=2026
```
```jsonc
[{ "month": "Ago", "currentYear": 18450.5, "previousYear": 15200 }]
```
```
GET {NEXT_PUBLIC_API_VENTAS}/stats/daily-income?storeId={companyId}&fromDate=2026-08-01&toDate=2026-08-24
```
```jsonc
[{ "date": "2026-08-20", "totalIncome": 1200 }]
```
Ticket promedio se deriva en el front (`totalSales / orderCount`), no viene de ningún endpoint.

**Pedidos**
```
GET {ms-ventas}/atencion-al-cliente/pedidos?storeId={companyId}&page=1&limit=10
```
```jsonc
{
  "data": [
    {
      "id": "ord-9f2a...",
      "orderNumber": "OV-000482",
      "customer": { "fullName": "Juan Pérez" },
      "grandTotal": "89.90",
      "status": "EN_ENVIO",
      "courier": "Shalom",
      "created_at": "2026-08-23T16:20:00.000Z"
    }
  ],
  "total": 132,
  "page": 1,
  "totalPages": 14
}
```

**Productos & SKUs**
```
GET {NEXT_PUBLIC_API_PRODUCTOS}/products/company/{companyId}
```
```jsonc
[
  { "id": "prod-01", "name": "Serum Vitamina C 30ml", "sku": "BP-SVC-30", "companySku": "SVC30", "status": true, "hasVariants": false, "imageUrl": "https://cdn.powip.com/products/serum.png" }
]
```
Sin precio/stock en el DTO — "Top vendidos" no existe en ningún endpoint, queda simulado.

**Facturación (SUNAT)**: bloqueado por impersonación — no hay endpoint admin con `companyId` explícito hoy, no se fuerza un ejemplo (ver bloqueo arriba).

**Envíos & Couriers**
```
GET {NEXT_PUBLIC_API_COURIER}/couriers/company/{companyId}
```
```jsonc
[{ "id": "cour-01", "name": "Shalom", "phone": "+51999888777", "email": "ops@shalom.pe", "companyId": "8a2f1e40-...", "isActive": true, "created_at": "2026-01-15T00:00:00.000Z" }]
```
```
GET {NEXT_PUBLIC_API_COURIER}/couriers/{courierId}/guides
```
```jsonc
[{ "id": "guide-01", "guideNumber": "SHL-000921", "created_at": "2026-08-23T16:25:00.000Z", "status": "en_transito", "deliveryType": "domicilio", "deliveryAddress": "Av. Arequipa 1200, Lince" }]
```
Sin % entrega/devolución agregado — se puede derivar de las guías o queda simulado.

**Integraciones & Upsell** (cada vendor con su propio `getXCredentials`/`getXStatus`, se consultan en paralelo):
```
GET {NEXT_PUBLIC_API_INTEGRATIONS}/eva/credentials/{companyId}
```
```jsonc
{ "id": "eva-cred-01", "companyId": "8a2f1e40-...", "baseUrl": "https://api.eva.pe", "clientType": "MARKETPLACE", "maskedApiKey": "eva_****9f3a", "hasWebhookSecret": true, "isActive": true, "createdAt": "2026-03-01T00:00:00.000Z", "updatedAt": "2026-07-10T00:00:00.000Z" }
```
(o `null` con 404 si la empresa no tiene credenciales EVA configuradas)
```
GET {NEXT_PUBLIC_API_INTEGRATIONS}/shalom/status/{companyId}
```
```jsonc
{ "isLoggedIn": true, "username": "bellapiel_ops", "hasInstance": true }
```
```
GET {NEXT_PUBLIC_API_INTEGRATIONS}/shopify/status/{companyId}
```
```jsonc
[{ "isConnected": true, "shop_url": "bella-piel.myshopify.com", "store_id": "st-01", "inventory_id": "inv-01" }]
```
```
GET {NEXT_PUBLIC_API_INTEGRATIONS}/aliclik/credentials/{companyId}
```
```jsonc
{ "id": "alk-cred-01", "companyId": "8a2f1e40-...", "baseUrl": "https://api.aliclik.pe", "isActive": true, "webhookSecret": "whsec_***", "importStoreId": "st-01", "createdAt": "2026-04-12T00:00:00.000Z", "updatedAt": "2026-07-01T00:00:00.000Z" }
```
"Upsell" (qué ofrecer) sigue siendo 100% editorial/simulado — no hay ningún cálculo de oportunidad real detrás de esto.

**Suscripción**
```
GET {NEXT_PUBLIC_API_SUBS}/subscriptions/user/{userId}
```
```jsonc
[
  {
    "id": "sub-01",
    "userId": "1c3d4e50-...",
    "plan": { "id": "plan-pro", "name": "Pro", "description": "Plan Pro mensual", "price": 179, "durationInDays": 30 },
    "startDate": "2026-08-01T00:00:00.000Z",
    "endDate": "2026-08-31T23:59:59.000Z",
    "status": "ACTIVE",
    "autoRenewal": true,
    "initPoint": "https://mercadopago.com/checkout/..."
  }
]
```
Es un array (historial) — la vigente es la de `startDate` más reciente (join manual por `userId`, ver pedido de `getSubscriptionByCompanyId` directo arriba).

**Usuarios**
```
GET {NEXT_PUBLIC_API_USERS}/api/v1/auth/company/{companyId}/users
```
```jsonc
[{ "id": "1c3d4e50-...", "name": "Rosa", "surname": "Delgado", "email": "rosa@bellapiel.pe", "phoneNumber": "+51987654321", "identityDocument": "45678912", "status": true }]
```

**Salud** y **Soporte**: simulados a propósito, sin ningún endpoint real detrás — no se fuerza un ejemplo (ver estado arriba).

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

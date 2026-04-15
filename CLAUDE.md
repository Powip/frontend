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

`docs/normas/nextjs-normas.md`

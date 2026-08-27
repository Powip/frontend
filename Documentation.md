# Documentación Técnica Frontend - POWIP

Este documento presenta una auditoría técnica completa y una guía de referencia del repositorio `frontend` basado en Next.js (App Router) y TypeScript. El propósito de este archivo es facilitar la toma de control del proyecto por parte del equipo técnico.

---

## 1. Guía de Inicio Local (Local Setup & Environment)

### Requisitos Previos
- **Node.js:** v20.x o superior (sugerido basado en `@types/node` v20).
- **Gestor de Paquetes:** `npm` (ya que existe un archivo `package-lock.json`).

### Variables de Entorno
Para correr el proyecto localmente, es necesario crear un archivo `.env` o `.env.local` en la raíz copiando `.env.example`. A continuación la clasificación de variables requeridas:

#### Públicas y de Configuración
- `NEXT_PUBLIC_FRONTEND_URL`: URL del frontend local (ej. `http://localhost:3000`).
- `NEXT_PUBLIC_LANDING_URL`: URL pública del landing page.

#### Microservicios (Backend propio)
- `NEXT_PUBLIC_API_COMPANY`: Endpoint para microservicio de Compañías.
- `NEXT_PUBLIC_API_VENTAS`: Endpoint para microservicio de Ventas.
- `NEXT_PUBLIC_API_PRODUCTOS`: Endpoint para microservicio de Productos.
- `NEXT_PUBLIC_API_USERS`: Endpoint para microservicio de Usuarios/Autenticación.
- `NEXT_PUBLIC_API_SUBS`: Endpoint para microservicio de Suscripciones.
- `NEXT_PUBLIC_API_INVENTORY`: Endpoint para microservicio de Inventarios.
- `NEXT_PUBLIC_API_COURIER`: Endpoint para microservicio de Couriers/Logística.
- `NEXT_PUBLIC_API_INTEGRATIONS`: Endpoint para microservicio de Integraciones.
- `NEXT_PUBLIC_API_CLIENTES`: Endpoint para microservicio de Clientes.
- `NEXT_PUBLIC_API_SUPERADMIN`: Endpoint propio del BFF/Panel para superadmins.

#### Integraciones de Terceros
- **Supabase:**
  - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Para el cliente público.
  - `SUPABASE_SERVICE_ROLE_KEY`: **Privada** (solo para uso en API routes de Next.js).
- **Mercado Pago:** `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`.
- **Google:** `NEXT_PUBLIC_GOOGLE_API_KEY`, `WEBHOOK_SECRET_GOOGLE_FORMS` (privada).

#### Seguridad
- `SUPERADMIN_EMAILS`: Lista de correos con acceso al panel de Superadmin.

### Comandos de Configuración e Inicio
```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor de desarrollo (Turbopack habilitado)
npm run dev

# Otros comandos útiles:
# npm run build (Para compilar)
# npm run format (Para formatear con Biome)
# npm run check (Para verificar tipos y linting)
```

### Posibles Bloqueos al Levantar Localmente
- **CORS o Cookies `httpOnly`:** El sistema de autenticación asume el envío automático de cookies (`withCredentials: true` en axios). Si estás en `localhost` levantando el backend en un puerto/dominio diferente, asegúrate de que tu backend tenga el CORS correctamente configurado para permitir origin `http://localhost:3000` y envío de credenciales.
- **Variables de Supabase:** Si falta el `SUPABASE_SERVICE_ROLE_KEY`, las llamadas del BFF a Supabase en la ruta `/api/superadmin` fallarán con un 500.

---

## 2. Resumen Ejecutivo del Panel de Administración

### Propósito del Frontend
La aplicación funciona como el **ERP / Panel de Administración Principal (Backoffice)** (POWIP) de cara a los negocios y a los administradores del sistema. Permite a los usuarios gestionar sus negocios (empresas, tiendas, inventario, facturación, y ventas), al mismo tiempo que ofrece un panel de "Superadmin" interno para gestionar las suscripciones, clientes y métricas de crecimiento SaaS de Powip en sí.

### Módulos Principales (Estructura de `src/app/`)
- **Gestión Comercial & Ventas:** `/ventas`, `/registrar-venta`, `/compras`, `/registrar-compra`, `/carritos-abandonados`.
- **Inventario & Productos:** `/inventario`, `/productos`, `/packs-promos`.
- **Logística:** `/couriers`, `/centro-envios`, `/seguimiento`.
- **Finanzas & Facturación:** `/finanzas`, `/facturacion` (emisión y consulta).
- **Contactos:** `/clientes`, `/proveedores`, `/usuarios`, `/atencion-cliente`.
- **Reportes & Análisis:** `/dashboard`, `/metricas`.
- **Configuración:** `/configuracion`, `/new-company`, `/restablecer-contrasena`, `/login`.
- **Administración Interna Powip:** `/superadmin`, `/administracion`.
- **Integraciones externas:** `/shopify`, `/google-sheets`.

### Navegación
La estructura sugiere un "Dashboard" o panel principal tras iniciar sesión. El usuario cambia entre los contextos de los módulos utilizando una barra de navegación lateral o superior gestionada probablemente por el `layout.tsx` central. Al seleccionar una Tienda (estado que se guarda en LocalStorage), el contexto general de las tablas y datos se adapta.

---

## 3. Mapa de Integraciones & Endpoints

### Endpoints Internos (BFF / Next.js API Routes en `src/app/api/`)
Se utiliza el patrón BFF primariamente para operaciones seguras e internas administrativas:
- **/api/superadmin/...**: Rutas exclusivas protegidas por el `middleware.ts`. Aquí encontramos endpoints para métricas de SaaS (`saas-metrics`), negocios (`businesses`), funnel (`conversion-funnel`), leads (`leads`), donde el Next.js server se conecta *directamente* a la base de datos de Supabase usando el Service Role.
- **/api/webhooks/...**: Puntos de recepción para webhooks (ej. Google Forms).

### Microservicios y Endpoints Externos (`src/lib/gateway.ts` & `src/api/`)
Gran parte del sistema frontend interactúa directamente con los microservicios sin pasar por el Next API (consumidos mediante Axios):
- **MS-Users:** `/users` y `/api/v1/auth/*` (Autenticación).
- **MS-Company:** `/company`
- **MS-Ventas:** `/ventas`
- **MS-Products:** `/products`
- **MS-Logistics & Courier:** `/logistics`, `/courier`
- **MS-Subscription:** `/subscription`, `/subscription-flow`
- **MS-Clients & Integrations:** `/clients`, `/integrations`

### Autenticación
La aplicación implementa un sistema híbrido/custom en `AuthContext.tsx`:
- **Login Inicial:** `/api/v1/auth/...` en el MS-Users. Devuelve un JWT de corto tiempo y una **httpOnly cookie** con el *Refresh Token*.
- **Refresh Silencioso:** Al cargar la app, se invoca un endpoint de refresh que lee la cookie segura y entrega un nuevo `accessToken`.
- **Manejo en cliente:** El `accessToken` (JWT) se decodifica con `jwt-decode` (sólo para saber roles y claims, no se valida la firma en cliente). Además, se almacena en `tokenStore.ts` e inyecta en todas las peticiones con Axios Interceptors (`axiosAuth.ts`).
- **Superadmin:** Las rutas API internas de superadmin cuentan con un `middleware.ts` en Next.js que valida si el token contiene un email presente en `SUPERADMIN_EMAILS`.

---

## 4. Arquitectura y Patrones de Diseño

### Arquitectura Principal
- **Next.js App Router:** La app está en `src/app/`, haciendo uso de Server Components (donde sea necesario) y Client Components (`"use client"` fuertemente en hooks y vistas interactivas).
- **Patrón BFF Híbrido:** Solo para el rol `superadmin` y webhooks. El resto hace Fetching Cliente-a-Microservicio.
- **UI Frameworks:** Radix UI y Tailwind CSS empaquetados por **shadcn/ui**. Iconografía con `lucide-react`. Formularios validados con `react-hook-form` y `zod`.

### Manejo de Estado Global
1. **React Query (`@tanstack/react-query`):** Es la herramienta principal para la lectura, mutación, caché, e invalidación de estados remotos. Los hooks están distribuidos en `src/hooks/` (ej. `useAdminQueries.ts`, `useVentas.tsx`, `useCreateClient.tsx`).
2. **Context API (`src/contexts/`):** Utilizado para estados verdaderamente globales como sesión (`AuthContext`), selección de Tienda actual, y roles operacionales (`OperationsRoleContext`).

### Evaluación de Código y Deuda Técnica
- **Duplicidad de Organización:** Existen dos carpetas (`src/services/` y `src/api/`) que básicamente cumplen el mismo propósito: encapsular llamadas HTTP (Axios/Fetch). Es una deuda técnica que puede llevar a confusión sobre dónde se deben definir las peticiones de un módulo nuevo. Sería ideal unificarlas.
- **Dependencia a Zustand no presente:** Pese a la complejidad, el estado de UI local o persistente se maneja de forma ad-hoc con React y Contextos en lugar de un manejador optimizado.
- **Acoplamiento de Lógica:** En algunos custom hooks (`src/hooks/*.tsx`) se expone directamente JSX y lógica, lo cual mezcla un poco responsabilidades puras.

---

## 5. Hoja de Ruta para Desarrollo de Nuevos Endpoints

Si necesitas crear una funcionalidad nueva usando el patrón BFF (enrutada a través del servidor Next.js para ocultar llaves o procesar datos sensibles):

### Paso 1: Crear el Endpoint Backend (Route Handler)
Crea la carpeta dentro de `src/app/api/` (ej. `src/app/api/mi-modulo/route.ts`).
```typescript
// src/app/api/mi-modulo/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Lógica segura: usar SUPABASE_SERVICE_ROLE_KEY, o llamar APIs privadas
  return NextResponse.json({ message: "Datos desde el BFF" });
}
```

### Paso 2: Crear el Archivo de Servicio de Fetch (API Client)
Para mantener orden, en la carpeta `src/api/` (o donde decida unificarse), crear una función que apunte al endpoint local.
```typescript
// src/api/MiModulo.ts
import axios from 'axios';

export const getMiModuloData = async () => {
  const { data } = await axios.get('/api/mi-modulo');
  return data;
};
```

### Paso 3: Crear el Custom Hook (React Query)
En la carpeta `src/hooks/` (ej. `useMiModulo.ts`), exponemos el acceso a la data.
```typescript
// src/hooks/useMiModulo.ts
"use client";
import { useQuery } from '@tanstack/react-query';
import { getMiModuloData } from '@/api/MiModulo';

export function useMiModuloData() {
  return useQuery({
    queryKey: ['mi-modulo-data'],
    queryFn: getMiModuloData,
  });
}
```

### Paso 4: Consumo en un Componente React
Finalmente, en la carpeta de rutas (ej. `src/app/mi-modulo/page.tsx`), importas y utilizas el hook.
```tsx
// src/app/mi-modulo/page.tsx
"use client";
import { useMiModuloData } from '@/hooks/useMiModulo';

export default function MiModuloPage() {
  const { data, isLoading } = useMiModuloData();

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div>
      <h1>Módulo</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```
*Si la ruta no usará BFF, el flujo es idéntico desde el paso 2, solo que el servicio apuntaría a la URL del gateway externo usando `axiosAuth`.*

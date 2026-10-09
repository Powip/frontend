# 09 · Página pública del pedido y acortador (X3)

Referencias: PDF §2 (POWIP Link, link de rastreo), §5.1, §5.2, §6.3.1 (incidencia y comprobante en la página), §6.4.4 (evidencia), §9.2 (`link_token`), §10.3 (`GET /p/:token`, `GET /r/:codigo`), §13 caso 22, §15 FAQ. El capítulo 7 del PDF, que debería describir la página, **no está** (D-23). El mockup no la dibuja.

## Qué muestra en el Hito 1

Rastreo (estado, courier, código de guía, agencia y horario si aplica, fecha estimada, eventos), motivo de incidencia si existe, foto de entrega y comprobante (PDF) si SUNAT lo aceptó. Sin login. En el Hito 2 se suman confirmar y pagar: fuera de alcance.

## Situación actual en el código

| Hecho | Evidencia |
|---|---|
| El link que hoy reciben los compradores apunta a la landing: `${NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}` | `src/components/modals/CustomerServiceModal.tsx:586`, `src/app/operaciones/pedidos/_components/types.ts:226`, `src/app/ventas/page.tsx:937`, `src/app/finanzas/page.tsx:423`, `src/components/modals/GuideDetailsModal.tsx:581`, `src/components/modals/orderReceiptModal.tsx:109`, `src/app/centro-envios/components/shipmentUtils.tsx:59` |
| Usa el número de pedido, adivinable; el PDF exige token largo no adivinable (caso 22) | — |
| `/rastreo` figura como ruta pública y sin menú en este repo, pero no hay `src/app/rastreo/` | `src/components/auth/AuthGuard.tsx:15-21`, `src/components/layout/AppContainer.tsx:14-21` |
| El layout raíz envuelve todo con `AuthProvider` y `AppContainer` (cliente) | `src/app/layout.tsx` |
| Vistas de rastreo internas reutilizables existen: `ShalomOrderTrackingView`, `AliclikOrderTrackingView`, `CourierTrackingView` | `src/components/tracking/`, `src/components/couriers/CourierTrackingView.tsx` |

## Opciones de alojamiento (D-06, pendiente)

| Opción | A favor | En contra |
|---|---|---|
| A. Landing (repo aparte, ya tiene `/rastreo`) | Ya es pública, ya la conocen los compradores, no carga la sesión del panel | Repo no disponible aquí; hay que migrar de `orderNumber` a token y sumar evidencia y comprobante |
| B. Este repo, ruta `src/app/p/[token]/page.tsx` | Reusa componentes de rastreo y evidencia; un solo equipo | El layout raíz monta `AuthProvider` (intenta refrescar sesión) y `AppContainer`; habría que agregar `/p` a `PUBLIC_ROUTES` y `noSidebarRoutes`, o reorganizar con grupos de rutas y layouts separados. Subdominio `{tienda}.powip.lat` requiere reescritura por host en `middleware.ts` (hoy solo protege `/api/superadmin`) y dominio comodín en Vercel |
| C. App nueva liviana | Aislada, rápida, SEO controlado | Otro despliegue |

Recomendación del frontend: decidir A o C; B solo si se acepta separar el layout público. En cualquier caso, los **componentes presentacionales** (línea de tiempo, tarjeta de evidencia, tarjeta de comprobante) se diseñan sin dependencias de `AuthContext` para poder llevarlos a cualquiera de las tres.

## Ficha de la página (independiente de la opción)

| Campo | Detalle |
|---|---|
| Ruta | `https://{tienda}.powip.lat/p/{token}` (PDF); acortador `https://powip.lat/r/{codigo}` → 302 |
| Disparador | Botón del aviso de WhatsApp ("Rastrear mi pedido", "Ver guía y dirección", "Ver mi pedido") |
| Lecturas | `GET /p/:token` (C-30.1) sin autenticación |
| Estados | Carga: skeleton. Token inválido o vencido: "No encontramos este pedido" (sin revelar si existe). Error: "No pudimos cargar tu pedido" + Reintentar. Sin evidencia ni comprobante: secciones ocultas. Pedido anulado: estado claro (SIN DEFINIR el texto) |
| Datos y privacidad | Mostrar solo lo necesario: nombre de pila, número de pedido, productos, estado, agencia. Dirección y teléfono completos: SIN DEFINIR (riesgo si el link se reenvía) |
| Comprobante | Botón "Descargar boleta/factura" con `pdfUrl` (vigencia de la URL firmada: SIN DEFINIR) |
| Evidencia | Imagen con texto alternativo "Foto de entrega del {fecha}" (D-15) |
| SEO | `noindex, nofollow`; sin previsualización con datos personales en Open Graph |
| Rendimiento | Página liviana, móvil primero (llega desde WhatsApp) |
| Medición | El clic se registra en `/r/:codigo` (backend); la página no necesita analítica propia para el Hito 1 |
| Garantías BE | Token largo y no adivinable; rate limit; no exponer IDs internos |
| Criterios de aceptación | §14.6: la foto de entrega aparece en la página; caso 22: funciona desde otro celular; incidencia muestra el motivo del courier; comprobante disponible tras SUNAT aceptado |
| Contrato | C-30 SPEC; alojamiento SIN DEFINIR |

## Cambios en el panel que dependen de esto

- C-30.3: el detalle del pedido debe exponer el link nuevo para que la ficha y los botones dejen de armar `/rastreo/{orderNumber}`.
- La variable `{{link_rastreo}}` de las plantillas la resuelve backend con el acortador; el frontend solo la muestra en vistas previas.

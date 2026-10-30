# 09 · Página pública del pedido y acortador (X3)

Referencias: PDF §2, §5.1-5.2, §6.3.1, §6.4.4, §9.2, §10.3, §13 caso 22. El capítulo 7 del PDF (la página) no está (D-23); el mockup no la dibuja.

**Estado (etapa 9, 2026-10-10):** componentes completos y montaje pendiente en `/p/[token]` dentro de este repo.

| Campo | Detalle |
|---|---|
| Componentes | `src/components/public-tracking/PublicTrackingPage.tsx`: identidad de la tienda, estado, línea de tiempo, envío (courier, guía, agencia y horario o domicilio con distrito, fecha estimada), fotos por tipo, comprobante aceptado y productos. Sin dependencias de `AuthContext`, móvil primero, modo oscuro |
| Ruta montada | `src/app/p/[token]/page.tsx`: muestra "Seguimiento no disponible todavía", no lee el token, no consulta APIs, `robots: noindex, nofollow` y sin Open Graph. `/p/` agregado a `PUBLIC_ROUTES` (`AuthGuard.tsx`) y a las rutas sin menú (`AppContainer.tsx`), igual que `/rastreo` (D-74) |
| No cambia | El rastreo actual de la landing (`/rastreo/{orderNumber}`) y los botones que lo arman. No se afirma que el dominio esté conectado |
| Estados | Pendiente, carga, enlace inválido o vencido (mismo mensaje para ambos: "No encontramos este pedido… Pide a la tienda un enlace nuevo", sin revelar si existe), error con Reintentar, datos incompletos (se ocultan las secciones sin datos) |
| Evidencia | "Foto de entrega"; "Foto del despacho" y "Foto de la preparación" con "no confirma la entrega" (D-56) |
| Comprobante | Solo si backend envía un comprobante aceptado por SUNAT con `pdfUrl` (vigencia de la URL firmada: backend) |
| Fuera de alcance | Confirmación COD, pagos y Pau (Hito 2, D-01) |

## DTO público mínimo (C-30.1, propuesto)

`GET /p/:token` (sin autenticación, solo token largo no adivinable; rate limit; nunca por número de pedido):

```json
{
  "store": { "name": "LIVII Store", "logoUrl": null },
  "order": { "number": "ORD-149880", "createdAt": "…", "customerFirstName": "Jorge", "items": [{ "name": "…", "quantity": 1 }] },
  "status": { "label": "Entregado", "description": "…", "tone": "progress | delivered | incident | cancelled", "incidentReason": null },
  "timeline": [{ "label": "En camino", "at": "…", "done": true }],
  "shipping": { "courierName": "Shalom", "trackingCode": "…", "deliveryMode": "agency | home", "estimatedDate": "2026-10-08", "district": "Miraflores", "agency": { "name": "…", "address": "…", "hours": "…" } },
  "evidence": [{ "type": "PREPARATION | DISPATCH | DELIVERY", "imageUrl": "…", "takenAt": "…" }],
  "invoice": { "label": "Boleta", "seriesNumber": "B001-000482", "pdfUrl": "…" },
  "updatedAt": "…"
}
```

No incluir: DNI, teléfono, correo, dirección completa (solo distrito), apellidos, notas internas, asesora, montos, pagos, IDs internos. Respuestas: `404` para token inválido o vencido (la página muestra el mismo mensaje), `429`, `5xx`.

## Acortador `/r/:codigo` (C-30.2)

Lo resuelve backend: registra el clic (dato del Historial) y redirige `302` a la página con token. El frontend no implementa `/r`.

## Montaje pendiente

1. Decidir alojamiento (D-06): este repo (ya montado como pendiente), la landing u otra app liviana. Para la landing: copiar `PublicTrackingPage.tsx` y `public-tracking.model.ts` (dependen solo de `lima-time.util`, enums de evidencia, `Button`, `next/image` y `lucide-react`).
2. Subdominio `{tienda}.powip.lat`: reescritura por host en `middleware.ts` y dominio comodín en Vercel (o la plataforma que se use).
3. Reemplazar el estado pendiente de la ruta por la lectura de `GET /p/:token` (server component o fetch del cliente) mapeando al DTO.
4. C-30.3: que el detalle del pedido exponga el link con token para que la ficha y los botones dejen de armar `/rastreo/{orderNumber}`.
5. Sacar la página del `AuthProvider` global. Hoy `src/app/layout.tsx` envuelve todas las rutas con `AuthProvider`, que al cargar hace `POST {API_AUTH}/api/v1/auth/refresh` con cookies (`withCredentials`). En `/p/token-de-prueba` sin sesión responde 401, igual que en `/login`; la página no lo usa ni lo muestra. Si el comprador tiene una sesión de POWIP en ese navegador, el proveedor además pide la empresa del usuario. Antes de publicar el enlace al comprador hay que montar `/p` en un grupo de rutas con su propio layout raíz o excluirlo del refresh silencioso. No se cambió en esta entrega porque afecta la autenticación de todo el sitio.

## Criterios de aceptación

Con datos: la foto de entrega aparece en la página (§14.6); funciona desde otro celular (caso 22); la incidencia muestra el motivo; el comprobante aparece tras SUNAT aceptado. Sin datos (tests): ningún dato privado en pantalla, enlace inválido y vencido indistinguibles, evidencia de despacho nunca presentada como entrega.

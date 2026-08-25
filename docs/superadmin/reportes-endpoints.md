# Reportes — contrato de endpoints

> A diferencia de los módulos migrados hasta ahora, este es el primero que llega con generación de archivos real ya construida — no en el backend de superadmin (`{NEXT_PUBLIC_API_SUPERADMIN}`), sino como rutas BFF de este mismo Next.js (`src/app/api/superadmin/reports/*`) que consultan Supabase directo y arman el archivo con ExcelJS/jsPDF. El trabajo acá fue: identificar cuáles del catálogo mockeado son esas dos, conectar sus botones de verdad, y documentar qué falta para el resto (catálogo + programación).

## 🟢 Real — "BBDD leads" (Excel)

`GET /api/superadmin/reports/crm/excel` (`src/app/api/superadmin/reports/crm/excel/route.ts`) ya genera un `.xlsx` real: consulta `leads` en Supabase (`contact_name, business_name, email, phone_whatsapp, pipeline_stage, plan_interest, created_at, source`) y lo arma con ExcelJS. Es exactamente lo que pide la card **"BBDD leads"** del catálogo (`rep-bbdd-leads`, "Exportación completa de la base de leads.", único formato `xlsx`) — coincide 1:1, no adivinamos nada acá.

El frontend (`src/hooks/superadmin/useReportes.ts`) ahora apunta el botón "Excel" de esa card directo a esa ruta: `GET` con `responseType: "blob"` + trigger de descarga en el navegador (mismo truco de object-URL + anchor temporal que ya usa `ExportButton`).

```
GET /api/superadmin/reports/crm/excel
```
Responde con el archivo binario (`Content-Disposition: attachment`, `.xlsx`), no JSON.

## 🟢 Real (parcial) — "MRR" → solo el PDF

`GET /api/superadmin/reports/saas/pdf` (`src/app/api/superadmin/reports/saas/pdf/route.ts`) genera un PDF real con jsPDF: MRR total (`company.plan` × precio de plan hardcodeado), tasa de activación (`onboarding_progress` con >80% de pasos completos), negocios activos, total de empresas, y dos métricas estimadas (churn 2.4%, NRR 105% — hardcodeadas en el código, no calculadas).

La card del catálogo que más se le parece es **"MRR"** (`rep-mrr`, formatos `xlsx` + `pdf`) — pero solo a nivel PDF: el reporte real es un resumen de salud SaaS (no un "detalle de MRR por empresa y por plan" como dice la descripción actual de la card), y no existe ningún generador de `xlsx` para esto. Por eso la conexión quedó **a nivel de formato, no de card completa**:

- Botón "PDF" de la card MRR → real, pega a `/api/superadmin/reports/saas/pdf`.
- Botón "Excel" de la misma card → sigue simulado (badge 🧪 al lado del botón).

```
GET /api/superadmin/reports/saas/pdf
```
Responde con el archivo binario (`Content-Disposition: attachment`, `.pdf`), no JSON.

## 🔴 Simulado — resto del catálogo

Ninguna otra combinación reporte+formato tiene ruta de generación real todavía: **Ventas**, **Leads & CAC**, **Comisiones de partners**, **Facturación**. El botón sigue existiendo (UX intacta) pero solo simula el delay de generación — no hay archivo real detrás. Lo que le falta a cada uno, puntualmente:

- **Ventas**: necesitaría un agregado de GMV/pedidos de toda la red desde ms-ventas — mismo tipo de endpoint agregado que ya pedimos en `docs/superadmin/operacion-endpoints.md` (Caja & COD), no hay nada nuevo que investigar acá.
- **Leads & CAC**: el lado "leads" existe (`GET /leads`, real), pero el "CAC" (costo de adquisición por canal) no tiene ninguna fuente — no hay tracking de gasto por canal en ningún lado del código. No es un endpoint que falte, es una métrica que nadie calcula todavía.
- **Comisiones de partners**: existe `liquidacionesMock`/`ILiquidacion` en el módulo de Partners (`usePartners.ts`), con mutaciones best-effort reales-si-existen — un reporte de esto reusaría esa misma fuente el día que `GET /partners/liquidaciones` exista de verdad.
- **Facturación**: mismo bloqueo que "Monitor SUNAT global" en `docs/superadmin/operacion-endpoints.md` — `sunatDocumentService` resuelve el scope por JWT de una sola empresa, no hay forma de traer comprobantes de toda la red todavía.

Ninguno de estos se propone como endpoint concreto acá porque ya están cubiertos (o bloqueados por lo mismo) en otros docs — repetir el pedido no agrega información nueva.

## 🔴 Simulado — catálogo de reportes disponibles (el listado en sí)

Hoy el catálogo (`reportesDisponiblesMock`: qué reportes existen, con qué nombre/descripción/formatos) vive hardcodeado en el frontend (`src/mocks/superadmin/config.ts`). Funciona bien mientras hay 6 reportes fijos, pero cada reporte nuevo que el backend agregue va a requerir un deploy del frontend solo para que aparezca la card. No lo tratamos como bloqueante — con 2 de 6 ya reales, no vale la pena un endpoint solo para esto todavía —, pero lo dejamos anotado: si el catálogo crece, tiene sentido que backend lo sirva:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/reportes/disponibles
```

```jsonc
{
  "data": [
    { "id": "rep-bbdd-leads", "nombre": "BBDD leads", "descripcion": "Exportación completa de la base de leads.", "formatos": ["xlsx"] }
  ]
}
```

## 🔴 Simulado — reportes programados

La spec pide poder programar el envío recurrente de cualquier reporte del catálogo (frecuencia + destinatario). Hoy el listado, la creación y el toggle activo/inactivo mutan un mock en memoria — funcionan en la demo, pero no hay nada real atrás. Igual que en Partners (`usePartners.ts`), las mutaciones ya están armadas para intentar el endpoint real primero y caer al mock solo si falla, así el día que el backend exista empiezan a funcionar solas sin tocar el frontend:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/reportes/programados
```

```jsonc
{
  "data": [
    { "id": "repp-0001", "reporte": "MRR", "frecuencia": "Mensual", "destinatario": "joel@powip.pe", "proximoEnvio": "2026-08-29T00:00:00Z", "activo": true }
  ]
}
```

```
POST {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/reportes/programados
```
**Body:**
```jsonc
{ "reporte": "MRR", "frecuencia": "Semanal", "destinatario": "finanzas@powip.pe" }
```
**Response:** el `IReporteProgramado` creado, con `id` y `proximoEnvio` calculados por el backend:
```jsonc
{ "id": "repp-0042", "reporte": "MRR", "frecuencia": "Semanal", "destinatario": "finanzas@powip.pe", "proximoEnvio": "2026-08-31T00:00:00Z", "activo": true }
```

```
PATCH {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/reportes/programados/{id}/activo
```
Sin body — es un toggle (el frontend lo llama con `{}`, ver `useToggleReporteProgramado`): el backend invierte el `activo` actual y responde con el `IReporteProgramado` actualizado (mismo shape que arriba).

`proximoEnvio` lo calcula el backend a partir de `frecuencia` — el frontend no tiene por qué reinventar esa lógica (hoy el mock la aproxima a "+7 días" como placeholder, ver `useCrearReporteProgramado`).

### El problema real detrás de "programado": no hay quién dispare el envío

Aunque los 3 endpoints de arriba existan, "programado" implica que *algo* corra la generación en la frecuencia pactada y la mande por email — y **eso no existe en este repo**. Investigamos la infraestructura de jobs antes de asumir que había que construirla desde cero:

- `src/app/api/superadmin/worker/google-sync/route.ts` y `.../worker/onboarding-alerts/route.ts` son rutas `POST` con lógica real (sync de Google Sheets, alertas de onboarding estancado) — pero son solo handlers HTTP. No hay `vercel.json` con `crons` en el repo, ni ningún disparador interno: algo externo (¿un cron de Vercel configurado fuera del repo, un servicio aparte?) tiene que estar pegándoles hoy para que corran, y no quedó rastro de eso acá.
- `onboarding-alerts` sí resuelve la mitad del problema de "entrega": cuando detecta un negocio estancado, hace `insert` en una tabla `transactional_emails` (`status: "pending"`, `template_name`, `template_data`) en vez de mandar el email directo. Eso es una cola real — pero tampoco hay, en este repo, ningún consumidor que la lea y efectivamente envíe el correo (no hay `nodemailer`/`resend`/`sendgrid` ni nada similar en `src`).

**Conclusión**: para que "Reportes programados" funcione de punta a punta hacen falta tres piezas, y ya sabemos dónde engancha cada una:

1. El CRUD de arriba (listado/crear/activar).
2. Un scheduler real que dispare "generar reporte X, en frecuencia Y" — el mismo tipo de pieza que hoy le falta a `google-sync`/`onboarding-alerts` (no es algo nuevo que inventar, es la MISMA pieza faltante, una sola vez, para los tres).
3. Entrega por email — reusar la cola `transactional_emails` que `onboarding-alerts` ya usa (agregar un `template_name` tipo `reporte_programado` con el archivo adjunto o un link de descarga) en vez de crear un canal de envío nuevo, una vez que exista el consumidor que la vacía.

## Resumen

| Ítem | Estado |
|---|---|
| "BBDD leads" (xlsx) | 🟢 Real — `GET /api/superadmin/reports/crm/excel` |
| "MRR" → PDF | 🟢 Real — `GET /api/superadmin/reports/saas/pdf` |
| "MRR" → Excel | 🔴 Simulado — no existe generador xlsx para este reporte |
| "Ventas", "Leads & CAC", "Comisiones de partners", "Facturación" | 🔴 Simulado — cada uno bloqueado por gaps ya documentados en otros docs (o métricas que nadie calcula, caso CAC) |
| Catálogo de reportes disponibles (el listado en sí) | 🔴 Simulado, no bloqueante — hardcodeado en frontend, candidato a `GET /reportes/disponibles` si el catálogo crece |
| Reportes programados — listado/crear/activar | 🟡 Pedido — `GET`/`POST`/`PATCH /reportes/programados` |
| Ejecución real de lo programado (cron + entrega) | 🔴 Simulado — no hay scheduler en el repo (mismo gap que `google-sync`/`onboarding-alerts`); la cola de email (`transactional_emails`) ya existe pero nadie la consume todavía |

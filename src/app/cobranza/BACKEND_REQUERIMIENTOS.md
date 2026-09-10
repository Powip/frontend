# Requerimientos de Backend — Módulo Cobranza (Hito 1)

> Fecha: 2026-09-10
> Frontend: `src/app/cobranza/`
> Referencia funcional: `POWIP_Hito1_Especificacion.md` (§5 modelo de datos, §6 máquina de estados, §7 flujos, §8 endpoints, §10 reglas de negocio)

Todo lo que está en `src/app/cobranza/` hoy es **100% mock** — `_lib/mock-data.ts`, sin ningún `axios`/`fetch`. No hay ninguna llamada real todavía. Este documento traduce la especificación general (que ya trae SQL y endpoints completos) al contrato exacto que necesita cada pantalla ya armada en React, con los nombres de campo que el frontend ya está pintando.

**Alcance:** este doc cubre solo el **Panel del negocio** (las 7 pantallas de abajo, ya scaffoldeadas). El **link del cliente** y el **portal del repartidor** están completos en la especificación (§7.1–§7.10, §8) pero todavía no tienen ninguna pantalla React en este repo — se puede construir ese backend directamente contra la especificación en paralelo, sin esperar a este documento.

---

## 0. Alineación con lo que ya existe — leer antes de crear tablas nuevas

La especificación general propone tablas nuevas asumiendo que no hay nada construido. En este frontend **ya existen** conceptos que se solapan:

- **Guías de envío** ya existen en `ms-courier` como `ShippingGuide` (`shipping-guides`, usado por `src/app/operaciones/guias`). **No crear una tabla `guias` paralela** — extender `ShippingGuide` con los campos de cobranza que necesita esta pantalla (ver §1).
- **Pagos por pedido** ya existen en `ms-ventas` como `OrderHeader.payments[]` (`paymentMethod`, `status`, `paymentProofUrl` — ver `src/interfaces/IOrder.ts`, usado por `/finanzas`). El código de entrega y el split de Mercado Pago sí son conceptos nuevos (prepago digital no existe hoy) — ahí sí tiene sentido `payment_links` / `delivery_codes` nuevos, pero colgados de `OrderHeader`, no de una entidad de pedido paralela.
- **Agencias Shalom** ya existen en `ms-integrations` (`/shalom/agencies`, `/shalom/agencies/search`, usado por `src/app/configuracion/integraciones/shalom`). Reusar ese catálogo en vez de sincronizar una tabla `agencias_courier` aparte.

Si alguna de estas decisiones no es viable del lado de backend, avisar antes de implementar — cambia bastante el reparto de trabajo entre `ms-ventas` y `ms-courier`.

---

## 1. Guías & Courier

**Usado en:** `src/app/cobranza/guias/page.tsx` → `GuiasCourierTab`
**Servicio:** `ms-courier` (extiende `ShippingGuide`)

```
GET /shipping-guides/:guiaId/cobranza
```

**Respuesta esperada:**
```json
{
  "codigo": "GE-202609-01647",
  "creada": "2026-09-04",
  "estado": "APROBADA",
  "zona": "Provincias",
  "courier": "Shalom",
  "tipoCobro": "Contra entrega · Provincias",
  "linkRepartidor": "powip.lat/rep/SHL-7B29X-01647",
  "cobranzaTotal": 422.00,
  "pendientePago": 422.00,
  "pedidos": [
    { "orden": "ORD-142781", "cliente": "Ricardo Elias Briceño", "ciudad": "Huamachuco", "total": 169.00, "cobrar": 139.00 },
    { "orden": "ORD-142312", "cliente": "Fátima Hernández", "ciudad": "Tambo Grande", "total": 89.00, "cobrar": null }
  ]
}
```
`cobrar: null` cuando el pedido ya no tiene saldo pendiente. `estado`: `BORRADOR` | `APROBADA` | `REGISTRADA` | `CERRADA` (§5.5).

```
POST /shipping-guides/:guiaId/registrar-courier
```
Equivalente a "Registrar en Shalom" (§7.4). Efectos esperados: llama a la API del courier, guarda `guia_courier_ext`, pasa `estado` a `REGISTRADA`, **crea el link del repartidor** y abre el canal de tracking.

**Respuesta esperada:**
```json
{ "linkRepartidor": "powip.lat/rep/SHL-7B29X-01647", "guiaCourierExt": "SHL-9834" }
```

Nota: "Imprimir guía/etiqueta" ya se puede resolver contra lo que expone `ms-integrations` para Shalom (`/shalom/ticket-pdf`, `/shalom/label`); no debería necesitar endpoint nuevo.

---

## 2. Códigos de entrega

**Usado en:** `src/app/cobranza/codigos/page.tsx` → `CodigosEntregaTab`
**Servicio:** `ms-ventas` (tabla nueva `delivery_codes`, 1:1 con `orders`, ver §5.3)

```
GET /negocio/:storeId/delivery-codes?estado=&page=
```

**Respuesta esperada (array):**
```json
[
  { "codigo": "7284", "orden": "ORD-012247", "cliente": "Joel García", "monto": 121.00, "estado": "activo", "validadoA": null },
  { "codigo": "3948", "orden": "ORD-012244", "cliente": "María Quispe", "monto": 71.80, "estado": "validado", "validadoA": "2026-09-10T14:30:00-05:00" }
]
```
`estado`: `activo` | `validado` | `en_camino` | `expirado` (combina `delivery_codes.estado` con el estado de envío del pedido). `validadoA` es `null` o ISO datetime — el frontend lo formatea.

```
GET /negocio/:storeId/delivery-codes/kpis
```
```json
{ "activos": 47, "validadosHoy": 12, "enCamino": 8, "expirados": 3 }
```

**Regla de negocio (§10.1):** el código solo existe si `payment_links.estado_pago = 'pagado'`. Nunca devolver código de un pedido sin pagar.

---

## 3. Validar Yapes

**Usado en:** `src/app/cobranza/yapes/page.tsx` → `ValidarYapesTab`
**Servicio:** `ms-ventas`

```
GET /negocio/:storeId/yape/pendientes
```
```json
[{ "id": "uuid", "orden": "ORD-010637", "cliente": "Yesenia Quispe", "monto": 84.00, "hora": "2026-09-10T10:32:00-05:00", "comprobanteUrl": "https://..." }]
```

```
PATCH /yape/:id/confirmar
PATCH /yape/:id/rechazar   { "motivo": "string (opcional)" }
```

**Efecto de confirmar** (§7.2, §10.1): `payment_links.estado_pago = 'pagado'`, activa `delivery_codes`, dispara notificación "pago confirmado". **No genera comisión** (§10.2) — es Yape directo, no pasa por Mercado Pago.

---

## 4. Finanzas — pagos manuales

**Usado en:** `src/app/cobranza/finanzas/page.tsx` → `FinanzasCobranzaTab`
**Servicio:** `ms-ventas`

```
GET /negocio/:storeId/pagos-manuales?estado=
```
```json
[
  { "orden": "ORD-010636", "cliente": "Joel Coila Osnayo", "telefono": "+51 947 424 006", "canal": "WhatsApp", "metodo": "Efectivo", "codigoOp": "—", "region": "Lima", "courier": "—", "estado": "Pendiente" },
  { "orden": "ORD-010633", "cliente": "Patricia Huamanchumo", "telefono": "+51 970 776 823", "canal": "Upsell", "metodo": "MP", "codigoOp": "Auto MP", "region": "Provincia", "courier": "Olva", "estado": "Aprobado MP" }
]
```
`canal`: `WhatsApp` | `Catálogo` | `Live` | `Upsell` (viene de `orders.canal` + `tipo_cobro`). `metodo`: `Efectivo` | `Yape` | `MP` | `Pago Link`. `estado`: `Pendiente` | `Aprobado MP`.

**Importante:** las filas con `metodo = "MP"` son de **solo lectura** informativa — Mercado Pago se aprueba solo por webhook (§7.1), nunca deberían quedar en `Pendiente`. Esta tabla es exclusivamente para los métodos manuales (Yape directo, Plin, Pago Link, Efectivo, Transferencia — §10.2).

---

## 5. Notificaciones automáticas

**Usado en:** `src/app/cobranza/notificaciones/page.tsx` → `NotificacionesTab`
**Servicio:** `ms-ventas`

```
GET /negocio/:storeId/notificaciones/plantillas
```
```json
[{ "id": "pago_confirmado", "trigger": "Pago confirmado", "mensaje": "✅ ¡Pago recibido, Joel! Tu código de entrega es *7284*...", "activo": true }]
```

```
PATCH /negocio/:storeId/notificaciones/plantillas/:id   { "activo": boolean }
```

Los 5 triggers y el texto exacto de cada plantilla ya están definidos en §12 de la especificación (pago confirmado, despachado, listo en agencia, saldo pendiente, entregado). Esta pantalla solo prende/apaga — no es un editor de campañas.

---

## 6. Mapa de flota

**Usado en:** `src/app/cobranza/flota/page.tsx` → `MapaFlotaTab`
**Servicio:** `ms-courier`

```
GET /negocio/:storeId/flota
```
```json
[
  { "repartidorId": "uuid", "nombre": "Luis Mamani", "iniciales": "LM", "color": "#4C2FB5", "detalle": "Moto propia · Guía SHL-7B29X-01647", "entregados": 2, "totalPedidos": 5, "lat": -16.409, "lng": -71.537, "ultimaActualizacion": "2026-09-10T15:04:00-05:00", "conGps": true },
  { "repartidorId": "uuid", "nombre": "Shalom — Provincias", "iniciales": "SH", "color": "#8b93a1", "detalle": "Seguimiento por estados · sin GPS", "entregados": 0, "totalPedidos": 0, "lat": null, "lng": null, "ultimaActualizacion": "en tránsito", "conGps": false }
]
```

Se alimenta de `POST /rep/:token/ubicacion` (ping GPS cada ~20s desde el portal del repartidor, §7.7) — ese endpoint es **prerequisito** de este y vive del lado del portal del repartidor, que todavía no tiene pantalla en este frontend. Polling cada 15–20s en este endpoint es suficiente para el Hito 1 (no hace falta WebSocket).

**Regla de negocio (§10.5):** esta información es exclusiva del negocio. Nunca debe exponerse en el link del cliente.

---

## 7. Mercado Pago

**Usado en:** `src/app/cobranza/mercado-pago/page.tsx` → `MercadoPagoTab`
**Servicio:** `ms-ventas` (tabla `mp_accounts` / `mp_transactions`, §5.4)

```
GET /negocio/:storeId/mp/cuenta
```
```json
{ "email": "jookbusiness@gmail.com", "razonSocial": "Jook Business SAC · APP ID 12847392", "activaDesde": "2026-01-12", "comisionPct": 0.5, "modo": "propia" }
```
`modo`: `propia` | `powip_temporal` (§5.4).

```
GET /negocio/:storeId/mp/oauth/iniciar   → 302 a Mercado Pago
GET /negocio/:storeId/mp/oauth/callback
DELETE /negocio/:storeId/mp/cuenta        (desconectar → pasa a powip_temporal)
```

```
GET /negocio/:storeId/mp/cobros-por-canal?mes=2026-09
```
```json
[
  { "label": "Cobranza link (deuda)", "monto": 4840.00, "pct": 57 },
  { "label": "Catálogo / recompra", "monto": 2350.00, "pct": 28 },
  { "label": "Upsell pre-despacho", "monto": 1230.00, "pct": 15 }
]
```
Los tres canales salen de `mp_transactions.tipo_cobro` (`deuda` | `recompra` | `upsell`, §5.4).

---

## Resumen de tablas/campos nuevos

| Entidad | Dónde | Campos clave nuevos |
|---|---|---|
| `payment_links` | `ms-ventas`, 1:1 con `orders` | `estado_pago`, `saldo_pendiente`, `metodo_pago`, `mp_payment_id`, `clave_oculta` (§5.2) |
| `delivery_codes` | `ms-ventas`, 1:1 con `orders` | `codigo`, `estado`, `validado_at`, `expira_at` (§5.3) |
| `mp_accounts` / `mp_transactions` | `ms-ventas` | `modo`, `yape_directo_activo`, `comision_powip`, `tipo_cobro` (§5.4) |
| `ShippingGuide` (extender, no duplicar) | `ms-courier` | `cobranzaTotal`, `pendientePago`, `linkRepartidorToken` |
| `repartidor_links` | `ms-courier` | `token`, `activo`, `vence_al_cerrar` (§5.6) |

---

## Orden de prioridad sugerido

1. **Endpoint 2** (Códigos de entrega + `delivery_codes`) — es el corazón del Hito 1: sin esto no hay prepago digital.
2. **Endpoint 1** (Guías & Courier, extender `ShippingGuide` + registrar-courier) — desbloquea la bisagra guía → repartidor → tracking.
3. **Endpoint 3** (Validar Yapes) — funcionalidad manual ya usada hoy en `/finanzas` con `payments[]`, es la migración más directa.
4. **Endpoint 4** (Pagos manuales) — mismo dato que el 3, vista consolidada.
5. **Endpoint 7** (Mercado Pago) — depende de la integración OAuth + Marketplace, es la pieza más grande de infraestructura nueva.
6. **Endpoint 5** (Notificaciones) — bajo esfuerzo, depende de que 1–3 ya disparen eventos.
7. **Endpoint 6** (Mapa de flota) — depende de que exista primero el portal del repartidor con el ping GPS (§7.7), que es trabajo aparte no cubierto por este frontend todavía.

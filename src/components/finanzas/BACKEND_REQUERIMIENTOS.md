# Requerimientos de Backend — Módulo Liquidaciones Courier

> Fecha: 2026-05-06  
> Frontend: `src/components/finanzas/`  
> Servicio destino: **ms-courier**

Todo lo que está en este módulo hoy usa datos mock hardcodeados.  
Para conectar el frontend real necesito los siguientes endpoints y estructuras de datos.

---

## 1. Métricas globales del store

**Usado en:** `LiquidacionesCourierTab` — tarjetas superiores

```
GET /shipping-guides/store/:storeId/metrics
```

**Respuesta esperada:**
```json
{
  "codPendienteTotal": 4820.00,
  "couriersConCod": 3,
  "guiasConCod": 19,
  "enAgenciaMonto": 1840.00,
  "enAgenciaCantidad": 8,
  "enAgenciaCourierNombre": "Shalom",
  "enAgenciaDiasMax": 30,
  "vencidoMonto": 3240.00,
  "vencidoCourierNombre": "Shalom",
  "vencidoDias": 5,
  "liquidadoMesActualMonto": 12340.00,
  "liquidadoMesActualGuias": 38,
  "liquidadoMesNombre": "Abril 2026",
  "reasignadosActivos": 4
}
```

---

## 2. Resumen por courier (cards con gráfico)

**Usado en:** `LiquidacionesCourierTab` — cards de courier con mini-gráfico

```
GET /shipping-guides/store/:storeId/couriers/resumen
```

**Respuesta esperada (array):**
```json
[
  {
    "courierId": "uuid",
    "nombre": "Shalom",
    "tipo": "empresa",
    "guiasMes": 30,
    "score": "Problemático",
    "estadoActual": "Vencido",
    "promedioRendicionDias": 4.8,
    "codPendiente": 3240.00,
    "enAgenciaCantidad": 8,
    "rendicionUltimas8Semanas": [
      { "semana": "S1", "rendido": 10, "pendiente": 0 },
      { "semana": "S2", "rendido": 12, "pendiente": 0 },
      { "semana": "S8", "rendido": 0, "pendiente": 30 }
    ]
  }
]
```

**Valores posibles de `score`:** `"Confiable"` | `"Problemático"`  
**Valores posibles de `estadoActual`:** `"Vencido"` | `"Pendiente"` | `"Sin COD"`

---

## 3. Listado de guías con liquidación

**Usado en:** `LiquidacionesCourierTab` — tabla de guías

```
GET /shipping-guides/store/:storeId/liquidaciones?courier=&estado=&fechaDesde=&fechaHasta=
```

**Query params opcionales:**
- `courier` — nombre o id del courier
- `estado` — `Vencido` | `Pendiente` | `Sin COD` | `Liquidado`
- `fechaDesde` / `fechaHasta` — ISO date strings

**Respuesta esperada (array):**
```json
[
  {
    "id": "GE-202604-00260",
    "fecha": "2026-04-15",
    "courierNombre": "Shalom",
    "courierScore": "Problemático",
    "tipo": "Courier cobra",
    "pedidosCantidad": 22,
    "pedidosEnAgencia": 3,
    "pedidosAlerta": 1,
    "pedidosReasignados": 1,
    "codBruto": 2748.30,
    "adelantos": 309.00,
    "codNeto": 2439.30,
    "costos": 379.76,
    "neto": 2074.54,
    "estado": "Vencido",
    "diasTranscurridos": 5,
    "diasLimite": 30
  }
]
```

**Valores posibles de `tipo`:** `"Courier cobra"` | `"Negocio cobra"` | `"Prepagado"`

---

## 4. Detalle de una guía (modal GestionCobroModal)

**Usado en:** `GestionCobroModal` — toda la vista del modal

```
GET /shipping-guides/:guiaId/detalle
```

**Respuesta esperada:**
```json
{
  "id": "GE-202604-00260",
  "fecha": "2026-04-15",
  "courier": {
    "id": "uuid",
    "nombre": "Shalom",
    "telefono": "51987654321",
    "zona": "Lima Sur"
  },
  "tipo": "Courier cobra",
  "cobrarOpcion": "todo",
  "pedidosCantidad": 22,
  "codBruto": 2748.30,
  "adelantos": 309.00,
  "codNeto": 2439.30,
  "costos": 379.76,
  "neto": 2074.54,
  "saldoPendiente": 1074.54,
  "pagosRegistrados": [
    {
      "id": "uuid",
      "monto": 1000.00,
      "metodo": "transferencia",
      "numeroOperacion": "Op. 12345678",
      "fecha": "2026-04-20",
      "comprobante": "https://...",
      "observaciones": "Primer pago parcial"
    }
  ]
}
```

**Valores posibles de `cobrarOpcion`:** `"todo"` | `"solo_envio"` | `"nada"`

---

## 5. Pedidos de una guía

**Usado en:** `GestionCobroModal` — lista de pedidos con filtros

```
GET /shipping-guides/:guiaId/pedidos
```

**Respuesta esperada (array):**
```json
[
  {
    "id": "ORD-006005",
    "clienteNombre": "Helen Ponce",
    "distrito": "Huánuco",
    "adelanto": 50.30,
    "monto": 75.00,
    "estado": "Rechazado",
    "entregado": false,
    "reasignadoDesde": null,
    "diasEnAgencia": null,
    "diasLimiteAgencia": null,
    "warningText": null
  },
  {
    "id": "ORD-005728",
    "clienteNombre": "Melissa Huamanchuco",
    "distrito": "Chiclayo",
    "adelanto": 0,
    "monto": 125.30,
    "estado": "En agencia",
    "entregado": false,
    "reasignadoDesde": null,
    "diasEnAgencia": 20,
    "diasLimiteAgencia": 30,
    "warningText": null
  }
]
```

**Valores posibles de `estado`:** `"Cobrado"` | `"Rechazado"` | `"Reasignado"` | `"En agencia"` | `"Retorno"` | `"En envío"`

---

## 6. Registrar pago del courier a la guía

**Usado en:** `GestionCobroModal` — formulario "Registrar nuevo pago"

```
POST /shipping-guides/:guiaId/pagos
Content-Type: multipart/form-data
```

**Body (form-data):**
```
monto: number           (requerido)
metodo: string          (requerido) — "transferencia" | "yape" | "efectivo" | "no-aplica"
numeroOperacion: string (opcional)
fecha: string           (requerido) — ISO date
comprobante: File       (opcional) — imagen
observaciones: string   (opcional, max 400 chars)
cobrarOpcion: string    (requerido) — "todo" | "solo_envio" | "nada"
```

**Respuesta esperada:**
```json
{
  "id": "uuid",
  "guiaId": "GE-202604-00260",
  "saldoRestante": 74.54,
  "liquidada": false
}
```

Cuando `saldoRestante === 0`, el frontend mostrará la guía como "Liquidada".

---

## 7. Registrar pago de flete (Tipo B)

**Usado en:** `GestionCobroModal` — banner Tipo B "Registrar pago de flete"

```
POST /shipping-guides/:guiaId/flete
```

**Body:**
```json
{
  "monto": 16.00,
  "metodo": "transferencia",
  "numeroOperacion": "Op. 98765432",
  "fecha": "2026-04-19"
}
```

---

## 8. Reasignar pedido rechazado

**Usado en:** `GestionCobroModal` — botón "Reasignar" en pedidos con estado "Rechazado"

```
POST /pedidos/:pedidoId/reasignar
```

**Body:**
```json
{
  "nuevaGuiaId": "uuid"
}
```

o sin body si se crea una nueva guía automáticamente.

---

## Resumen de campos nuevos en entidades existentes

Si ms-courier ya tiene `ShippingGuide`, necesita estos campos adicionales:

| Campo | Tipo | Descripción |
|---|---|---|
| `tipo` | `enum` | `COURIER_COBRA` / `NEGOCIO_COBRA` / `PREPAGADO` |
| `cobrarOpcion` | `enum` | `TODO` / `SOLO_ENVIO` / `NADA` (solo aplica Tipo A) |
| `codBruto` | `decimal` | Suma de montos pedidos |
| `adelantos` | `decimal` | Suma de adelantos ya pagados |
| `codNeto` | `decimal` | `codBruto - adelantos` |
| `costos` | `decimal` | Costos del courier (flete, almacenaje, etc.) |
| `neto` | `decimal` | `codNeto - costos` |
| `saldoPendiente` | `decimal` | `neto - suma de pagos registrados` |
| `diasTranscurridos` | `int` | Días desde emisión de la guía |
| `diasLimite` | `int` | Días límite para rendición (ej: 30 para Shalom) |
| `score` | `enum` | `CONFIABLE` / `PROBLEMATICO` (calculado en backend) |

---

## Orden de prioridad sugerido

1. **Endpoints 4 + 5** — detalle de guía + pedidos (desbloquea el modal completo)
2. **Endpoint 3** — listado de guías (desbloquea la tabla)
3. **Endpoint 6** — registrar pago (funcionalidad core)
4. **Endpoints 1 + 2** — métricas y resumen de couriers (tarjetas superiores)
5. **Endpoints 7 + 8** — flete y reasignación (funcionalidades secundarias)

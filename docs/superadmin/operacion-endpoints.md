# Operación de Red — contrato de endpoints

> De los módulos migrados hasta ahora, este es el que menos backend real tiene atrás — las 3 secciones de la página están bloqueadas por gaps ya identificados en otro lado. No hay mucho que "conectar" todavía; el valor de este pase es dejar documentado por qué, con endpoints propuestos, para no repetir la investigación cuando alguien retome esto.

## 🔴 Caja & COD de la red — bloqueado por lo mismo que Empresas → Pagos & Recaudos

La spec pide, por empresa: GMV, COD en tránsito, liquidación pendiente, morosidad. Ya está documentado que ms-courier no expone nada de esto — ver `src/components/finanzas/BACKEND_REQUERIMIENTOS.md` (liquidaciones, adelantos COD, `/shipping-guides/store/:id/metrics`). No lo repetimos acá.

Lo nuevo que agrega ESTA página sobre lo ya documentado: necesita esos datos **para todas las empresas a la vez**, no de una por vez — aunque ms-courier expusiera esos endpoints por empresa, montar esta tabla llamando a cada empresa por separado sería otra vez el problema de escala que ya evitamos en Oportunidades (radar de upsell) y en Adquisición (paginación). Por eso el pedido acá es directamente un endpoint agregado:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/operacion/caja-cod
```

```jsonc
{ "data": [{ "empresaId": "uuid", "empresaNombre": "...", "gmv": 42000, "codEnTransito": 5200, "liquidacionPendiente": 1200, "morosidadPct": 3.2 }] }
```

Bloqueado por: los endpoints de ms-courier de `BACKEND_REQUERIMIENTOS.md` primero, y una agregación server-side sobre todas las empresas después.

## 🔴 Monitor SUNAT global — mismo bloqueo que Empresas → Facturación, a escala de red

`sunatDocumentService.getSunatDocumentsByCompany()` (real) resuelve el scope desde el JWT del usuario logueado, sin parámetro de empresa — no hay ninguna función que traiga comprobantes de una empresa arbitraria, y mucho menos de todas a la vez. Es el mismo bloqueo de impersonación que ya documentamos en `docs/superadmin/empresas-endpoints.md`, pero acá hace falta un endpoint admin agregado, no solo impersonar una empresa a la vez:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/operacion/sunat-global
```

```jsonc
{ "data": [{ "empresaId": "uuid", "empresaNombre": "...", "emite": true, "comprobantesMes": 340, "rechazosMes": 2, "certificadoVence": "2026-09-15" }] }
```

## 🔴 Fraude / anomalías — no es un endpoint que falte, es un sistema que no existe

A diferencia de las dos secciones anteriores (donde el dato existe pero no está agregado/expuesto), acá no hay ninguna señal real en ningún lado: no hay tracking de "% devolución vs. la media", picos de pedidos, ni descuadre entre adelantos y entregas. Antes de pedir un endpoint hace falta que Producto defina las reglas (la spec sugiere algunas: devolución muy sobre la media, picos de pedidos, descuadre adelantos↔entregas) y que alguien las calcule — probablemente como un job periódico, no algo que se calcule al vuelo en cada carga de esta página.

## Resumen

| Sección | Estado | Bloqueado por |
|---|---|---|
| Caja & COD de la red | 🔴 Simulado | Endpoints de ms-courier (`BACKEND_REQUERIMIENTOS.md`) + agregación server-side |
| Monitor SUNAT global | 🔴 Simulado | Impersonación real o endpoint admin agregado (sin JWT-scope) |
| Fraude / anomalías | 🔴 Simulado | No es un endpoint — hace falta definir las reglas de negocio primero |

**Nota**: esta es la primera página migrada donde, honestamente, no hay nada que conectar todavía — las tres secciones dependen de trabajo de backend que ni siquiera empezó. Vale la pena revisarla de nuevo recién cuando `BACKEND_REQUERIMIENTOS.md` (COD) y la impersonación (SUNAT) avancen, no antes.

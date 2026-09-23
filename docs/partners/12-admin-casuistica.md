# Page

Partners Admin · Casuística

## Route

`/partners/admin/casuistica`

## Objetivo

Ser la referencia de consulta rápida para el equipo de Powip: todos los casos que le pueden pasar a un referido y cómo los resuelve el sistema, en una sola tabla.

## UI / Layout

Server wrapper + Client Component simple: un título + descripción + una tabla dentro de una card.

## Componentes

- `_components/program-cases-table.tsx` — tabla de 3 columnas (Caso, Qué pasa, Resultado), con el resultado coloreado según su naturaleza (neutral/éxito/advertencia/peligro).

## Información mostrada

18 casos: registro por correo, invitación sin abrir, atribución por link vs código, referido duplicado, auto-referido, activó sin pagar, pagó, cancelaciones (mes 1 y mes 2+), reembolso/chargeback, upgrade/downgrade de plan, pago anual, pago atrasado, quién asume el descuento, comisión bajo umbral, partner suspendido.

## Acciones del usuario

Ninguna — página 100% de solo lectura, es documentación funcional dentro del producto.

## Estados

### Loading
Skeletons en la tabla mientras `useProgramCases()` carga.

### Empty
No aplica — es contenido de referencia fijo, nunca debería estar vacío.

### Error
`PartnerSectionError` si la carga falla.

### Success
Tabla completa con los 18 casos.

## Datos requeridos

- `ProgramCase[]` — modelo nuevo (título, descripción, resultado, tono del resultado para el color del badge).

## Mock data

- `src/features/partners/mocks/program-cases.mock.ts` — contenido 100% estático, transcripto de la casuística documentada en la referencia visual original del feature.

## Backend Requirements

Esta página es la que menos depende de backend de las 6 — es contenido editorial, no datos transaccionales.

1. **BACKEND TBD**: ¿esta tabla debería ser editable desde el admin (para que el equipo de Powip actualice la casuística sin depender de un deploy de frontend), o es aceptable que viva como contenido estático versionado en el código? Si se requiere editable, necesita su propio CRUD — hoy se sirve como un `GET` de solo lectura.

## API Contract Proposal

### Request

```
GET /partners/admin/program-cases
Authorization: Bearer <token>
```

### Response

```json
[
  { "id": "case-1", "title": "Registro por correo", "description": "...", "result": "Correo enviado", "resultTone": "neutral" }
]
```

## Business Rules

- El contenido de esta página es documentación del comportamiento del sistema, no una fuente de configuración — cambiar una fila acá no cambia cómo se comporta el programa (a diferencia de `/partners/admin/reglas`).

## Acceptance Criteria

- [ ] Se muestran los 18 casos con su descripción y resultado correctos.
- [ ] Los resultados con tono "danger"/"warning"/"success" se distinguen visualmente (badge de color), los "neutral" se muestran como texto simple.
- [ ] Si la carga falla, se muestra `PartnerSectionError` con reintento.

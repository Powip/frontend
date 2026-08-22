# Seguimiento — contrato de endpoints

> Igual que Adquisición: hay backend real parcial (columnas `next_action`/`next_action_date` en `leads`, tabla `lead_postventa`), pero con más ambigüedad — hay una pieza que preferimos dejar simulada en vez de adivinar mal el significado de datos reales que no entendemos del todo. Mejor eso que mostrarle al equipo una fecha de "vencido" que no significa lo que creen.

## 🟢 Real — lado "leads" (pre-venta)

`leads.next_action` (texto libre) y `leads.next_action_date` (timestamp) ya existen y son justo lo que pide este módulo: qué hay que hacer y cuándo vence. El frontend (`src/hooks/superadmin/useSeguimiento.ts`) arma la bandeja filtrando client-side los leads que tengan `next_action_date` seteado.

**Limitación de rendimiento, misma raíz que en Adquisición**: `GET /leads` no tiene forma de pedir "solo los que tienen próxima acción" — no hay un query param para eso, ni orden por `next_action_date`. Mientras tanto pedimos una página acotada (los N leads más recientes) y filtramos ahí — funciona bien con volumen bajo/medio, pero un lead viejo con una acción pendiente puede no aparecer si cae fuera de esa página.

**Pedido concreto al backend**: agregar a `GET /leads` soporte para `has_next_action=true` + `sort=next_action_date&dir=asc`, paginado en la base. Con eso la bandeja de Seguimiento deja de depender de traer una página "a ojo" y pasa a ser 100% correcta con cualquier volumen.

**Marcar "Hecho"**: `PATCH /leads/{id}` con `{ next_action: null, next_action_date: null }` — ya funciona hoy, es el mismo endpoint genérico que usa Adquisición.

## 🔴 Simulado — lado "empresas" (postventa)

La spec pide seguimiento también sobre cuentas activas (CS/postventa). Existe una tabla real, `lead_postventa` (`GET/PATCH /api/superadmin/leads/postventa`), con campos `followup_7d`, `followup_30d`, `client_status` — pero decidimos **no adivinar su semántica** antes de conectarlo:

- No hay ningún lugar en el código que documente qué significan exactamente `followup_7d`/`followup_30d` (¿fecha objetivo del checkpoint? ¿fecha en que se hizo? ¿ambas?) ni qué valores válidos tiene `client_status` — no hay enum, es texto libre.
- `lead_postventa` se relaciona con `leads`/`lead_activations` (por `lead_id`), **no** con la entidad `empresa` de ms-company que usa el resto del panel (Empresas, Perfil 360, etc.) — es el mismo problema de "dos fuentes de verdad para empresa" que ya señalamos en el análisis inicial del proyecto. Mostrar acá un "vence" que en realidad apunta a un lead viejo y no a la empresa activa de verdad sería confuso.

**Antes de conectar esto en serio, necesitamos que el equipo de producto/backend confirme:**
1. Qué significan `followup_7d`/`followup_30d` exactamente (fecha objetivo vs. fecha de ejecución).
2. Qué valores toma `client_status` y cuál de ellos equivale a "seguimiento completado".
3. Cómo se vincula un registro de `lead_postventa` con el `id` real de la empresa en ms-company (hoy solo hay `business_name` de texto, no un id confiable).

**Mientras tanto**, el frontend ya apunta a un endpoint agregado propuesto y muestra la card en rojo hasta que exista:

```
GET {NEXT_PUBLIC_API_SUPERADMIN}/api/v1/seguimiento/postventa?limit=20
```

```jsonc
{
  "data": [
    { "id": "uuid", "empresaId": "uuid-ms-company", "empresaNombre": "TecnoHogar Express", "accion": "Llamar por caída de ventas 40%", "vence": "2026-08-19T00:00:00Z" }
  ]
}
```

Con `empresaId` ya resuelto contra ms-company (no contra `lead_id`) para que "Abrir" navegue de verdad al Perfil 360 de la empresa.

## Resumen

| Ítem | Estado |
|---|---|
| Seguimiento sobre leads (`next_action`) | 🟢 Real, con la limitación de paginación ya conocida |
| Marcar "Hecho" sobre un lead | 🟢 Real (`PATCH /leads/{id}`) |
| `has_next_action` + orden por fecha en `GET /leads` | 🟡 Pedido — desbloquea que la bandeja sea 100% correcta, no solo "la página más reciente" |
| Seguimiento sobre empresas (postventa) | 🔴 Simulado a propósito — falta definición de negocio antes de conectar `lead_postventa`, no falta el dato en sí |

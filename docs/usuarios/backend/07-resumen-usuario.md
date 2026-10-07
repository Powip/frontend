# 07 — Resumen de usuario (extensión del diseño)

Estado: UI preparada · perfil integrado en frontend con datos de E3 · actividad sin datos · backend pendiente de confirmar.

## 1. Pantalla y controles que desbloquea

Botón «Resumen» de cada fila. **El mockup solo muestra un aviso** («Abriendo resumen de …»): la pantalla es una propuesta del frontend.

Contenido propuesto: rol y estado; Usuario, Email, Documento, Teléfono, Dirección, Ubicación, Género; sección Actividad.

## 2. Estado actual y evidencia

- [FE] `src/components/users/UserSummaryModal.tsx` muestra solo datos que ya trae E3 (lo que falta aparece como «—»; Usuario muestra `username`, no el email).
- [FE] La sección Actividad muestra «Última conexión y actividad no disponibles». No hay cifras de ejemplo.
- No existe en el frontend ninguna llamada de actividad.

## 3. Datos necesarios

| Campo | Significado |
|---|---|
| `lastLoginAt` | Última sesión iniciada (nullable). |
| `period` | Período del resumen (`from`, `to`, zona horaria). |
| `metrics[]` | Métricas que backend pueda respaldar, con etiqueta y valor. Sin ventas ni comisiones inventadas. |

## 4. Operaciones

| Operación | Tipo |
|---|---|
| Datos del perfil desde E3 | [FE] |
| `GET /api/v1/auth/users/{userId}/activity-summary?from&to` | [PROPUESTA] |

## 5. Ejemplos

```json
{
  "userId": "usr_03",
  "lastLoginAt": "2026-10-06T14:20:00Z",
  "period": { "from": "2026-09-07", "to": "2026-10-07", "timezone": "America/Lima" },
  "metrics": [{ "key": "logins", "label": "Inicios de sesión", "value": 18 }]
}
```

Sin actividad:

```json
{ "userId": "usr_03", "lastLoginAt": null, "period": { "from": "2026-09-07", "to": "2026-10-07", "timezone": "America/Lima" }, "metrics": [] }
```

## 6. Validaciones, permisos y aislamiento por empresa

- Permiso `users.read`; usuario de otra empresa → `404`.
- Métricas de otros servicios (ventas, contact center) solo si esos servicios las exponen con el mismo aislamiento.

## 7. Errores y comportamiento esperado en frontend

- Sin actividad: estado vacío, nunca números de ejemplo.
- Error: la sección Actividad muestra error con Reintentar; el perfil sigue visible.

## 8. Transacciones, concurrencia e idempotencia

Solo lectura.

## 9. Dependencias mínimas

Bloques 00 y 02.

## 10. Pruebas de aceptación

- `lastLoginAt` se actualiza después de un login.
- Resumen de otra empresa → `404`.
- Sin actividad → `metrics: []` y `lastLoginAt: null`, mostrado como vacío.

## 11. Decisiones pendientes y desviaciones del mockup

- Producto debe fijar el contenido del resumen antes de considerarlo fiel funcionalmente.
- Qué métricas de otros servicios corresponden.

## 12. Checklist de entrega e integración

- [ ] Producto define el contenido.
- [ ] OpenAPI de `activity-summary`.
- [ ] Frontend: reemplazar el aviso por los datos reales y su estado vacío.

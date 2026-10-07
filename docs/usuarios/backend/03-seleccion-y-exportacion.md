# 03 — Selección y Exportar

Estado: UI preparada · integrado en frontend (exportación local sobre E3 completo) · backend necesario solo si el listado se pagina.

## 1. Pantalla y controles que desbloquea

- Casilla por fila y casilla de cabecera.
- Botón Exportar (o «Exportar seleccionados (N)» cuando hay selección).
- Texto «N seleccionados (M ocultos por los filtros) · Limpiar selección».

El mockup dibuja las casillas y el botón pero no define acción masiva ni comportamiento entre páginas. La semántica de abajo es una **propuesta del frontend** pendiente de aprobación de producto.

## 2. Estado actual y evidencia

- [FE] `src/app/usuarios/page.tsx`: la selección se guarda por `id` y se conserva al cambiar de página, filtro u orden. La cabecera selecciona o deselecciona la página visible. Al cambiar de empresa la selección se vacía.
- [FE] Exportar usa `src/services/userExport.ts` (ExcelJS + file-saver, mismo patrón que `exportCcPedidosExcel`):
  - con selección: exporta los seleccionados, incluidos los ocultos por filtros, en el orden actual;
  - sin selección: exporta **todo el listado filtrado**, no solo la página visible.
- [FE] Columnas: Usuario, Nombre, Apellidos, Dirección, Distrito, Provincia, Departamento, Email, Documento, Rol, Estado, Teléfono. No incluye contraseñas ni tokens.
- [FE] Todas las celdas se escriben como texto (formato `@`). Un valor como `+51 987…` o `=SUM(...)` se guarda tal cual y la hoja no lo evalúa como fórmula; no se agrega apóstrofo ni se altera el dato visible. La columna Usuario queda vacía si no hay `username`.
- No se agregó borrado masivo: los checkboxes no definen esa acción.

## 3. Datos necesarios

Mismos campos de `UserSummary` (bloque 02). Para exportar desde el servidor: filtros, orden e `ids` seleccionados.

## 4. Operaciones

| Operación | Tipo |
|---|---|
| E3 completo + generación local del `.xlsx` | [FE] |
| `GET /api/v1/auth/users/company/export?format=xlsx&q&roleId&status&sort` | [PROPUESTA] |
| `POST /api/v1/auth/users/company/export` con `{ "ids": [...] }` | [PROPUESTA] |

Este endpoint **no hace falta** mientras E3 siga devolviendo el listado completo y el volumen sea manejable en el navegador.

## 5. Ejemplos

`POST /api/v1/auth/users/company/export`

```json
{ "ids": ["usr_02", "usr_07"], "format": "xlsx", "sort": "name:asc" }
```

Respuesta: `200` con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition: attachment; filename="usuarios_2026-10-07.xlsx"`. Si el volumen es alto: `202 { "jobId": "exp_01" }` y descarga posterior.

## 6. Validaciones, permisos y aislamiento por empresa

- Permiso `users.export` (o `users.read`, según decida backend).
- Cada `id` se comprueba contra la empresa del token; un `id` ajeno responde `404` o se rechaza la exportación completa (documentar cuál).
- Límite de filas documentado; codificación UTF-8; zona horaria para fechas.
- En XLSX, celdas de tipo texto (nunca fórmula). Si se ofrece CSV, escapar los valores que empiezan con `=`, `+`, `-` o `@`.
- Registrar la exportación en auditoría (datos personales).

## 7. Errores y comportamiento esperado en frontend

- Fallo al generar: toast «No se pudo generar el archivo de usuarios», sin aviso de éxito.
- Botón deshabilitado mientras carga el listado, si falló o si no hay filas.
- Con exportación del servidor: `403` mensaje de permiso; `413/422` límite superado.

## 8. Transacciones, concurrencia e idempotencia

- Lectura. Con trabajo asíncrono: `jobId` idempotente por petición y expiración del archivo.

## 9. Dependencias mínimas

Bloque 02 (y bloque 00 para permisos).

## 10. Pruebas de aceptación

- La exportación coincide con lo seleccionado o, sin selección, con todo el listado filtrado.
- Un `id` de otra empresa se rechaza.
- Un usuario sin permiso no exporta.
- Ningún texto de usuario se ejecuta como fórmula al abrir el archivo.
- El archivo no contiene contraseñas ni tokens.

## 11. Decisiones pendientes y desviaciones del mockup

- Aprobar la semántica de selección (página visible + selección conservada entre páginas).
- Si producto quiere acciones masivas, se definen en un bloque nuevo.
- Formato final (XLSX hoy) y columnas.
- Cuándo el volumen obliga a exportar desde el servidor.

## 12. Checklist de entrega e integración

- [ ] Producto aprueba la semántica de selección y exportación.
- [ ] Backend confirma si hace falta exportación en servidor (solo si se pagina E3).
- [ ] Frontend: cambiar a la ruta del servidor si E3 se pagina.
- [ ] Prueba de inyección de fórmulas con un archivo abierto en Excel/LibreOffice.

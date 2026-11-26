# Entrega del frontend — Notificaciones por WhatsApp, Hito 1

Fecha: 2026-10-10 · Rama `feat/whatsapp-notificaciones`. La integración real con backend es una fase posterior; esta entrega cierra el frontend.

## Resumen

- **Frontend implementado:** las seis pestañas de `/configuracion/whatsapp` (Conexión, Plantillas, Programación, Conversaciones, Historial de envíos, Bajas/alertas/permisos) con todos sus modales y el panel de conversación; el hilo en la ficha del pedido; el indicador del último aviso en Ventas, Operaciones y Gestión CC; la tarjeta que reemplaza la configuración local de Guías; el componente de alertas (sin montar) y los componentes de la página pública con su ruta `/p/[token]` en estado pendiente.
- **Comportamiento sin backend:** cada lectura muestra "pendiente de integración" (distinto de vacío o error); cada acción persistente queda bloqueada con explicación accesible; no hay datos, métricas, conexiones, guardados ni éxitos ficticios; `localStorage` solo guarda la pestaña y la vista de Conversaciones. Los fixtures viven solo en `src/mocks/whatsapp/` y se usan en stories y tests (test de guarda).
- **Integración pendiente de backend:** todos los contratos `/wa` (C-01 a C-28), C-29, C-30 y C-31, más permisos `WA_*` efectivos (C-28/C-00.10) y tiempo real (C-00.9).
- **Decisiones pendientes de producto:** D-55, D-63, D-67 (comportamientos provisionales que difieren del PDF o lo interpretan), D-69, D-72 y las demás marcadas "Pendiente" en [decisiones-y-contradicciones.md](decisiones-y-contradicciones.md).
- **Montaje pendiente en otro repositorio o infraestructura:** alojamiento definitivo de la página pública y subdominio `{tienda}.powip.lat` (D-06), configuración de la app de Meta para Embedded Signup (D-71), campanita global (C-31).
- **Fidelidad visual:** la interfaz reproduce el mockup (tokens, medidas, composición de las seis pestañas, modales y cajón), comparada en Storybook con el mismo viewport; diferencias intencionales V-01 a V-28 en [fidelidad-visual.md](fidelidad-visual.md).
- **Revisión visual pendiente:** ver [Verificación visual](#verificación-visual).

## Matriz final

Leyenda: **Hecho** = frontend completo y probado; **Hecho (pendiente)** = completo, en la app muestra estado pendiente hasta tener contrato; **Montado** = integrado en una pantalla existente. En verificación visual, **Stories ✔** = revisado con Playwright en 1280, 375 y 320 px, oscuro y teclado ([README](README.md#etapas-7-a-9-y-revisión-final-2026-10-10)); **app con sesión pendiente** = la pantalla real necesita login contra el backend y queda en la lista de comprobación manual.

| Elemento | Frontend | Contrato backend | Bloqueo externo | Verificación visual |
|---|---|---|---|---|
| Menú y tarjeta (NAV-1, NAV-2) | Hecho | — | — | App con sesión pendiente |
| Página, pestañas, URL y volver/adelante (PG-1, PG-1.3) | Hecho | C-12, C-22.2 (contadores) | — | App con sesión pendiente |
| Estado de conexión en cabecera (PG-1.1) | Aviso fijo; estado real en Conexión | C-01 | — | App con sesión pendiente |
| Selector de tienda global (PG-1.2) | Por pestaña (D-69) | C-E1 ✔ | Producto (D-69) | App con sesión pendiente |
| Conexión · Tipo de conexión + confirmar cambio (T1.S1, T1.M3) | Hecho (pendiente) | C-01, C-03 | D-04 | Stories ✔; app con sesión pendiente |
| Conexión · Número conectado, actualizar, desconectar (T1.S2, T1.A1, T1.M2) | Hecho (pendiente) | C-02, C-04, C-05 | — | Stories ✔; app con sesión pendiente |
| Conexión · Mensaje de prueba (T1.S3) | Hecho (pendiente) | C-07, C-12 | — | Stories ✔; app con sesión pendiente |
| Conexión · Números por tienda + ver detalle (T1.S4, T1.A2) | Hecho (pendiente) | C-02, C-E1 ✔ | — | Stories ✔; app con sesión pendiente |
| Conexión · Embedded Signup (T1.M1) | Hecho (bloqueado) | C-06 | Configuración de Meta (D-71) | Stories ✔; app con sesión pendiente |
| Conexión · Contingencia (T1.S5) | Hecho (pendiente) | C-10, C-E4 ✔ | Alta de número solo app (sin definir) | Stories ✔; app con sesión pendiente |
| Conexión · Bandeja asistida (T1.S6, T1.A3) | Hecho (pendiente) | C-11 | Producto (D-72), permiso (D-65) | Stories ✔; app con sesión pendiente |
| Conexión · Costos (T1.S7) | Hecho (pendiente) | C-08, C-09 | Fuente de tarifas (D-05) | Stories ✔; app con sesión pendiente |
| Plantillas · lista, filtros, duplicar (T2.S1, T2.A1) | Hecho (pendiente) | C-12 | D-13 | Stories ✔; app con sesión pendiente |
| Plantillas · editor, A/B, estados de Meta (T2.M1) | Hecho (guardar bloqueado) | C-12, C-13, C-14 | D-39, D-44 (validar reglas de Meta) | Stories ✔; app con sesión pendiente |
| Plantillas · aviso de aprobación + activar en regla (T2.S2) | Hecho | C-12, C-16 | — | Stories ✔; app con sesión pendiente |
| Programación · resumen y reglas, alcance, ver mensaje (T3.S1, T3.S2, T3.A1) | Hecho (pendiente) | C-16, C-E1..E3 ✔, C-E8 ✔ | D-08, D-09, D-50 | Stories ✔; app con sesión pendiente |
| Programación · activar regla (T3.M1) | Hecho (bloqueado) | C-16 | D-47 | Stories ✔; app con sesión pendiente |
| Programación · datos faltantes, horario (T3.S3, T3.S4) | Hecho (pendiente) | C-18, C-24 | D-48 | Stories ✔; app con sesión pendiente |
| Programación · próximas 24 h (T3.S5) | Hecho (pendiente) | C-20 | — | Stories ✔; app con sesión pendiente |
| Programación · envíos programados, modal, resultados (T3.S6, T3.M2, T3.M3) | Hecho (pendiente) | C-21 | D-54 | Stories ✔; app con sesión pendiente |
| Conversaciones · barra, tablero, lista (T4.S1-S3) | Hecho (pendiente) | C-22.1, C-22.2 | **D-55 (producto)** | Stories ✔; app con sesión pendiente |
| Conversaciones · panel, composición, ventana 24 h (T4.C1) | Hecho (pendiente) | C-22.3..8, C-23 | D-56, D-58, D-60 | Stories ✔; app con sesión pendiente |
| Conversaciones · respuesta automática (T4.M1) | Hecho (guardar bloqueado) | C-18 | D-27 | Stories ✔; app con sesión pendiente |
| Conversaciones · dar de baja (T4.M2) | Hecho (bloqueado) | C-25 | D-12 | Stories ✔; app con sesión pendiente |
| Historial · periodo, export, indicadores, embudo (T5.S1-S3) | Hecho (pendiente) | C-24 | **D-63, D-67 (producto)**, D-64 | Stories ✔; app con sesión pendiente |
| Historial · "Así se ve en las listas" y leyenda (T5.S4, T5.S5) | Hecho | — | — | Stories ✔; app con sesión pendiente |
| Historial · tabla, línea de tiempo, reenviar (T5.S6, T5.A1) | Hecho (pendiente) | C-24 | — | Stories ✔; app con sesión pendiente |
| Ajustes · bajas, alta, reactivación (T6.S1, T6.M1, T6.M2) | Hecho (pendiente) | C-25, C-18 | D-12, D-66 | Stories ✔; app con sesión pendiente |
| Ajustes · alertas y últimas alertas (T6.S2, T6.S3) | Hecho (pendiente) | C-26 | D-65 | Stories ✔; app con sesión pendiente |
| Ajustes · números extranjeros (T6.S4) | Hecho (pendiente) | C-18 | — | Stories ✔; app con sesión pendiente |
| Ajustes · registro de cambios (T6.S5) | Hecho (pendiente) | C-27 | — | Stories ✔; app con sesión pendiente |
| Ajustes · permisos (T6.S6) | Hecho (pendiente) | C-28, C-00.10 | D-11, D-65 | Stories ✔; app con sesión pendiente |
| X1 · Mensajes en la ficha del pedido | Montado (pendiente) | C-22.7 | D-56 | Stories ✔; app con sesión pendiente |
| X2 · Indicador del último aviso | Montado (sin dato no se ve) | C-29 | — | Stories ✔; app con sesión pendiente |
| X3 · Página pública | Componentes + ruta pendiente | C-30 | Alojamiento y dominio (D-06) | Stories ✔; ruta en la app ✔ |
| X3 · Acortador `/r` | No corresponde al frontend | C-30.2 | Backend | — |
| X4 · Sección local de Guías | Reemplazada | — | — | App con sesión pendiente |
| X5 · Campanita de alertas | Componente listo, sin montar | C-31 | Infraestructura global (D-75) | Stories ✔; app con sesión pendiente |

## Qué necesita construir backend, por pantalla

| Pantalla | Lecturas | Acciones |
|---|---|---|
| Conexión | C-01 estado, C-02 cuentas, C-08 uso, C-09 tarifas, C-10 contingencia, C-11 bandeja | C-03 tipo, C-04 actualizar, C-05 desconectar, C-06 signup, C-07 prueba, C-10 guardar/activar, C-11 opened/mark-sent/discard |
| Plantillas | C-12 lista/detalle, C-13 catálogo, C-14 pedidos de muestra | C-12 crear, editar, enviar a revisión, duplicar |
| Programación | C-16 reglas y vista previa, C-18 ajustes, C-20 cola, C-21 campañas y contador, C-24 omitidos | C-16 guardar/activar/desactivar, C-18 guardar, C-21 crear/editar/pausar/reanudar |
| Conversaciones | C-22.1/22.2 tablero, lista y contadores, C-22.3 detalle, C-23 respuestas rápidas, C-18 respuesta automática | C-22.4 responder, C-22.5 plantilla, C-22.6 nota/asignar/atender, C-22.8 reintentar, C-25 baja, C-18 guardar |
| Historial | C-24 métricas y mensajes | C-24 reenviar, exportar todas las filas |
| Bajas, alertas y permisos | C-25 bajas, C-18 protección, C-26 reglas y alertas, C-27 registro, C-28 matriz y permisos efectivos | C-25 alta/reactivar, C-18, C-26, C-28 guardar |
| Pedidos | C-22.7 conversaciones por pedido, C-29 `waLastNotice` en listas y detalle | — |
| Página pública | C-30.1 `GET /p/:token`, C-30.2 `/r/:codigo` | — |
| Campanita | C-31 | C-31 marcar leído |
| Transversal | C-00.1 servicio y URL base, C-00.9 tiempo real, C-00.10 permisos `WA_*` | Auditoría (C-27) en toda mutación |

## Qué falta para usarlo con datos reales

1. Backend: servicio y URL base (C-00.1) y los contratos de la tabla anterior; permisos `WA_*` por usuario y tienda.
2. Frontend (fase de integración): por contrato, cambiar su estado a `confirmed` en `whatsapp-contracts.ts`, crear `api/` con `assertWhatsAppContractAvailable`, hooks de TanStack Query con las claves de `whatsapp.keys.ts`, pasar estados y manejadores a cada `*Tab` (los `*View` ya aceptan `mutations` y estados), invalidaciones y polling o tiempo real.
3. Meta: app como Tech Provider, `config_id`, dominio permitido, verificación del negocio; luego implementar `startSignup` (D-71).
4. Producto: resolver las decisiones pendientes (en especial D-55, D-63, D-67, D-72) y validar los textos de Meta (D-32, D-44).
5. Infraestructura: alojamiento de la página pública y subdominio (D-06); sacar `/p` del `AuthProvider` global, que hoy intenta `auth/refresh` también en esa ruta ([09](screens/09-pagina-publica-rastreo.md#montaje-pendiente), punto 5); campanita (C-31).
6. Revisión visual y criterios §14 del PDF con datos reales.

## Verificación visual

Ver [README.md › Verificaciones](README.md#verificaciones-y-limitaciones) para el resultado de la revisión con el navegador disponible y la lista de comprobación manual.

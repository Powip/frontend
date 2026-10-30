# 06 · Pestaña Bajas, alertas y permisos (`?tab=ajustes`)

Referencias: PDF §6.6, §9.1, §11, §13 casos 12-14, 35, §14.5-14.6; mockup `#p-ajustes`.

**Estado (etapa 6, 2026-10-09):** frontend completo y revisable en Storybook (`WhatsApp/Ajustes/SettingsView`). En la app, sin backend, los formularios cargan valores sugeridos rotulados ("no son la configuración guardada"), las listas muestran "pendiente de integración" y toda acción persistente queda bloqueada con explicación. No hay llamadas a `/wa` ni datos en `localStorage`.

## Componentes

| Componente | Archivo |
|---|---|
| `SettingsTab` (contenedor: tiendas y tienda activa de `useAuth`, búsqueda y filtros locales, navegación de "Ver") | `src/app/configuracion/whatsapp/_components/ajustes/SettingsTab.tsx` |
| `SettingsView` (motivos de bloqueo por acción) | `…/SettingsView.tsx` |
| `OptOutsSection`, `AddOptOutDialog`, `ReactivateOptOutDialog` | `…/OptOutsSection.tsx`, `AddOptOutDialog.tsx`, `ReactivateOptOutDialog.tsx` |
| `AlertsSection` (reglas + últimas alertas) | `…/AlertsSection.tsx` |
| `ForeignNumbersSection` | `…/ForeignNumbersSection.tsx` |
| `AuditLogSection` | `…/AuditLogSection.tsx` |
| `PermissionsSection` | `…/PermissionsSection.tsx` |
| `SettingsDraftFooter`, `SuggestedValuesNote` (reutilizan `FormDraftActions`) | `…/SettingsDraftFooter.tsx` |

Dominio: `models/settings-tab.model.ts`, `schemas/settings-tab.schema.ts`, `utils/whatsapp-permissions.util.ts`, `utils/audit-format.util.ts`, `utils/opt-out-phone.util.ts`, `hooks/use-settings-draft.ts`, `constants/whatsapp-settings-catalog.ts`.

## Reglas comunes

- **Tienda:** bajas automáticas, alertas y números extranjeros son por tienda (`tienda_id`, §9.1). Se usa la tienda activa de POWIP (`selectedStoreId`); el encabezado lo dice. Cambiar de tienda reinicia los borradores.
- **Borradores:** locales y revisables; "Descartar cambios" pide confirmación; un refetch no pisa un borrador con cambios y, sin cambios, toma lo nuevo (`useSettingsDraft`, tests).
- **Sugeridos:** sin backend, "Valores sugeridos del documento… No son la configuración guardada"; con backend y sin configuración (`null`), "Todavía no hay una configuración guardada".
- **Motivos de bloqueo** (se combinan): "Pendiente de integración…" + permiso (`WA_*` sin confirmar, denegado, o "El permiso para hacer este cambio todavía no está definido en POWIP" cuando el PDF no asigna un permiso).
- **Edición de campos:** `canManageConfiguration` (administrador, criterio provisorio D-11) solo habilita editar borradores; nunca habilita guardar.

## T6.S1 · Clientes que no quieren avisos

| Campo | Detalle |
|---|---|
| Interruptor | "Dar de baja solo si el cliente escribe STOP, BAJA o NO MÁS, y confirmarle que ya no recibirá avisos" (`optOutByKeyword`, C-18; sugerido: activo) |
| Tabla | Cliente ("Sin nombre"), Teléfono, Tienda ("Todas las tiendas" solo si backend envía `storeId: null`), Cómo se dio de baja, Fecha (Lima), Reactivar |
| Origen | Escribió STOP, BAJA o NO MÁS · Lo pidió a la asesora · Meta informó que bloqueó el número (solo con `origin: meta_block`) · Agregado a mano · "Origen sin informar". Nunca se afirma un bloqueo de Meta sin ese dato |
| Búsqueda / paginación | Nombre o teléfono (300 ms, mínimo 2); `pageSize` 50; bloqueada sin backend |
| Estados | Pendiente, cargando, error, sin permisos, vacío ("Nadie se dio de baja"), sin coincidencias |
| Garantías BE | A estos números no se les envía nada (ni automático ni masivo); se consulta antes de encolar |
| Permiso | `WA_OPTOUTS` |

### T6.M1 · Agregar número

Teléfono validado y normalizado con la utilidad existente `toWhatsAppNumber` (D-29): celular de Perú, 9 dígitos que empiezan en 9, con o sin +51; muestra "Se guardará como +51 987 654 321". Nombre opcional (≤ 80), tienda obligatoria (alcance empresa pendiente, D-12), nota opcional (≤ 200). "Agregar a bajas" bloqueado; Cancelar con datos pide confirmar. Números extranjeros en bajas: pendiente (D-66).
Contrato: `POST /wa/optouts` + `Idempotency-Key` `{ "phone": "51987654321", "storeId", "customerName", "origin": "manual", "note" }` → baja creada. Errores: `409 WA_ALREADY_OPTED_OUT`, `422 WA_INVALID_PHONE`, `403`.

### T6.M2 · Reactivar

Exige marcar "El comprador pidió volver a recibir avisos" y escribir cómo lo pidió (5-200 caracteres); explica que queda registrado quién, cuándo y por qué. Bloqueado sin backend y sin `WA_OPTOUTS`.
Contrato: `POST /wa/optouts/:id/reactivate` + `If-Match` `{ "reason": "customer_request", "note" }` → `204`; backend escribe en C-27 usuario, fecha, teléfono y nota. Errores: `404`, `409 WA_VERSION_CONFLICT`, `403`.

## T6.S2 · Alertas de salud y T6.S3 · Últimas alertas

| Alerta | Unidad y rango | Sugerido (PDF / mockup) |
|---|---|---|
| La calidad del número baja a media o roja | — | activa |
| Meta pausa o rechaza una plantilla en uso | — | activa |
| Avisos no enviados en 1 hora | % entero 1-100 | 5 |
| Uso del límite diario de Meta | % entero 1-100 | 80 |
| Respuestas de clientes sin atender | minutos enteros 1-1440 | 30 |

Una alerta apagada no valida su umbral. "Pausar envíos programados y masivos si la calidad baja a roja" (sugerido: activo) aclara que POWIP pausa y reanuda; la pantalla no pausa reglas ni campañas. "Quién recibe": Administradores · campanita y WhatsApp / solo campanita, con la nota de que la campanita no existe (C-31, no integrada). La deduplicación (no repetir antes de 6 h) es de backend.
Últimas alertas (7 días): fecha (Hoy/Ayer/fecha) y hora de Lima, texto y "Ver" que solo cambia a la pestaña `relatedTab` (sin inventar plantilla, conversación ni mensaje). Sin pestaña válida: "Sin pestaña relacionada".
Contratos: `GET/PUT /wa/alerts/rules?storeId` con `If-Match` `{ "rules": [{ "type", "enabled", "threshold" }], "recipients", "pauseCampaignsOnRed", "version" }` (errores `422` por rango, `409`); `GET /wa/alerts?storeId&days=7` → `[{ "id", "type", "message", "createdAt", "relatedTab" }]`. Permiso: no lo define el PDF (D-65).

## T6.S4 · Números extranjeros

"Si escribe un número que no es de Perú (+51)": Responder normal (sugerido) · Responder una vez y cerrar · Ignorar. Interruptor "Permitir avisos automáticos a números extranjeros" (sugerido: apagado).
**Relación con Programación:** la condición obligatoria de "Si al pedido le faltan datos" ahora dice "No enviar si el teléfono no es un celular válido de Perú (+51, 9 dígitos, empieza en 9), salvo que se permitan avisos a números extranjeros en Bajas, alertas y permisos". Así ambas pestañas describen la misma regla. La validación real al encolar es de backend (§6.6.4).
Contrato: `PUT /wa/settings` (`optOutByKeyword`, `foreignNumbers: { inbound, allowOutbound }`) con `If-Match`. Permiso: `WA_RULES` (afecta avisos automáticos).

## T6.S5 · Registro de cambios

Lista con fecha y hora (Lima), usuario ("Usuario sin informar" si falta), acción, tipo y resumen; "Ver antes y después" muestra cada campo con Antes/Después, "Sin dato" para ausentes, listas legibles y "Ver completo" para valores largos (> 120 caracteres). Campos sensibles (token, secret, password, clave, credential, authorization, api key, private), también anidados, se muestran como "Oculto por seguridad" y nunca llegan al DOM. Sin editar ni borrar. Filtros: tipo (8 entidades) y usuario (solo si backend devuelve la lista `users`; si no, deshabilitado con explicación). Paginación `pageSize` 20.
Contrato C-27: `GET /wa/audit?storeId&entity&userId&page&pageSize` → `{ "items": [{ "id", "createdAt", "user", "entity", "entityId", "action", "summary", "before", "after" }], "page", "pageSize", "total", "hasMore", "users" }`. Backend escribe una fila por cada mutación confirmada (nunca por cambios locales del formulario), redacta secretos antes de guardar y no permite borrar.

## T6.S6 · Permisos

- **Tus permisos en este módulo:** los 8 permisos con "Permitido", "No permitido" o "Sin confirmar", desde códigos `WA_*` del usuario (C-28/C-00.10). Hoy: todos "Sin confirmar", y las acciones que los requieren quedan bloqueadas.
- **Permisos por rol:** sin backend, la matriz del PDF como referencia de solo lectura ("no está guardada ni se aplica"; Supervisor CC y Asesora todavía no existen como roles de POWIP). Con backend y edición: casillas para Supervisor CC y Asesora; Administrador siempre marcado y deshabilitado; "N cambios sin guardar"; "Cambiar una casilla no da ni quita permisos"; guardar bloqueado.
- **Identidad de roles:** `admin`, `cc_supervisor`, `cc_agent` deben venir de backend y asignarse a usuarios reales (D-11); el frontend no los deduce de `ADMINISTRADOR`, `AGENTES` ni `ccRol`.
- Contrato C-28: `GET /wa/permissions` → `{ "matrix": { "WA_VIEW": { "admin", "cc_supervisor", "cc_agent" }, … }, "version" }`; `PUT` con `If-Match` (backend fuerza `admin: true`); permisos efectivos en `GET /auth/me` o en el JWT como `waPermissions: ["WA_VIEW", …]`. Enforcement: cada endpoint `/wa` valida el permiso en el servidor; el frontend solo oculta o bloquea.

## Criterios de aceptación

§14.4-14.6 con datos reales: STOP da de baja y confirma; reactivar deja registro de quién; cada alerta se dispara al cruzar su umbral y no se repite antes de 6 h; la pausa por calidad roja pausa campañas y no los avisos de Utilidad; una asesora no puede activar reglas ni conectar números. Sin backend (tests): sugeridos rotulados, validaciones de teléfono y umbrales, descarte confirmado, borradores que sobreviven a refetch, secretos ocultos, "Ver" solo a la pestaña, administrador fijo y ninguna acción guardada.

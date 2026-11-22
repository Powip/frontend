# 02 · Pestaña Plantillas (`?tab=plantillas`)

Referencias: PDF §6.2, §8.3, §10.1, §13 casos 10-11, §14.2; mockup `#p-plantillas`, `#mTpl`.
Permiso de mutación: `WA_TEMPLATES` (PDF §6.6.3: Administrador y Supervisor CC). Hoy solo administradores y superadmins (D-33, D-11).

**Estado (etapa 3):** frontend implementado completo. Listado, filtros, editor, vista previa, A/B, validaciones, descarte y estados de Meta funcionan en local y en Storybook. **Pendiente de integración:** leer plantillas, guardar, enviar a revisión, duplicar en servidor, métricas, estados de Meta reales, aviso de aprobación con datos reales y pedidos reales para la vista previa (C-12, C-13, C-14).

## Implementado frente a pendiente

| Parte | Frontend (implementado) | Pendiente de integración |
|---|---|---|
| Listado | Tabla, filtros, estados, métricas como "—" si no hay dato, A/B sin ganador inventado | `GET /wa/templates` (C-12) |
| Nueva plantilla | Editor completo, vista previa con datos de muestra, validaciones | `POST /wa/templates`, `POST …/submit` |
| Editar | Carga de valores, estados de Meta, versión aprobada anterior, solo lectura en revisión | `GET /wa/templates/:id`, `PUT /wa/templates/:id`, `POST …/submit` |
| Duplicar | Abre el editor como plantilla nueva con el contenido y nombre "… copia" | `POST /wa/templates/:id/duplicate` (o crear con `POST /wa/templates`, D-13) |
| Aviso "Meta aprobó" | Componente con "Activar en una regla" verificable en Storybook | Detección real de la aprobación (polling de C-12) y navegación a Programación (etapa 4) |
| Catálogo | Usos, variables, idiomas y límites del PDF en `whatsapp-template-catalog.ts` | C-13 (backend como fuente) |
| Vista previa | Valores de muestra etiquetados | C-14 (pedidos reales) |

---

## T2.S1 · Lista de plantillas y filtros

| Campo | Detalle |
|---|---|
| Componentes | `TemplatesTab` (contenedor), `TemplatesListView` (presentacional), `TemplatesTable`, `TemplateStatusBadge`, `WhatsAppResourceState` (`src/components/whatsapp/`) |
| Ubicación | `src/app/configuracion/whatsapp/_components/plantillas/` |
| Cabecera | "Tus plantillas", texto de revisión de Meta y botón "Nueva plantilla" (solo con permiso) |
| Columnas | Plantilla (nombre técnico + inicio del mensaje), Se usa en, Categoría, Estado en Meta (insignia + motivo de Meta o "se sigue enviando la versión aprobada anterior"), Enviados 30 d, Leídos (+ resumen A/B), Abren rastreo, Acciones (Editar/Ver, Duplicar) |
| Métricas | Vienen de `stats30d`. Sin dato: "—". Nunca se calculan en el frontend |
| A/B | Si hay `abTest.results`: "A/B · A x% · B y%", ganadora en negrita y anunciada a lectores de pantalla **solo si backend envía `winner`**. Sin resultados: "A/B en curso · sin resultados" |
| Filtros | Todas, Aprobadas, En revisión, Rechazadas, Pausadas, Borradores (`aria-pressed`). Sin coincidencias: "No hay plantillas con este estado". Se muestran solo con datos |
| Estados | **Pendiente de integración** (app hoy): aviso "Listado de plantillas pendiente de integración"; no hay tabla ni filtros ni "Todavía no tienes plantillas". **Cargando**: skeleton con `role="status"`. **Error**: alerta + "Reintentar". **Sin permisos**: aviso. **Vacío real**: "Todavía no tienes plantillas". **Contenido**: tabla |
| Acciones | Fila, lápiz → editor en modo edición. Duplicar → editor en modo duplicar. Sin permiso: icono "Ver" y sin Duplicar |
| Tabla en mobile | Contenedor con desplazamiento horizontal propio (`overflow-x-auto`, tabla `min-w-[860px]`); la página no se desborda |
| Lectura | `GET /wa/templates?storeId=&status=&page&pageSize` → `{ items, page, pageSize, total }` (forma en C-12) |
| Actualización | Polling 30 s mientras haya alguna `PENDING` (cuando exista C-12) |
| Criterios de aceptación | Sin backend se ve pendiente y no "vacío" ✔. Métricas y ganadora solo con datos ✔. Motivo de rechazo tal cual ✔. Estados automáticos por webhook: pendiente |

### T2.A1 · Duplicar

| Campo | Detalle |
|---|---|
| Implementado | Abre el editor "Duplicar plantilla" con el contenido de la original y el nombre "{nombre legible} copia"; aviso "La copia es una plantilla nueva y Meta la revisa desde cero". No crea nada |
| Pendiente | Persistir la copia: `POST /wa/templates/:id/duplicate` → plantilla `DRAFT`, o `POST /wa/templates` con los valores del editor (decisión D-13) |
| Errores propuestos | `422 WA_VALIDATION` (nombre ya existe en la WABA) → error en "Nombre interno" |

## T2.S2 · Aviso "Meta aprobó" y "Activar en una regla"

| Campo | Detalle |
|---|---|
| Componente | `TemplateApprovedBanner` (`role="status"`), integrado en `TemplatesListView` por la prop `approvedNotice` |
| Implementado | Texto "Meta aprobó {nombre}. Ya puedes usarla en un aviso automático.", botón "Activar en una regla" (solo con permiso de reglas) y "Cerrar aviso de aprobación". Stories `WithApprovalNotice` y `TemplateApprovedBanner/*` |
| En producción | `TemplatesTab` no pasa `approvedNotice`: el aviso solo aparecerá cuando exista C-12 y se detecte el cambio `PENDING → APPROVED` real |
| Pendiente | Detección por polling; navegación a `?tab=programacion&template=<id>` y preselección de la plantilla en la regla del mismo uso (etapa 4) |

---

## T2.M1 · Editor de plantilla

| Campo | Detalle |
|---|---|
| Componentes | `TemplateEditorDialog` (estructura, descarte, pie), `TemplateEditorFields` (campos), `TemplateEditorPreview`, `TemplateVariableChips`, `TemplateSegmentedChoice`, `TemplatePromotionalWarning`, `TemplateStatusNotice`; `WhatsAppPhonePreview` compartido |
| Dominio | `templateEditorSchema` + `createTemplateEditorDefaultValues` (`src/features/whatsapp/schemas/`), `toTemplateEditorValues` (`mappers/`), `insertTextAtSelection` y variables por uso (`utils/template-variables.util.ts`), `hasMalformedVariableTokens` (`utils/template-render.util.ts`), catálogo (`constants/whatsapp-template-catalog.ts`) |
| Modos | Nueva plantilla · Editar plantilla · Ver plantilla (sin permiso o en revisión) · Duplicar plantilla |
| Estructura | `Dialog` del repo sin el botón por defecto (su texto era "Close"); cabecera fija con título, descripción y "Cerrar ventana"; contenido con scroll propio (`max-h-[calc(100dvh-2rem)]`, `overflow-y-auto`); pie fijo. Formulario a la izquierda y vista previa a la derecha desde `lg`; en pantallas menores, vista previa debajo |
| Reapertura | Cada apertura monta un editor nuevo (`key` por sesión): no quedan datos de otra plantilla |

### Campos y validaciones

| Campo | Implementación | Validación del frontend (mensaje junto al campo) |
|---|---|---|
| Nombre interno | Texto; debajo "Se guarda como `slug`" en vivo (`toTemplateTechnicalName`) | Requerido; debe producir al menos una letra o número; máx. 512 |
| Se usa en | `Select` con los 10 usos del PDF §6.2.3 | Requerido. Al cambiar de uso: si el encabezado era PDF y el nuevo uso no lo admite, vuelve a "Ninguno"; se revalidan variables |
| Categoría | Selector segmentado accesible (radios nativos) Utilidad/Marketing con texto de ayuda | — |
| Idioma | Español (Perú) / Español | Códigos `es_PE` y `es`. Meta lista `es_PE` en su página pública, pero no está confirmado en integración (D-39) |
| Encabezado | Ninguno · Texto · Documento PDF | Texto: requerido si se elige, máx. 60 y una variable como máximo (ambas comprobadas en la documentación de Meta, D-44). PDF: solo para "Comprobante emitido"; la opción queda deshabilitada en otros usos y se explica por qué |
| Encabezado PDF | Sin subida de archivos: "El PDF del comprobante lo adjunta POWIP en cada envío" | — |
| Mensaje | `Textarea` con contador 0/1024 | Requerido; máx. 1024; llaves bien formadas; solo variables del uso elegido |
| Variables | Botones que insertan en la posición del cursor del último mensaje enfocado (A o B), reemplazan la selección y devuelven el foco con el cursor después de la variable. `onMouseDown` evita perder la selección; por teclado también funciona | `{{tipo_comprobante}}` y `{{serie_numero}}` solo en "Comprobante emitido" |
| Texto sugerido | Botón "Usar texto sugerido para «uso»" con los textos base del PDF §6.2.2, visible solo con el mensaje vacío | — |
| Pie | Por defecto "Responde STOP para no recibir avisos" | Máx. 60 (comprobado); sin variables (inferido de "text-only", requiere validación, D-44) |
| Botón de enlace | Texto editable; enlace fijo `powip.lat/r/{{codigo}}` (solo lectura, "Rastreo POWIP") | Requerido; máx. 25 (comprobado en Meta); sin variables (no comprobado, requiere validación, D-44) |
| Respuesta rápida | Casilla "Tengo una consulta" | — |
| A/B | Interruptor; mensaje de la versión B; "Elegir ganadora después de" (por defecto 200); selector "Vista previa A / B" | Versión B con las mismas reglas que A; mínimo entero 1..100.000. Solo se valida con A/B activo |
| Lenguaje promocional | Recuadro ámbar `role="status"` con los términos detectados, en Utilidad, sobre encabezado de texto, mensaje A y B | **No bloquea** (D-38) |

Las validaciones se muestran al salir de cada campo (`mode: "onTouched"`) con `aria-invalid` y el mensaje enlazado por `aria-describedby`. Meta y backend siguen siendo la autoridad (unicidad del nombre, formato final, variables posicionales).

### Vista previa

- Teléfono con el nombre de la empresa (`auth.company.name`). El nombre visible real de cada número (C-02) está pendiente.
- Insignia "Datos de muestra" y texto "Las variables se reemplazan con valores de ejemplo, no con un pedido real". Los valores salen del catálogo, no de `src/mocks`.
- Encabezado PDF con nombre de archivo de muestra; variables sin valor se marcan en ámbar.
- Con A/B: título "Vista previa · versión A/B" y selector de versión.
- Render seguro con `WhatsAppFormattedText`: no se usa `dangerouslySetInnerHTML`.

### Estados de Meta en el editor (`TemplateStatusNotice`)

| Estado | Comportamiento |
|---|---|
| DRAFT | "Borrador: todavía no se envió a Meta." Editable. Botón "Enviar a revisión de Meta" |
| PENDING | Solo lectura ("Ver plantilla"): "Meta está revisando esta plantilla. Podrás editarla cuando Meta responda." Si hay `approvedVersion`: aviso y desplegable "Ver la versión aprobada que se sigue enviando" con fecha (hora de Lima) y vista previa |
| APPROVED | Editable con aviso de que vuelve a revisión y se sigue enviando la versión aprobada. Botón "Guardar y reenviar a revisión" |
| REJECTED | Editable; "Motivo informado por Meta: …" tal cual; si había versión aprobada, también se muestra |
| PAUSED | Editable; aviso de pausa y motivo de Meta. Botón "Guardar y reenviar a revisión" |
| Duplicado | "Estás creando una copia de {nombre}…" |

### Sin backend (comportamiento actual)

- Se puede abrir "Nueva plantilla", completar el formulario, insertar variables, ver la vista previa y las validaciones.
- "Guardar borrador" y "Enviar a revisión de Meta" usan `aria-disabled` (siguen siendo enfocables) y están descritos por el texto del pie: "Guardar y enviar a revisión de Meta estarán disponibles cuando se conecte el servicio de plantillas…". Al pulsarlos no ocurre nada: ni toast, ni cierre, ni plantilla en la lista.
- No se escribe nada en `localStorage`.
- Los botones solo se activarán con `canPersist` (contrato `templates` confirmado) **y** un manejador real (`onSaveDraft`, `onSubmitForReview`); hoy `TemplatesTab` no pasa ninguno.

### Descarte

Al cerrar con cambios (Cancelar, "Cerrar ventana", Escape o clic fuera) aparece un `AlertDialog` "¿Descartar los cambios?" con "Seguir editando" y "Descartar cambios". Sin cambios o en solo lectura, cierra directo.

### T2.M1.A1 · Guardar borrador (pendiente)

| Campo | Detalle |
|---|---|
| Mutación propuesta | Nueva: `POST /wa/templates`. Existente: `PUT /wa/templates/:id` con `If-Match: <version>` |
| Payload propuesto | `{ storeId, name: toTemplateTechnicalName(displayName), usage, category, language, header: { type: headerType, text: headerText \| null }, body, footer \| null, button: { text: buttonText }, quickReply, ab: { enabled, bodyB \| null, minSendsPerVariant } }` |
| Respuesta | Plantilla (forma C-12) en `DRAFT` o con su estado vigente si estaba aprobada |
| Errores | `422 WA_VALIDATION` con `details.fields` → errores por campo; `409 WA_VERSION_CONFLICT` → aviso y recarga sin perder el texto local; `403 WA_FORBIDDEN` |
| Invalidación | `templates`, `template` |

### T2.M1.A2 · Enviar / Guardar y reenviar a revisión (pendiente)

| Campo | Detalle |
|---|---|
| Mutación propuesta | Guardar (A1) y `POST /wa/templates/:id/submit` |
| Éxito esperado | Cierra; la fila queda "En revisión"; toast real solo con respuesta 2xx |
| Errores | `422 WA_META_REJECTED_SUBMISSION` (motivo de Meta en el modal), `409 WA_TEMPLATE_IN_REVIEW`, `502 WA_META_UNAVAILABLE` |

### Lo que resuelve backend con Meta

Conversión de `{{cliente}}` a posicionales con `var_map` y ejemplos por variable; categoría e idioma finales; creación de `{nombre}_b` y reparto 50/50 del A/B; elección de ganadora y archivo de la perdedora; adjuntar el PDF de SUNAT en cada envío; estados `APPROVED/REJECTED/PAUSED` por webhook; mantener la versión aprobada mientras una edición está en revisión; unicidad del nombre en la WABA.

### Criterios de aceptación

| Criterio (PDF §14.2 y encargo) | Estado |
|---|---|
| Variables en la vista previa | Hecho (frontend) |
| Inserción en el cursor con foco y selección | Hecho, con tests de ratón y teclado |
| Advertencia promocional en Utilidad, sin bloquear | Hecho |
| Encabezado PDF solo para Comprobante emitido | Hecho |
| A/B con vista previa de ambas versiones, sin resultados inventados | Hecho |
| Validaciones junto al campo | Hecho |
| Descarte con confirmación y reapertura limpia | Hecho |
| Sin guardados ficticios ni `localStorage` | Hecho, con test |
| Llega a Meta con posicionales y ejemplos | Pendiente (backend) |
| Estados por webhook y aviso "Activar en una regla" con la regla correcta | Pendiente (C-12 y etapa 4) |
| A/B reparte 50/50 y elige ganadora | Pendiente (backend) |

**Contrato:** C-12 SPEC; C-13 y C-14 PROPUESTA. Ninguno disponible.

# Page

Partners · Mi Link & Código

## Route

`/partners/link`

## Objetivo

Que el partner tenga a mano su link y código de referido para compartirlos, vea sus métricas básicas (clics, usos, conversiones) y pueda descargar el kit de recursos.

## UI / Layout

Usa el `layout.tsx` compartido de Partners (se agregó la pestaña "Mi Link"). Reutiliza `loading.tsx`/`error.tsx` del segmento padre.

Grid de 2 columnas:
- Izquierda: card "Tu link y tu código de referido".
- Derecha: card "Compartir y kit".

## Componentes

- `_components/partner-link-card.tsx` — link y código con botón "Copiar" cada uno, alert de descuento (`ui/alert.tsx`), grid de 3 estadísticas.
- `_components/share-kit-card.tsx` — botones de compartir + lista de recursos.

### Qué es mock y qué es funcionalidad real en esta página

A diferencia de las páginas anteriores, acá varias acciones **no dependen de backend y se implementaron reales, no como stub**:
- **Copiar link / código**: `navigator.clipboard.writeText()` real (mismo patrón que ya usa el resto del dashboard, ej. `CcScriptPanel.tsx`).
- **Compartir por WhatsApp**: abre `https://wa.me/?text=...` real con el link del partner en el mensaje — es una URL pública de WhatsApp, no requiere backend.
- **Descargar QR**: genera un QR real del link (reutiliza el hook existente `src/hooks/useQrCode.tsx`, ya usado en etiquetas/comprobantes) y lo descarga con `saveAs` de `file-saver` (ya usado en el resto del proyecto para exports).
- **Compartir en Instagram**: Instagram no tiene una URL pública de "compartir" como WhatsApp, así que copia el link al portapapeles con un toast que indica pegarlo en la bio/historia — mismo comportamiento que tenía el botón "Instagram" en la referencia visual (ahí también reusaba la acción de copiar).

Lo que **sí sigue siendo mock** (no hay archivo real detrás): los 3 recursos (Logos, Playbook, Plantillas) — clickearlos muestra un toast explicando que todavía no están disponibles, en vez de simular una descarga de un archivo que no existe.

## Información mostrada

- Link único y código de referido.
- % de descuento que reciben los referidos por venir de un partner.
- Estadísticas: clics al link, usos del código, referidos que cerraron (pagaron).
- Lista de recursos descargables.

## Acciones del usuario

- Copiar link / copiar código.
- Compartir por WhatsApp (real) / Instagram (copia + instrucción).
- Descargar el QR del link (real, PNG).
- Intentar abrir un recurso (placeholder hasta que existan archivos reales).

## Estados

### Loading
Skeletons en la card de link mientras `usePartnerLink()` carga, y en la lista de recursos mientras `usePartnerResources()` carga. Los botones de compartir/QR se deshabilitan hasta tener `link`/QR generado.

### Empty
`EmptyState` en la lista de recursos si no hay ninguno.

### Error
`PartnerSectionError` independiente para la card de link y para la lista de recursos (compartir por WhatsApp/Instagram/QR sigue disponible aunque falle la carga de recursos, ya que dependen de `link`, no de `resources`).

### Success
Datos normales.

## Datos requeridos

- `PartnerLink` — modelo nuevo (url, código, % descuento, clics, usos, conversiones).
- `PartnerResource[]` — modelo nuevo (id, título, descripción, tipo).

## Mock data

- `src/features/partners/mocks/partner-link.mock.ts` — un `PartnerLink` de ejemplo.
- `src/features/partners/mocks/partner-resources.mock.ts` — 3 recursos de ejemplo.
- `services/get-partner-link.ts` y `get-partner-resources.ts` son el único lugar a reemplazar cuando exista backend. El resto de la página (copiar, WhatsApp, QR) no cambia porque no depende de esos endpoints.

## Backend Requirements

Propuesta, no confirmada.

1. **Link y código del partner autenticado**, con sus métricas (clics, usos de código, conversiones) — **BACKEND TBD**: ¿estas métricas se recalculan en tiempo real o son un snapshot periódico? Afecta si esta query necesita refetch automático (`refetchInterval`) más adelante.
2. **Catálogo de recursos descargables**: cada recurso necesita una URL real de archivo (S3, CDN, etc.) para que "abrir recurso" deje de ser un placeholder. Hoy el modelo `PartnerResource` no tiene ese campo porque no hay URL real que mockear con sentido — se agrega cuando exista.
3. **BACKEND TBD**: ¿el código de referido (`JOEL10`) lo genera el backend al aprobar al partner, o lo puede elegir el propio partner? Afecta si esta página necesita edición del código en el futuro.

## API Contract Proposal

### Request

```
GET /partners/me/link
Authorization: Bearer <token>
```

```
GET /partners/me/resources
Authorization: Bearer <token>
```

### Response

`GET /partners/me/link`
```json
{
  "url": "powip.com/r/joel-coila",
  "code": "JOEL10",
  "discountPct": 10,
  "clicks": 312,
  "codeUses": 47,
  "conversions": 7
}
```

`GET /partners/me/resources`
```json
[
  { "id": "res-logos", "title": "Logos POWIP", "description": "PNG · SVG", "kind": "logos" }
]
```
**BACKEND TBD**: agregar `downloadUrl` a cada recurso cuando exista almacenamiento real de archivos.

## Business Rules

- El % de descuento (`discountPct`) es un dato que se muestra, no se calcula ni se hardcodea en el frontend — hoy viene del mock, mañana del backend.
- Las estadísticas (clics/usos/conversiones) son de solo lectura, no se recalculan en el cliente.

## Acceptance Criteria

- [ ] La pestaña "Mi Link" navega correctamente.
- [ ] "Copiar" y "Copiar código" copian el valor correcto al portapapeles y muestran un toast de confirmación.
- [ ] El botón de WhatsApp abre una pestaña nueva con el link del partner en el mensaje.
- [ ] "Descargar QR" está deshabilitado hasta que el QR termine de generarse, y descarga un PNG con el nombre `powip-{código}.png`.
- [ ] Si falla la carga de recursos, la card de link y los botones de compartir siguen funcionando con normalidad (no dependen de esa query).
- [ ] Click en un recurso muestra el mensaje de "todavía no disponible" en vez de intentar descargar un archivo inexistente.

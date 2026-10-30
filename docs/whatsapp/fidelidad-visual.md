# Fidelidad visual con el mockup

Revisión y corrección visual del módulo Configuración › WhatsApp contra `POWIP WhatsApp Notificaciones (Copy).html` (2026-10-10). El mockup es la referencia visual; el PDF define las reglas. Donde chocan, se conserva la apariencia del mockup y se cumple la regla del PDF; cada caso queda listado en [Diferencias intencionales](#diferencias-intencionales).

> El pedido mencionaba el archivo «POWIP WhatsApp Notificaciones (Copy)(1).html». En el equipo solo existe `Downloads/POWIP WhatsApp Notificaciones (Copy).html` (157 KB, 7 oct 2026); es el que se usó.

## Cómo se comparó

- Mockup: abierto en Chromium (Playwright 1.63) desde el archivo local. Se capturó la zona de contenido (`main`) de cada pestaña y la ventana completa con cada modal o el cajón abierto.
- Implementación: Storybook compilado. La story `WhatsApp/Pagina` (archivo `WhatsAppPage.stories.tsx`) arma la página con el mismo marco que la ruta real (`WhatsAppPageFrame`, `WhatsAppPageHeader`, `WhatsAppTabsShell`) y los mismos `View` de cada pestaña, con datos de ejemplo solo de Storybook. Tiene una variante con datos y otra pendiente por pestaña.
- Mismo viewport en ambos: 1280 × 900, 375 × 812 y 320 × 720, en claro, y 375 en oscuro. El mockup en 1280 incluye su barra lateral (no se reproduce: se usa el shell de POWIP), por eso su contenido es más angosto.
- Evidencias: [`fidelidad/`](fidelidad/). Cada par se llama `<pantalla>--<viewport>--mockup.jpg` y `<pantalla>--<viewport>--implementacion.jpg`.

## Base visual nueva

| Pieza | Archivo | Qué hace |
|---|---|---|
| Tokens del mockup | `src/styles/whatsapp.css` (importado en `globals.css`) | Variables `--wa-*` claras y oscuras copiadas del mockup (superficies, bordes, violeta primario, teal, verde WhatsApp, ámbar, rojo, azul, ticks, chat) y utilidades Tailwind `bg-wa-*`, `text-wa-*`, `border-wa-*`, `shadow-wa`, `font-wa-mono`. Están en `:root` y `.dark` para que también lleguen a los modales (que se montan fuera de la página) |
| Clases del mockup | `src/components/whatsapp/ui/wa-classes.ts` | `waButton` (variantes default, primary, whatsapp, ghost, danger, solid-danger, facebook; tamaños md, sm, icon), campos, selects, switch verde 40 × 23, checkbox, segmentado, chips de filtro y de alcance, tablas y modales con las medidas del CSS del mockup |
| Componentes | `WaCard`/`WaCardHeader`, `WaPill`/`WaMini`/`WaDot`, `WaCallout`, `WaDialogClose`, `WaChipRadioGroup`, `WaInput`, `WhatsAppGlyph` | Tarjeta de 16 px de radio y 22 px de padding, encabezados h2 17 px / h3 15 px, pills y minis por tono, avisos violeta/ámbar/teal/rojo y uno punteado para «pendiente», cierre de modal, chips con radios nativos, campo sin el contenedor de ancho completo de `Input`, ícono de WhatsApp del mockup |
| Ticks | `MessageStatusTicks.tsx` | Usa los SVG del mockup (18 × 12, gris `#8696A0` y azul `#53BDEB`) en lugar de íconos genéricos |
| Marco de la página | `WhatsAppPageLayout.tsx` | Migas «Configuración › WhatsApp» (Configuración es un enlace y reemplaza al botón «Volver»), título 26/22 px, pill de estado a la derecha y pestañas segmentadas con ícono |

La lógica, los contratos, los textos que verifican los tests y la navegación no cambiaron. Los títulos del módulo usan Poppins (el resto de la app sigue usando Montserrat en títulos).

## Correcciones visuales por pantalla

| Pantalla | Antes | Ahora (como el mockup) |
|---|---|---|
| Cabecera y pestañas | Título centrado de `HeaderConfig`, botón Volver, pestañas teal a todo el ancho, título y descripción repetidos en cada pestaña | Migas, título a la izquierda, pill a la derecha, pestañas grises con la activa en blanco y sombra; sin título duplicado (la pestaña rotula el panel) |
| Conexión · Tipo | Tarjetas planas sin íconos, ventajas y limitaciones en dos columnas de texto | Tarjetas con ícono, pill de color (verde, azul, ámbar), ✓ verdes y ✕ rojas; la elegida en verde |
| Conexión · Número conectado | Lista de etiquetas y valores | Avatar de WhatsApp con insignia, nombre de 18 px, pill del estado del nombre, grilla 3 × 2 con bordes finos, barra de uso verde. Pendiente: misma grilla con «—» |
| Conexión · Prueba | Botón teal, estados como lista | Botón verde a todo el ancho y tres chips punteados que se encienden solo con fecha |
| Conexión · Tiendas, contingencia, costos | Filas genéricas, contingencia y bandeja en tarjetas separadas, costos con dos avisos | Insignias de color, pills de estado, botón verde «Conectar número»; contingencia y bandeja en una tarjeta de dos columnas con el switch «Contingencia activa» en la cabecera; tabla de tarifas y aviso violeta «Meta te cobra directo» |
| Plantillas | Lista con título suelto, filtros como botones, insignias de colores propios | Tarjeta con botón violeta, chips de filtro, tabla con encabezado gris en mayúsculas, nombre en monoespaciada, pills de categoría y estado, resultado A/B con mini teal |
| Editor de plantilla | Modal shadcn, campos genéricos, teléfono con colores fijos | Modal de 1080 px con cabecera y pie fijos, segmentados del mockup, contador arriba a la derecha, chips de variables teal, fila de botón con pill «Rastreo POWIP», teléfono con marco `#1F2329`, cabecera verde y fondo punteado |
| Programación | Reglas en tarjetas genéricas, alcance con campos apilados, días teal | Tarjetas con ícono del evento, switch verde, borde verde si está activa, «A qué pedidos» en filas de 110 px con chips teal, pie punteado; filas de datos faltantes con ícono y switch; días, cola con punto de color y envíos con caja de fecha violeta |
| Modales de Programación | Modales shadcn | Activar con aviso violeta y opciones verdes; Programar envío con secciones en mayúsculas y segmentado; Mensaje del aviso y Resultados con el mismo marco |
| Conversaciones | Barra con botones teal, columnas sin íconos, etiquetas de colores propios | Buscador con ícono, chips «Asignadas a mí» y «Respuesta automática», segmentado Tablero/Lista, columnas grises con ticks y contador, «Respondió» en rojo, tarjetas con cita del comprador, minis teal, ámbar y rojo, y avatar violeta |
| Cajón de conversación | Datos en lista, banners, composición en recuadros | Nombre de 16 px, teléfono y pedido, pill «Respondió», asesora a la derecha, línea de ventana con punto verde, hilo a todo el alto sobre fondo de chat, chips de respuesta rápida, cuadro con botón verde de enviar, «Ver pedido», «Dar de baja» y «Marcar atendida» |
| Historial | Indicadores en tarjetas planas, embudo con barras teal, leyenda en cajas, filtros como radios | Segmentado de periodo y «Exportar Excel», KPIs con ícono y porcentaje de color, embudo con barras de 26 px en gris, gris oscuro, azul y teal, ejemplo de botón de lista, leyenda con ticks, tarjeta con chips de estado y tabla con «Abrió HH:MM» en teal |
| Bajas, alertas y permisos | Una columna de secciones | Tarjeta de bajas con fila de bajas automáticas; Alertas de salud y Últimas alertas en dos columnas; Números extranjeros y Registro de cambios en dos columnas; Permisos con la matriz de casillas teal del mockup en todos los estados (antes, sin datos o en solo lectura, mostraba íconos) |

Problemas encontrados en la revisión y corregidos:

- **Desborde a 320 px.** Fila de tienda con texto apretado; «Ver a cuántos pedidos actuales aplica» sin partir; segmentado Tablero/Lista tapado por el buscador.
- **Campos en línea.** Quedaban en otra fila porque `Input` envuelve el campo en un `div` de ancho completo; se usa `WaInput` dentro del módulo.
- **Historial.** Filas altísimas por el motivo de bloqueo repetido en cada fila: ahora es un único motivo debajo de la tabla. También el detalle del estado que no se partía.
- **Foco.** Borde teal heredado de shadcn en lugar del contorno violeta del mockup.
- **Cajón.** El estado «No enviado» bajo la burbuja se cortaba.
- **Editor de plantilla a 320 px.** El pie (aviso de pendiente y tres botones apilados) ocupaba media pantalla y el botón principal se salía del modal: el aviso pasó al inicio del cuerpo y los botones usan dos columnas.

## Diferencias intencionales

| # | Diferencia | Motivo |
|---|---|---|
| V-01 | Sin la barra lateral, la barra superior móvil ni el interruptor «Modo oscuro» del mockup | Se usa el shell de POWIP (pedido explícito). El modo oscuro sigue la clase `.dark` de la app |
| V-02 | Sin el interruptor «Notas para devs» ni las notas técnicas | Son anotaciones del mockup para el equipo, no parte del producto |
| V-03 | La cabecera muestra «Integración pendiente» (pill neutro) en lugar de «Conectado · LIVII» | No se inventan estados: el estado real llega con C-01. La story con datos muestra el pill verde del mockup |
| V-04 | Pestañas sin contadores («Plantillas 10», «Conversaciones 3») | Solo se mostrarán con datos de C-12 y C-22.2 (`WhatsAppTabCount` está listo) |
| V-05 | Fila «Tienda» y pill de estado arriba de Conexión | Selector por pestaña (D-69). El mockup no lo tiene |
| V-06 | Textos de los tipos de conexión del PDF, sin «Habilita la confirmación por POWIP Link» | Esa línea es del Hito 2 (D-01) |
| V-07 | Número conectado agrega «mensajes del mes · datos leídos de Meta» y botones «Copiar» | Datos del PDF que el mockup no ubica; se agregan en una línea chica para no romper la grilla 3 × 2 |
| V-08 | La bandeja asistida suma «Ya lo envié», «Descartar» y el estado de cada aviso | D-72: abrir `wa.me` no confirma el envío |
| V-09 | «Fallan [5] envíos seguidos en [15] minutos» con campos editables | El PDF pide umbrales configurables |
| V-10 | Costos: la tabla solo aparece con tarifas que tengan fuente y vigencia; el uso del mes va dentro del aviso violeta | No se usan montos del documento como precios actuales |
| V-11 | Plantillas suma los filtros «Pausadas» y «Borradores» y el estado «Pausada» en rojo | Estados de Meta del PDF |
| V-12 | Vista previa del editor: «Vista previa · Datos de muestra» sin selector de pedido; el selector A/B va sobre el teléfono | La vista con un pedido real depende de backend; agrupar A/B con la vista previa evita perderlo al desplazarse |
| V-13 | Editor con aviso de estado en Meta arriba de los campos | Regla del PDF (revisión, rechazo, versión aprobada) |
| V-14 | Reglas: «Se dispara: …» con el texto que informe backend, en lugar de «Cuando el pedido pasa a CODIGO» | Los códigos de estado no están confirmados |
| V-15 | Reglas obligatorias con switch deshabilitado y la palabra «Obligatoria» para lectores de pantalla | Mismo aspecto que el mockup, con su significado explícito |
| V-16 | «Fechas» del alcance como segmentado en lugar de select | Opciones cortas y excluyentes, más claras en móvil |
| V-17 | Envíos recurrentes con «REPITE» e ícono en la caja de fecha | No hay frecuencia fija que mostrar como «Diario» |
| V-18 | «Asignadas a mí» con ícono de persona en lugar de iniciales | La vista no recibe el nombre del usuario actual |
| V-19 | Cajón: segmentado «Responder al comprador / Nota interna», contador de caracteres y avisos de bloqueo | Notas internas y límites del PDF |
| V-20 | Cajón: «Reasignar» deshabilitado con la asesora como avatar en lugar del select | El select aparece cuando exista C-22.5 y la lista de asesoras |
| V-21 | Cajón «No enviado»: los botones «Corregir en el pedido» y «Reintentar» van en el aviso rojo dentro del hilo y no en el pie | Mantiene juntos el motivo y sus acciones |
| V-22 | Historial: seis indicadores (agrega «Asistidos»), cinco tarjetas de leyenda, chip «Asistido» y selector de tienda | Envío asistido del PDF; la tienda filtra indicadores y tabla |
| V-23 | «Así se ve en las listas de pedidos» sin números de pedido ni horas | El indicador está en Ventas, Operaciones y Gestión CC; el ejemplo no inventa pedidos |
| V-24 | Bajas: buscador; Registro de cambios con filtros de tipo y usuario y «Ver antes y después»; Permisos agrega «Tus permisos en este módulo» | Reglas del PDF; se ubican sin cambiar la composición |
| V-25 | Sin las etiquetas «Del v4» | Marcas de versión del mockup |
| V-26 | Con datos faltantes, cada sección conserva su lugar y muestra un aviso punteado o «—» (tablero con columnas vacías, KPIs y embudo sin valores, grilla del número con «—», reglas del catálogo) | El pedido: no reemplazar pantallas por un aviso grande ni inventar valores |
| V-27 | Modales: el foco entra al primer control (contorno violeta visible) | Accesibilidad; el mockup no gestiona el foco |
| V-28 | Permisos: cuando la matriz no se puede editar (matriz propuesta del documento sin backend, o usuario sin permiso de configuración), las casillas se ven pero quedan deshabilitadas y algo atenuadas; la columna Administrador siempre lleva candado | El mockup solo deshabilita la columna Administrador; habilitar las demás haría creer que el cambio se guarda |

## Verificado y pendiente

| Pantalla | Mockup y app comparados | Estado |
|---|---|---|
| Conexión, Plantillas, Programación, Conversaciones, Historial, Bajas/alertas/permisos | 1280, 375, 320 y 375 oscuro | Verificado en Storybook |
| Editor de plantilla, Programar envío, Activar aviso, Conectar número, Respuesta automática | 1280, 375, 320 y 375 oscuro | Verificado en Storybook |
| Cajón (Respondió y No enviado) y lista de conversaciones | 1280, 375, 320 y 375 oscuro | Verificado en Storybook |
| Desconectar, Descartar cambios, Dar de baja, Agregar a bajas, Reactivar, Descartar aviso asistido, Desactivar regla, Resultados | Marco común revisado con el resto; no hay story que los abra | Pendiente de revisión manual en la app |
| Fila expandida del historial | El mockup se capturó expandido; en Storybook se revisó con teclado (expande con Enter) | Pendiente de captura |
| Ruta real `/configuracion/whatsapp` | Necesita login contra el backend | **No verificada en la app**: comprobar que el shell de POWIP (barra lateral) deja el ancho previsto y que el fondo de la página coincide |

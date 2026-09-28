# Panel de Control v5 — frontend y contratos pendientes

Para: backend (conexión de datos) y frontend (siguientes etapas).
Rama: `feat/nuevo-dashboard`. Ruta aislada: **`/panel-control`** (no reemplaza `/dashboard` ni aparece en el sidebar).
Fuentes: especificación `POWIP_Panel_Control_v5_Especificacion` (manda en reglas y fórmulas) y mockup `powip_panel_control_v5_1.html` (referencia visual). Auditoría del frontend actual: [auditoria-frontend-actual.md](auditoria-frontend-actual.md).

Este documento describe **solo el contrato que necesita el frontend**. La arquitectura interna del backend queda a su criterio.

---

## 1. Estado de la rama

| Pieza | Estado |
|---|---|
| Shell: barra de filtros, pestañas, subpestañas, línea de estado, chips, menú móvil | Listo |
| Filtros centralizados, periodo en hora Lima, rol, "Ver como", modo de datos, sincronía con URL | Listo |
| Componentes: KPI con meta y tooltip, tabla ordenable/buscable/exportable, gráficos, estados vacío/carga/error/pendiente, semáforo, drawer de detalle | Listo |
| Contratos tipados de las 6 pestañas, Configuración, Mis ventas, detalle, metas, exportación y acciones | Listo |
| Capa de datos con fuentes reales, demo y pendientes intercambiables | Lista |
| **Resumen (§6.1)**: 4 tarjetas, Qué hacer hoy, Ventas diarias, Ventas por canal, Clientes, Inventario, Flujo, drawer paginado | **Completo con fuente demo.** Esperando `GET /panel/resumen` y `GET /panel/detalle` (ver §4.1) |
| **Ventas y canales (§6.2)**: Canales (lista por familia, ficha, 6 KPI, bloque por tipo, comparativo de 3 vistas, tendencia), Productos, Publicidad, Clientes y zonas | **Completo con fuente demo.** Esperando `GET /panel/canales`, `/panel/canales/{id}`, `/panel/productos`, `/panel/publicidad`, `/panel/clientes` (ver §4.2) |
| **Call center (§6.3)**: 6 KPI, «Mi día» de la Confirmadora, cola por antigüedad, motivos de anulación, duplicados y lista negra, mapa de calor, ranking | **Completo con fuente demo.** Esperando `GET /panel/callcenter` (ver §4.3). Los hooks actuales de `/atencion-al-cliente/kpis/*` no coinciden con la especificación (ver §4.3) |
| **Operaciones (§6.4)**: Cola y tiempos, Couriers, Inventario | **Completo con fuente demo.** Esperando `GET /panel/operaciones?sub=cola\|couriers\|inventario` y `POST /panel/acciones` (ver §4.4) |
| **Finanzas (§6.5)**: Resultado, Caja, Cobranza | **Completo con fuente demo** (solo Dueño). Esperando `GET /panel/finanzas?reloj=pedido\|caja\|cobranza` (ver §4.5) |
| **Equipo (§6.6)**: Vendedoras y caja (plegable, Zona ↔ Asesora, con/sin upsell), Confirmadoras | **Completo con fuente demo.** Esperando `GET /panel/equipo?tipo=…` (ver §4.6) |
| **Mis ventas (§6.7)**: vista de la Vendedora | **Completo con fuente demo.** Esperando `GET /panel/mis-ventas` (ver §4.7) |
| **Configuración (§6.8)**: Canales, Metas (editable), Estados y reglas, Cuadres y calidad, Para desarrollo | **Completo con fuente demo.** Esperando `/config/metas`, `/panel/config/estados`, `/panel/config/cuadres` y los `PUT` de fichas y metas (ver §4.8) |
| **Excel completo (§7.2)** y **Compartir reporte (§7.3)** | **Completos con fuente demo** (el libro demo se arma en el navegador). Esperando `GET /panel/export.xlsx` y `GET /panel/compartir` (ver §4.9) |
| Pantallas pendientes | **Ninguna.** Todo el panel funciona con fuentes demo; lo que falta es backend (§4) y las decisiones de §6 |

## 2. Qué es real y qué es demo

La interfaz marca cada vista o cifra con un badge: **Demo** (ámbar), **Pendiente** (gris) o, donde aporta, **Real** (verde). El selector «Datos» de la barra permite ver **solo datos reales**; en ese modo las vistas demo muestran «Pendiente de integración».

| Contrato | Fuente en la rama | Dónde se ve |
|---|---|---|
| `canales-fichas` | **Real** parcial: `GET /config/canales?empresaId=` | Filtro Canal, Configuración → Canales |
| `opciones-asesores` | **Real**: `GET /atencion-al-cliente/agentes/vendedores?companyId=` | Filtro Asesor(a), previsualización de roles |
| Tiendas | **Real**: `auth.company.stores` | Filtro Tienda |
| `estado-periodo` | **Demo** | Línea de estado ("% del periodo aún abierto", cuadres) |
| `resumen` | **Demo** | Pestaña Resumen, todos sus bloques |
| `detalle` | **Demo** | Drawer de detalle (paginación, búsqueda, por producto, por estado, Excel) |
| `config-metas` | **Demo**: metas por defecto de la especificación §11 y metas mensuales de ejemplo | Semáforos, Configuración → Metas |
| `canales-comparativo`, `canales-detalle` | **Demo** | Ventas y canales → Canales |
| `productos` | **Demo** | Ventas y canales → Productos |
| `publicidad` | **Demo** | Ventas y canales → Publicidad |
| `clientes-zonas` | **Demo** | Ventas y canales → Clientes y zonas |
| `callcenter` | **Demo** | Call center |
| `operaciones-cola`, `operaciones-couriers`, `operaciones-inventario` | **Demo** | Operaciones |
| `acciones-pedido` | **Pendiente** | Botones Preparar, Asignar guía, Coordinar recojo, Reclamar al courier, Llamar, Pedir liquidación, Completar motivo (avisan y no cambian nada) |
| `finanzas-resultado`, `finanzas-caja`, `finanzas-cobranza` | **Demo** (gastos fijos de ejemplo: S/ 9,000 al mes por tienda) | Finanzas |
| `equipo-vendedoras`, `equipo-confirmadoras` | **Demo** (metas y comisiones de ejemplo) | Equipo |
| `mis-ventas` | **Demo** | Mis ventas (Vendedora) |
| `config-estados`, `config-cuadres` | **Demo** | Configuración → Estados y reglas, Cuadres y calidad; línea de estado (cuadres y % de datos completos) |
| `exportacion-libro` | **Demo**: el libro de 9 hojas se arma en el navegador con las mismas fuentes demo | Botón «Excel» de la barra y del diálogo Compartir |
| `compartir-reporte` | **Demo** | Botón «Compartir» de la barra |
| `canales-fichas-guardar` | **Pendiente** | Botón «Editar ficha» (avisa y no guarda) |
| `config-metas-guardar` | **Pendiente** | Botón «Guardar» de Configuración → Metas (valida y avisa, no guarda) |

**Regla de no mezcla:** cada contrato se resuelve con **una sola fuente**. Ningún total combina cifras de dos contratos, así que nunca se suma una cifra demo con una real. Si un contrato real tiene campos que el backend todavía no da (por ejemplo, la ficha de canal), esos campos llegan como `null` y se muestran como «Pendiente»; nunca se rellenan con demo.

**Un solo universo demo:** todas las fuentes demo leen el mismo conjunto determinista de pedidos (`shared/data/demo/demo-universe.ts`: 400 días, ítems con precio neto y cantidad, sesiones Live y pauta registrada). Por eso Resumen, las cuatro subpestañas de Ventas y canales y el drawer cuadran entre sí con cualquier filtro. Si el catálogo real de canales está disponible, el demo usa esos nombres y les asigna una familia demo (por el nombre cuando es reconocible; si no, por rotación). La vista lo avisa con la nota «Cifras demo» y con el badge Demo en cada bloque.

**Permisos en demo:** las fuentes demo reciben el rol y **omiten** los campos de costo, margen, ganancia y comisión a los roles sin permiso, igual que deberá hacerlo el backend.

## 3. Contrato común

### 3.1 Parámetros (todos los `GET /panel/*`)

| Parámetro | Tipo | Nota |
|---|---|---|
| `desde`, `hasta` | `YYYY-MM-DD` | Días calendario en hora Lima; corte 00:00 America/Lima (UTC−5) |
| `anterior_desde`, `anterior_hasta` | `YYYY-MM-DD` | Rango de comparación (§5.2), calculado por el frontend |
| `zona_horaria` | `America/Lima` | Fijo |
| `tienda` | id | Omitido = todas las tiendas de la empresa del JWT |
| `canal` | id de ficha | Canal de **origen** |
| `entrada` | `lead` · `directa` · `presencial` | Según ficha |
| `cobro` | `cod` · `pre` · `inm` · `mkp` | Según ficha |
| `zona` | `lima` · `provincia` | `salesRegion` del pedido |
| `turno` | `express` · `general` | Pendiente: el pedido no guarda el turno |
| `asesor` | id de usuario o `sin_asesor` | Ver §5 |
| `ver_como` | `dueno` · `supervisora` · `confirmadora` · `vendedora` | Solo lo manda un Dueño previsualizando. El backend **nunca** debe otorgar más de lo que permite el JWT |

Periodos (§5.2): Hoy/Ayer → mismo día de la semana anterior; Últimos 7 días → 7 días previos; Mes actual → mismo tramo del mes anterior (recortado al fin de ese mes); Mes anterior → mes previo completo; Personalizado → rango previo de igual duración.

### 3.2 Respuesta

```ts
interface PanelEnvelope<T> {
  actual: T;
  anterior_misma_antiguedad: T | null;
  metas: MetasPanel | null;
  generado_en: string;
}
```

`anterior_misma_antiguedad` es el periodo anterior **fotografiado a la fecha actual − desfase** (`desfase = anterior_desde − desde`), no terminado. Requiere historial de estados por pedido.

Montos como número plano en PEN; porcentajes como fracción (`0.65`); valores imposibles o sin dato como `null` (el front muestra «—»).

### 3.3 Permisos (deben aplicarse en el backend)

| Rol | Pestañas | Restricción de datos |
|---|---|---|
| Dueño | Todas + Configuración | Ninguna |
| Supervisora | Resumen, Ventas y canales, Call center, Operaciones, Equipo | Sin costos, márgenes, ganancia, comisiones ni Finanzas |
| Confirmadora | Call center | `asesor` = usuario del JWT (ver «Identidad» abajo); sin costos; sin Excel completo |
| Vendedora | Mis ventas | `asesor` = usuario del JWT; sin costos; sin Excel completo |

Los campos restringidos deben **omitirse** en la respuesta (no enviarse en `null` ni en 0) y los endpoints solo del Dueño deben responder 403. Ocultarlos en pantalla no es seguridad.

> **La autorización se implementa en cada endpoint. El frontend no aporta seguridad de API.** Cada endpoint real de §4 debe validar el JWT, el rol, la empresa y la identidad, responder HTTP 403 cuando corresponda y omitir los campos restringidos. Nada de lo que hace el navegador cuenta como control de acceso.
>
> Lo que hace hoy el frontend es solo **experiencia de usuario y especificación ejecutable**: `usePanelContract` no pide un contrato que el rol no puede usar, y el registro de fuentes (`panel-sources.ts`) envuelve cada fuente con `conAutorizacion` (`shared/data/panel-autorizacion.ts`), que corta la llamada con un error local `PanelAccesoDenegadoError` (su mensaje empieza con «403:» para imitar la respuesta esperada). No es una respuesta HTTP ni protege datos: el código corre en el navegador del usuario y se evita con la consola o con una petición directa a la API. Las fuentes demo aplican las mismas reglas para que las pruebas describan cómo debe comportarse el backend.

**Resolución del rol** (`src/features/panel-control/shared/utils/resolve-panel-role.ts`):

| Evidencia | Rol del panel |
|---|---|
| Email en `SUPERADMIN_EMAILS` o rol en `ADMIN_ROLES` (ADMIN, OWNER, SUPERADMIN, ADMINISTRADOR) | Dueño |
| Rol `AGENTES` ("Personal de agentes", bucket CALLCENTER) | Confirmadora |
| Rol `VENTAS` ("Personal de ventas") | Vendedora |
| `CALLER`, `OPERACIONES`, `COURIER`, otros | **Sin resolver**: el panel muestra un aviso y no entrega datos |

**Identidad de la Confirmadora y la Vendedora (contrato):** el backend toma la identidad **del JWT** y la impone en `/panel/callcenter`, `/panel/detalle`, `/panel/estado` y cualquier otro endpoint que reciba `asesor`:

- ignora el `asesor` de la consulta y usa el usuario del token;
- si `grupo_params.asesor` pide a otra persona, responde **403**;
- sin identidad resoluble, responde **403**;
- «Ver como» solo lo puede usar un Dueño; si un Dueño previsualiza a una Confirmadora, manda `ver_como=confirmadora` y el `asesor` elegido, y el backend lo acepta porque el usuario real es Dueño. Nunca debe otorgar más de lo que permite el JWT;
- los agregados de equipo de «Mi día» (confirmación y upsell del equipo, puesto) se calculan en el servidor; la Confirmadora no recibe filas de otras personas ni sus metas.

En el frontend, `derivePanelView` fija el filtro Asesor(a) en el usuario de la sesión (la URL, el filtro manual y «Ver como» no lo cambian para una Confirmadora real) y las fuentes reciben `asesorAutorizado` (`shared/data/panel-identidad.ts`). Las fuentes demo aplican la misma regla (`consultaConIdentidad`, `parametrosConIdentidad`) para probarla. **Identidades demo:** el catálogo de asesoras puede traer `rol` (`confirmadora` o `vendedora`); si lo trae, el demo asigna los leads solo a confirmadoras y las ventas directas solo a vendedoras. La fuente real de `opciones-asesores` todavía no informa el rol, así que en real se usa todo el padrón. Una Confirmadora no puede listar a sus compañeras: en ese caso el demo agrega dos «Compañera demo» para que el equipo exista; en real ese cálculo es del backend.

**Contrato pendiente:** Supervisora no tiene rol en el JWT (`ccRol = supervisor` solo existe en la lista de agentes). Se propone que el JWT incluya en `permissions` uno de `PANEL_ROL_DUENO`, `PANEL_ROL_SUPERVISORA`, `PANEL_ROL_CONFIRMADORA`, `PANEL_ROL_VENDEDORA`; si viene, tiene prioridad sobre el nombre de rol.

## 4. Contratos pendientes

El catálogo ejecutable está en `src/features/panel-control/**/**.contract(s).ts` y se ve en la app en **Configuración → Para desarrollo**. Tipos de respuesta en `src/features/panel-control/*/models/`.

| Contrato | Endpoint | Respuesta | Roles | Campos restringidos |
|---|---|---|---|---|
| Línea de estado | `GET /panel/estado` | `PanelEnvelope<EstadoPeriodo>` | Todos | `calidad` (Dueño) |
| Resumen | `GET /panel/resumen` | `PanelEnvelope<ResumenPanel>` | Dueño, Supervisora | `gane`, `ventasPorCanal[].retornoPublicidad`, `flujo.rechazados.flete` |
| Fichas de canal | `GET /config/canales?empresaId=` (existe, parcial) | `CanalFicha[]` | Todos | — |
| Guardar ficha | `PUT /config/canales/{id}`, `POST /config/canales` | `CanalFicha` | Dueño | — |
| Comparativo de canales | `GET /panel/canales?vista=ventas\|entregas\|ganancia` | `PanelEnvelope<CanalesComparativo>` | Dueño, Supervisora | `vista=ganancia` (403 a no Dueño); `filas[].flete` y `total.flete` en `vista=entregas` |
| Detalle de canal | `GET /panel/canales/{id}` | `PanelEnvelope<CanalDetalle>` | Dueño, Supervisora | `costos`; `ficha.comisionPct`/`pasarelaPct` (omitidos; `null` significa «no configurado», no «restringido»); `bloque.comisionADescontar`, `netoARecibir`, `pasarela` |
| Productos | `GET /panel/productos` | `PanelEnvelope<ProductosPanel>` | Dueño, Supervisora | `costoUnitario`, `margen` |
| Publicidad | `GET /panel/publicidad` | `PanelEnvelope<PublicidadPanel>` | Dueño, Supervisora | `kpis.comisionesPlataformas`, `porCanal[].comision`, `porCanal[].ganancia` |
| Clientes y zonas | `GET /panel/clientes` | `PanelEnvelope<ClientesZonasPanel>` | Dueño, Supervisora | — |
| Call center | `GET /panel/callcenter` | `PanelEnvelope<CallCenterPanel>` | Dueño, Supervisora, Confirmadora | Con Confirmadora: todo filtrado a su identidad; `miDia` solo para ella; `ranking` solo su fila; `metas.mensuales.porConfirmadora` solo la suya |
| Cola y tiempos | `GET /panel/operaciones?sub=cola` | `PanelEnvelope<ColaPanel>` | Dueño, Supervisora | — |
| Couriers | `GET /panel/operaciones?sub=couriers` | `PanelEnvelope<CouriersPanel>` | Dueño, Supervisora | `kpis.fleteTotal`, `kpis.fletePromedio`, `couriers[].fleteTotal`, `fletePromedio`, `costoRechazos`, `departamentos[].fletePromedio` (el flete es costo) |
| Inventario | `GET /panel/operaciones?sub=inventario` | `PanelEnvelope<InventarioPanel>` | Dueño, Supervisora | `valorAlCosto`, `costoUnitario`, `valor` |
| Resultado | `GET /panel/finanzas?reloj=pedido` | `PanelEnvelope<ResultadoPanel>` | Dueño | Todo |
| Caja | `GET /panel/finanzas?reloj=caja` | `PanelEnvelope<CajaPanel>` | Dueño | Todo |
| Cobranza | `GET /panel/finanzas?reloj=cobranza` | `PanelEnvelope<CobranzaPanel>` | Dueño | Todo |
| Vendedoras y caja | `GET /panel/equipo?tipo=vendedoras&agrupar=zona\|asesor&upsell=con\|sin` | `PanelEnvelope<EquipoVendedorasPanel>` | Dueño, Supervisora | `comisionEstimada` |
| Confirmadoras | `GET /panel/equipo?tipo=confirmadoras` | `PanelEnvelope<EquipoConfirmadorasPanel>` | Dueño, Supervisora | `comisionEstimada`, `reglaComision` |
| Mis ventas | `GET /panel/mis-ventas` (no está en §13.2) | `PanelEnvelope<MisVentasPanel>` | Vendedora, Dueño (previsualización) | Identidad del JWT impuesta; `ranking[]` de otras vendedoras sin nombre ni id; `comisionEstimada` omitida hasta decidir §6.7 vs §14 |
| Metas | `GET /config/metas?empresaId=` / `PUT /config/metas` | `ConfigMetas` | Todos / Dueño | Confirmadora y Vendedora: `mensuales.porVendedora` y `porConfirmadora` solo con su propia fila |
| Conteo por estado | `GET /panel/config/estados` | `ConfigEstados` | Dueño | — |
| Cuadres y calidad | `GET /panel/config/cuadres` | `ConfigCuadres` | Dueño | — |
| Detalle (drawer) | `GET /panel/detalle?grupo=&grupo_params=&pagina=&tamano_pagina=` | `DetalleResponse` | Todos | `porProducto[].margen` |
| Acciones | `POST /panel/acciones` | `AccionPedidoResponse` | Según acción | — |
| Excel completo | `GET /panel/export.xlsx` | xlsx (9 hojas, §7.2) | Dueño, Supervisora (Confirmadora y Vendedora: 403) | Columnas de costo solo Dueño |
| Compartir | `GET /panel/compartir` | `CompartirReporteResponse` | Dueño, Supervisora | `producto`, `productoIncompleto`, `envios`, `gananciaSobreVentaTotal`, `gananciaSobreEntregado` (omitidos, no `null`) |

### 4.0 Matriz de integración

Generada desde los descriptores (`PANEL_CONTRACTS`) y el registro de fuentes (`DEFAULT_PANEL_SOURCES`). «Filtros §3.1» = los 13 parámetros comunes. Consumidor = el único punto del frontend que llama al contrato: al cambiar la fuente, esos componentes no cambian.

| Contrato | Endpoint | Consumidor frontend | Campos obligatorios | Filtros | Reloj | Roles · capacidad | Fuente hoy |
|---|---|---|---|---|---|---|---|
| `estado-periodo` | `GET /panel/estado` | `PeriodStatusLine` | `porcentajeAbierto`, cuadres; `calidad` solo Dueño | §3.1 | ingreso | Todos | demo |
| `resumen` | `GET /panel/resumen` | `ResumenView` (4 tarjetas, Qué hacer hoy, gráficos, Flujo) | §4.1 | §3.1 | ingreso; tareas e inventario: estado actual | Dueño, Supervisora | demo |
| `detalle` | `GET /panel/detalle` | `DetailDrawer` (+ Excel del detalle) | `resumen`, `porProducto`, `porEstado`, `pedidos{filas,total,pagina,tamanoPagina}`; con caja: `movimientoCaja`, `movimientoFecha`, `movimientoMonto` | §3.1 + `grupo`, `grupo_params`, `pagina`, `tamano_pagina`, `buscar` | según el grupo (tabla §4.1) | Todos; identidad impuesta | demo |
| `canales-fichas` | `GET /config/canales` | catálogo del panel (filtro Canal), `ConfigCanalesView` | `id`, `nombre`, `activo`; el resto admite `null` + `camposPendientes` | `empresaId` | — | Todos | **real** parcial |
| `canales-comparativo` | `GET /panel/canales?vista=` | `ComparativoCanales` | §4.2 | §3.1 + `vista` | ingreso | Dueño, Supervisora (`ganancia`: Dueño) | demo |
| `canales-detalle` | `GET /panel/canales/{id}` | `CanalSeleccionado` | §4.2 | §3.1 | ingreso; por liquidar: estado actual | Dueño, Supervisora | demo |
| `productos` | `GET /panel/productos` | `ProductosSubtab` | §4.2 | §3.1 | ingreso | Dueño, Supervisora | demo |
| `publicidad` | `GET /panel/publicidad` | `PublicidadSubtab` | §4.2 | §3.1 | fecha de la pauta / ingreso | Dueño, Supervisora | demo |
| `clientes-zonas` | `GET /panel/clientes` | `ClientesZonasSubtab` | §4.2 | §3.1 | ingreso; historial: todo | Dueño, Supervisora | demo |
| `callcenter` | `GET /panel/callcenter` | `CallCenterView` | §4.3 | §3.1 | ingreso; cola: estado actual | Dueño, Supervisora, Confirmadora (identidad) | demo |
| `operaciones-cola` / `-couriers` / `-inventario` | `GET /panel/operaciones?sub=` | `ColaSubtab`, `CouriersSubtab`, `InventarioSubtab` | §4.4 | §3.1 | cola e inventario: estado actual; couriers: ingreso | Dueño, Supervisora | demo |
| `finanzas-resultado` | `GET /panel/finanzas?reloj=pedido` | `ResultadoSubtab` | §4.5 | §3.1 | **fecha del pedido** | Dueño · `ver_finanzas` | demo |
| `finanzas-caja` | `GET /panel/finanzas?reloj=caja` | `CajaSubtab` | §4.5 | §3.1 | **fecha del dinero** | Dueño · `ver_finanzas` | demo |
| `finanzas-cobranza` | `GET /panel/finanzas?reloj=cobranza` | `CobranzaSubtab` | §4.5 | §3.1 | **estado actual** | Dueño · `ver_finanzas` | demo |
| `equipo-vendedoras` / `-confirmadoras` | `GET /panel/equipo?tipo=` | `VendedorasSubtab`, `ConfirmadorasSubtab` | §4.6 | §3.1 + `agrupar`, `upsell` | ingreso | Dueño, Supervisora | demo |
| `mis-ventas` | `GET /panel/mis-ventas` | `MisVentasView` | §4.7 | §3.1 | ingreso; no cobrados: estado actual | Vendedora (identidad), Dueño | demo |
| `config-metas` | `GET /config/metas` | semáforos de todas las vistas, `ConfigMetasView` | `indicadores`, `mensuales` | `empresaId` | — | Todos (filas propias para Confirmadora/Vendedora) | demo |
| `config-estados` / `config-cuadres` | `GET /panel/config/…` | `ConfigEstadosView`, `ConfigCuadresView`, línea de estado | §4.8 | §3.1 | ingreso | Dueño · `ver_configuracion` | demo |
| `exportacion-libro` | `GET /panel/export.xlsx` | `useExcelCompleto` (barra y Compartir) | 9 hojas §4.9 | §3.1 | como cada hoja | Dueño, Supervisora · `exportar_libro` | demo |
| `compartir-reporte` | `GET /panel/compartir` | `CompartirReporteDialog` | §4.9 | §3.1 | ingreso | Dueño, Supervisora | demo |
| `opciones-asesores` | `GET /atencion-al-cliente/agentes/vendedores` | catálogo del panel (filtro Asesor(a), Ver como) | `id`, `nombre`; `rol` opcional | `companyId` | — | Dueño, Supervisora · `elegir_asesor` | **real** |
| `acciones-pedido` | `POST /panel/acciones` | `CobranzaSubtab`, `ColaSubtab`, `DetailDrawer`, Qué hacer hoy | `accion`, `pedidoIds` | — | — | Según acción | pendiente (avisa) |
| `canales-fichas-guardar` / `config-metas-guardar` | `PUT /config/…` | `ConfigCanalesView`, `ConfigMetasView` | modelo `*Guardar` | — | — | Dueño · `editar_configuracion` | pendiente (avisa) |

**Qué bloquea cifras reales y qué solo falta implementar.**

*Decisiones del negocio (el backend no puede resolverlas solo; detalle y bloqueo en §6):* rol Supervisora en el JWT (**la única que bloquea una conexión**); comisión estimada en Mis ventas (§6.7 vs §14); cuál de las dos ganancias va en Compartir; reglas de comisión y gastos fijos configurables; turno del pedido; plazos de liquidación por courier; el cuadre 9 con filtro de canal o entrada (contradicción de §12); nombres en el ranking de Mis ventas; la Supervisora en Publicidad.

*Datos que faltan en el modelo actual (§5):* RECHAZADO separado de ANULADO con motivo; estado de cobro separado del operativo; historial de estados; costo por ítem que admita «sin costo»; canal de origen apuntando a la ficha; reserva de stock; primer intento de entrega; fechas de liquidación y de adelanto.

*Solo falta implementar (el contrato está definido):* todos los `GET /panel/*` de la matriz, `GET/PUT /config/metas`, `PUT /config/canales`, los campos pendientes de la ficha de canal y `POST /panel/acciones`.

**Excel de tablas:** cada tabla se exporta en el navegador con título, periodo, filtros, fecha y origen en la cabecera; si los datos son demo, la cabecera lo dice y el archivo termina en `_DEMO.xlsx`. El Excel del detalle recorre todas las páginas de `GET /panel/detalle` (ver §4.1). El Excel completo lo arma hoy la fuente demo en el navegador con el mismo formato que deberá devolver `GET /panel/export.xlsx` (ver §4.9).

### 4.1 Resumen: campos exactos por bloque

Estado de conexión: **ningún bloque tiene fuente real todavía**. Todos se ven con la fuente demo (`resumen.demo.ts`, `detalle.demo.ts`) y, en modo «solo reales», cada bloque muestra «Pendiente de integración». Tipos en `src/features/panel-control/resumen/models/resumen.model.ts` y `detalle/models/detalle.model.ts`.

`GET /panel/resumen` recibe los parámetros de §3.1 y responde `PanelEnvelope<ResumenPanel>`. `anterior_misma_antiguedad` trae el mismo objeto calculado sobre `anterior_desde..anterior_hasta` y fotografiado en `ahora − (desde − anterior_desde)`. Si el backend no puede calcularlo, debe enviar `null`: el frontend oculta la línea de comparación y las variaciones ▲▼, y explica por qué. Montos en PEN como número y fracciones como `0.65`. Un valor desconocido va como `null`, nunca como `0`.

| Bloque | Campo | Definición que debe cumplir el backend | Fecha | Rol |
|---|---|---|---|---|
| Vendí | `vendi.facturacion` | Σ neto (precio − descuentos − cupones) de pedidos que son **venta** | ingreso | Todos |
| | `vendi.ventas` | N° de ventas (lead confirmado, venta directa registrada o POS cobrada; **nunca** PENDIENTE ni ANULADO; RECHAZADO sí cuenta) | ingreso | Todos |
| | `vendi.ticket` | facturación ÷ ventas, `null` si no hay ventas | ingreso | Todos |
| | `vendi.leads` | Pedidos de canales con entrada lead | ingreso | Todos |
| | `vendi.confirmacion` | confirmados ÷ (confirmados + anulados); los abiertos no cuentan | ingreso | Todos |
| Gané | `gane.ganancia` | entregado − costo de producto − publicidad − flete − comisiones | ingreso | **Solo Dueño**; omitir el objeto para los demás |
| | `gane.entregado`, `margen`, `publicidad`, `costoProducto`, `flete`, `comisiones` | Componentes de la fórmula anterior; publicidad = directa + general prorrateada | ingreso | Solo Dueño |
| | `gane.entregasSinCosto` | Entregas con algún producto sin costo. Si es > 0, el frontend muestra «Gané (parcial)» con «≤ S/ …», sin variación ▲▼, y aclara que la cifra es un tope y no la ganancia final | ingreso | Solo Dueño |
| Entregado | `entregado.entregado`, `entregas`, `efectividadEntrega` | Σ neto y N° con **estado operativo** entregado; efectividad = entregados ÷ (entregados + rechazados) | ingreso | Supervisora (y Dueño en el flujo) |
| Me deben | `meDeben.porLiquidar` | Σ neto entregado cuyo cobro aún no se recibe | ingreso | Todos |
| | `meDeben.enCursoPorCobrar` | Σ neto de ventas en curso **no cobradas** (un prepago en curso ya está cobrado y no entra) | ingreso | Todos |
| | `meDeben.vencido` | Parte de por liquidar con hoy > entrega + plazo del courier; `null` si no hay plazos | ingreso | Todos |
| Por hacer hoy | `acciones[]` | `{ clave, id, urgencia, pedidos, monto, courier, plazoDias, productos[], accion, pestana, grupo }`. `id` ∈ `leads_sin_llamar`, `ventas_sin_guia`, `courier_no_liquida` (una entrada por courier, top 2 por monto), `productos_agotados`, `envios_retrasados`, `anulaciones_sin_motivo`. Solo tareas con `pedidos > 0` | **Estado actual** (ignora `desde/hasta`, respeta tienda, canal y demás filtros), salvo `anulaciones_sin_motivo`, que usa el periodo | Según pestaña destino |
| Ventas diarias | `ventasDiarias[]` | `{ dia, facturacion, ventas, diaAnterior, facturacionAnterior }`, un elemento por día de `desde..hasta` (incluye días en cero). `diaAnterior` = `anterior_desde + i`, `null` si pasa de `anterior_hasta` | ingreso, corte 00:00 Lima | Todos |
| Ventas por canal | `ventasPorCanal[]` | `{ canalId, canalNombre, color, facturacion, ventas, retornoPublicidad? }` por **canal de origen**. `canalId: null` = «Sin canal» (atribución sin resolver), debe venir para que Σ = Vendí. `retornoPublicidad` solo para el Dueño | ingreso | Todos |
| Clientes | `clientes.nuevos` | Clientes cuya **primera compra histórica** cae en el periodo | ingreso | Todos |
| | `clientes.conCompra`, `recompra`, `listaNegra` | Clientes distintos con venta; clientes con 2+ compras históricas ÷ conCompra; N° de ventas a clientes con un RECHAZADO anterior. Cada uno puede ir `null` si no se puede calcular | ingreso | Todos |
| Inventario | `inventario.alertas[]` | `{ productoId, nombre, estado, disponible, coberturaDias, ventasEsperando }` solo con `estado` `agotado` (disponible ≤ 0) o `critico` (cobertura < `umbralCriticoDias` = 7). disponible = stock − reservado (LLAMADO + PREPARADO + CON_GUIA: se reserva en LLAMADO y se descuenta al pasar a EN_ENVIO, §2.5); stock < 0 es `error_datos` y no aparece como agotado; cobertura = disponible ÷ venta diaria de 30 días, `null` sin ventas | **Estado actual**; stock por tienda; `ventasEsperando` respeta los demás filtros | Todos |
| Flujo | `flujo.leads`, `leadsAbiertos`, `leadsAnulados`, `directasYPos`, `ventas`, `facturacion`, `confirmados`, `confirmacion` | Conteos por entrada y resultado del lead | ingreso | Todos |
| | `flujo.enCurso{pedidos, monto, porDespachar, enEnvio}`, `entregados{pedidos, monto, efectividad}`, `rechazados{pedidos, perdido, flete}` | Por **estado operativo**. `rechazados.flete` solo para el Dueño (omitido para los demás) | ingreso | Todos |
| | `flujo.cobro{cobradoTotal, cobradoEntregado, cobradoSinEntregar, porLiquidar, vencido}` | Por **estado de cobro**, separado del operativo. `cobradoSinEntregar` = prepagos cobrados aún no entregados | ingreso | Todos |

**Cuadres que el frontend verifica y muestra** (`resumen/utils/cuadres-resumen.ts`): Σ canales = Vendí; Σ días = Vendí; ventas = entregados + en curso + rechazados (monto y N°); ventas = cobrado + por liquidar + en curso por cobrar + perdido.

**`GET /panel/detalle`** (drawer). Parámetros: los de §3.1 más `grupo`, `grupo_params` (JSON), `pagina`, `tamano_pagina` y `buscar` opcional (pedido, cliente, canal, asesor, departamento en **todo** el grupo). Respuesta `DetalleResponse`: `resumen` y `porProducto`/`porEstado` sobre el **grupo completo**, y `pedidos.{filas,total,pagina,tamanoPagina}` sobre las coincidencias de la búsqueda. El frontend pagina de a 100, muestra «Mostrando X–Y de N» y el Excel pide páginas de 500 hasta completar `total`. `porProducto[].margen` solo para el Dueño (`null` si falta costo). Con `grupo=movimientos_caja` la respuesta agrega `resumen.movimientoCaja` (Σ de los movimientos del grupo dentro del periodo, lo mismo que cuenta Caja) y en cada fila `movimientoFecha` (fecha y hora Lima del dinero) y `movimientoMonto`; las filas van ordenadas por fecha del dinero. El drawer muestra las columnas «Fecha del dinero» y «Movido en caja», y el Excel del detalle las incluye.

| `grupo` | `grupo_params` | Pedidos que debe devolver | Alcance |
|---|---|---|---|
| `ventas` | — | Ventas | periodo |
| `ventas_dia` | `{dia}` | Ventas con ingreso ese día | periodo |
| `ventas_canal` | `{canal}` (`sin_canal` = sin atribución) | Ventas de ese canal de origen | periodo |
| `leads`, `leads_abiertos`, `leads_anulados` | — | Leads; leads aún sin cerrar (PENDIENTE); leads ANULADO | periodo |
| `directas_pos` | — | Pedidos que no entraron como lead | periodo |
| `en_curso`, `entregados`, `rechazados` | — | Por estado operativo | periodo |
| `cobrado`, `cobrado_sin_entregar`, `por_liquidar`, `no_cobrado` | — | Por estado de cobro (`no_cobrado` = por liquidar + en curso no cobrado) | periodo |
| `clientes_nuevos`, `lista_negra` | — | Ventas de clientes nuevos; ventas a clientes con rechazo previo | periodo |
| `anulaciones_sin_motivo` | — | ANULADO sin motivo | periodo |
| `accion` | `{accion, courier?}` | Pedidos que cumplen la regla §8 de esa tarea | estado actual |
| `espera_producto` | `{producto}` | Ventas LLAMADO/PREPARADO con ese producto | estado actual |
| `contactados` | `{canal?}` | Leads ya trabajados (con primer intento ≤ ahora) y con contacto logrado. Es el numerador de «Contactados» | periodo |
| `con_upsell` | — | Ventas con al menos un ítem marcado como upsell | periodo |
| `anulados_rechazados` | — | ANULADO + RECHAZADO (la misma definición que «Anulados y rechazados» en Productos) | periodo |
| `perdidas` | `{canal, tipo: anulado o rechazado, motivo}` | Pedidos perdidos por ese motivo («Sin motivo» incluido) | periodo |
| `reembolsados` | `{canal}` | Prepagos cobrados y luego anulados o rechazados | periodo |
| `recurrentes` | — | Ventas de clientes que ya habían comprado antes de `desde` | periodo |
| `historial_cliente` | `{cliente}` | **Todas** las ventas del cliente, sin filtro de fechas | historial |
| `leads_confirmados` | — | Leads que ya son venta (LLAMADO o más) | periodo |
| `primera_llamada_tardia` | `{minutos?}` (por defecto la meta, 30) | Leads cuya primera llamada tardó más de `minutos` | periodo |
| `duplicados` | — | Leads marcados como duplicado (mismo teléfono y producto en < 24 h) | periodo |
| `leads_lista_negra` | — | Leads (no solo ventas) de clientes con un RECHAZADO anterior | periodo |
| `cola_leads` | `{antiguedad?: menos_1h, 1_6h, 6_24h, mas_24h}` | Leads en PENDIENTE ahora, por horas desde el ingreso | estado actual |
| `cola_operativa` | `{estado?, antiguedad?: menos_24h, 1_2d, 3_5d, mas_5d}` | Ventas con courier en LLAMADO, PREPARADO, CON_GUIA o EN_ENVIO ahora, por tiempo **en su estado actual** | estado actual |
| `etapa_lenta` | `{etapa}` | Entregas con courier del periodo cuya etapa superó su meta en horas | periodo |
| `envios` | `{courier?, departamento?, estado?}` | Ventas con courier ya despachadas (EN_ENVIO, entregadas o rechazadas) | periodo |
| `por_liquidar_actual` | `{courier?, vencido?: "1" o "sin_plazo"}` | ENTREGADO sin liquidar de **cualquier** fecha de ingreso | estado actual |
| `reservados` | `{producto}` | Ventas que hoy reservan ese producto (LLAMADO, PREPARADO, CON_GUIA) | estado actual |
| `despachados_dia` | `{dia_despacho}` | Ventas despachadas ese día, de cualquier fecha de ingreso | fecha de despacho |
| `ventas_rango` | `{desde, hasta, familias?}` | Ventas ingresadas en ese rango propio del gráfico, de esas familias de canal («Sin canal» incluido) | rango del gráfico |
| `pedidos` | — | **Todos** los pedidos ingresados (incluye PENDIENTE y ANULADO); con `estado` da el conteo de Estados y reglas | periodo |
| `ventas_sin_costo` | — | Ventas con al menos un producto sin costo cargado | periodo |
| `por_cobrar_actual` | — | Ventas de cualquier fecha con cobro «en curso» (ni entregadas ni cobradas) | estado actual |
| `movimientos_caja` | `{concepto?, dia_cobro?}` | Pedidos de **cualquier** fecha de ingreso con un movimiento de ese concepto de caja dentro del periodo (sin `concepto`: todas las entradas). Ver §4.5 | fecha del dinero |
| `despachados_rango` | — | Ventas despachadas dentro del periodo, de cualquier fecha de ingreso | fecha de despacho |

Cualquier grupo acepta además, en `grupo_params`, los filtros de fila:
- `canal`, `canales` (lista separada por comas);
- `dia` (de ingreso), `dia_semana` (0 = lunes, hora Lima), `hora` (0–23, hora Lima);
- `asesor` (`sin_asesor`), `entrada`, `entrada_no` (excluye esa entrada; Equipo usa `entrada_no: lead`);
- `estado` (estado del panel), `estado_cobro` (`pagado`, `por_liquidar`, `en_curso`, `perdido`, `reembolsado`), `operativo` (`entregado`, `rechazado`, …);
- `producto`, `cupon`, `categoria` (pedidos que contienen ese ítem), `departamento`, `zona`, `metodo`, `sesion`, `courier`;
- en `por_liquidar_actual`, además `antiguedad_deuda` (`0_3d`, `4_7d`, `8_14d`, `mas_14d`, días desde la entrega).

Se aplican **además de** los filtros globales. Cuando el alcance no es el periodo, el encabezado del drawer y el Excel lo dicen: «Estado actual», «Historial completo del cliente», «Por fecha de despacho», «Rango propio del gráfico» o «Por fecha del dinero».

Cada fila: `{ id, numero, ingreso (ISO con −05:00), canalOrigenId, canalOrigenNombre, canalCierreNombre, cliente, departamento, asesor, estado, cobro, vencido, listaNegra, motivo, neto }`. `estado` usa los estados de la especificación y `cobro` va aparte; un prepago en tránsito es `EN_ENVIO` con `cobro: "pagado"`, nunca `PAGADO`.

**Acciones por pedido** (botones dentro del drawer): siguen pendientes de `POST /panel/acciones`. El botón lo dice y no simula la ejecución.

### 4.2 Ventas y canales: campos por subpestaña

Estado de conexión: **ninguna subpestaña tiene fuente real**. Se ven con las fuentes demo (`canales/sources/canales.demo.ts`, `productos/…`, `publicidad/…`, `clientes-zonas/…`); en modo «solo reales» muestran «Pendiente de integración». Todas reciben los parámetros de §3.1, las fechas son de **ingreso** y la atribución es al **canal de origen**. `canalCierreNombre` es informativo y nunca suma dos veces. Tipos en `canales/models/`, `productos/models/`, `publicidad/models/` y `clientes-zonas/models/`.

**Canales** — `GET /panel/canales?vista=` → `CanalesComparativo` y `GET /panel/canales/{id}` → `CanalDetalle`

| Campo | Definición | Rol |
|---|---|---|
| `canales[]` | Fichas (`CanalFicha`) de los canales con datos en el periodo, para nombrar filas y agrupar por familia | Todos |
| `vista=ventas` · `filas[]` | `{ canalId, leads, confirmacion, ventas, facturacion, participacion, unidades, ticket, descuentos, upsell, metaPeriodo, avanceMeta }`. `leads`/`confirmacion` = `null` si la entrada no es lead. `metaPeriodo` = meta mensual prorrateada a los días del periodo, `null` sin meta. Incluye `canalId: null` («Sin canal») para que Σ = Vendí | Todos |
| `vista=entregas` · `filas[]` | `{ canalId, ventas, enCurso, entregados, rechazados, efectividadEntrega, primerIntento, flete?, pagado, porCobrar, perdido }`. `efectividadEntrega` = `null` si el canal no usa courier (POS). `flete` solo para el Dueño | Todos |
| `vista=ganancia` · `filas[]` | `{ canalId, facturacion, entregado, costoProducto, costoIncompleto, pautaDirecta, pautaGeneralEstimada, comision, flete, ganancia, gananciaParcial, margen, retornoPublicidad, costoPorVenta }`. `gananciaParcial` = hay entregas sin costo; `retornoPublicidad`/`costoPorVenta` = `null` sin inversión | **Solo Dueño** (403) |
| `total` | Mismos campos sin `canalId`, calculados sobre el total (no promedios de filas) | Según vista |
| `tendencia[]` | `{ familia, agrupada, familiasIncluidas[], valores[{ semanaDesde, facturacion }] }`: 12 semanas lunes–domingo hasta la actual; las 3 familias con más facturación y el resto en «Otras» (`agrupada: true`). Respeta los filtros de dimensión, no el periodo | Todos |
| `semanaEnCurso` | Lunes de la semana incompleta, para marcarla | Todos |
| Detalle · `kpis` | `{ leads, confirmacion, ventas, facturacion, participacion, metaPeriodo, avanceMeta, ticket, unidades, efectividadEntrega, cobradoEnCaja }` (`cobradoEnCaja` solo presencial) | Todos |
| Detalle · `costos` | `{ pautaDirecta, pautaGeneralEstimada, publicidad, comision, flete, costoCanal, ganancia, gananciaParcial, margen, retornoPublicidad }` | **Omitir** si no es Dueño |
| Detalle · `bloque` | Según la ficha: `lead` `{ embudo[{etapa: recibidos, contactados, llamados, entregados; pedidos}], perdidas[{tipo, motivo, pedidos}] }` · `live` `{ sesiones[] }` · `presencial` `{ metodos[], cierres[{dia, tickets, porMetodo, total, ticketPromedio}] }` · `marketplace` `{ porLiquidarBruto, pedidosPorLiquidar, comisionADescontar?, netoARecibir?, plazoDias }` · `prepago` `{ cobrado, pasarela?, reembolsos, pedidosReembolsados }` · `conversacional` `{ vendedoras[{asesorId, asesorNombre, ventas, facturacion, ticket, tasaUpsell, efectividadEntrega, pagado}] }` | Campos `?` solo Dueño |
| Sesión Live | `{ sesionId, tiendaId, inicio, fin (ISO), inversion, leads, llamados, confirmacion, facturacion, retorno, costoPorVenta, cerradosPorOtroCanal }`. Las ventas se atribuyen a la sesión y al canal donde **entró** el lead, aunque se cierren por WhatsApp | Todos |

**Productos** — `GET /panel/productos` → `ProductosPanel`

| Campo | Definición | Rol |
|---|---|---|
| `kpis` | `{ facturacionNeta, ventas, unidades, ticket, unidadesPorVenta, descuentos, descuentoSobreLista, upsell, ventasConUpsell, anuladosMasRechazados, ingresados, tasaPerdida }`. Descuentos = Σ (precio de lista − neto) de los ítems vendidos; `descuentoSobreLista` = descuentos ÷ (neto + descuentos); upsell = Σ neto de los ítems marcados como upsell; `tasaPerdida` = (anulados + rechazados) ÷ ingresados | Todos |
| `ventasDiarias[]` | Igual que en Resumen | Todos |
| `productos[]` | `{ productoId, sku, productoBaseId, productoBaseNombre, variante, nombre, categoria, unidades, facturacionNeta, participacion, canalPrincipalId, canalPrincipalNombre, descuentoPromedio, costoUnitario?, margen?, tasaRechazo, stock }`. **Una variante es un producto propio** (su propio `productoId` y SKU); `productoBaseId` solo informa de dónde deriva. Montos con el precio neto y la cantidad **de cada ítem**, no del pedido. `margen` = `null` si falta costo (nunca 0 ni 1) | `costoUnitario`, `margen`: solo Dueño |
| `cupones[]` | `{ cupon, ventas, descuento, facturacion, efectividadEntrega }` | Todos |
| `categorias[]` | `{ categoria, facturacionNeta }`; Σ = `kpis.facturacionNeta` | Todos |

**Publicidad** — `GET /panel/publicidad` → `PublicidadPanel`

| Campo | Definición | Rol |
|---|---|---|
| `kpis` | `{ invertido, pautaDirecta, pautaGeneralEstimada, pautaGeneralRegistrada, pautaGeneralSinAsignar, retornoPublicidad, ventasEnCanalesConPauta, facturacionEnCanalesConPauta, costoPorVenta, porcentajeDeLaVenta, comisionesPlataformas? }`. La pauta general registrada se reparte entre los canales que la reciben según su facturación (**estimado**); si ninguno vendió, queda en `pautaGeneralSinAsignar`. `invertido` = directa + general estimada. Denominador cero → `null` | `comisionesPlataformas`: solo Dueño |
| `porCanal[]` | `{ canalId, canalNombre, pautaDirecta, pautaGeneralEstimada, totalInvertido, comision?, ventas, facturacion, costoPorVenta, retorno, ganancia? }`, solo canales con inversión o comisión | `comision`: Dueño; `ganancia`: Dueño |
| `porDia[]` | `{ dia, invertido, vendido, ventas, costoPorVenta, registros[{ canalId, canalNombre, tipo: directa, general o live, monto }] }`: pauta **registrada** ese día y ventas en canales con pauta. `registros` es el desglose de la inversión (no tiene pedidos). Con filtro de canal, entrada o cobro se excluye la pauta general | Todos |
| `canalesConPauta[]` | Ids de los canales con inversión en el periodo; «Vendido» de un día abre `ventas_dia {dia, canales}` con esta lista | Todos |
| `sesionesLive[]` | Igual que en Canales | Todos |
| `inversionNoSeparable` | `true` si hay filtro de zona, turno o asesora: la inversión no se puede separar por esas dimensiones y el frontend lo avisa | Todos |

**Clientes y zonas** — `GET /panel/clientes` → `ClientesZonasPanel`

| Campo | Definición | Rol |
|---|---|---|
| `historial` | `{ disponible, desde }`. Si el backend no tiene el historial de compras por cliente, `disponible: false` y los campos que dependen de él van `null`: el frontend los muestra como «Pendiente» y **no** los reconstruye con los pedidos del periodo | Todos |
| `kpis` | `{ conCompra, nuevos, recurrentes, recompra, valorHistoricoPorCliente, listaNegraPedidos, efectividadListaNegra, efectividadTotal }`. Nuevos = primera compra histórica en el periodo; recurrentes = compraron antes de `desde` (nuevos + recurrentes = conCompra); recompra = clientes con 2+ compras históricas ÷ conCompra; valor histórico = Σ entregado histórico ÷ conCompra; lista negra = ventas a clientes con un RECHAZADO previo | Todos |
| `zonas[]`, `departamentos[]` | `{ zona\|departamento, ventas, facturacion, participacion, ticket, efectividadEntrega }` (departamento añade `zona`) | Todos |
| `metodosPago[]` | `{ metodo, pedidos, facturacion }` | Todos |
| `mejoresClientes[]` | `{ clienteId, nombre, departamento, pedidos, entregado, rechazosPrevios }`, top 10 por entregado histórico; `null` sin historial | Todos |

**Grupos del drawer por subpestaña**

| Subpestaña | Clic en | `grupo` + `grupo_params` |
|---|---|---|
| Canales | Canal de la lista o fila del comparativo | `ventas_canal {canal}` |
| | KPI Facturación / Ventas / Unidades · Leads · Efectividad · Cobrado en caja · Ganancia | `ventas {canal}` · `leads {canal}` · `entregados {canal}` · `cobrado {canal}` · `entregados {canal}` |
| | Embudo: recibidos · contactados · confirmados · entregados | `leads` · `contactados` · `ventas` · `entregados`, todos con `{canal}` |
| | Motivo de pérdida | `perdidas {canal, tipo, motivo}` |
| | Sesión Live · día de caja · vendedora | `ventas {canal, sesion}` · `ventas {canal, dia}` · `ventas {canal, asesor}` |
| | Por liquidar (marketplace) · cobrado / reembolsos (prepago) | `por_liquidar {canal}` · `cobrado {canal}` / `reembolsados {canal}` |
| Productos | Producto · cupón · categoría · día | `ventas {producto}` · `ventas {cupon}` · `ventas {categoria}` · `ventas_dia {dia}` |
| | KPI Upsell · Anulados y rechazados | `con_upsell` · `anulados_rechazados` |
| Publicidad | Canal · sesión Live | `ventas_canal {canal}` · `ventas {sesion}` |
| | Punto «Vendido» del gráfico | `ventas_dia {dia, canales}` |
| | Barra de «Inversión diaria» o punto «Invertido» | **No abre pedidos**: muestra el desglose de `porDia[].registros` en la misma tarjeta |
| Canales | Punto de la tendencia semanal | `ventas_rango {desde: lunes, hasta: domingo, familias}` (rango propio, no el periodo) |
| Clientes y zonas | Zona · departamento · método de pago | `ventas {zona}` · `ventas {departamento}` · `ventas {metodo}` |
| | KPI Nuevos · Recurrentes · Lista negra · cliente | `clientes_nuevos` · `recurrentes` · `lista_negra` · `historial_cliente {cliente}` |

**Cuadres que cumplen las fuentes demo** (`canales/__tests__/ventas-canales-demo.test.ts`), que el backend también debe cumplir:

- Σ filas del comparativo (con «Sin canal») = Vendí, con y sin filtros.
- KPI del canal = su fila = su drawer.
- Σ sesiones Live = facturación del canal Live.
- Σ cierres de caja = facturación del canal POS.
- Σ vendedoras = facturación del canal conversacional.
- Σ productos = Σ categorías = Σ ventas diarias = facturación neta = Vendí.
- Pauta general registrada = estimada + sin asignar; Σ inversión por canal = invertido = `gane.publicidad`.
- Nuevos + recurrentes = con compra; Σ departamentos, zonas y métodos = Vendí.

**Ficha editable:** «Editar ficha» usa `canales-fichas-guardar` (`PUT /config/canales/{id}`), que no existe. El botón solo lo ve el Dueño, dice «Pendiente» y no guarda nada.

### 4.3 Call center: campos y semántica temporal

`GET /panel/callcenter` → `PanelEnvelope<CallCenterPanel>` (`call-center/models/call-center.model.ts`). Recibe los parámetros de §3.1. Todo se calcula sobre **leads** (entrada = lead) por **fecha de ingreso**, salvo lo marcado como estado actual. Hora Lima.

| Campo | Definición (una sola fórmula, §4) | Fecha |
|---|---|---|
| `kpis.leadsRecibidos`, `valorLeads` | Leads del periodo y Σ de su neto | ingreso |
| `kpis.porLlamarAhora`, `sinIntentoAhora` | Leads en PENDIENTE ahora; de ellos, sin ningún intento | **estado actual** (no depende del periodo; sí de tienda, canal y demás filtros) |
| `kpis.tiempoPrimeraLlamadaMin` | **Mediana** de (primer_contacto_at − fecha_ingreso) en minutos de los leads ya trabajados. `leadsConPrimeraLlamada` = tamaño de la muestra; `llamadasTardias` = sobre la meta (30 min) | ingreso |
| `kpis.contactacion` | `contactados ÷ trabajados`. Trabajado = tiene primer intento; contactado = se logró hablar | ingreso |
| `kpis.confirmacion` | `confirmados ÷ (confirmados + anulados)`. Los PENDIENTE (`abiertos`) **no** cuentan. Cuadre: confirmados + anulados + abiertos = leads | ingreso |
| `kpis.upsellTasa`, `upsellMonto` | Confirmados con al menos un ítem `es_upsell` ÷ confirmados; Σ neto de esos ítems | ingreso |
| `colaEspera[]` | `{ bucket: menos_1h, 1_6h, 6_24h, mas_24h; leads; sinIntento }` por **horas desde el ingreso**; Σ = porLlamarAhora | **estado actual** |
| `motivosAnulacion[]` | `{ motivo, sinMotivo, leads }`; Σ = anulados. «Sin motivo» va al final, con `sinMotivo: true`: es error de calidad, no un motivo | ingreso |
| `calidad` | `duplicados` (mismo teléfono + producto en < 24 h, se anulan con «Duplicado»); `listaNegra` (leads de clientes con un RECHAZADO previo); `confirmacionListaNegra` / `entregaListaNegra` contra `confirmacionTotal` / `entregaTotal`; `anuladosSinMotivo` | ingreso |
| `mapaCalor[]` | `{ diaSemana (0 = lunes), hora (0–23), leads, confirmados, anulados, confirmacion }` por hora de **llegada en Lima**; Σ leads = leadsRecibidos | ingreso |
| `ranking[]` | Por asesora del lead (`null` = «Sin asignar»): `asignados, trabajados, contactacion, confirmados, anulados, confirmacion, tiempoPrimeraLlamadaMin, upsellTasa, upsellMonto, entregadosDeConfirmados, rechazadosDeConfirmados, entregaDeLoConfirmado, metaPeriodo`. **Entrega de lo confirmado** = entregados ÷ (entregados + rechazados) **de los leads que confirmó esa persona**; un prepago cobrado en tránsito no cuenta como entregado. Σ asignados = leads | ingreso (estado operativo actual) |
| `miDia` | Solo con rol Confirmadora: `puesto, totalConfirmadoras, miCola, miConfirmacion, confirmacionEquipo, confirmados, metaPeriodo, upsellMonto, upsellTasa, upsellTasaEquipo`. `metaPeriodo` = meta mensual de confirmados × días ÷ 30 | ingreso; `miCola` estado actual |

**Hooks existentes que no se reutilizan** (no coinciden con §4; por eso, en modo «solo reales», Call center queda **Pendiente**):
- `/atencion-al-cliente/kpis/funnel`: confirmados ÷ **ingresados** (incluye pendientes);
- `/kpis/aging`: antigüedad en **días** por `NO_CONTESTA/DESPACHADO`, no en horas;
- todos exigen **un solo `storeId`**, no filtran canal, zona, entrada ni asesora y no aclaran la hora de corte;
- `/agentes/kpis`: `pctConfirmados` y `pctEntregados` sin denominadores documentados; su entrega no se limita a lo que confirmó cada persona.

Faltan además `primer_contacto_at`, intentos y motivo como catálogo cerrado.

### 4.4 Operaciones: campos y semántica temporal

Cuatro relojes que **no se mezclan**: fecha de **ingreso** (métricas del periodo), fecha de **despacho** (despachos por día), fecha de **entrega** (días de entrega, vencimiento) y fecha de **cobro** (liquidación). Las colas y lo vencido son **fotografías actuales**: no se recortan por el periodo, sí por tienda, canal y demás filtros.

**Cola y tiempos** — `GET /panel/operaciones?sub=cola` → `ColaPanel`

| Campo | Definición | Fecha |
|---|---|---|
| `kpis.colaActiva` | Ventas con courier en LLAMADO, PREPARADO, CON_GUIA o EN_ENVIO | estado actual |
| `kpis.sinGuiaMas24h` | LLAMADO o PREPARADO, usa courier y > 24 h desde LLAMADO (acción §8) | estado actual |
| `kpis.enviosRetrasados`, `enviosSinTiempoNormal` | EN_ENVIO con más días que el tiempo normal del courier; los de un courier **sin** tiempo normal se cuentan aparte (pendiente, no retrasados) | estado actual |
| `kpis.diasConfirmadoAEntregado`, `entregasMedidas` | **Mediana** de (entrega − LLAMADO) en días de las entregas con courier | ingreso |
| `kpis.incidenciaRechazo` | rechazados ÷ (entregados + rechazados) de ventas con courier. Un ANULADO nunca cuenta como rechazo: RECHAZADO necesita una señal propia (hoy no existe, §5) | ingreso |
| `matriz[]` | `{ estado, accion, porAntiguedad{menos_24h, 1_2d, 3_5d, mas_5d}, total, sinFecha }`. Antigüedad = tiempo **desde que entró a su estado actual** (LLAMADO: fecha de confirmación; PREPARADO, CON_GUIA, EN_ENVIO: fecha de ese cambio). `sinFecha` si falta el historial de estados. Acción: Preparar, Asignar guía, Coordinar recojo, Reclamar al courier | estado actual |
| `tiemposPorEtapa[]` | `{ etapa, medianaHoras, metaHoras, pedidosMedidos, sobreMeta, sinFechas }` para Llamado → Preparado (≤ 12 h), Preparado → Con guía (≤ 6 h), Con guía → En envío (≤ 12 h), En envío → Entregado (≤ 72 h) y ciclo total (≤ días de ciclo × 24). Sobre entregas con courier; una etapa sin fechas no se cuenta como 0 | ingreso |
| `despachosPorDia[]` | `{ dia, despachados }` por **fecha de despacho** dentro de `desde..hasta`, sin importar la fecha de ingreso | despacho |
| `motivosRechazo[]` | `{ motivo, sinMotivo, pedidos }`; Σ = rechazados | ingreso |

**Couriers** — `GET /panel/operaciones?sub=couriers` → `CouriersPanel`

| Campo | Definición | Fecha |
|---|---|---|
| `kpis.envios` | Ventas con courier ya despachadas = entregados + rechazados + en tránsito. **Un prepago cobrado y aún en tránsito cuenta en tránsito, no como entrega** | ingreso |
| `kpis.efectividadEntrega` | entregados ÷ (entregados + rechazados) | ingreso |
| `kpis.primerIntento`, `entregasSinDatoPrimerIntento` | entregados al primer intento ÷ entregados **con ese dato**; si el courier no lo informa, `null` («—»), nunca 0 | ingreso |
| `kpis.diasEntrega` | Promedio de (entrega − despacho) en días | ingreso |
| `kpis.fleteTotal`, `fletePromedio` | Flete de los envíos, incluido el retorno de provincia; **solo Dueño** | ingreso |
| `kpis.porLiquidar`, `pedidosPorLiquidar`, `liquidacionVencida`, `pedidosVencidos`, `porLiquidarSinPlazo` | ENTREGADO sin liquidar de cualquier fecha; vencido si hoy > entrega + plazo. Sin plazo cargado no hay vencido (se informa aparte) | estado actual |
| `couriers[]` | `{ courierId, nombre, tipo, plazoLiquidacionDias, tiempoNormalDias, envios, entregados, rechazados, enTransito, efectividad, primerIntento, diasPromedio, fletePromedio?, fleteTotal?, costoRechazos?, porLiquidar, vencido, score }`. `vencido: null` y plazo «Pendiente» si falta el plazo. **Score**: A ≥ 90 %, B ≥ meta de efectividad, C ≥ meta − 7 puntos, D debajo; `null` sin envíos cerrados | ingreso; `porLiquidar`/`vencido` estado actual |
| `departamentos[]` | `{ departamento, envios, entregados, rechazados, efectividad, courierPrincipal, ticket, fletePromedio? }` | ingreso |

**Inventario** — `GET /panel/operaciones?sub=inventario` → `InventarioPanel`. Estado actual; stock único para todos los canales, así que solo aplica el filtro de **tienda**.

| Campo | Definición |
|---|---|
| `productos[]` | `{ productoId, sku, nombre, tiendaId, stock, reservado, disponible, unidades30Dias, ventaDiaria, coberturaDias, estado, costoUnitario?, valor? }`. reservado = unidades en LLAMADO, PREPARADO y CON_GUIA (`null` si no hay reserva → «Pendiente»); disponible = stock − reservado; venta diaria = unidades vendidas en 30 días ÷ 30; cobertura = disponible ÷ venta diaria (`null` sin ventas o con error) |
| `estado` | `error_datos` si stock < 0 (**nunca** «Agotado»); `agotado` si disponible ≤ 0; `critico` < 7 días; `bajo` < 15; `sobrestock` > 90; si no, `ok` |
| `kpis` | `productos, sinCosto, valorAlCosto? (Σ max(0, stock) × costo, solo Dueño), agotados, criticos, erroresDatos, ventasEsperandoStock`. `ventasEsperandoStock` = acción «Productos agotados»: LLAMADO/PREPARADO con un producto de stock **= 0** (el stock negativo va como error de datos) |

**Grupos del drawer por pestaña**

| Pestaña | Clic en | `grupo` + `grupo_params` |
|---|---|---|
| Call center | Leads recibidos · Por llamar ahora · Tiempo a 1ª llamada · Contactados · Confirmados · Upsell | `leads` · `cola_leads` (acción Llamar) · `primera_llamada_tardia` · `contactados` · `leads_confirmados` · `con_upsell {entrada: lead}` |
| | Tramo de espera · motivo de anulación · duplicados · lista negra | `cola_leads {antiguedad}` · `leads_anulados {tipo: anulado, motivo}` («Sin motivo» con acción Completar motivo) · `duplicados` · `leads_lista_negra` |
| | Celda del mapa de calor | `leads {dia_semana, hora}` |
| | Ranking: confirmadora · confirmados · entrega de lo confirmado · anulados | `leads {asesor}` · `leads_confirmados {asesor}` · `entregados {asesor, entrada: lead}` · `leads_anulados {asesor}` |
| | «Mi día»: mi cola · mi confirmación · mi upsell | `cola_leads` · `leads_confirmados` · `con_upsell {entrada: lead}` (el backend filtra a la identidad) |
| Cola y tiempos | Cola activa · sin guía · retrasados · días de ciclo · incidencia | `cola_operativa` · `accion {accion: ventas_sin_guia}` · `accion {accion: envios_retrasados}` · `etapa_lenta {etapa: ciclo_total}` · `rechazados` |
| | Celda estado × antigüedad · total del estado | `cola_operativa {estado, antiguedad}` · `cola_operativa {estado}`, con la acción del estado |
| | Sobre la meta (tabla de etapas) · barra de despachos · motivo de rechazo | `etapa_lenta {etapa}` · `despachados_dia {dia_despacho}` · `rechazados {tipo: rechazado, motivo}` |
| Couriers | Envíos · efectividad · días · por liquidar · vencido | `envios` · `rechazados` · `entregados` · `por_liquidar_actual` · `por_liquidar_actual {vencido: 1}` |
| | Fila: courier · rechazados · en tránsito · por liquidar · vencido | `envios {courier}` · `rechazados {courier}` · `envios {courier, estado: EN_ENVIO}` · `por_liquidar_actual {courier}` · `por_liquidar_actual {courier, vencido: 1}` |
| | Departamento · rechazados | `envios {departamento}` · `rechazados {departamento}` |
| Inventario | Reservado · ventas esperando stock | `reservados {producto}` · `accion {accion: productos_agotados}` |

**Acciones:** Preparar, Asignar guía, Coordinar recojo, Reclamar al courier, Llamar, Pedir liquidación, Avisar al cliente y Completar motivo necesitan `POST /panel/acciones`. Todos los botones muestran «Pendiente» y no simulan cambios.

**Cuadres que cumplen las fuentes demo** (`call-center/__tests__`, `operaciones/__tests__`), que el backend también debe cumplir:

- Leads = confirmados + anulados + pendientes; Σ tramos de espera = por llamar ahora; Σ motivos = anulados; Σ mapa de calor = leads; Σ asignados del ranking = leads.
- Cada KPI, tramo, celda y fila abre exactamente su grupo; la cola no cambia al cambiar el periodo.
- Σ matriz = cola activa; cada celda abre pedidos de ese estado y esa antigüedad.
- La mediana por etapa es la mediana real de las entregas del periodo; «sobre la meta» = su grupo.
- Σ despachos por día = pedidos despachados en el rango por fecha de despacho.
- Envíos = entregados + rechazados + en tránsito = Σ couriers = Σ departamentos; ningún prepago cobrado en tránsito figura como entregado.
- Stock negativo → `error_datos`, sin cobertura ni valor; la Supervisora no recibe flete, costo ni valor.

### 4.5 Finanzas (solo Dueño): campos y relojes

Los tres endpoints exigen `ver_finanzas`: a cualquier otro rol responden **403**. Tipos en `finanzas/models/`.

**Resultado** — `GET /panel/finanzas?reloj=pedido` → `ResultadoPanel`. Todo por **fecha de ingreso** del pedido.

| Campo | Definición |
|---|---|
| `facturadoAlDinero` | `{ facturado, entregado, pagado, porLiquidar, vencido, enCurso, perdido, reembolsado, adelantosRecibidos }`. Cuadre (§12, n.º 5): facturado = pagado + porLiquidar + enCurso + perdido + reembolsado. `entregado` = ENTREGADO + PAGADO por **estado operativo** (un prepago cobrado en tránsito no es entregado). `adelantosRecibidos` = `null` mientras no exista `adelanto_monto`/`fecha_adelanto`: los adelantos son caja, nunca ingreso |
| `estadoResultados` | `{ ventaEntregada, costoProducto, entregasSinCosto, publicidadDirecta, publicidadGeneralEstimada, envios, comisiones, ganancia, gananciaParcial, gastosFijos, gastosFijosMensuales, utilidadOperativa }`. `ganancia` = la misma fórmula que «Gané» de Resumen (entregado − costo de producto − publicidad − fletes con retornos − comisiones y pasarela). `gananciaParcial` = hay entregas sin costo (la cifra es un tope). `gastosFijos` = mensual × días ÷ 30; **`null` si hay filtro de canal, entrada, cobro, zona, turno o asesora** (los gastos fijos no se reparten), y entonces `utilidadOperativa` también es `null` |
| `puntoEquilibrio` | `{ gananciaPorEntrega = ganancia ÷ entregas, entregasNecesarias = ⌈gastosFijos ÷ gananciaPorEntrega⌉, entregasLogradas, margenSeguridad = (logradas − necesarias) ÷ logradas, fletePromedioPorRechazo }`; `null` sin gastos fijos |
| `rentabilidadPorCanal[]` | `{ canalId, canalNombre, entregado, ganancia, gananciaParcial, margen, retornoPublicidad }`, igual que `GET /panel/canales?vista=ganancia` |
| `evolucionMensual[]` | Últimos 6 meses por fecha de ingreso, **no dependen del periodo**: `{ mes: "AAAA-MM", enCurso, facturado, entregado, pagado }` |

**Caja** — `GET /panel/finanzas?reloj=caja` → `CajaPanel`. Todo por **fecha del dinero**: un pedido ingresado antes del periodo cuenta si su dinero entró o salió dentro del periodo.

| Concepto | Fecha que manda | Monto |
|---|---|---|
| Entrada `liquidacion_courier` | fecha de la liquidación (`fecha_pago`) | neto de contraentrega entregado; un rechazo nunca entra |
| Entrada `liquidacion_marketplace` | fecha del depósito | neto **menos** la comisión del marketplace |
| Entrada `caja_pos` | fecha de cobro en caja | neto |
| Entrada `prepago` | fecha del pago en línea | neto (aunque luego se reembolse) |
| Entrada `adelantos` | `fecha_adelanto` | `null` hasta que exista el dato |
| Salida `publicidad` | fecha de la pauta | pauta registrada (con filtro de canal, solo la de esos canales; con filtro de zona, turno o asesora: `null`, no se separa) |
| Salida `fletes` | fecha de envío; el retorno de provincia en la fecha del rechazo | flete real |
| Salida `pasarela` | fecha del pago en línea | neto × % pasarela |
| Salida `comisiones_aliados` | fecha de la liquidación | neto × % comisión de la plataforma aliada |
| Salida `reembolsos` | fecha del rechazo del prepago | neto devuelto |
| Salida `gastos_fijos` | prorrateo diario | mensual ÷ 30 por día transcurrido; `null` con filtros de dimensión |

Respuesta: `{ entradas[{concepto, monto, pedidos}], salidas[…], totalEntro, totalSalio, netoCaja, promedioDiarioEntra, dias, porDia[{dia, entro, salio}], incluyeComprasMercaderia: false }`. `pedidos` = pedidos distintos con ese movimiento (`null` si el concepto no tiene pedidos). Cada concepto con pedidos abre `movimientos_caja {concepto}`; cada barra diaria abre `movimientos_caja {dia_cobro}`.

**Cobranza** — `GET /panel/finanzas?reloj=cobranza` → `CobranzaPanel`. **Estado actual**: no depende del periodo; respeta tienda, canal y demás filtros.

| Campo | Definición |
|---|---|
| `kpis` | `{ porLiquidar, pedidosPorLiquidar, vencido, pedidosVencidos, enCurso, pedidosEnCurso, adelantosDeNoEntregadas (null sin dato), porLiquidarSinPlazo }`. Vencido si hoy > fecha de entrega + plazo del courier |
| `liquidacionesPendientes[]` | Por courier: `{ courierId, courier, plazoDias, pedidos, monto, diasMasAntiguo, vencido }`; `vencido: null` si el courier no tiene plazo. Botón «Pedir» → `POST /panel/acciones {accion: pedir_liquidacion}` |
| `antiguedad[]` | `{ bucket: 0_3d, 4_7d, 8_14d, mas_14d; monto; pedidos }` por días desde la entrega; Σ = porLiquidar |

**Grupos del drawer**: Facturado · Entregado · Pagado · Por liquidar · En curso · Perdido → `ventas` · `entregados` · `cobrado` · `por_liquidar` · `ventas {estado_cobro: en_curso}` · `rechazados`; canal → `ventas_canal`; punto mensual → `ventas_rango {desde, hasta, operativo?, estado_cobro?}`; Caja → `movimientos_caja`; Cobranza → `por_liquidar_actual {courier?, vencido?, antiguedad_deuda?}` y `por_cobrar_actual`.

### 4.6 Equipo: campos

**Vendedoras y caja** — `GET /panel/equipo?tipo=vendedoras&agrupar=zona|asesor&upsell=con|sin` → `EquipoVendedorasPanel`. Por fecha de ingreso.

- **Universo**: ventas que **no** entraron como lead (directas y POS). Las ventas de leads se miden en Confirmadoras; las ventas sin asesora (web, marketplace) van en `automaticas {ventas, facturacion}` y fuera de comisiones. Cuadre: Σ vendedoras + automáticas + leads confirmados = ventas del periodo.
- **`upsell=sin`**: todos los montos restan el neto de los ítems `es_upsell` (el conteo de pedidos no cambia).
- **`grupos[]`**: `{ clave, etiqueta, asesorId, rol: vendedora | caja | null, metricas, hijos[] }`. Con `agrupar=zona` el grupo es la zona y los hijos las asesoras; con `asesor`, al revés. `rol = caja` si la mayoría de sus ventas son presenciales.
- **`metricas`** (bloques del Excel del negocio): Volumen `{pedidos, participacion, entregados, efectividadEntrega}` · Cobranza `{pagado, pendiente (por liquidar + en curso), perdido (rechazado + reembolsado), total, porcentajePagado}` · Upsell `{upsellPagado, conUpsell, tasaUpsell, entregaConUpsell}` · Ticket `{ticketEntregado = entregado ÷ entregas}` · Meta `{metaPeriodo, avanceMeta = total ÷ meta}` (solo en la fila de la asesora) · `comisionEstimada?` (**solo Dueño**; ejemplo: 3 % de lo pagado + 10 % del upsell pagado).
- **Drawer**: cada cifra abre `ventas`, `entregados`, `cobrado`, `no_cobrado`, `rechazados` o `con_upsell` con `{asesor?, zona?, entrada_no: lead}`.

**Confirmadoras** — `GET /panel/equipo?tipo=confirmadoras` → `EquipoConfirmadorasPanel`. **Mismo cálculo que el ranking de Call center** (§4.3): `filas[{ asesorId, asesorNombre, asignados, contactacion, confirmados, confirmacion, tiempoPrimeraLlamadaMin, entregados, efectividadEntrega (de lo que confirmó), anulados, upsellTasa, upsellPagado, metaPeriodo, avanceMeta, comisionEstimada? }]`, `total`, `kpis` y `reglaComision?` (**solo Dueño**; ejemplo: S/ 1.50 por confirmado entregado + 10 % del upsell pagado).

### 4.7 Mis ventas (vista Vendedora)

`GET /panel/mis-ventas` → `MisVentasPanel`. El backend toma la **identidad del JWT** (ver §3.3) e ignora `asesor`; sin identidad responde 403.

| Campo | Definición |
|---|---|
| `vendi`, `meta`, `pagado` | Sus ventas directas y POS del periodo: facturación, ventas, ticket; meta mensual × días ÷ 30, avance y lo que falta; pagado, efectividad y perdido |
| `comisionEstimada` | **Omitida**: §6.7 muestra «mi comisión estimada», pero §14 dice que la Vendedora no recibe comisiones. La pantalla muestra «Pendiente». Decisión abierta (§6) |
| `porEstado[]` | Sus pedidos del periodo por estado actual; cada barra abre `pedidos {estado}` |
| `ranking[]` | Facturación de todas las vendedoras con `esYo`. **Las demás van sin nombre ni id real** (`Vendedora N`): la Vendedora no recibe datos identificables de otras personas |
| `noCobrados[]` | Sus pedidos con cobro «en curso» o «por liquidar» (`DetallePedidoFila`) |

### 4.8 Configuración: campos

| Pantalla | Contrato | Campos |
|---|---|---|
| Metas | `GET /config/metas?empresaId=` → `MetasPanel`; `PUT /config/metas` ← `ConfigMetasGuardar` | `indicadores` (§11.1: valor, dirección, unidad, tolerancia) y `mensuales {porCanal, porVendedora, porConfirmadora}` por id. El frontend valida (número ≥ 0, porcentaje ≤ 100) y envía solo lo cambiado; hoy «Guardar» avisa pendiente |
| Estados y reglas | `GET /panel/config/estados` → `{ conteoActual[{estado, pedidos}] }` | Pedidos **ingresados en el periodo** por su estado **actual**; Σ = pedidos ingresados (cuadre 7). Las reglas y el glosario son texto fijo del frontend |
| Cuadres y calidad | `GET /panel/config/cuadres` → `{ cuadres[], calidad }` | `cuadres[{id, descripcion, valor, total, unidad, cuadra, nota}]`: los 9 de §12 con los mismos filtros. Tolerancia S/ 1 en montos, 0 en cantidades. `nota` explica los que no cuadran (el n.º 9 con filtro de canal o con pauta general sin canal receptor). `calidad {porcentajeCompleto, pedidosRevisados, anulacionesSinMotivo, importadosSinCanal, ventasConProductoSinCosto, productosSinCosto[], productosStockNegativo[]}`. La línea de estado usa este mismo resultado |

### 4.9 Excel completo y Compartir reporte

**`GET /panel/export.xlsx`** (capacidad `exportar_libro`: Dueño y Supervisora; 403 a los demás). Mismos parámetros que el panel. Nombre: `powip_panel_AAAA-MM-DD_AAAA-MM-DD.xlsx` (sin tildes; el demo agrega `_DEMO`). Cada hoja empieza con: `POWIP · Panel de Control`, título, periodo, filtros legibles, fecha de generación y origen; montos numéricos con formato `"S/ "#,##0.00` y porcentajes `0.0%`.

| Hoja | Columnas (las marcadas * solo para el Dueño) |
|---|---|
| Resumen | Indicador, Unidad, Periodo, Periodo anterior, Variación, Meta (facturación, ventas, ticket, leads, confirmados, entregado, efectividad, me deben, retorno de publicidad, ganancia*) |
| Canales | Canal, Leads, Confirmación, Ventas, Facturación, Part., Ticket, Meta, Avance, Entregados, Rechazados, Efectividad, Pagado, Por cobrar, Flete* |
| Pedidos | 27 columnas: Pedido, Fecha de ingreso, Hora (Lima), Tienda, Canal de origen, Cerrado por, Entrada, Cobro, Cliente, Departamento, Zona, Turno, Asesor(a), Estado, Estado de cobro, Vencido, Lista negra, Motivo, Productos, Unidades, Precio de lista, Descuento, Neto, Upsell, Courier, Flete*, Costo de producto* (vacío si falta costo). Todos los pedidos ingresados del periodo |
| Productos | Producto, SKU, Categoría, Unidades, Facturación neta, Part., Canal principal, Descuento promedio, Tasa de rechazo, Stock, Costo unitario*, Margen* |
| Vendedoras | Asesora, Rol, bloques Volumen, Cobranza, Upsell, Ticket y Meta, Comisión estimada* |
| Confirmadoras | Confirmadora, Asignados, Contactados, Confirmados, % confirmación, 1ª llamada, Entregados, Entrega de lo confirmado, Anulados, Upsell, Upsell pagado, Meta, Avance, Comisión* |
| Couriers | Courier, Envíos, Entregados, Rechazados, En tránsito, Efectividad, 1er intento, Días, Plazo, Por liquidar, Vencido, Score, Flete total*, Costo de rechazos* |
| Departamentos | Departamento, Zona, Ventas, Facturación, Part., Ticket, Efectividad |
| Cuadres | Cuadre, Valor, Total, Cuadra, Nota |

**`GET /panel/compartir`** → `CompartirReporteResponse` (Dueño y Supervisora). Campos: `periodo, ventaTotal, pedidos, publicidad, costoPorVenta (publicidad ÷ ventas), entregado, efectividadEntrega, meDeben, vencido, texto` y, **solo para el Dueño** (omitidos, no `null`): `producto` (costo de lo vendido), `productoIncompleto`, `envios`, `gananciaSobreVentaTotal` (venta total − producto − publicidad − envíos, entregado o no) y `gananciaSobreEntregado` (la de «Gané»: entregado − costo − publicidad − envíos − comisiones). `texto` es el mensaje listo para WhatsApp con el vocabulario del equipo, y cada ganancia lleva su fórmula en la etiqueta: «Ganancia sobre venta total (venta − producto − publicidad − envíos)» y «Ganancia real sobre entregado (entregado − costo − publicidad − envíos − comisiones)». Cuál de las dos queda es una decisión abierta (§6); hasta entonces se envían ambas. El diálogo muestra el texto, copia al portapapeles y ofrece el Excel completo.

### 4.10 Ejemplos de respuesta

Salida real de las fuentes demo para `desde=2026-09-01`, `hasta=2026-09-21` (comparación `2026-08-01..2026-08-21`), recortada: cada arreglo muestra un solo elemento y se omiten bloques para abreviar. Los tipos completos están en `src/features/panel-control/*/models/`.

**`GET /panel/resumen` como Supervisora.** No trae `gane` ni `flujo.rechazados.flete`: las claves **no existen**, no van en `null`.

```json
{
  "actual": {
    "vendi": { "facturacion": 146963, "ventas": 937, "ticket": 156.84, "leads": 390, "confirmacion": 0.6 },
    "entregado": { "entregado": 107447, "entregas": 684, "efectividadEntrega": 0.87 },
    "meDeben": { "total": 43363, "porLiquidar": 21398, "enCursoPorCobrar": 21965, "vencido": 3798 },
    "ventasDiarias": [
      { "dia": "2026-09-01", "facturacion": 7932, "ventas": 55, "diaAnterior": "2026-08-01", "facturacionAnterior": 5748 }
    ],
    "flujo": {
      "rechazados": { "pedidos": 99, "perdido": 16570 },
      "cobro": { "cobradoTotal": 87030, "cobradoEntregado": 86049, "cobradoSinEntregar": 981, "porLiquidar": 21398, "vencido": 3798 }
    }
  },
  "anterior_misma_antiguedad": { "…": "mismo objeto, periodo anterior a la misma antigüedad" },
  "metas": { "…": "MetasPanel" },
  "generado_en": "2026-09-21T21:00:00.000Z"
}
```

Mismo pedido como **Dueño**: agrega `gane` y el flete de los rechazos.

```json
{
  "gane": { "ganancia": 43817.88, "entregado": 107447, "margen": 0.41, "publicidad": 10985, "costoProducto": 39364, "flete": 10840, "comisiones": 2440.12, "entregasSinCosto": 104 },
  "flujo": { "rechazados": { "pedidos": 99, "perdido": 16570, "flete": 2145 } }
}
```

**`GET /panel/detalle?grupo=movimientos_caja&grupo_params={"concepto":"liquidacion_courier"}&pagina=1&tamano_pagina=1`** (Dueño). Pedidos de cualquier fecha de ingreso cuyo dinero entró en el periodo; `movimientoCaja` es lo que suma Caja.

```json
{
  "resumen": { "facturacion": 97899, "ventas": 622, "unidades": 988, "ticket": 157.39, "movimientoCaja": 97899 },
  "pedidos": {
    "filas": [
      {
        "id": "demo-27867", "numero": "DEMO-27867", "ingreso": "2026-09-05T08:09:00-05:00",
        "canalOrigenId": "demo-aliada", "canalOrigenNombre": "Plataforma aliada (demo)", "canalCierreNombre": null,
        "cliente": "Cliente demo 15562", "departamento": "Piura", "asesor": "Asesora 2",
        "estado": "PAGADO", "cobro": "pagado", "vencido": false, "listaNegra": false, "motivo": null, "neto": 129,
        "movimientoFecha": "2026-09-21T15:55:00-05:00", "movimientoMonto": 129
      }
    ],
    "total": 622, "pagina": 1, "tamanoPagina": 1
  },
  "porProducto": [
    { "productoId": "demo-1-B", "nombre": "Producto demo B", "unidades": 115, "facturacionNeta": 18005, "precioNetoPromedio": 156.57, "margen": 0.59 }
  ],
  "porEstado": [{ "estado": "PAGADO", "pedidos": 622 }]
}
```

**`GET /panel/compartir` como Dueño.** A la Supervisora le llegan solo `periodo`, `ventaTotal`, `pedidos`, `publicidad`, `costoPorVenta`, `entregado`, `efectividadEntrega`, `meDeben`, `vencido` y `texto` (sin las líneas de producto, envíos ni ganancias).

```json
{
  "periodo": "1 set – 21 set (hora Lima)",
  "ventaTotal": 146963, "pedidos": 937, "publicidad": 10985, "costoPorVenta": 11.72,
  "entregado": 107447, "efectividadEntrega": 0.87, "meDeben": 43363, "vencido": 3798,
  "producto": 53495, "productoIncompleto": true, "envios": 10840,
  "gananciaSobreVentaTotal": 71643, "gananciaSobreEntregado": 43817.88,
  "texto": "*Reporte POWIP · 1 set – 21 set (hora Lima)*\nVenta total: S/ 146,963 (937 pedidos)\nProducto: S/ 53,495 (hay productos sin costo)\n…\nGanancia sobre venta total (venta − producto − publicidad − envíos): S/ 71,643\n—\nEntregado: S/ 107,447 (efectividad 87%)\nGanancia real sobre entregado (entregado − costo − publicidad − envíos − comisiones): S/ 43,818\nMe deben: S/ 43,363 (vencido S/ 3,798)"
}
```

**Rol sin permiso.** Por ejemplo, la Supervisora pide `GET /panel/finanzas?reloj=caja`: el endpoint responde **HTTP 403**. El frontend no interpreta el cuerpo: el bloque muestra «No se pudieron cargar los datos» con el mensaje del error y un botón «Reintentar». El formato del cuerpo queda a criterio del backend. En condiciones normales la interfaz ni siquiera hace esa petición, porque no muestra la pestaña a ese rol; el 403 es para las peticiones directas.

## 5. Reglas que no se pueden resolver con los estados actuales

| # | Regla de la especificación | Problema con los datos actuales | Qué necesita el frontend |
|---|---|---|---|
| 1 | Es venta desde LLAMADO; PENDIENTE no es venta | Flujo real `PENDIENTE → PREPARADO → LLAMADO («Contactado»)`; la confirmación CC está en `subEstadoCc`; las ventas directas pueden nacer en PENDIENTE | Que el backend clasifique cada pedido como lead abierto / anulado / venta según la **ficha del canal**, nunca por el orden de los estados |
| 2 | RECHAZADO con motivo obligatorio | No existe; un rechazo termina en ANULADO (incluso desde ENTREGADO) o en `shalomStatus = DEVUELTO` | Estado RECHAZADO o un campo que distinga anulación de lead y rechazo de entrega, con catálogo de motivos |
| 3 | Atribución al canal de origen | `salesChannel`, `closingChannel`, `canalOrigen` y `externalSource` no apuntan a la ficha | `canal_id` de origen y `canal_cierre_id` informativo |
| 4 | Resultado por `fecha_ingreso`, Caja por fecha del dinero | No hay fecha de liquidación persistida; los pagos `PAID` incluyen adelantos | Fecha de cobro por pedido y registro de liquidaciones |
| 5 | Prepago: PAGADO antes de ENTREGADO | Un solo `status` | Estado operativo y estado de cobro separados |
| 6 | Productos sin costo → «—» | `costAmount` no distingue sin costo de 0 | Costo unitario nullable por ítem, con vigencia |
| 7 | Comparación a la misma antigüedad | No hay historial de estados confiable | Historial `(pedido, estado, fecha)` |
| 8 | Asesor(a) único | Venta directa usa `sellerId`; lead usa `ccAgenteId` | Que `asesor=` compare el campo correcto según la entrada y que la lista de asesoras informe su rol (confirmadora o vendedora) |
| 11 | Antigüedad en su estado y tiempos por etapa | Solo se aproximan con `logs[].data.status` | `order_status_history (pedido, estado, fecha)` |
| 12 | Reserva de stock | No hay reserva por pedido | Unidades reservadas en LLAMADO, PREPARADO y CON_GUIA por producto y tienda |
| 13 | Primer intento de entrega | No se guarda | `primer_intento_entrega_ok` por pedido (nulo si el courier no lo informa) |
| 9 | Pauta directa + general prorrateada | Solo gastos mensuales y cierre del día en `localStorage` | Registro de pauta por fecha, tienda y canal o «general» |
| 10 | Vencido y envíos retrasados | Plazos por courier en una tabla local | Plazo de liquidación y tiempo normal por courier |

## 6. Decisiones abiertas y contradicciones de la especificación

Lo que de verdad impide conectar cifras reales son los **datos de §5** (RECHAZADO, cobro separado, historial de estados, costo nullable, canal de origen). De las decisiones de negocio, **solo una bloquea una conexión**: el rol Supervisora en el JWT. Las demás dejan un campo en `null`, omitido o con una regla provisional, y el resto del endpoint se puede conectar igual.

| Decisión | Contradicción o vacío | ¿Bloquea conexión real? | Qué hace hoy el frontend |
|---|---|---|---|
| **Rol Supervisora en el JWT** | `ccRol = supervisor` solo existe en la lista de agentes (§3.3) | **Sí, para la Supervisora**: sin el rol no se resuelve y no ve datos. Dueño, Confirmadora y Vendedora no dependen de esto | Propone `PANEL_ROL_*` en `permissions` |
| Comisión estimada en Mis ventas | §6.7 la muestra; §14 prohíbe comisiones a la Vendedora | No. `GET /panel/mis-ventas` se conecta sin el campo | Omitida; pantalla «Pendiente de decisión» |
| Ganancia en Compartir | Dos fórmulas para «Ganancia», contra «una sola fórmula por métrica» | No. Se envían ambas con nombres distintos | `gananciaSobreVentaTotal` y `gananciaSobreEntregado`, cada una con su fórmula en el texto |
| Reglas de comisión del equipo | Configurables (§3.2 `comisiones_config`) sin contrato de carga | Parcial: solo `comisionEstimada` y `reglaComision` de Equipo | Valores de ejemplo en demo |
| Gastos fijos | Configurables (§3.2 `gastos_fijos`) sin contrato de carga | Parcial: `gastosFijos`, `utilidadOperativa` y punto de equilibrio de Resultado | S/ 9,000 al mes por tienda en demo |
| Plazo de liquidación por courier | No hay dato (§5 n.º 10, §15) | Parcial: `vencido` va `null` y el plazo muestra «Pendiente» | Contempla `null` |
| Turno del pedido | El pedido no lo guarda (§15) | No: solo el filtro Turno | Filtro marcado pendiente |
| Cuadre 9 con filtro de canal o entrada | §12 exige ✓ con cualquier filtro; con esos filtros no puede cuadrar | No | Muestra ✗ con nota explicativa |
| Nombres en el ranking de Mis ventas | No definido | No | Otras vendedoras sin nombre ni id |
| Supervisora en Publicidad | No definido | No (regla provisional conservadora) | Ve inversión, retorno y costo por venta; no recibe comisiones, ganancia ni flete |
| Flete para la Supervisora | No definido | No | Se trata como costo y se omite, también en Couriers |
| «Productos agotados» con stock negativo | §8 usa stock ≤ 0; el stock negativo es «Error de datos» | No | La acción usa stock = 0; el negativo se informa en Inventario |
| Reembolsos en Caja | No están en la lista de §6.5 | No | Salida propia |
| Criterio 14.1 (coincidir con el mockup) | El mockup genera datos en el navegador | No bloquea la conexión; bloquea verificar 14.1 | Hace falta un fixture compartido |
| Yavendió y demás puntos de §15 | Abiertos en la especificación | Sin impacto en los contratos de este documento | — |

## 7. Cómo sustituir una fuente demo por la real

1. Implementar la función de API en la feature (por ejemplo `src/features/panel-control/resumen/api/resumen.api.ts`) usando `axiosAuth` y el tipo del modelo como respuesta.
2. Crear la fuente real:
   ```ts
   export const resumenRealSource: PanelSource<"resumen"> = {
     contractId: "resumen",
     kind: "real",
     descripcion: "GET /panel/resumen",
     fetch: (query) => getResumen(query),
   };
   ```
3. Reemplazar la entrada en `DEFAULT_PANEL_SOURCES` (`src/features/panel-control/shared/data/panel-sources.ts`) y actualizar `estado` / `endpointActual` en el descriptor del contrato.
4. Borrar la fuente demo si ya no se usa.

Los componentes no cambian: consumen `usePanelContract("resumen", query)` y reciben `{ status, data, origin }`. El badge pasa solo de Demo a Real.

**Cómo validar un endpoint real contra el demo:** las fuentes demo son la **especificación ejecutable** del contrato. Cada una tiene pruebas de reglas y cuadres (`src/features/panel-control/**/__tests__/*-demo.test.ts`) que llaman a la fuente con un contexto de rol y verifican denominadores, relojes, permisos y que cada cifra abra exactamente su grupo en `/panel/detalle`. Para validar un endpoint real, se puede correr la misma prueba contra la fuente real (mismo `PanelSource<K>`) sobre un conjunto de datos de prueba.

## 7.1 Checklist para el backend

Orden sugerido (cada paso destraba pantallas completas):

1. **Datos base (§5):** estado RECHAZADO distinto de ANULADO con catálogo de motivos; `canal_id` de origen apuntando a la ficha; estado de cobro separado del operativo; `order_status_history (pedido, estado, fecha)`; costo por ítem que admita «sin costo»; identidad de Supervisora en el JWT.
2. **`GET /panel/detalle`** (§4.1): todos los grupos, parámetros y alcances. Casi todas las cifras del panel abren un grupo de aquí.
3. **`GET /panel/estado`** y **`GET /panel/resumen`** (§4.1).
4. **`GET /panel/canales`**, `/canales/{id}`, `/productos`, `/publicidad`, `/clientes` (§4.2), con pauta registrada por día, tienda y canal o «general».
5. **`GET /panel/callcenter`** (§4.3): `primer_contacto_at`, intentos, duplicados, asesora del lead.
6. **`GET /panel/operaciones?sub=…`** (§4.4): reserva de stock, primer intento de entrega, plazo y tiempo normal por courier.
7. **`GET /panel/finanzas?reloj=…`** (§4.5): liquidaciones de courier y marketplace con fecha, adelantos, gastos fijos.
8. **`GET /panel/equipo?tipo=…`** y **`GET /panel/mis-ventas`** (§4.6–4.7): metas y reglas de comisión configurables.
9. **Configuración** (§4.8): `GET/PUT /config/metas`, `PUT /config/canales`, `/panel/config/estados`, `/panel/config/cuadres`.
10. **`GET /panel/export.xlsx`** y **`GET /panel/compartir`** (§4.9).
11. **`POST /panel/acciones`**: llamar, preparar, asignar guía, coordinar recojo, reclamar al courier, pedir liquidación, avisar al cliente, completar motivo, asignar canal.

**En todos los endpoints:**
- Mismos parámetros (§3.1) y sobre (§3.2), con `anterior_misma_antiguedad` donde aplique.
- Hora de corte 00:00 Lima.
- Cifras imposibles como `null`, nunca `0`.
- Campos restringidos **omitidos**, no en `null` (§3.3).
- HTTP 403 **emitido por el endpoint** para roles sin permiso. Que el frontend no muestre la pestaña no cuenta.
- Identidad del JWT impuesta a Confirmadora y Vendedora.
- Los cuadres de cada sección deben cumplirse con cualquier filtro, salvo los documentados en §6.

## 7.2 Criterios de aceptación por endpoint

Un endpoint se da por integrado cuando cumple **todo** lo siguiente, verificado con datos reales de una empresa de prueba:

1. **Contrato:** la respuesta tipa contra el modelo de `src/features/panel-control/<feature>/models/` sin casts, y `anterior_misma_antiguedad` viene calculado o en `null` explicado.
2. **Autorización en el servidor:** con un JWT de cada rol, llamado **directamente** (curl o Postman, sin frontend):
   - un rol no incluido en la columna «Roles» de §4 recibe HTTP 403;
   - un rol incluido sin permiso de costos recibe la respuesta **sin** las claves de «Campos restringidos» (no en `null`);
   - una Confirmadora o Vendedora que manda `asesor` o `grupo_params.asesor` de otra persona recibe 403 o solo sus datos, según §3.3;
   - `ver_como` enviado por un no Dueño no otorga nada extra;
   - los datos de otra empresa nunca aparecen, aunque se envíe su `tienda` o `canal`.
3. **Relojes:** Resultado cuenta por fecha de ingreso, Caja por fecha del dinero y Cobranza, Qué hacer hoy, cola e inventario por estado actual. Cambiar el periodo mueve Resultado y no mueve las tareas de estado actual (sí mueve `anulaciones_sin_motivo`, que usa el periodo).
4. **Coherencia:** los cuadres de la sección dan ✓ con: sin filtros, una tienda, un canal, `entrada=lead`, `zona=provincia` y `asesor` de una vendedora (salvo el cuadre 9, §6).
5. **Detalle:** cada cifra clicable abre en `GET /panel/detalle` un grupo cuyo `total` y `resumen` coinciden con la cifra, y el Excel del detalle exporta exactamente `total` filas.
6. **Desconocido ≠ cero:** un dato que falta llega en `null`, nunca en `0`.
7. **Sin demo:** en el modo «solo datos reales», la vista conectada no muestra ningún badge Demo; los contratos todavía no conectados siguen diciendo «Pendiente de integración».
8. **Pruebas:** la prueba de reglas de la fuente demo (`**/__tests__/*-demo.test.ts`), adaptada a la fuente real sobre el conjunto de prueba, pasa.

## 7.3 Estado de las pruebas del frontend y fallo conocido ajeno al panel

- `npx tsc --noEmit`: sin errores.
- `npx biome check src/app/panel-control src/components/panel-control src/features/panel-control`: sin hallazgos.
- `npx jest src/app/panel-control src/components/panel-control src/features/panel-control`: 25 suites, 243 pruebas, todas pasan.

**Prueba intermitente conocida (no es del panel ni se modificó):** `src/app/inventario/__tests__/page.test.tsx` › «estado de carga del botón › muestra "Exportando..." y deshabilita el botón…».

- **Causa:** el test simula la exportación con una promesa que se resuelve con un `setTimeout` real de 50 ms y busca el botón «Exportando…» con `findByRole`, que consulta el DOM cada 50 ms. Con la CPU cargada, el estado intermedio puede aparecer y desaparecer entre dos consultas, y el test no lo encuentra (`Unable to find role="button" and name /exportando/i`). El módulo de inventario no importa nada del panel. Las 243 pruebas del panel solo agregan carga en paralelo.
- **Reproducir** (falló 2 de 3 veces en cada serie de la auditoría):
  ```bash
  npx jest src/app/inventario/__tests__/page.test.tsx src/app/panel-control src/components/panel-control src/features/panel-control
  ```
  La suite completa (`npx jest`) también falló 2 de 3 veces en la rama. En cambio, inventario solo (`npx jest src/app/inventario/__tests__/page.test.tsx`) pasó 3 de 3, y la suite sin las pruebas del panel (`npx jest --testPathIgnorePatterns panel-control`) pasó 1175 de 1175.
- **Arreglo sugerido para el responsable de inventario:** controlar la resolución de la promesa desde el test (resolverla manualmente después de comprobar «Exportando…») en lugar de depender de 50 ms reales.

## 8. Estructura

```
src/features/panel-control/
  shared/
    models/    roles, filtros, periodo, consulta, origen de datos, metas, comparación, estados, contratos
    config/    pestañas, permisos por rol, estados, metas por defecto (§11), glosario (§4), mapa vista→contratos
    utils/     hora Lima, periodos (§5.2), formato, semáforo, variación, chips, URL, rol, vista derivada
    data/      mapa tipado contrato→consulta/respuesta, fuentes, registro, descriptores, identidad autorizada
    data/demo/ universo determinista (pedidos, productos, canales, pauta, sesiones), consultas y grupos del
               detalle, movimientos de caja; es la referencia ejecutable de cada regla
    state/     proveedor único del panel (filtros, navegación, rol, modo de datos, detalle)
    hooks/     usePanelContract, usePanelOptions, usePanelExportMeta
  <feature>/   models, contrato(s), sources (resumen, canales, productos, publicidad, clientes-zonas,
               call-center, operaciones, finanzas, equipo, mis-ventas, configuracion, exportacion, detalle)
src/components/panel-control/   componentes reutilizables (KPI, tabla, gráficos con puntos seleccionables, drawer, estados)
src/app/panel-control/           ruta, shell (barra, Excel completo, Compartir) y una vista por pestaña/subpestaña
```

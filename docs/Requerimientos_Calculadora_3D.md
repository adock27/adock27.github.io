# Documento de Requerimientos - Calculadora de Precios 3D (Bambu Lab P1S + AMS)

## 1. Introducción
### 1.1 Propósito
El propósito de este documento es definir los requerimientos funcionales, no funcionales y de interfaz de usuario para la **Calculadora de Precios 3D Pro**, una herramienta web diseñada para estimar los costos y generar cotizaciones precisas de impresión 3D, optimizada para impresoras Bambu Lab P1S con sistema AMS y con moneda configurable.

### 1.2 Alcance
El sistema permitirá a los usuarios (operadores de impresión 3D):
- Crear una cuenta e iniciar sesión, manteniendo aislados los datos de cada usuario.
- Calcular costos operativos (filamento, electricidad, desgaste, recuperación proporcional de la cuota de impresora, mano de obra, mermas/fallos).
- Gestionar materiales y sus propiedades (colores, precio por kg) con soporte multi-color (AMS).
- Administrar costos de insumos extra (imanes, tornillos, empaques).
- Generar cotizaciones estructuradas y listas para compartir con clientes (ej. vía WhatsApp).
- Configurar y guardar preferencias, catálogos, presets, inventario y ventas en Google Sheets mediante Apps Script, con exportación e importación JSON como respaldo manual.
- Gestionar existencias y registrar ventas asociadas a productos del inventario.

## 2. Requerimientos Funcionales (RF)

### RF-1: Gestión de Proyectos y Piezas
- **RF-1.1:** El sistema debe permitir ingresar el nombre del proyecto o pieza.
- **RF-1.2:** El sistema debe permitir ingresar opcionalmente el nombre del cliente.
- **RF-1.3:** El sistema debe permitir definir el tiempo de impresión (horas y minutos).
- **RF-1.4:** El sistema debe permitir registrar el tiempo estimado de mano de obra asociado a la pieza (minutos).
- **RF-1.5:** El sistema debe soportar el cálculo para impresiones por lotes (múltiples piezas por placa), dividiendo los costos totales entre la cantidad de unidades.

### RF-2: Gestión de Materiales y AMS (Automatic Material System)
- **RF-2.1:** El sistema debe proveer una paleta de filamentos guardados en un catálogo.
- **RF-2.2:** El sistema debe permitir asignar filamentos a las ranuras virtuales del AMS mediante una interacción de "Toque y Selección" (Tap-to-select). Al interactuar con una ranura, se desplegará un panel inferior (Bottom Sheet / Offcanvas) con el catálogo para elegir el material, optimizando el espacio y usabilidad en dispositivos móviles.
- **RF-2.3:** El sistema debe permitir registrar la cantidad de gramos (peso) consumidos por cada filamento asignado a una ranura.

### RF-3: Insumos y Extras
- **RF-3.1:** El sistema debe permitir agregar insumos adicionales al cálculo (ej. herrajes, lijas, pegamento).
- **RF-3.2:** El usuario debe poder definir la cantidad utilizada de cada insumo extra seleccionado de un catálogo.

### RF-4: Motor de Cálculo de Costos
- **RF-4.1:** **Costo de Filamento:** Calcular en base a los gramos consumidos por cada material y su respectivo costo por kg.
- **RF-4.2:** **Costo de Electricidad:** Calcular en base al tiempo de impresión, el consumo en kW de la máquina (ej. P1S) y la tarifa eléctrica local expresada en la moneda configurada por kWh.
- **RF-4.3:** **Costo de Desgaste (Amortización):** Calcular multiplicando el tiempo de impresión por una tarifa de desgaste por hora.
- **RF-4.4:** **Costo de Mano de Obra:** Calcular en base a los minutos dedicados (pre y post-procesado) por la tarifa horaria del operador.
- **RF-4.5:** **Costo de Merma/Fallos:** Calcular un porcentaje extra sobre el costo base para cubrir purgas (AMS) y posibles fallos de impresión.
- **RF-4.6:** El sistema debe mostrar el desglose total y unitario (si es impresión en lote) en tiempo real.

### RF-5: Estrategia de Precios y Cotizaciones
- **RF-5.1:** El sistema debe mostrar la base completa de producción, el precio al vendedor con margen bruto configurable del dueño y el precio sugerido al cliente con margen bruto configurable del vendedor.
- **RF-5.1.1:** Los márgenes se expresan sobre cada precio de venta; la cuota mensual de la impresora se distribuye por hora entre las horas productivas facturables estimadas del mes.
- **RF-5.2:** El sistema debe permitir seleccionar un nivel de precio y generar automáticamente un texto de cotización profesional.
- **RF-5.3:** El sistema debe incluir un botón de "Copiar al portapapeles" diseñado para facilitar el envío de la cotización vía WhatsApp.

### RF-6: Configuración y Catálogos (CRUD)
- **RF-6.1:** **Parámetros Máquina:** Modificar moneda, tarifas de electricidad, consumo (kW), desgaste, cuota mensual de impresora, horas productivas estimadas, mano de obra y porcentajes de fallo y márgenes.
- **RF-6.2:** **Catálogo Filamentos:** Crear, leer, actualizar y eliminar (CRUD) tipos de filamentos con su costo por kg.
- **RF-6.3:** **Catálogo Extras:** CRUD de insumos complementarios con su precio unitario.
- **RF-6.4:** **Redondeo:** Configurar reglas de redondeo para precios finales (ej. a los $100 o $500 más cercanos).
- **RF-6.5:** **Exportar/Importar:** Guardar y cargar toda la configuración y catálogos mediante archivos `.json`.

### RF-7: Cuenta y acceso
- **RF-7.1:** El usuario puede crear una cuenta con correo y contraseña e iniciar sesión.
- **RF-7.2:** Las operaciones privadas deben autenticarse con la sesión emitida por Apps Script.
- **RF-7.3:** Los datos de negocio se filtran por el usuario autenticado; una cuenta solo puede consultar y modificar sus propios registros.

### RF-8: Inventario y ventas
- **RF-8.1:** El inventario permite crear, consultar, actualizar y eliminar artículos con categoría, cantidad, unidad, stock mínimo, costo unitario y notas.
- **RF-8.2:** El listado muestra la existencia, el mínimo y el estado. Una cantidad igual a cero se marca como «Agotado»; las cantidades positivas que alcancen el mínimo se marcan como «Stock bajo».
- **RF-8.3:** El formulario de venta selecciona el producto desde el inventario y permite agregar uno nuevo desde el mismo formulario, indicando su existencia inicial.
- **RF-8.4:** Registrar una venta descuenta del inventario la cantidad vendida y guarda el producto, fecha, cliente, cantidad, precio unitario, total, medio de pago y notas.
- **RF-8.5:** Editar una venta ajusta las existencias asociadas; eliminarla devuelve al inventario la cantidad que se había vendido.
- **RF-8.6:** El costo de compra del inventario y el precio de venta son valores independientes.
- **RF-8.7:** El módulo de ventas presenta indicadores mensuales, búsqueda y acciones para editar y eliminar ventas.

### RF-9: Gestión de pedidos
- **RF-9.1:** El usuario puede crear, consultar, editar y eliminar pedidos con número, cliente, fecha, fecha de entrega, producto del inventario o nombre personalizado, cantidad, precio, estado y notas. Un precio unitario de 0 representa un pedido por cotizar.
- **RF-9.2:** Los estados disponibles son pendiente, en producción, listo, entregado y cancelado; el listado permite buscar y filtrar por estado. La vista inicial muestra pedidos activos y el filtro permite consultar el historial.
- **RF-9.3:** Crear un pedido no reserva ni descuenta stock. Al marcarlo como entregado, se crea y enlaza una venta. Si está vinculado al inventario, la conversión valida existencias y descuenta la cantidad. Los pedidos personalizados generan ventas sin stock asociado y pueden agregar opcionalmente el producto al inventario con existencia 0.
- **RF-9.4:** Un pedido ya convertido a venta no puede editarse ni eliminarse desde Pedidos para evitar inconsistencias con el historial de ventas.

## 3. Requerimientos No Funcionales (RNF)

### RNF-1: Usabilidad y Diseño
- La interfaz debe seguir un diseño minimalista, moderno y profesional.
- Se debe utilizar **Bootstrap 5** para garantizar un diseño responsivo (adaptable a móviles y escritorio).
- Uso de iconografía clara (Bootstrap Icons) y fuentes legibles (Inter).
- Interacciones fluidas, priorizando el uso de componentes amigables para móviles (como Bottom Sheets para seleccionar filamentos en lugar de drag-and-drop exclusivo) y retroalimentación visual (toasts) al realizar acciones exitosas o errores.
- En escritorio, el catálogo de filamentos y la lista de ranuras AMS se limitan a 45vh y tienen scroll vertical propio para evitar que muchos elementos alarguen la página. En móviles, el catálogo se muestra en un panel inferior desplazable; la lista de ranuras conserva el flujo normal de la página.
- La sección «Insumos, Herrajes y Extras» debe presentarse como un desplegable inicialmente cerrado para mantener compacta la vista de la calculadora; al abrirlo, muestra los controles de cantidades existentes.
- La moneda de trabajo es configurable (COP, USD, MXN, EUR, PEN, CLP, ARS, BRL, CAD y GBP) y se aplica al resumen, cotizaciones, costos unitarios y catálogos. Cambiar la moneda no convierte los valores guardados; la interfaz debe pedir que se revisen tarifas, filamentos y extras.
- En el primer uso se ofrece un asistente para configurar moneda, electricidad, consumo de máquina, desgaste, mano de obra, márgenes de fallo y purga y redondeo. La configuración se guarda en el backend; si se pospone, se muestra un acceso para retomarla y también se puede editar desde Configuración.

### RNF-2: Rendimiento
- Los cálculos matemáticos deben actualizar la interfaz (resumen económico, gráficas) de manera instantánea (en tiempo real) sin necesidad de recargar la página.

### RNF-3: Persistencia de Datos
- La aplicación usa Google Apps Script como backend y Google Sheets como almacenamiento persistente por usuario.
- Los datos de negocio se guardan en Apps Script/Google Sheets, no en el navegador. Los datos legados del navegador se migran una sola vez al backend en una cuenta vacía. La sesión autenticada se mantiene en `sessionStorage`.

### RNF-4: Mantenibilidad
- El código debe estar modularizado utilizando módulos ES6 (ej. `app.js` como controlador central).
- Separación clara entre estructura (HTML), presentación (CSS) y lógica (JS).

## 4. Requisitos de Interfaz (Wireframes Lógicos)

El sistema se divide en tres vistas principales mediante pestañas (Nav Pills):

1. **Tab 1: Calculadora de Impresión**
   - Panel izquierdo: Entradas de datos (nombre, tiempos, lotes, Selección de Filamentos AMS vía Botones/Bottom Sheet, extras).
   - Panel derecho: Barra de progreso de desglose porcentual, grilla de costos fijos, costo base destacado y sugerencia de precios de venta.

2. **Tab 2: Cotizador para Clientes**
   - Selector de nivel de precio.
   - Previsualización en formato monospaced del mensaje de cotización.
   - Botones de acción: Copiar a WhatsApp, Imprimir/PDF.

3. **Tab 3: Configuración & Catálogos**
   - Formularios de parámetros de máquina y entorno.
   - Tablas de datos para filamentos y extras con acciones de edición/eliminación.
   - Panel de Exportación e Importación de Backups.
4. **Tab 4: Inventario**
   - Resumen de artículos, alertas de stock bajo y valor estimado.
   - Tabla de existencias con búsqueda, edición y eliminación.
5. **Tab 5: Pedidos**
   - Seguimiento de pedidos por estado, fechas, cliente, artículo y valor.
   - Acción para registrar como venta los pedidos listos, validando y descontando el inventario.
6. **Tab 6: Ventas**
   - Indicadores del mes, búsqueda, historial y formulario de registro.
   - Selección de artículos del inventario y alta rápida de un producto desde el formulario de venta.

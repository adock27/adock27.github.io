# Documento de Requerimientos - Calculadora de Precios 3D (Bambu Lab P1S + AMS)

## 1. Introducción
### 1.1 Propósito
El propósito de este documento es definir los requerimientos funcionales, no funcionales y de interfaz de usuario para la **Calculadora de Precios 3D Pro**, una herramienta web diseñada para estimar los costos y generar cotizaciones precisas de impresión 3D, optimizada para impresoras Bambu Lab P1S con sistema AMS y con moneda configurable.

### 1.2 Alcance
El sistema permitirá a los usuarios (operadores de impresión 3D):
- Calcular costos operativos (filamento, electricidad, desgaste, mano de obra, mermas/fallos).
- Gestionar materiales y sus propiedades (colores, precio por kg) con soporte multi-color (AMS).
- Administrar costos de insumos extra (imanes, tornillos, empaques).
- Generar cotizaciones estructuradas y listas para compartir con clientes (ej. vía WhatsApp).
- Configurar y guardar preferencias y catálogos en el navegador o exportarlos como respaldo (JSON).

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
- **RF-5.1:** El sistema debe sugerir diferentes niveles o *tiers* de precios de venta (ej. Amigo, Comercial, Premium) basados en márgenes de ganancia predefinidos sobre el costo base.
- **RF-5.2:** El sistema debe permitir seleccionar un nivel de precio y generar automáticamente un texto de cotización profesional.
- **RF-5.3:** El sistema debe incluir un botón de "Copiar al portapapeles" diseñado para facilitar el envío de la cotización vía WhatsApp.

### RF-6: Configuración y Catálogos (CRUD)
- **RF-6.1:** **Parámetros Máquina:** Modificar moneda, tarifas de electricidad, consumo (kW), desgaste y mano de obra en la moneda elegida, además de porcentajes de fallo.
- **RF-6.2:** **Catálogo Filamentos:** Crear, leer, actualizar y eliminar (CRUD) tipos de filamentos con su costo por kg.
- **RF-6.3:** **Catálogo Extras:** CRUD de insumos complementarios con su precio unitario.
- **RF-6.4:** **Redondeo:** Configurar reglas de redondeo para precios finales (ej. a los $100 o $500 más cercanos).
- **RF-6.5:** **Exportar/Importar:** Guardar y cargar toda la configuración y catálogos mediante archivos `.json`.

## 3. Requerimientos No Funcionales (RNF)

### RNF-1: Usabilidad y Diseño
- La interfaz debe seguir un diseño minimalista, moderno y profesional.
- Se debe utilizar **Bootstrap 5** para garantizar un diseño responsivo (adaptable a móviles y escritorio).
- Uso de iconografía clara (Bootstrap Icons) y fuentes legibles (Inter).
- Interacciones fluidas, priorizando el uso de componentes amigables para móviles (como Bottom Sheets para seleccionar filamentos en lugar de drag-and-drop exclusivo) y retroalimentación visual (toasts) al realizar acciones exitosas o errores.
- En escritorio, el catálogo de filamentos y la lista de ranuras AMS se limitan a 45vh y tienen scroll vertical propio para evitar que muchos elementos alarguen la página. En móviles, el catálogo se muestra en un panel inferior desplazable; la lista de ranuras conserva el flujo normal de la página.
- La sección «Insumos, Herrajes y Extras» debe presentarse como un desplegable inicialmente cerrado para mantener compacta la vista de la calculadora; al abrirlo, muestra los controles de cantidades existentes.
- La moneda de trabajo es configurable (COP, USD, MXN, EUR, PEN, CLP, ARS, BRL, CAD y GBP) y se aplica al resumen, cotizaciones, costos unitarios y catálogos. Cambiar la moneda no convierte los valores guardados; la interfaz debe pedir que se revisen tarifas, filamentos y extras.
- En el primer uso se ofrece un asistente para configurar moneda, electricidad, consumo de máquina, desgaste, mano de obra, márgenes de fallo y purga y redondeo. La configuración se guarda localmente; si se pospone, se muestra un acceso para retomarla y también se puede editar desde Configuración.

### RNF-2: Rendimiento
- Los cálculos matemáticos deben actualizar la interfaz (resumen económico, gráficas) de manera instantánea (en tiempo real) sin necesidad de recargar la página.

### RNF-3: Persistencia de Datos
- La aplicación funcionará del lado del cliente (Client-side).
- Los datos (catálogos, configuraciones, presets) deben persistir localmente en el navegador usando `localStorage` o `IndexedDB` para no perder la información entre sesiones.

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

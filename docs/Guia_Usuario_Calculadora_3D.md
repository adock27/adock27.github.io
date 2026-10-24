# Guía de uso de la Calculadora 3D

La calculadora estima costos de impresión, genera cotizaciones y administra inventario y ventas. La aplicación web usa Google Apps Script y Google Sheets como backend.

## Acceso y datos

1. Abre `calculadora_3d.html` en el sitio publicado.
2. Crea una cuenta o inicia sesión. La contraseña debe tener al menos 8 caracteres.
3. Cada cuenta tiene su propia configuración, materiales, extras, presets, inventario, pedidos y ventas. Las hojas pueden estar en un mismo Google Sheet, pero cada registro pertenece a la cuenta que inició sesión.
4. Observa el indicador del encabezado: muestra cuándo se cargan o guardan datos y si ocurrió un error de conexión. Espera a que indique que se guardó en el backend antes de cerrar la página.

## Calcular e imprimir una cotización

1. En **Calculadora**, ingresa proyecto, cliente opcional, tiempos de impresión y mano de obra.
2. Selecciona uno o varios materiales y asigna los gramos consumidos. Agrega extras si corresponden.
3. Revisa el desglose de costos y los precios sugeridos.
4. En **Cotizador para Clientes**, elige el nivel de precio y copia el mensaje para compartirlo. La impresión del navegador permite guardar la cotización como PDF.
5. Ajusta moneda, consumo de máquina, tarifas, cuota de impresora y márgenes en **Configuración & Catálogos**.

La calculadora presenta tres importes encadenados: **Base de producción** (costo completo del trabajo), **Precio al vendedor** (base más el margen bruto del dueño) y **Precio sugerido al cliente** (precio al vendedor más el margen bruto del vendedor). La cotización para compartir usa por defecto el precio sugerido al cliente. Los márgenes son porcentajes sobre el precio de venta, no recargos sobre el costo.

En Configuración puedes definir la cuota mensual de la impresora y las horas productivas facturables estimadas al mes. La app asigna al trabajo la parte proporcional de esa cuota según sus horas de impresión. Mientras recuperas una deuda de la impresora, configura **Desgaste máquina** como costo de mantenimiento para no contabilizar dos veces la compra; al terminar de pagarla, puedes dejar la cuota en cero y ajustar desgaste para reservar la reposición futura.

Una cotización es una propuesta que se comparte con el cliente; no se convierte automáticamente en un pedido.

## Administrar el inventario

En **Inventario de productos**, usa **Añadir artículo** para registrar productos terminados que fabricas y vendes: nombre, categoría, unidad, existencia inicial, stock mínimo y costo unitario. Los filamentos, resina y demás compras de insumos se registran en **Compras e inversiones**.

El listado muestra todos los artículos. Los de stock crítico aparecen primero:

- **Agotado**: existencia igual a cero.
- **Stock bajo**: existencia positiva igual o menor que el mínimo configurado.
- **Disponible**: existencia por encima del mínimo.

Usa la búsqueda para localizar artículos y los botones de la fila para editar o eliminar.

## Registrar una venta

1. Abre **Ventas** y pulsa **Registrar venta**.
2. Selecciona un producto existente del inventario.
3. Si aún no existe, pulsa **Agregar producto** debajo del selector. Completa el nombre y la existencia inicial; puedes añadir categoría, unidad, mínimo y costo. Pulsa **Agregar y seleccionar** para continuar en el formulario de venta.
4. Indica fecha, cliente, cantidad, precio de venta unitario y medio de pago. El total se calcula automáticamente.
5. Pulsa **Guardar venta**. La cantidad vendida se descuenta del inventario.

Al editar una venta se ajustan las existencias del producto anterior y del nuevo según corresponda. Al eliminar una venta, la cantidad vendida se devuelve al inventario. No se permite vender más unidades de las disponibles.

## Dar seguimiento a pedidos

En **Pedidos**, crea un registro con cliente, producto (del inventario o personalizado), cantidad, precio y fechas. Cada pedido contiene un producto. Si todavía no conoces el precio, déjalo en 0: el pedido aparecerá como **Por cotizar**. Puedes avanzar por los estados **Pendiente**, **En producción** y **Listo**, o marcarlo como **Cancelado**. Al entregar un pedido, la app registra la venta automáticamente. El listado muestra primero los pedidos activos; el filtro **Todos los pedidos** permite consultar también entregados y cancelados.

Crear un pedido no descuenta ni reserva existencias. Al cambiarlo a **Entregado**, la app crea y enlaza su venta. Si el pedido usa un artículo del inventario, valida y descuenta las unidades; si es personalizado, crea la venta sin afectar existencias. En el formulario puedes elegir agregar ese producto personalizado al inventario con existencia 0 para futuras ventas. Los pedidos entregados se conservan en el historial y quedan bloqueados para edición o eliminación, evitando duplicar ventas.

## Registrar compras e inversiones

En **Compras e inversiones**, registra cada desembolso del negocio: equipo, filamentos, otros insumos, mantenimiento y gastos. Para varias compras, usa **Carga masiva** y pega una fila por compra con nombre y valor en columnas separadas; Excel/Sheets y tablas Markdown también se aceptan. Revisa las categorías sugeridas y la fecha común antes de registrar. Las cantidades del nombre como `x 150` o `250G` se detectan cuando es posible; completa las cantidades de filamento que falten y selecciona el material del catálogo. Si no existe, se crea al guardar. El importe pegado se guarda como costo total de compra y el envío separado queda en cero.

Las compras de filamento actualizan el costo promedio por kg que usa la calculadora y suman el stock disponible. Después de completar una impresión, pulsa **Registrar consumo después de imprimir** en la calculadora para descontar sus gramos del stock. Para otros insumos, si no indicas cantidad en la carga masiva se registra el gasto sin saldo controlado; puedes ajustar el saldo desde el registro individual.

El tablero compara el total desembolsado con las ventas registradas y muestra cuánto falta para cubrir esas compras. Para que represente dinero recibido, registra ventas ya cobradas. Este indicador sirve para seguir el flujo acumulado de compras y ventas, no representa utilidad neta. El valor disponible de insumos se presenta por separado porque todavía está en existencias.

## Publicar cambios

Los archivos de la app y los archivos `.gs` del backend se publican por separado:

- **Cambios de interfaz o lógica web:** publica los archivos del sitio, incluidos `calculadora_3d.html` y los módulos `scripts/calculator/` afectados; luego recarga con **Ctrl+F5**.
- **Cambios de Apps Script o de las hojas:** copia todos los `.gs` de `apps_script_crud/` al mismo proyecto. Ejecuta `setupDatabase` si cambió el esquema y publica una nueva versión en **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**.

Al añadir módulos que usan una entidad nueva, actualiza primero Apps Script: copia su archivo `.gs` y el `Database.gs` actualizado, ejecuta `setupDatabase` para crear la hoja correspondiente y publica una nueva versión. Después publica el frontend. La interfaz no podrá cargar esa entidad hasta que la API actualizada esté desplegada.

Consulta [Backend de Apps Script](../apps_script_crud/README.md) para configurar el Sheet, la propiedad `SPREADSHEET_ID`, despliegues y errores comunes. El documento de alcance funcional está en [Requerimientos de la calculadora](Requerimientos_Calculadora_3D.md).

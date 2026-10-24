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
5. Ajusta moneda, consumo de máquina, tarifas y márgenes en **Configuración & Catálogos**.

Una cotización es una propuesta que se comparte con el cliente; no se convierte automáticamente en un pedido.

## Administrar el inventario

En **Inventario**, usa **Añadir artículo** para registrar nombre, categoría, unidad, existencia inicial, stock mínimo y costo unitario. El costo unitario se usa para estimar el valor del inventario; es independiente del precio cobrado en una venta.

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

En **Pedidos**, crea un registro con cliente, producto (del inventario o personalizado), cantidad, precio y fechas. Cada pedido contiene un producto. Si todavía no conoces el precio, déjalo en 0: el pedido aparecerá como **Por cotizar**. Puedes avanzar por los estados **Pendiente**, **En producción** y **Listo**, o marcarlo como **Cancelado**. El listado permite buscar pedidos y filtrar por estado.

Crear un pedido no descuenta ni reserva existencias. Cuando el pedido está **Listo** y usa un artículo del inventario, puedes registrarlo como venta: la app comprueba las unidades, descuenta el stock, crea la venta y enlaza ambos registros. Para un producto personalizado sin inventario, cambia el estado manualmente a **Entregado** cuando corresponda; ese pedido no descuenta stock ni crea una venta automáticamente. Los pedidos enlazados a una venta quedan bloqueados para edición o eliminación.

## Publicar cambios

Los archivos de la app y los archivos `.gs` del backend se publican por separado:

- **Cambios de interfaz o lógica web:** publica los archivos del sitio, incluidos `calculadora_3d.html` y los módulos `scripts/calculator/` afectados; luego recarga con **Ctrl+F5**.
- **Cambios de Apps Script o de las hojas:** copia todos los `.gs` de `apps_script_crud/` al mismo proyecto. Ejecuta `setupDatabase` si cambió el esquema y publica una nueva versión en **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**.

Al añadir el módulo **Pedidos**, actualiza primero Apps Script: copia `Pedidos.gs` y el `Database.gs` actualizado, ejecuta `setupDatabase` para crear la hoja `Pedidos` y publica una nueva versión. Después publica el frontend. Si la nueva interfaz se publica antes que el backend, fallará la carga porque la API aún no reconoce la entidad `pedidos`.

Consulta [Backend de Apps Script](../apps_script_crud/README.md) para configurar el Sheet, la propiedad `SPREADSHEET_ID`, despliegues y errores comunes. El documento de alcance funcional está en [Requerimientos de la calculadora](Requerimientos_Calculadora_3D.md).

# Backend para Calculadora 3D (Google Apps Script)

Archivos `.gs` listos para copiar al mismo proyecto de Apps Script. Cada archivo corresponde a una parte del CRUD; Apps Script los combina en un único espacio global.

Para el flujo de uso de la aplicación, consulta la [Guía de usuario](../docs/Guia_Usuario_Calculadora_3D.md). El [Documento de requerimientos](../docs/Requerimientos_Calculadora_3D.md) describe el alcance funcional.

## Configuración

1. Crea una hoja de cálculo de Google.
2. En Apps Script abre **Configuración del proyecto → Propiedades del script** y agrega `SPREADSHEET_ID` con el ID de esa hoja (la parte entre `/d/` y `/edit` en su URL).
3. Copia todos los archivos `.gs` de esta carpeta a un proyecto de Apps Script vinculado o independiente. No copies este README.
4. Ejecuta `setupDatabase` desde el editor y concede permisos. Crea las pestañas y encabezados necesarios. Al actualizar desde una versión anterior, usa el `Database.gs` actual y vuelve a ejecutar esta función: completa encabezados y repara filas de ventas reconocidas con las columnas desplazadas por la antigua posición de `inventoryId`.
5. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como tú. Selecciona quién puede acceder según tu caso y usa la URL `/exec`.

La API recibe JSON por `POST`, con `entity` y `action`. Todas las respuestas usan `{ "ok": true, "data": ... }` o `{ "ok": false, "error": "..." }`.

## Entidades y acciones

| `entity` | Hoja | Acciones |
|---|---|---|
| `usuarios` | Usuarios | `create`, `login`, `me`, `list`, `createuser`, `setrole`, `setactive`, `resetpassword`, `delete` |
| `materiales` | Materiales | `create`, `list`, `get`, `update`, `delete` |
| `extras` | Extras | `create`, `list`, `get`, `update`, `delete` |
| `presets` | Presets | `create`, `list`, `get`, `update`, `delete` |
| `configuracion` | Configuracion | `get`, `save`, `delete` |
| `cotizaciones` | Cotizaciones | `create`, `list`, `get`, `update`, `delete` |
| `inventario` | Inventario | `create`, `list`, `get`, `update`, `delete` |
| `ventas` | Ventas | `create`, `list`, `get`, `update`, `delete` |
| `pedidos` | Pedidos | `create`, `list`, `get`, `update`, `delete` |
| `compras` | Compras | `create`, `list`, `get`, `update`, `delete` |

Campos `id`, `createdAt` y `updatedAt` se generan automáticamente cuando corresponda. `create` y `login` son las únicas acciones públicas; la primera cuenta queda como administrador y el registro público se cierra después. El administrador crea las cuentas de empleados desde **Usuarios**. Todas las cuentas del negocio comparten los datos mediante el `businessId` del administrador; los demás negocios siguen aislados. Ejecuta `setupDatabase` para agregar columnas de roles, migrar las cuentas existentes como administradores de sus propios datos y generar `AUTH_SECRET`.

Los registros de negocio incluyen `createdBy` (ID de cuenta) y `createdByEmail` (correo del creador). Al desplegar estos campos, ejecuta `setupDatabase`: los datos antiguos se atribuyen a la cuenta cuyo ID coincide con el `userId` del registro. En ventas, pedidos y cotizaciones, un empleado solo puede editar o borrar registros creados por su cuenta; un administrador puede gestionar todos los del negocio. Los productos de `Inventario` incluyen `productType`: `stock` controla existencias y `on_demand` identifica productos que se fabrican al recibir una venta. Los registros existentes se interpretan como `stock`.

### Roles y permisos

- **Administrador:** acceso a todos los módulos, compras e inversiones, configuración, catálogos y administración de usuarios.
- **Empleado:** acceso a Calculadora, Cotizador, Inventario de productos, Pedidos y Ventas. Puede consultar existencias y registrar operaciones; en ventas, pedidos y cotizaciones solo puede editar o borrar los registros que creó. No ve costos unitarios del inventario, no administra catálogo/configuración y no accede a compras ni cuentas.
- El backend valida el rol en cada petición. El personal puede actualizar cantidades de inventario para reflejar ventas, pero no crear ni eliminar artículos. La configuración y los catálogos son de solo lectura para que la calculadora y el cotizador puedan funcionar.

El administrador crea cuentas con una contraseña temporal desde **Usuarios** y puede cambiar roles, activar/desactivar cuentas, restablecer contraseñas o eliminar empleados. Cambiar o desactivar una cuenta surte efecto en su siguiente petición autenticada. Conserva al menos un administrador activo por negocio.

## Ejemplos

Crear usuario (la contraseña se guarda como hash con salt):

```json
{"entity":"usuarios","action":"create","email":"ana@example.com","password":"UnaClaveLarga"}
```

Iniciar sesión:

```json
{"entity":"usuarios","action":"login","email":"ana@example.com","password":"UnaClaveLarga"}
```

Crear material con los campos compatibles con `storage.js` (requiere un token de sesión):

```json
{"entity":"materiales","action":"create","token":"TOKEN_DE_SESION","name":"PLA mate","pricePerKg":60000,"color":"#10b981","note":"Acabado mate"}
```

Tras iniciar sesión, las llamadas privadas deben incluir el `sessionToken` devuelto como `token`; la API obtiene el usuario desde ese token. Leer una entidad por ID requiere `id`. Configuración guarda el objeto enviado en `data`:

```json
{"entity":"configuracion","action":"save","token":"TOKEN_DE_SESION","data":{"currency":"COP","powerKw":0.12,"materials":[],"extrasCatalog":[],"pricingTiers":[]}}
```

El módulo de ventas guarda el ID del artículo de inventario, fecha, nombre del producto (copia legible), cliente, cantidad, precio de venta unitario, total, medio de pago y notas. El precio de venta no se toma del costo unitario del inventario. La interfaz descuenta las existencias al registrar una venta; al editar ajusta el stock y al eliminar devuelve la cantidad vendida.

```json
{"entity":"ventas","action":"create","token":"TOKEN_DE_SESION","inventoryId":"ID_DEL_ARTICULO","date":"2026-10-23","productName":"Llavero personalizado","clientName":"Ana","quantity":2,"unitPrice":12000,"total":24000,"paymentMethod":"Transferencia","notes":"Pago recibido"}
```

Los pedidos se guardan por usuario con número, fechas, producto del inventario o nombre personalizado, cliente, cantidad, precio, estado y notas. Un precio unitario de `0` se muestra como `Por cotizar`. Crear el pedido no cambia existencias. Al marcarlo como `Entregado`, la interfaz registra y enlaza la venta automáticamente. Si usa inventario, valida y descuenta stock; si es personalizado, registra la venta sin stock asociado y permite agregar el producto al inventario con existencia `0`.

```json
{"entity":"pedidos","action":"create","token":"TOKEN_DE_SESION","orderNumber":"PED-12345678","inventoryId":"ID_DEL_ARTICULO","date":"2026-10-24","dueDate":"2026-10-30","productName":"Llavero personalizado","clientName":"Ana","quantity":2,"unitPrice":12000,"total":24000,"status":"Pendiente","paymentMethod":"Transferencia","notes":"Color azul"}
```

Las compras e inversiones registran el desembolso total (valor de compra más envío), su tipo y, para insumos, la cantidad comprada y el saldo disponible. Las compras de filamento se vinculan al `materialId` del catálogo:

```json
{"entity":"compras","action":"create","token":"TOKEN_DE_SESION","date":"2026-10-24","type":"filamento","itemName":"PLA Estándar","materialId":"ID_DEL_MATERIAL","quantity":1,"unit":"kg","purchaseCost":55000,"shippingCost":5000,"totalCost":60000,"remainingQuantity":1,"supplier":"Proveedor","paymentMethod":"Transferencia","notes":"Color negro"}
```

## Conexión con el frontend

La calculadora carga y guarda configuración, materiales, extras, presets, inventario, compras e inversiones, pedidos y ventas directamente en Apps Script. El formulario de ventas selecciona un artículo existente y permite crear uno rápidamente en el inventario. `sessionStorage` solo mantiene el token de acceso de la sesión. Al primer acceso, la app puede migrar datos legados de `localStorage` a una cuenta vacía y luego elimina esas claves; el uso normal no persiste datos de negocio en el navegador. El indicador de sincronización de la app muestra cargas, guardados y errores. Los cambios se reflejan primero en la sesión y se sincronizan de forma asíncrona; si el indicador muestra un error, verifica la conexión y vuelve a cargar desde el backend antes de dar el cambio por guardado.

Después de copiar o actualizar los archivos `.gs`, guarda el proyecto y ejecuta `setupDatabase` si cambió el esquema. Para activar roles, actualiza `Database.gs`, `Usuarios.gs` y `CrudUtils.gs`, ejecuta `setupDatabase` para agregar columnas y migrar usuarios existentes, y publica una **nueva versión** de la aplicación web antes de publicar el frontend. Las cuentas existentes se migran como administradores de su espacio. El primer registro público después de una instalación nueva crea el administrador inicial; las cuentas posteriores las crea el administrador desde la app.

## Solución de problemas

| Mensaje | Qué revisar |
|---|---|
| `handleConfig_ is not defined`, `handleInventory_ is not defined`, `handlePurchases_ is not defined` u otra función no definida | Confirma que copiaste todos los archivos `.gs` al mismo proyecto y publica una nueva versión de la implementación que usa el frontend. |
| La venta se registra, pero el stock no cambia al volver a cargar | Revisa el indicador de sincronización y la pestaña `Inventario` en Sheets. Confirma que el frontend actualizado está publicado y que la hoja pertenece al `SPREADSHEET_ID` configurado. |
| Fecha o campos de ventas aparecen en columnas incorrectas | Actualiza `Database.gs` y ejecuta `setupDatabase`; esa versión conserva el orden físico de columnas y repara filas detectables con el antiguo desplazamiento. |
| No aparece la alerta de stock bajo | Define el mínimo del artículo. Una existencia igual a cero se muestra como `Agotado`; una existencia positiva se marca `Stock bajo` cuando llega al mínimo configurado. |

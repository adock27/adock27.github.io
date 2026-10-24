# Backend para Calculadora 3D (Google Apps Script)

Archivos `.gs` listos para copiar al mismo proyecto de Apps Script. Cada archivo corresponde a una parte del CRUD; Apps Script los combina en un único espacio global.

## Configuración

1. Crea una hoja de cálculo de Google.
2. En Apps Script abre **Configuración del proyecto → Propiedades del script** y agrega `SPREADSHEET_ID` con el ID de esa hoja (la parte entre `/d/` y `/edit` en su URL).
3. Copia todos los archivos `.gs` de esta carpeta a un proyecto de Apps Script vinculado o independiente. No copies este README.
4. Ejecuta `setupDatabase` desde el editor y concede permisos. Crea las pestañas y encabezados necesarios.
5. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como tú. Selecciona quién puede acceder según tu caso y usa la URL `/exec`.

La API recibe JSON por `POST`, con `entity` y `action`. Todas las respuestas usan `{ "ok": true, "data": ... }` o `{ "ok": false, "error": "..." }`.

## Entidades y acciones

| `entity` | Hoja | Acciones |
|---|---|---|
| `usuarios` | Usuarios | `create`, `get`, `update`, `delete`, `login` |
| `materiales` | Materiales | `create`, `list`, `get`, `update`, `delete` |
| `extras` | Extras | `create`, `list`, `get`, `update`, `delete` |
| `presets` | Presets | `create`, `list`, `get`, `update`, `delete` |
| `configuracion` | Configuracion | `get`, `save`, `delete` |
| `cotizaciones` | Cotizaciones | `create`, `list`, `get`, `update`, `delete` |
| `inventario` | Inventario | `create`, `list`, `get`, `update`, `delete` |

Campos `id`, `createdAt` y `updatedAt` se generan automáticamente cuando corresponda. `create` y `login` son operaciones públicas; las demás requieren el token firmado que devuelve `login`. Los datos de calculadora se limitan al usuario autenticado. Ejecuta `setupDatabase` después de agregar estos archivos para generar `AUTH_SECRET` en las propiedades del script.

## Ejemplos

Crear usuario (la contraseña se guarda como hash con salt):

```json
{"entity":"usuarios","action":"create","email":"ana@example.com","password":"UnaClaveLarga"}
```

Iniciar sesión:

```json
{"entity":"usuarios","action":"login","email":"ana@example.com","password":"UnaClaveLarga"}
```

Crear material con los campos compatibles con `storage.js`:

```json
{"entity":"materiales","action":"create","userId":"ID_USUARIO","name":"PLA mate","pricePerKg":60000,"color":"#10b981","note":"Acabado mate"}
```

Tras iniciar sesión, las llamadas privadas deben incluir el `sessionToken` devuelto como `token`; la API obtiene el usuario desde ese token. Leer una entidad por ID requiere `id`. Configuración guarda el objeto enviado en `data`:

```json
{"entity":"configuracion","action":"save","token":"TOKEN_DE_SESION","data":{"currency":"COP","powerKw":0.12,"materials":[],"extrasCatalog":[],"pricingTiers":[]}}
```

## Conexión con el frontend

La calculadora ahora usa `scripts/calculator/api-sync.js` para cargar configuración, materiales, extras, presets e inventario desde Apps Script y sincronizar cambios. Allí se configura `API_URL`; sustituye su valor por la URL `/exec` de tu implementación si cambia. El frontend conserva `localStorage` como respaldo.

Después de copiar o actualizar los archivos `.gs`, crea una **nueva versión** de la aplicación web. Luego publica los cambios del frontend en tu sitio. Los cambios de la API no estarán activos en la URL `/exec` hasta actualizar la implementación.

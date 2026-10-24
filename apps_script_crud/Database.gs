/** Inicializa las hojas necesarias. Ejecutar manualmente una vez. */
function setupDatabase() {
  var ss = getSpreadsheet_();
  var properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('AUTH_SECRET')) properties.setProperty('AUTH_SECRET', Utilities.getUuid() + Utilities.getUuid());
  Object.keys(DB_SCHEMAS).forEach(function (name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = DB_SCHEMAS[name];
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    else {
      var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
      headers.forEach(function (header) {
        if (existing.indexOf(header) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          existing.push(header);
        }
      });
    }
    sheet.setFrozenRows(1);
  });
  migrateUserRoles_();
  repairMisalignedSalesRows_(ss.getSheetByName('Ventas'));
  return 'Base de datos lista';
}

var DB_SCHEMAS = {
  Usuarios: ['id', 'email', 'passwordHash', 'salt', 'role', 'businessId', 'active', 'createdAt', 'updatedAt'],
  Materiales: ['id', 'userId', 'name', 'pricePerKg', 'color', 'note', 'createdAt', 'updatedAt'],
  Extras: ['id', 'userId', 'name', 'defaultCost', 'category', 'createdAt', 'updatedAt'],
  Presets: ['id', 'userId', 'name', 'description', 'materialId', 'grams', 'hours', 'minutes', 'laborMinutes', 'extrasJson', 'createdAt', 'updatedAt'],
  Configuracion: ['id', 'userId', 'dataJson', 'createdAt', 'updatedAt'],
  Cotizaciones: ['id', 'userId', 'projectName', 'clientName', 'payloadJson', 'createdAt', 'updatedAt'],
  Inventario: ['id', 'userId', 'name', 'category', 'quantity', 'unit', 'minQuantity', 'unitCost', 'notes', 'createdAt', 'updatedAt'],
  Ventas: ['id', 'userId', 'date', 'productName', 'clientName', 'quantity', 'unitPrice', 'total', 'paymentMethod', 'notes', 'createdAt', 'updatedAt', 'inventoryId'],
  Pedidos: ['id', 'userId', 'orderNumber', 'inventoryId', 'date', 'dueDate', 'productName', 'clientName', 'quantity', 'unitPrice', 'total', 'status', 'paymentMethod', 'notes', 'saleId', 'createdAt', 'updatedAt'],
  Compras: ['id', 'userId', 'date', 'type', 'itemName', 'materialId', 'quantity', 'unit', 'purchaseCost', 'shippingCost', 'totalCost', 'remainingQuantity', 'supplier', 'paymentMethod', 'notes', 'createdAt', 'updatedAt']
};

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Configura la propiedad del script SPREADSHEET_ID.');
  return SpreadsheetApp.openById(id);
}

function sheetFor_(name) {
  var schema = DB_SCHEMAS[name];
  if (!schema) throw new Error('Entidad no válida.');
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Falta la hoja ' + name + '. Ejecuta setupDatabase.');
  return sheet;
}

function rowsFor_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function (row, index) {
    var item = { _row: index + 2 };
    headers.forEach(function (key, col) { item[key] = row[col]; });
    return item;
  }).filter(function (item) { return item.id !== '' && item.id != null; });
}

function appendRecord_(sheetName, record) {
  var sheet = sheetFor_(sheetName), headers = sheetHeaders_(sheet);
  var now = new Date().toISOString();
  record.id = record.id || Utilities.getUuid();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  sheet.appendRow(headers.map(function (key) { return record[key] == null ? '' : record[key]; }));
  return record;
}

function writeRecord_(sheetName, rowNumber, record) {
  var sheet = sheetFor_(sheetName), headers = sheetHeaders_(sheet);
  record.updatedAt = new Date().toISOString();
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function (key) {
    return record[key] == null ? '' : record[key];
  })]);
  return record;
}

function sheetHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

/** Repara filas creadas mientras inventoryId estaba insertado en medio del esquema lógico. */
function repairMisalignedSalesRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return;
  var headers = sheetHeaders_(sheet);
  var dateCol = headers.indexOf('date'), productCol = headers.indexOf('productName'), inventoryCol = headers.indexOf('inventoryId');
  if (dateCol < 0 || productCol !== dateCol + 1 || inventoryCol <= dateCol) return;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var repaired = false;
  values.forEach(function (row) {
    var dateValue = row[dateCol], productValue = row[productCol];
    var nextCellLooksLikeDate = productValue instanceof Date || /^\d{4}-\d{2}-\d{2}$/.test(String(productValue || ''));
    var dateCellLooksShifted = dateValue === '' || dateValue == null || /^[\w-]{8,}$/.test(String(dateValue));
    if (!nextCellLooksLikeDate || !dateCellLooksShifted) return;
    var original = row.slice();
    for (var col = dateCol; col < inventoryCol; col++) row[col] = original[col + 1];
    row[inventoryCol] = original[dateCol];
    repaired = true;
  });
  if (repaired) sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function publicRecord_(sheetName, record) {
  var output = {};
  Object.keys(record).forEach(function (key) {
    if (key.charAt(0) !== '_' && key !== 'passwordHash' && key !== 'salt' && key !== 'dataJson' && key !== 'payloadJson' && key !== 'extrasJson') {
      output[key] = (sheetName === 'Ventas' || sheetName === 'Compras') && key === 'date' && record[key] instanceof Date
        ? Utilities.formatDate(record[key], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : record[key];
    }
  });
  if (record.dataJson) output.data = parseJson_(record.dataJson, {});
  if (record.payloadJson) output.data = parseJson_(record.payloadJson, {});
  if (record.extrasJson) output.extras = parseJson_(record.extrasJson, []);
  return output;
}

function parseJson_(value, fallback) {
  try { return JSON.parse(value); } catch (e) { return fallback; }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    var entity = String(body.entity || '').toLowerCase();
    var result;
    var auth = null;
    if (entity === 'usuarios' && ['create', 'login'].indexOf(String(body.action || '').toLowerCase()) === -1) {
      auth = authenticateRequest_(body);
      body.authUser = auth;
      body.userId = auth.id;
    } else if (entity !== 'usuarios') {
      auth = authenticateRequest_(body);
      body.authRole = auth.role;
      body.userId = auth.businessId;
      authorizeEntityRequest_(auth, entity, String(body.action || '').toLowerCase());
    }
    if (entity === 'usuarios') result = handleUsers_(body);
    else if (entity === 'materiales') result = handleMaterials_(body);
    else if (entity === 'extras') result = handleExtras_(body);
    else if (entity === 'presets') result = handlePresets_(body);
    else if (entity === 'configuracion') result = handleConfig_(body);
    else if (entity === 'cotizaciones') result = handleQuotes_(body);
    else if (entity === 'inventario') result = handleInventory_(body);
    else if (entity === 'ventas') result = handleSales_(body);
    else if (entity === 'pedidos') result = handleOrders_(body);
    else if (entity === 'compras') result = handlePurchases_(body);
    else throw new Error('Entidad inválida.');
    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || 'Error procesando solicitud.' });
  }
}

function issueSessionToken_(userId) {
  var expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  var payload = String(userId) + '|' + expiresAt;
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  var signature = Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8) + '.' + Utilities.base64EncodeWebSafe(signature);
}

function authenticateRequest_(body) {
  var token = String(body.token || ''), parts = token.split('.');
  if (parts.length !== 2) throw new Error('Sesión no válida. Inicia sesión de nuevo.');
  var payload;
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); }
  catch (e) { throw new Error('Sesión no válida. Inicia sesión de nuevo.'); }
  var values = payload.split('|'), userId = values[0], expiresAt = Number(values[1]);
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  var signature = Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8);
  if (!userId || !expiresAt || Date.now() > expiresAt || Utilities.base64EncodeWebSafe(signature) !== parts[1]) {
    throw new Error('Sesión vencida o no válida. Inicia sesión de nuevo.');
  }
  var user = rowsFor_(sheetFor_('Usuarios')).filter(function (row) { return String(row.id) === userId; })[0];
  if (!user) throw new Error('La cuenta ya no existe.');
  if (user.active === false || String(user.active).toLowerCase() === 'false') throw new Error('La cuenta está desactivada.');
  return { id: userId, email: user.email, role: user.role || 'admin', businessId: user.businessId || user.id };
}

function migrateUserRoles_() {
  var sheet = sheetFor_('Usuarios'), users = rowsFor_(sheet);
  users.forEach(function (user) {
    var changed = false;
    if (!user.role) { user.role = 'admin'; changed = true; }
    if (!user.businessId) { user.businessId = user.id; changed = true; }
    if (user.active === '' || user.active == null) { user.active = true; changed = true; }
    if (changed) writeRecord_('Usuarios', user._row, user);
  });
}

function authorizeEntityRequest_(auth, entity, action) {
  if (auth.role === 'admin') return;
  var readOnly = ['list', 'get'];
  var allowedReadEntities = ['configuracion', 'materiales', 'extras', 'presets', 'inventario'];
  var allowedWriteEntities = ['cotizaciones', 'ventas', 'pedidos'];
  if (allowedReadEntities.indexOf(entity) !== -1 && readOnly.indexOf(action) !== -1) return;
  if (allowedWriteEntities.indexOf(entity) !== -1 && ['list', 'get', 'create', 'update', 'delete'].indexOf(action) !== -1) return;
  if (entity === 'inventario' && action === 'update') return; // el CRUD solo permite modificar quantity en CrudUtils_.
  throw new Error('Tu rol no tiene permiso para esta acción.');
}

function doGet() {
  return jsonResponse_({ ok: true, message: 'API de Calculadora 3D activa. Envía solicitudes POST en formato JSON.' });
}

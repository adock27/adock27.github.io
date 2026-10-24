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
  return 'Base de datos lista';
}

var DB_SCHEMAS = {
  Usuarios: ['id', 'email', 'passwordHash', 'salt', 'createdAt', 'updatedAt'],
  Materiales: ['id', 'userId', 'name', 'pricePerKg', 'color', 'note', 'createdAt', 'updatedAt'],
  Extras: ['id', 'userId', 'name', 'defaultCost', 'category', 'createdAt', 'updatedAt'],
  Presets: ['id', 'userId', 'name', 'description', 'materialId', 'grams', 'hours', 'minutes', 'laborMinutes', 'extrasJson', 'createdAt', 'updatedAt'],
  Configuracion: ['id', 'userId', 'dataJson', 'createdAt', 'updatedAt'],
  Cotizaciones: ['id', 'userId', 'projectName', 'clientName', 'payloadJson', 'createdAt', 'updatedAt'],
  Inventario: ['id', 'userId', 'name', 'category', 'quantity', 'unit', 'minQuantity', 'unitCost', 'notes', 'createdAt', 'updatedAt']
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
  var sheet = sheetFor_(sheetName), headers = DB_SCHEMAS[sheetName];
  var now = new Date().toISOString();
  record.id = record.id || Utilities.getUuid();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  sheet.appendRow(headers.map(function (key) { return record[key] == null ? '' : record[key]; }));
  return record;
}

function writeRecord_(sheetName, rowNumber, record) {
  var sheet = sheetFor_(sheetName), headers = DB_SCHEMAS[sheetName];
  record.updatedAt = new Date().toISOString();
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function (key) {
    return record[key] == null ? '' : record[key];
  })]);
  return record;
}

function publicRecord_(sheetName, record) {
  var output = {};
  Object.keys(record).forEach(function (key) {
    if (key.charAt(0) !== '_' && key !== 'passwordHash' && key !== 'salt' && key !== 'dataJson' && key !== 'payloadJson' && key !== 'extrasJson') output[key] = record[key];
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
    if (entity === 'usuarios' && ['create', 'login'].indexOf(String(body.action || '').toLowerCase()) === -1) {
      body.userId = authenticateRequest_(body).id;
    } else if (entity !== 'usuarios') {
      body.userId = authenticateRequest_(body).id;
    }
    if (entity === 'usuarios') result = handleUsers_(body);
    else if (entity === 'materiales') result = handleMaterials_(body);
    else if (entity === 'extras') result = handleExtras_(body);
    else if (entity === 'presets') result = handlePresets_(body);
    else if (entity === 'configuracion') result = handleConfig_(body);
    else if (entity === 'cotizaciones') result = handleQuotes_(body);
    else if (entity === 'inventario') result = handleInventory_(body);
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
  return { id: userId, email: user.email };
}

function doGet() {
  return jsonResponse_({ ok: true, message: 'API de Calculadora 3D activa. Envía solicitudes POST en formato JSON.' });
}

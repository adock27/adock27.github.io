/** Funciones compartidas para CRUDs de entidades con ID. */
function genericCrud_(sheetName, body, fields, normalize) {
  var sheet = sheetFor_(sheetName), rows = rowsFor_(sheet);
  var action = String(body.action || '').toLowerCase();
  var userId = String(body.userId || '');
  var allowedFields = fields;
  function owned(r) { return String(r.userId || '') === userId; }
  if (sheetName === 'Inventario' && body.authRole === 'employee') {
    if (action === 'update') allowedFields = ['quantity'];
    else if (action === 'create' || action === 'delete') throw new Error('El personal no puede crear ni eliminar artículos del inventario.');
  }
  if (action === 'list') return rows.filter(owned).map(function (r) { return safeCrudRecord_(sheetName, r, body); });
  var found = rows.filter(function (r) { return String(r.id) === String(body.id || '') && owned(r); })[0];
  if (action === 'get') {
    if (!found) throw new Error('Registro no encontrado.');
    return safeCrudRecord_(sheetName, found, body);
  }
  if (action === 'create') {
    var record = { id: body.id || undefined, userId: userId };
    allowedFields.forEach(function (key) { if (body[key] != null) record[key] = body[key]; });
    if (normalize) normalize(record);
    return publicRecord_(sheetName, appendRecord_(sheetName, record));
  }
  if (action === 'update') {
    if (!found) throw new Error('Registro no encontrado.');
    allowedFields.forEach(function (key) { if (body[key] != null) found[key] = body[key]; });
    if (normalize) normalize(found);
    return publicRecord_(sheetName, writeRecord_(sheetName, found._row, found));
  }
  if (action === 'delete') {
    if (!found) throw new Error('Registro no encontrado.');
    sheet.deleteRow(found._row);
    return { id: found.id, message: 'Registro eliminado.' };
  }
  throw new Error('Acción no válida.');
}

function safeCrudRecord_(sheetName, record, body) {
  var output = publicRecord_(sheetName, record);
  if (sheetName === 'Inventario' && body.authRole === 'employee') delete output.unitCost;
  return output;
}

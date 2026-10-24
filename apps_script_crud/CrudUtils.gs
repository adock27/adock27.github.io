/** Funciones compartidas para CRUDs de entidades con ID. */
function genericCrud_(sheetName, body, fields, normalize) {
  var sheet = sheetFor_(sheetName), rows = rowsFor_(sheet);
  var action = String(body.action || '').toLowerCase();
  var userId = String(body.userId || '');
  function owned(r) { return String(r.userId || '') === userId; }
  if (action === 'list') return rows.filter(owned).map(function (r) { return publicRecord_(sheetName, r); });
  var found = rows.filter(function (r) { return String(r.id) === String(body.id || '') && owned(r); })[0];
  if (action === 'get') {
    if (!found) throw new Error('Registro no encontrado.');
    return publicRecord_(sheetName, found);
  }
  if (action === 'create') {
    var record = { id: body.id || undefined, userId: userId };
    fields.forEach(function (key) { if (body[key] != null) record[key] = body[key]; });
    if (normalize) normalize(record);
    return publicRecord_(sheetName, appendRecord_(sheetName, record));
  }
  if (action === 'update') {
    if (!found) throw new Error('Registro no encontrado.');
    fields.forEach(function (key) { if (body[key] != null) found[key] = body[key]; });
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

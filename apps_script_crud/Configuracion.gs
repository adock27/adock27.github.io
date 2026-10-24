/** Guarda una configuración completa por usuario (objeto en el campo data). */
function handleConfig_(body) {
  var sheet = sheetFor_('Configuracion'), rows = rowsFor_(sheet);
  var userId = String(body.userId || 'default');
  var found = rows.filter(function (r) { return String(r.userId) === userId; })[0];
  var action = String(body.action || '').toLowerCase();
  if (action === 'get') return found ? publicRecord_('Configuracion', found) : null;
  if (action === 'save') {
    if (!body.data || typeof body.data !== 'object') throw new Error('data debe ser un objeto de configuración.');
    var record = { id: found ? found.id : Utilities.getUuid(), userId: userId, dataJson: JSON.stringify(body.data), createdAt: found ? found.createdAt : undefined, createdBy: found ? (found.createdBy || body.authUserId) : body.authUserId, createdByEmail: found ? (found.createdByEmail || body.authUserEmail) : body.authUserEmail };
    record = found ? writeRecord_('Configuracion', found._row, record) : appendRecord_('Configuracion', record);
    return publicRecord_('Configuracion', record);
  }
  if (action === 'delete') {
    if (!found) throw new Error('Configuración no encontrada.');
    sheet.deleteRow(found._row);
    return { id: found.id, message: 'Configuración eliminada.' };
  }
  throw new Error('Acción no válida para configuración.');
}

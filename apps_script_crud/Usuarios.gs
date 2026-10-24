/** CRUD usuarios y autenticación. Nunca devuelve hash, salt ni contraseña. */
function handleUsers_(body) {
  var action = String(body.action || '').toLowerCase();
  var sheet = sheetFor_('Usuarios'), rows = rowsFor_(sheet);
  var email = String(body.email || '').trim().toLowerCase();
  if (action === 'create') {
    if (!email || !body.password) throw new Error('email y password son obligatorios.');
    if (rows.some(function (r) { return String(r.email).toLowerCase() === email; })) throw new Error('Ese email ya está registrado.');
    var salt = Utilities.getUuid();
    return publicRecord_('Usuarios', appendRecord_('Usuarios', { email: email, salt: salt, passwordHash: passwordHash_(body.password, salt) }));
  }
  if (action === 'login') {
    var user = rows.filter(function (r) { return String(r.email).toLowerCase() === email; })[0];
    if (!user || passwordHash_(body.password || '', user.salt) !== user.passwordHash) throw new Error('Email o contraseña incorrectos.');
    var output = publicRecord_('Usuarios', user);
    output.sessionToken = issueSessionToken_(user.id);
    return output;
  }
  if (action === 'list') throw new Error('La lista de usuarios no está disponible.');
  var found = rows.filter(function (r) { return String(r.id) === String(body.id || ''); })[0];
  if (found && String(found.id) !== String(body.userId || '')) throw new Error('No autorizado.');
  if (action === 'get') {
    if (!found) throw new Error('Usuario no encontrado.');
    return publicRecord_('Usuarios', found);
  }
  if (action === 'update') {
    if (!found) throw new Error('Usuario no encontrado.');
    var nextEmail = String(body.email || found.email).trim().toLowerCase();
    if (rows.some(function (r) { return r.id !== found.id && String(r.email).toLowerCase() === nextEmail; })) throw new Error('Ese email ya está registrado.');
    found.email = nextEmail;
    if (body.password) { found.salt = Utilities.getUuid(); found.passwordHash = passwordHash_(body.password, found.salt); }
    return publicRecord_('Usuarios', writeRecord_('Usuarios', found._row, found));
  }
  if (action === 'delete') {
    if (!found) throw new Error('Usuario no encontrado.');
    sheet.deleteRow(found._row);
    return { id: found.id, message: 'Usuario eliminado.' };
  }
  throw new Error('Acción no válida para usuarios.');
}

function passwordHash_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

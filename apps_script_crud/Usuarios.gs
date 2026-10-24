/** Usuarios, inicio de sesión y administración de miembros del negocio. */
function handleUsers_(body) {
  var action = String(body.action || '').toLowerCase();
  var sheet = sheetFor_('Usuarios'), rows = rowsFor_(sheet);
  var email = String(body.email || '').trim().toLowerCase();

  if (action === 'create') {
    if (rows.length) throw new Error('El registro público está cerrado. Solicita una cuenta al administrador del negocio.');
    if (!email || !body.password) throw new Error('email y password son obligatorios.');
    if (String(body.password).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    var id = Utilities.getUuid(), salt = Utilities.getUuid();
    return publicRecord_('Usuarios', appendRecord_('Usuarios', {
      id: id, email: email, salt: salt, passwordHash: passwordHash_(body.password, salt),
      role: 'admin', businessId: id, active: true
    }));
  }

  if (action === 'login') {
    var user = rows.filter(function (r) { return String(r.email).toLowerCase() === email; })[0];
    if (!user || passwordHash_(body.password || '', user.salt) !== user.passwordHash) throw new Error('Email o contraseña incorrectos.');
    if (user.active === false || String(user.active).toLowerCase() === 'false') throw new Error('La cuenta está desactivada.');
    var output = publicRecord_('Usuarios', user);
    output.sessionToken = issueSessionToken_(user.id);
    output.role = user.role || 'admin';
    output.businessId = user.businessId || user.id;
    return output;
  }

  var auth = body.authUser;
  if (!auth) throw new Error('Sesión no válida.');
  if (action === 'me') {
    var current = rows.filter(function (r) { return String(r.id) === String(auth.id); })[0];
    if (!current) throw new Error('La cuenta ya no existe.');
    var me = publicRecord_('Usuarios', current);
    me.role = current.role || 'admin';
    me.businessId = current.businessId || current.id;
    return me;
  }
  if (auth.role !== 'admin') throw new Error('Solo el administrador puede gestionar usuarios.');

  var businessId = String(auth.businessId || auth.id);
  if (action === 'list') return rows.filter(function (r) { return String(r.businessId || r.id) === businessId; }).map(function (r) {
    var safe = publicRecord_('Usuarios', r);
    safe.role = r.role || 'admin';
    safe.active = !(r.active === false || String(r.active).toLowerCase() === 'false');
    safe.businessId = r.businessId || r.id;
    return safe;
  });

  if (action === 'createuser') {
    if (!email || !body.password) throw new Error('Correo y contraseña temporal son obligatorios.');
    if (String(body.password).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (rows.some(function (r) { return String(r.email).toLowerCase() === email; })) throw new Error('Ese email ya está registrado.');
    var newId = Utilities.getUuid(), newSalt = Utilities.getUuid();
    return publicRecord_('Usuarios', appendRecord_('Usuarios', {
      id: newId, email: email, salt: newSalt, passwordHash: passwordHash_(body.password, newSalt),
      role: 'employee', businessId: businessId, active: true
    }));
  }

  var target = rows.filter(function (r) { return String(r.id) === String(body.id || '') && String(r.businessId || r.id) === businessId; })[0];
  if (!target) throw new Error('Usuario no encontrado en este negocio.');
  if (String(target.id) === String(auth.id)) throw new Error('No puedes cambiar el rol ni desactivar tu propia cuenta.');
  if (action === 'setrole') {
    var role = String(body.role || '').toLowerCase();
    if (['admin', 'employee'].indexOf(role) === -1) throw new Error('Rol no válido.');
    if (target.role === 'admin' && role !== 'admin' && !(target.active === false || String(target.active).toLowerCase() === 'false') && rows.filter(function (r) {
      return String(r.businessId || r.id) === businessId && (r.role || 'admin') === 'admin' && !(r.active === false || String(r.active).toLowerCase() === 'false');
    }).length <= 1) throw new Error('El negocio debe conservar al menos un administrador activo.');
    target.role = role;
    return publicRecord_('Usuarios', writeRecord_('Usuarios', target._row, target));
  }
  if (action === 'setactive') {
    var active = body.active === true || String(body.active).toLowerCase() === 'true';
    if (!active && target.role === 'admin' && rows.filter(function (r) {
      return String(r.businessId || r.id) === businessId && (r.role || 'admin') === 'admin' && !(r.active === false || String(r.active).toLowerCase() === 'false');
    }).length <= 1) throw new Error('El negocio debe conservar al menos un administrador activo.');
    target.active = active;
    return publicRecord_('Usuarios', writeRecord_('Usuarios', target._row, target));
  }
  if (action === 'resetpassword') {
    if (String(body.password || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    target.salt = Utilities.getUuid();
    target.passwordHash = passwordHash_(body.password, target.salt);
    return { id: target.id, message: 'Contraseña actualizada.' };
  }
  if (action === 'delete') {
    if (target.role === 'admin') throw new Error('Cambia esa cuenta a empleado antes de eliminarla.');
    sheet.deleteRow(target._row);
    return { id: target.id, message: 'Usuario eliminado.' };
  }
  throw new Error('Acción no válida para usuarios.');
}

function passwordHash_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

/** CRUD presets de trabajo. extras se recibe/devuelve como arreglo JSON. */
function handlePresets_(body) {
  return genericCrud_('Presets', body, ['name', 'description', 'materialId', 'grams', 'hours', 'minutes', 'laborMinutes', 'extras'], function (r) {
    ['grams', 'hours', 'minutes', 'laborMinutes'].forEach(function (key) { if (r[key] != null) r[key] = Number(r[key]); });
    if (r.extras != null) r.extrasJson = JSON.stringify(r.extras);
  });
}

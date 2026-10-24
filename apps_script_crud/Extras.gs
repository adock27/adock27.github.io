/** CRUD insumos adicionales. Campos compatibles con storage.js. */
function handleExtras_(body) {
  return genericCrud_('Extras', body, ['name', 'defaultCost', 'category'], function (r) {
    if (r.defaultCost != null) r.defaultCost = Number(r.defaultCost);
  });
}

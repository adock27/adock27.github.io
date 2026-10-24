/** CRUD materiales/filamentos. Campos compatibles con storage.js. */
function handleMaterials_(body) {
  return genericCrud_('Materiales', body, ['name', 'pricePerKg', 'color', 'note'], function (r) {
    if (r.pricePerKg != null) r.pricePerKg = Number(r.pricePerKg);
  });
}

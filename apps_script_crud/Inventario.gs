/** CRUD de inventario personal: stock, unidad, costo y alerta mínima. */
function handleInventory_(body) {
  return genericCrud_('Inventario', body, ['name', 'category', 'quantity', 'unit', 'minQuantity', 'unitCost', 'notes'], function (record) {
    ['quantity', 'minQuantity', 'unitCost'].forEach(function (key) {
      if (record[key] != null) record[key] = Number(record[key]);
    });
  });
}

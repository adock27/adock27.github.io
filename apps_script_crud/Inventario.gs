/** CRUD de inventario personal: stock, unidad, costo y alerta mínima. */
function handleInventory_(body) {
  return genericCrud_('Inventario', body, ['name', 'category', 'productType', 'quantity', 'unit', 'minQuantity', 'unitCost', 'notes'], function (record) {
    record.productType = ['on_demand', 'hybrid'].indexOf(record.productType) !== -1 ? record.productType : 'stock';
    if (record.productType === 'on_demand') {
      record.quantity = 0;
      record.minQuantity = 0;
    }
    ['quantity', 'minQuantity', 'unitCost'].forEach(function (key) {
      if (record[key] != null) record[key] = Number(record[key]);
    });
  });
}

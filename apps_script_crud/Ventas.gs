/** CRUD de ventas personales. El total puede enviarse o calcularse desde cantidad y precio. */
function handleSales_(body) {
  return genericCrud_('Ventas', body, ['inventoryId', 'date', 'productName', 'clientName', 'quantity', 'unitPrice', 'total', 'paymentMethod', 'notes'], function (record) {
    ['quantity', 'unitPrice', 'total'].forEach(function (key) {
      if (record[key] != null) record[key] = Number(record[key]);
    });
    if (record.total == null && record.quantity != null && record.unitPrice != null) {
      record.total = Number(record.quantity) * Number(record.unitPrice);
    }
  });
}

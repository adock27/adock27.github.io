/** CRUD de pedidos personales. Los pedidos no modifican existencias hasta registrar la venta. */
function handleOrders_(body) {
  return genericCrud_('Pedidos', body, ['orderNumber', 'inventoryId', 'date', 'dueDate', 'productName', 'clientName', 'quantity', 'quantityFromStock', 'quantityMadeToOrder', 'unitPrice', 'total', 'status', 'paymentMethod', 'notes', 'saleId'], function (record) {
    ['quantity', 'quantityFromStock', 'quantityMadeToOrder', 'unitPrice', 'total'].forEach(function (key) {
      if (record[key] != null) record[key] = Number(record[key]);
    });
    if (record.total == null && record.quantity != null && record.unitPrice != null) {
      record.total = Number(record.quantity) * Number(record.unitPrice);
    }
    if (!record.status) record.status = 'Pendiente';
  });
}

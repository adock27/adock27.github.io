/** CRUD de compras e inversiones del negocio, aislado por usuario. */
function handlePurchases_(body) {
  return genericCrud_('Compras', body, ['date', 'type', 'itemName', 'materialId', 'quantity', 'unit', 'purchaseCost', 'shippingCost', 'totalCost', 'remainingQuantity', 'supplier', 'paymentMethod', 'notes'], function (record) {
    ['quantity', 'purchaseCost', 'shippingCost', 'totalCost', 'remainingQuantity'].forEach(function (key) {
      if (record[key] != null) record[key] = Number(record[key]);
    });
  });
}

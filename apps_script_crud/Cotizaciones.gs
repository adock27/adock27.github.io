/** CRUD de proyectos/cotizaciones calculados. payload conserva el detalle completo. */
function handleQuotes_(body) {
  return genericCrud_('Cotizaciones', body, ['projectName', 'clientName', 'data'], function (r) {
    if (r.data != null) r.payloadJson = JSON.stringify(r.data);
  });
}

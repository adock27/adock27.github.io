const TABLE_LANGUAGE = {
  emptyTable: 'No hay datos disponibles en la tabla',
  info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
  infoEmpty: 'Mostrando 0 a 0 de 0 registros',
  infoFiltered: '(filtrado de _MAX_ registros en total)',
  lengthMenu: 'Mostrar _MENU_ registros',
  loadingRecords: 'Cargando…',
  processing: 'Procesando…',
  zeroRecords: 'No se encontraron coincidencias',
  paginate: { first: 'Primera', last: 'Última', next: 'Siguiente', previous: 'Anterior' }
};

export const Tables = {
  addMobileLabels(table) {
    if (!table) return;
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => {
      [...row.cells].forEach((cell, index) => {
        if (!cell.hasAttribute('colspan') && labels[index]) cell.dataset.label = labels[index];
      });
    });
  },

  begin(tbody) {
    const table = tbody?.closest('table');
    if (!table || !globalThis.DataTable?.isDataTable?.(table)) return table;
    new globalThis.DataTable(table).destroy();
    return table;
  },

  end(tbody, options = {}) {
    const table = tbody?.closest('table');
    if (!table || !globalThis.DataTable || globalThis.DataTable.isDataTable(table)) return;
    const rows = [...tbody.rows];
    if (!rows.length || rows.every(row => row.querySelector('td[colspan]'))) return;

    this.addMobileLabels(table);

    new globalThis.DataTable(table, {
      searching: options.searching ?? false,
      order: [],
      pageLength: 10,
      lengthMenu: [10, 25, 50],
      autoWidth: false,
      columnDefs: [{ targets: -1, orderable: false, searchable: false }],
      language: { ...TABLE_LANGUAGE, search: 'Buscar:' }
    });
  },

  adjustVisible() {
    if (!globalThis.DataTable) return;
    document.querySelectorAll('.tab-pane-view:not(.d-none) table').forEach(table => {
      if (globalThis.DataTable.isDataTable(table)) new globalThis.DataTable(table).columns.adjust().draw(false);
    });
  }
};

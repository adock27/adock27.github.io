import { Storage } from '../storage.js';

function localDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export class Sales {
  constructor(app) {
    this.app = app;
    this.items = app.sales || [];
    this.modalElement = document.getElementById('saleModal');
    this.modal = window.bootstrap?.Modal && this.modalElement
      ? window.bootstrap.Modal.getOrCreateInstance(this.modalElement)
      : null;
    this.form = document.getElementById('saleForm');
    this.tableBody = document.getElementById('salesTableBody');
    this.searchInput = document.getElementById('salesSearch');
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    document.getElementById('btnAddSale')?.addEventListener('click', () => this.openForm());
    this.form?.addEventListener('submit', event => this.saveSale(event));
    this.searchInput?.addEventListener('input', () => this.render());
    ['saleQuantity', 'saleUnitPrice'].forEach(id => document.getElementById(id)?.addEventListener('input', () => this.updateTotalPreview()));
  }

  openForm(sale = null) {
    this.form?.reset();
    document.getElementById('saleId').value = sale?.id || '';
    document.getElementById('saleDate').value = sale?.date || localDateInput();
    document.getElementById('saleProductName').value = sale?.productName || '';
    document.getElementById('saleClientName').value = sale?.clientName || '';
    document.getElementById('saleQuantity').value = sale?.quantity ?? 1;
    document.getElementById('saleUnitPrice').value = sale?.unitPrice ?? 0;
    document.getElementById('salePaymentMethod').value = sale?.paymentMethod || 'Efectivo';
    document.getElementById('saleNotes').value = sale?.notes || '';
    document.getElementById('saleModalTitle').textContent = sale ? 'Editar venta' : 'Registrar venta';
    this.updateTotalPreview();
    this.modal?.show();
  }

  updateTotalPreview() {
    const quantity = Number(document.getElementById('saleQuantity')?.value) || 0;
    const price = Number(document.getElementById('saleUnitPrice')?.value) || 0;
    const preview = document.getElementById('saleTotalPreview');
    if (preview) preview.textContent = this.formatMoney(quantity * price);
  }

  saveSale(event) {
    event.preventDefault();
    const id = document.getElementById('saleId').value;
    const quantity = Number(document.getElementById('saleQuantity').value);
    const unitPrice = Number(document.getElementById('saleUnitPrice').value);
    if (quantity <= 0 || unitPrice < 0) {
      this.app.showToast('Verifica la cantidad y el precio de la venta.', 'error');
      return;
    }
    const sale = {
      id: id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `sale_${Date.now()}`),
      date: document.getElementById('saleDate').value,
      productName: document.getElementById('saleProductName').value.trim(),
      clientName: document.getElementById('saleClientName').value.trim(),
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      paymentMethod: document.getElementById('salePaymentMethod').value,
      notes: document.getElementById('saleNotes').value.trim()
    };
    const index = this.items.findIndex(current => current.id === id);
    if (index >= 0) this.items[index] = sale;
    else this.items.push(sale);
    this.persist();
    this.modal?.hide();
    this.app.showToast(index >= 0 ? 'Venta actualizada' : 'Venta registrada', 'success');
  }

  persist() {
    this.app.sales = this.items;
    Storage.saveSales(this.items);
    this.render();
  }

  render() {
    if (!this.tableBody) return;
    const monthKey = localDateInput().slice(0, 7);
    const monthSales = this.items.filter(sale => String(sale.date || '').slice(0, 7) === monthKey);
    const monthTotal = monthSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const totalEl = document.getElementById('salesMonthTotal');
    const countEl = document.getElementById('salesMonthCount');
    const averageEl = document.getElementById('salesMonthAverage');
    if (totalEl) totalEl.textContent = this.formatMoney(monthTotal);
    if (countEl) countEl.textContent = String(monthSales.length);
    if (averageEl) averageEl.textContent = this.formatMoney(monthSales.length ? monthTotal / monthSales.length : 0);

    const query = (this.searchInput?.value || '').trim().toLowerCase();
    const visible = [...this.items]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .filter(sale => `${sale.productName} ${sale.clientName || ''} ${sale.paymentMethod || ''} ${sale.notes || ''}`.toLowerCase().includes(query));
    this.tableBody.replaceChildren();
    if (!visible.length) {
      const row = document.createElement('tr'), cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'text-center text-secondary py-4';
      cell.textContent = this.items.length ? 'No hay ventas que coincidan con la búsqueda.' : 'Aún no hay ventas registradas.';
      row.appendChild(cell); this.tableBody.appendChild(row); return;
    }
    visible.forEach(sale => {
      const row = document.createElement('tr');
      const date = new Date(`${sale.date}T00:00:00`);
      [Number.isNaN(date.getTime()) ? sale.date : date.toLocaleDateString('es-CO'), sale.productName, sale.clientName || '—', sale.quantity, this.formatMoney(sale.total), sale.paymentMethod || '—']
        .forEach((value, index) => {
          const cell = document.createElement('td'); cell.textContent = String(value);
          if (index === 1) cell.classList.add('fw-semibold');
          row.appendChild(cell);
        });
      const actions = document.createElement('td'); actions.className = 'text-end text-nowrap';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.title = 'Editar'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.addEventListener('click', () => this.openForm(sale));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.title = 'Eliminar'; remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar la venta de “${sale.productName}”?`)) return;
        this.items = this.items.filter(current => current.id !== sale.id);
        this.persist(); this.app.showToast('Venta eliminada', 'info');
      });
      actions.append(edit, remove); row.appendChild(actions); this.tableBody.appendChild(row);
    });
  }

  formatMoney(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
}

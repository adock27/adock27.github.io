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
    this.renderInventoryOptions();
    this.render();
  }

  bindEvents() {
    document.getElementById('btnAddSale')?.addEventListener('click', () => this.openForm());
    this.form?.addEventListener('submit', event => this.saveSale(event));
    this.modalElement?.addEventListener('hide.bs.modal', () => {
      const focusedElement = document.activeElement;
      if (focusedElement && this.modalElement.contains(focusedElement)) focusedElement.blur();
    });
    this.modalElement?.addEventListener('hidden.bs.modal', () => {
      const fallback = document.getElementById('btnAddSale');
      const target = this.returnFocusTarget?.isConnected ? this.returnFocusTarget : fallback;
      target?.focus({ preventScroll: true });
    });
    this.searchInput?.addEventListener('input', () => this.render());
    document.getElementById('saleInventoryId')?.addEventListener('change', () => this.updateInventoryHint());
    document.getElementById('btnQuickAddInventory')?.addEventListener('click', () => {
      const panel = document.getElementById('quickInventoryPanel');
      panel?.classList.toggle('d-none');
      if (!panel?.classList.contains('d-none')) document.getElementById('quickInventoryName')?.focus();
    });
    document.getElementById('btnQuickAddInventorySave')?.addEventListener('click', () => this.quickAddInventoryItem());
    ['saleQuantity', 'saleUnitPrice'].forEach(id => document.getElementById(id)?.addEventListener('input', () => this.updateTotalPreview()));
  }

  openForm(sale = null) {
    this.returnFocusTarget = document.activeElement;
    this.form?.reset();
    document.getElementById('quickInventoryPanel')?.classList.add('d-none');
    document.getElementById('quickInventoryName').value = '';
    document.getElementById('quickInventoryCategory').value = '';
    document.getElementById('quickInventoryUnit').value = 'unidades';
    document.getElementById('quickInventoryQuantity').value = '1';
    document.getElementById('quickInventoryMinimum').value = '0';
    document.getElementById('quickInventoryCost').value = '0';
    this.renderInventoryOptions(sale?.inventoryId || '');
    document.getElementById('saleId').value = sale?.id || '';
    document.getElementById('saleDate').value = sale?.date || localDateInput();
    document.getElementById('saleClientName').value = sale?.clientName || '';
    document.getElementById('saleQuantity').value = sale?.quantity ?? 1;
    document.getElementById('saleUnitPrice').value = sale?.unitPrice ?? 0;
    document.getElementById('salePaymentMethod').value = sale?.paymentMethod || 'Efectivo';
    document.getElementById('saleNotes').value = sale?.notes || '';
    document.getElementById('saleModalTitle').textContent = sale ? 'Editar venta' : 'Registrar venta';
    this.updateInventoryHint();
    this.updateTotalPreview();
    this.modal?.show();
  }

  updateTotalPreview() {
    const quantity = Number(document.getElementById('saleQuantity')?.value) || 0;
    const price = Number(document.getElementById('saleUnitPrice')?.value) || 0;
    const preview = document.getElementById('saleTotalPreview');
    if (preview) preview.textContent = this.formatMoney(quantity * price);
  }

  quickAddInventoryItem() {
    const nameInput = document.getElementById('quickInventoryName');
    const name = nameInput.value.trim();
    const quantity = Number(document.getElementById('quickInventoryQuantity').value);
    const minQuantity = Number(document.getElementById('quickInventoryMinimum').value) || 0;
    const unitCost = Number(document.getElementById('quickInventoryCost').value) || 0;
    if (!name) {
      nameInput.focus();
      this.app.showToast('Escribe el nombre del producto.', 'error');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0 || minQuantity < 0 || unitCost < 0) {
      this.app.showToast('Revisa la existencia, el mínimo y el costo unitario.', 'error');
      return;
    }
    const item = {
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `stock_${Date.now()}`,
      name,
      category: document.getElementById('quickInventoryCategory').value.trim() || 'General',
      quantity,
      unit: document.getElementById('quickInventoryUnit').value,
      minQuantity,
      unitCost,
      notes: ''
    };
    this.app.inventoryModule.items.push(item);
    this.app.inventoryModule.persist();
    this.renderInventoryOptions(item.id);
    this.updateInventoryHint();
    document.getElementById('quickInventoryPanel').classList.add('d-none');
    document.getElementById('saleQuantity').value = 1;
    this.updateTotalPreview();
    document.getElementById('saleQuantity').focus();
    this.app.showToast('Producto agregado al inventario y seleccionado.', 'success');
  }

  saveSale(event) {
    event.preventDefault();
    const id = document.getElementById('saleId').value;
    const inventoryId = document.getElementById('saleInventoryId').value;
    const quantity = Number(document.getElementById('saleQuantity').value);
    const unitPrice = Number(document.getElementById('saleUnitPrice').value);
    if (quantity <= 0 || unitPrice < 0) {
      this.app.showToast('Verifica la cantidad y el precio de la venta.', 'error');
      return;
    }
    const inventory = this.app.inventoryModule.items;
    const selectedItem = inventory.find(item => String(item.id) === String(inventoryId));
    if (!selectedItem) {
      this.app.showToast('Selecciona un producto del inventario.', 'error');
      return;
    }
    const index = this.items.findIndex(current => current.id === id);
    const previousSale = index >= 0 ? this.items[index] : null;
    const previousItem = previousSale?.inventoryId
      ? inventory.find(item => String(item.id) === String(previousSale.inventoryId))
      : null;
    const available = Number(selectedItem.quantity || 0) + (previousItem?.id === selectedItem.id ? Number(previousSale?.quantity || 0) : 0);
    if (quantity > available) {
      this.app.showToast(`Existencias insuficientes. Disponibles: ${available} ${selectedItem.unit || ''}.`, 'error');
      return;
    }
    if (previousItem) previousItem.quantity = Number(previousItem.quantity || 0) + Number(previousSale.quantity || 0);
    selectedItem.quantity = Number(selectedItem.quantity || 0) - quantity;
    const sale = {
      id: id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `sale_${Date.now()}`),
      inventoryId: selectedItem.id,
      date: document.getElementById('saleDate').value,
      productName: selectedItem.name,
      clientName: document.getElementById('saleClientName').value.trim(),
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      paymentMethod: document.getElementById('salePaymentMethod').value,
      notes: document.getElementById('saleNotes').value.trim()
    };
    if (index >= 0) this.items[index] = sale;
    else this.items.push(sale);
    this.persistInventory();
    this.persist();
    this.modal?.hide();
    this.app.showToast(index >= 0 ? 'Venta actualizada' : 'Venta registrada', 'success');
  }

  persist() {
    this.app.sales = this.items;
    Storage.saveSales(this.items);
    this.render();
  }

  renderInventoryOptions(selectedId = '') {
    const select = document.getElementById('saleInventoryId');
    if (!select) return;
    const items = this.app.inventoryModule?.items || [];
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = items.length ? 'Selecciona un producto' : 'Agrega productos al inventario primero';
    placeholder.disabled = true;
    placeholder.selected = !selectedId;
    select.appendChild(placeholder);
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} — ${Number(item.quantity) || 0} ${item.unit || 'unidades'} disponibles`;
      option.disabled = Number(item.quantity) <= 0 && String(item.id) !== String(selectedId);
      option.selected = String(item.id) === String(selectedId);
      select.appendChild(option);
    });
    select.disabled = items.length === 0;
    const help = document.getElementById('saleInventoryHelp');
    if (help) help.textContent = items.length
      ? 'El stock se descontará al registrar la venta. El precio de venta se ingresa por separado.'
      : 'Agrega productos al inventario antes de registrar una venta.';
  }

  updateInventoryHint() {
    const select = document.getElementById('saleInventoryId');
    const item = (this.app.inventoryModule?.items || []).find(entry => String(entry.id) === String(select?.value));
    const quantity = document.getElementById('saleQuantity');
    if (quantity && item) quantity.max = String(Number(item.quantity || 0) + (this.items.find(sale => sale.id === document.getElementById('saleId').value && String(sale.inventoryId) === String(item.id))?.quantity || 0));
  }

  persistInventory() {
    this.app.inventory = this.app.inventoryModule.items;
    Storage.saveInventory(this.app.inventory);
    this.app.inventoryModule.render();
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
        const item = this.app.inventoryModule.items.find(entry => String(entry.id) === String(sale.inventoryId));
        if (item) {
          item.quantity = Number(item.quantity || 0) + Number(sale.quantity || 0);
          this.persistInventory();
        }
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

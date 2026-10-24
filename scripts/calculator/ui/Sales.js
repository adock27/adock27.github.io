import { Storage } from '../storage.js';
import { ApiSync } from '../api-sync.js';
import { Tables } from './Tables.js';

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
    this.initPeriodControls();
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
    document.getElementById('btnSyncSalesHistory')?.addEventListener('click', () => this.syncHistory());
    document.getElementById('salesPeriodMonth')?.addEventListener('change', () => this.render());
    document.getElementById('salesPeriodYear')?.addEventListener('change', () => this.render());
    document.getElementById('saleInventoryId')?.addEventListener('change', () => this.updateInventoryHint());
    document.getElementById('btnQuickAddInventory')?.addEventListener('click', () => {
      const panel = document.getElementById('quickInventoryPanel');
      panel?.classList.toggle('d-none');
      if (!panel?.classList.contains('d-none')) document.getElementById('quickInventoryName')?.focus();
    });
    document.getElementById('btnQuickAddInventorySave')?.addEventListener('click', () => this.quickAddInventoryItem());
    ['saleQuantity', 'saleUnitPrice'].forEach(id => document.getElementById(id)?.addEventListener('input', () => this.updateTotalPreview()));
  }

  async syncHistory() {
    const button = document.getElementById('btnSyncSalesHistory');
    const icon = document.getElementById('salesSyncIcon');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    icon?.classList.add('sales-sync-spinning');
    try {
      const sales = await ApiSync.refreshSales();
      this.items = sales;
      this.app.sales = sales;
      Storage.setSnapshot({ sales });
      ApiSync.setSnapshot({ sales });
      this.render();
      this.app.purchasesModule?.renderSummary();
      this.app.showToast('Historial de ventas sincronizado con el backend.', 'success');
    } catch (error) {
      this.app.showToast(error?.message || 'No se pudo sincronizar el historial de ventas.', 'error');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      icon?.classList.remove('sales-sync-spinning');
    }
  }

  initPeriodControls() {
    const monthSelect = document.getElementById('salesPeriodMonth');
    if (!monthSelect || !document.getElementById('salesPeriodYear')) return;
    const today = localDateInput();
    monthSelect.value = today.slice(5, 7);
    this.syncAvailableYears();
    document.getElementById('salesPeriodYear').value = today.slice(0, 4);
  }

  syncAvailableYears() {
    const yearSelect = document.getElementById('salesPeriodYear');
    if (!yearSelect) return;
    const selected = yearSelect.value;
    const years = new Set([localDateInput().slice(0, 4)]);
    this.items.forEach(sale => {
      const year = String(sale.date || '').slice(0, 4);
      if (/^\d{4}$/.test(year)) years.add(year);
    });
    yearSelect.replaceChildren(new Option('Todos los años', 'all'));
    [...years].sort((a, b) => b.localeCompare(a)).forEach(year => yearSelect.add(new Option(year, year)));
    yearSelect.value = [...yearSelect.options].some(option => option.value === selected) ? selected : localDateInput().slice(0, 4);
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
    const linkedItem = sale ? this.findInventoryItem(sale) : null;
    this.renderInventoryOptions(linkedItem?.id || sale?.inventoryId || '', sale);
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
    if (!this.app.isAdmin) return this.app.showToast('Solo un administrador puede crear productos de inventario.', 'error');
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
    const missingInventoryItem = inventoryId.startsWith('__missing__:');
    const selectedItem = inventory.find(item => String(item.id) === String(inventoryId));
    const index = this.items.findIndex(current => current.id === id);
    const previousSale = index >= 0 ? this.items[index] : null;
    if (previousSale && !this.app.canManageRecord(previousSale)) {
      this.app.showToast('Solo quien registró la venta o un administrador puede editarla.', 'error');
      return;
    }
    if (!selectedItem && !(missingInventoryItem && previousSale)) {
      this.app.showToast('Selecciona un producto del inventario.', 'error');
      return;
    }
    const previousItem = previousSale ? this.findInventoryItem(previousSale) : null;
    const previousStockQuantity = this.getQuantityFromStock(previousSale, previousItem);
    const previousTracksStock = previousItem && previousStockQuantity > 0;
    const selectedTracksStock = selectedItem && selectedItem.productType !== 'on_demand';
    const sameItem = previousItem && selectedItem && String(previousItem.id) === String(selectedItem.id);
    const available = selectedTracksStock
      ? Math.max(0, Number(selectedItem.quantity || 0) + (sameItem ? previousStockQuantity : 0))
      : 0;
    if (selectedItem?.productType === 'stock' && quantity > available) {
      this.app.showToast(`Existencias insuficientes. Disponibles: ${available} ${selectedItem.unit || ''}.`, 'error');
      return;
    }
    const quantityFromStock = !selectedTracksStock ? 0
      : selectedItem.productType === 'hybrid' ? Math.min(quantity, available) : quantity;
    const quantityMadeToOrder = quantity - quantityFromStock;
    if (previousTracksStock) previousItem.quantity = Number(previousItem.quantity || 0) + previousStockQuantity;
    if (selectedTracksStock) selectedItem.quantity = Number(selectedItem.quantity || 0) - quantityFromStock;
    const sale = {
      id: id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `sale_${Date.now()}`),
      inventoryId: selectedItem?.id || previousSale?.inventoryId || '',
      date: document.getElementById('saleDate').value,
      productName: selectedItem?.name || previousSale?.productName || '',
      clientName: document.getElementById('saleClientName').value.trim(),
      quantity,
      quantityFromStock,
      quantityMadeToOrder,
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
    const fulfillment = quantityMadeToOrder > 0 ? ` (${quantityFromStock} de stock · ${quantityMadeToOrder} bajo pedido)` : '';
    this.app.showToast(`${index >= 0 ? 'Venta actualizada' : 'Venta registrada'}${fulfillment}`, 'success');
  }

  persist() {
    this.app.sales = this.items;
    Storage.saveSales(this.items);
    this.render();
    this.app.purchasesModule?.renderSummary();
  }

  findInventoryItem(sale) {
    const items = this.app.inventoryModule?.items || [];
    if (sale?.inventoryId) {
      const byId = items.find(item => String(item.id) === String(sale.inventoryId));
      if (byId) return byId;
    }
    const productName = String(sale?.productName || '').trim().toLocaleLowerCase();
    return productName ? items.find(item => String(item.name || '').trim().toLocaleLowerCase() === productName) || null : null;
  }

  getQuantityFromStock(sale, item = this.findInventoryItem(sale)) {
    if (!sale) return 0;
    if (sale.quantityFromStock !== undefined && sale.quantityFromStock !== null && sale.quantityFromStock !== '' && Number.isFinite(Number(sale.quantityFromStock))) {
      return Math.max(0, Number(sale.quantityFromStock));
    }
    return item && item.productType !== 'on_demand' ? Math.max(0, Number(sale.quantity) || 0) : 0;
  }

  renderInventoryOptions(selectedId = '', editingSale = null) {
    const select = document.getElementById('saleInventoryId');
    if (!select) return;
    const items = this.app.inventoryModule?.items || [];
    const matchedItem = editingSale ? this.findInventoryItem(editingSale) : null;
    const effectiveSelectedId = matchedItem?.id || selectedId;
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = items.length ? 'Selecciona un producto' : 'Agrega productos al inventario primero';
    placeholder.disabled = true;
    placeholder.selected = !effectiveSelectedId && !editingSale;
    select.appendChild(placeholder);
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      const onDemand = item.productType === 'on_demand';
      const hybrid = item.productType === 'hybrid';
      option.textContent = onDemand ? `${item.name} — bajo pedido`
        : hybrid ? `${item.name} — ${Number(item.quantity) || 0} en stock + bajo pedido`
          : `${item.name} — ${Number(item.quantity) || 0} ${item.unit || 'unidades'} disponibles`;
      option.disabled = !onDemand && !hybrid && Number(item.quantity) <= 0 && String(item.id) !== String(effectiveSelectedId);
      option.selected = String(item.id) === String(effectiveSelectedId);
      select.appendChild(option);
    });
    const hasSelectedInventoryOption = matchedItem || items.some(item => String(item.id) === String(selectedId));
    if (editingSale && !hasSelectedInventoryOption) {
      const historicalOption = document.createElement('option');
      historicalOption.value = `__missing__:${editingSale.id}`;
      historicalOption.textContent = `${editingSale.productName || 'Producto'} — ya no está en el inventario`;
      historicalOption.selected = true;
      select.appendChild(historicalOption);
    }
    select.disabled = items.length === 0 && !editingSale;
    const help = document.getElementById('saleInventoryHelp');
    const selected = items.find(entry => String(entry.id) === String(select.value));
    if (help) help.textContent = !items.length
      ? 'Agrega productos al inventario antes de registrar una venta.'
      : selected?.productType === 'hybrid'
        ? `Se descontarán hasta ${Number(selected.quantity) || 0} ${selected.unit || 'unidades'} disponibles; el excedente queda bajo pedido.`
        : selected?.productType === 'on_demand'
          ? 'Toda la cantidad se registra como fabricada bajo pedido.'
          : 'La cantidad vendida se descuenta del stock disponible.';
  }

  updateInventoryHint() {
    const select = document.getElementById('saleInventoryId');
    const item = (this.app.inventoryModule?.items || []).find(entry => String(entry.id) === String(select?.value));
    const quantity = document.getElementById('saleQuantity');
    if (quantity && item?.productType === 'stock') quantity.max = String(Number(item.quantity || 0) + this.getQuantityFromStock(this.items.find(sale => sale.id === document.getElementById('saleId').value && String(this.findInventoryItem(sale)?.id) === String(item.id))));
    else if (quantity) quantity.removeAttribute('max');
  }

  persistInventory() {
    this.app.inventory = this.app.inventoryModule.items;
    Storage.saveInventory(this.app.inventory);
    this.app.inventoryModule.render();
  }

  render() {
    if (!this.tableBody) return;
    Tables.begin(this.tableBody);
    this.syncAvailableYears();
    const month = document.getElementById('salesPeriodMonth')?.value || localDateInput().slice(5, 7);
    const year = document.getElementById('salesPeriodYear')?.value || localDateInput().slice(0, 4);
    const matchesPeriod = sale => {
      const date = String(sale.date || '');
      return (year === 'all' || date.slice(0, 4) === year) && (month === 'all' || date.slice(5, 7) === month);
    };
    const periodSales = this.items.filter(matchesPeriod);
    const periodTotal = periodSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const monthName = month === 'all' ? '' : document.getElementById('salesPeriodMonth')?.selectedOptions[0]?.textContent || '';
    const periodLabel = year === 'all'
      ? (month === 'all' ? 'todos los períodos' : `${monthName} · todos los años`)
      : (month === 'all' ? year : `${monthName} ${year}`);
    const totalEl = document.getElementById('salesMonthTotal');
    const countEl = document.getElementById('salesMonthCount');
    const averageEl = document.getElementById('salesMonthAverage');
    if (totalEl) totalEl.textContent = this.formatMoney(periodTotal);
    if (countEl) countEl.textContent = String(periodSales.length);
    if (averageEl) averageEl.textContent = this.formatMoney(periodSales.length ? periodTotal / periodSales.length : 0);
    const totalLabel = document.getElementById('salesPeriodTotalLabel');
    const countLabel = document.getElementById('salesPeriodCountLabel');
    const averageLabel = document.getElementById('salesMonthAverageLabel');
    if (totalLabel) totalLabel.textContent = `Ventas · ${periodLabel}`;
    if (countLabel) countLabel.textContent = `Operaciones · ${periodLabel}`;
    if (averageLabel) averageLabel.textContent = 'Promedio por venta';

    const query = (this.searchInput?.value || '').trim().toLowerCase();
    const visible = [...this.items]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .filter(sale => matchesPeriod(sale) && `${sale.productName} ${sale.clientName || ''} ${sale.paymentMethod || ''} ${sale.notes || ''}`.toLowerCase().includes(query));
    this.tableBody.replaceChildren();
    if (!visible.length) {
      const row = document.createElement('tr'), cell = document.createElement('td');
      cell.className = 'text-center text-secondary py-4';
      cell.textContent = !this.items.length ? 'Aún no hay ventas registradas.' : !periodSales.length ? `No hay ventas para ${periodLabel}.` : 'No hay ventas que coincidan con la búsqueda.';
      cell.colSpan = 9;
      row.appendChild(cell); this.tableBody.appendChild(row); Tables.end(this.tableBody); return;
    }
    visible.forEach(sale => {
      const row = document.createElement('tr');
      const date = new Date(`${sale.date}T00:00:00`);
      const quantityFromStock = this.getQuantityFromStock(sale);
      const quantityMadeToOrder = sale.quantityMadeToOrder !== undefined && sale.quantityMadeToOrder !== null && sale.quantityMadeToOrder !== ''
        ? Number(sale.quantityMadeToOrder) || 0
        : Math.max(0, (Number(sale.quantity) || 0) - quantityFromStock);
      const fulfillment = quantityMadeToOrder > 0
        ? `${quantityFromStock} stock · ${quantityMadeToOrder} bajo pedido`
        : quantityFromStock > 0 ? 'Desde stock' : 'Bajo pedido';
      [Number.isNaN(date.getTime()) ? sale.date : date.toLocaleDateString('es-CO'), sale.productName, sale.clientName || '—', sale.createdByEmail || '—', sale.quantity, fulfillment, this.formatMoney(sale.total), sale.paymentMethod || '—']
        .forEach((value, index) => {
          const cell = document.createElement('td'); cell.textContent = String(value);
          if (index === 0) cell.dataset.order = String(sale.date || '');
          if (index === 1) cell.classList.add('fw-semibold');
          row.appendChild(cell);
        });
      const actions = document.createElement('td'); actions.className = 'text-end text-nowrap';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.title = 'Editar'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      const canManage = this.app.canManageRecord(sale);
      edit.disabled = !canManage;
      if (!canManage) edit.title = 'Solo quien registró la venta o un administrador puede editarla';
      else edit.addEventListener('click', () => this.openForm(sale));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.title = 'Eliminar'; remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.disabled = !canManage;
      if (!canManage) remove.title = 'Solo quien registró la venta o un administrador puede eliminarla';
      else remove.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar la venta de “${sale.productName}”?`)) return;
        const item = this.findInventoryItem(sale);
        if (item && this.getQuantityFromStock(sale, item) > 0) {
          item.quantity = Number(item.quantity || 0) + this.getQuantityFromStock(sale, item);
          this.persistInventory();
        }
        this.items = this.items.filter(current => current.id !== sale.id);
        this.persist(); this.app.showToast('Venta eliminada', 'info');
      });
      actions.append(edit, remove); row.appendChild(actions); this.tableBody.appendChild(row);
    });
    Tables.end(this.tableBody);
  }

  formatMoney(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
}

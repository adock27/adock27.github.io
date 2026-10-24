import { Storage } from '../storage.js';
import { Tables } from './Tables.js';
import { RecordDetails } from './RecordDetails.js';

export class Inventory {
  constructor(app) {
    this.app = app;
    this.items = app.inventory || [];
    this.modalElement = document.getElementById('inventoryItemModal');
    this.modal = window.bootstrap?.Modal && this.modalElement
      ? window.bootstrap.Modal.getOrCreateInstance(this.modalElement)
      : null;
    this.form = document.getElementById('inventoryItemForm');
    this.tableBody = document.getElementById('inventoryTableBody');
    this.searchInput = document.getElementById('inventorySearch');
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    document.getElementById('btnAddInventoryItem')?.addEventListener('click', () => this.openForm());
    this.form?.addEventListener('submit', event => this.saveItem(event));
    document.getElementById('inventoryProductType')?.addEventListener('change', () => this.toggleStockFields());
    this.searchInput?.addEventListener('input', () => this.render());
  }

  openForm(item = null) {
    if (!this.app.isAdmin) return this.app.showToast('Solo un administrador puede editar el inventario.', 'error');
    this.form?.reset();
    document.getElementById('inventoryItemId').value = item?.id || '';
    document.getElementById('inventoryName').value = item?.name || '';
    document.getElementById('inventoryCategory').value = item?.category || '';
    document.getElementById('inventoryProductType').value = ['on_demand', 'hybrid'].includes(item?.productType) ? item.productType : 'stock';
    document.getElementById('inventoryQuantity').value = item?.quantity ?? 0;
    document.getElementById('inventoryUnit').value = item?.unit || 'unidades';
    document.getElementById('inventoryMinQuantity').value = item?.minQuantity ?? 0;
    document.getElementById('inventoryUnitCost').value = item?.unitCost ?? 0;
    document.getElementById('inventoryNotes').value = item?.notes || '';
    this.toggleStockFields();
    document.getElementById('inventoryModalTitle').textContent = item ? 'Editar artículo' : 'Añadir artículo';
    this.modal?.show();
  }

  saveItem(event) {
    if (!this.app.isAdmin) return this.app.showToast('Solo un administrador puede editar el inventario.', 'error');
    event.preventDefault();
    const id = document.getElementById('inventoryItemId').value;
    const item = {
      id: id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `stock_${Date.now()}`),
      name: document.getElementById('inventoryName').value.trim(),
      category: document.getElementById('inventoryCategory').value.trim() || 'General',
      productType: ['on_demand', 'hybrid'].includes(document.getElementById('inventoryProductType').value) ? document.getElementById('inventoryProductType').value : 'stock',
      quantity: document.getElementById('inventoryProductType').value === 'on_demand' ? 0 : (Number(document.getElementById('inventoryQuantity').value) || 0),
      unit: document.getElementById('inventoryUnit').value,
      minQuantity: document.getElementById('inventoryProductType').value === 'on_demand' ? 0 : (Number(document.getElementById('inventoryMinQuantity').value) || 0),
      unitCost: Number(document.getElementById('inventoryUnitCost').value) || 0,
      notes: document.getElementById('inventoryNotes').value.trim()
    };
    if (!item.name) return;
    const index = this.items.findIndex(current => current.id === id);
    if (index >= 0) this.items[index] = item;
    else this.items.push(item);
    this.persist();
    this.modal?.hide();
    this.app.showToast(index >= 0 ? 'Artículo actualizado' : 'Artículo añadido', 'success');
  }

  persist() {
    this.app.inventory = this.items;
    Storage.saveInventory(this.items);
    this.app.salesModule?.renderInventoryOptions();
    this.render();
  }

  toggleStockFields() {
    const onDemand = document.getElementById('inventoryProductType')?.value === 'on_demand';
    document.getElementById('inventoryStockFields')?.classList.toggle('d-none', onDemand);
    ['inventoryQuantity', 'inventoryMinQuantity'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = onDemand;
    });
  }

  quickSell(item) {
    const sales = this.app.salesModule;
    if (!sales) return this.app.showToast('El módulo de ventas todavía no está disponible.', 'error');
    sales.openForm();
    const select = document.getElementById('saleInventoryId');
    if (select) select.value = String(item.id);
    sales.updateInventoryHint();
    sales.updateTotalPreview();
  }

  quickOrder(item) {
    const orders = this.app.ordersModule;
    if (!orders) return this.app.showToast('El módulo de pedidos todavía no está disponible.', 'error');
    orders.openForm();
    const select = document.getElementById('orderInventoryId');
    if (select) select.value = String(item.id);
    orders.toggleCustomProduct();
  }

  showDetails(item) {
    const type = item.productType === 'hybrid' ? 'Mixto: stock + bajo pedido'
      : item.productType === 'on_demand' ? 'Bajo pedido' : 'Solo stock';
    RecordDetails.show('Detalle del producto', [
      ['Producto', item.name], ['Categoría', item.category || 'General'],
      ['Modalidad', type], ['Existencia', item.productType === 'on_demand' ? 'No controla stock' : `${Number(item.quantity) || 0} ${item.unit || 'unidades'}`],
      ['Stock mínimo', item.productType === 'on_demand' ? '—' : `${Number(item.minQuantity) || 0} ${item.unit || 'unidades'}`],
      ...(this.app.isAdmin ? [['Costo unitario', this.formatMoney(item.unitCost)]] : []),
      ['Registrado por', item.createdByEmail], ['Creado', RecordDetails.formatDateTime(item.createdAt)],
      ['Última actualización', RecordDetails.formatDateTime(item.updatedAt)],
      ['Notas', item.notes, true], ['ID', item.id, true]
    ]);
  }

  render() {
    if (!this.tableBody) return;
    Tables.begin(this.tableBody);
    const query = (this.searchInput?.value || '').trim().toLowerCase();
    const isLowStock = item => {
      if (item.productType === 'on_demand' || (item.productType === 'hybrid' && !(Number(item.minQuantity) > 0))) return false;
      const quantity = Number(item.quantity) || 0;
      const minimum = Math.max(0, Number(item.minQuantity) || 0);
      return quantity <= 0 || (minimum > 0 && quantity <= minimum);
    };
    const visibleItems = this.items
      .filter(item => `${item.name} ${item.category} ${item.notes || ''}`.toLowerCase().includes(query))
      .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)));
    const lowStock = this.items.filter(isLowStock).length;
    const totalValue = this.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
    const itemCount = document.getElementById('inventoryItemCount');
    const lowCount = document.getElementById('inventoryLowCount');
    const value = document.getElementById('inventoryTotalValue');
    document.getElementById('inventoryValueCard')?.classList.toggle('d-none', !this.app.isAdmin);
    document.getElementById('inventoryUnitCostHead')?.classList.toggle('d-none', !this.app.isAdmin);
    if (itemCount) itemCount.textContent = String(this.items.length);
    if (lowCount) lowCount.textContent = String(lowStock);
    if (value) value.textContent = new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(totalValue);
    this.tableBody.replaceChildren();
    if (!visibleItems.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'text-center text-secondary py-4';
      cell.textContent = this.items.length ? 'No hay artículos que coincidan con la búsqueda.' : 'Aún no tienes artículos en el inventario.';
      row.appendChild(cell);
      this.tableBody.appendChild(row);
      Tables.end(this.tableBody);
      return;
    }
    visibleItems.forEach(item => {
      const row = document.createElement('tr');
      const onDemand = item.productType === 'on_demand';
      const quantity = Number(item.quantity) || 0;
      const minimum = Math.max(0, Number(item.minQuantity) || 0);
      const exhausted = !onDemand && quantity <= 0;
      const low = isLowStock(item);
      const hybrid = item.productType === 'hybrid';
      const status = onDemand ? 'Bajo pedido' : hybrid ? (low ? 'Stock bajo · mixto' : quantity > 0 ? 'Stock + bajo pedido' : 'Bajo pedido') : exhausted ? 'Agotado' : low ? 'Stock bajo' : 'Disponible';
      const statusClass = onDemand || (hybrid && quantity === 0) ? 'text-bg-info' : exhausted ? 'text-bg-danger' : low ? 'text-bg-warning' : 'text-bg-success';
      const values = [item.name, item.category || 'General', onDemand ? 'Bajo pedido' : `${quantity} ${item.unit}${hybrid ? ' + bajo pedido' : ''}`, onDemand ? '—' : `${minimum} ${item.unit}`, this.formatMoney(item.unitCost), status];
      values.forEach((text, index) => {
        const cell = document.createElement('td');
        cell.textContent = text;
        if (index === 4 && !this.app.isAdmin) cell.classList.add('d-none');
        if (index === 5) cell.innerHTML = `<span class="badge ${statusClass}">${text}</span>`;
        if (index === 0) cell.classList.add('fw-semibold');
        row.appendChild(cell);
      });
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'btn btn-sm btn-outline-secondary me-1';
      view.title = 'Ver detalle del producto';
      view.setAttribute('aria-label', `Ver detalle de ${item.name}`);
      view.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
      view.addEventListener('click', () => this.showDetails(item));
      const sell = document.createElement('button');
      sell.type = 'button';
      sell.className = 'btn btn-sm btn-outline-success me-1';
      sell.title = 'Registrar venta de este producto';
      sell.setAttribute('aria-label', `Vender ${item.name}`);
      sell.innerHTML = '<i class="bi bi-cash-coin" aria-hidden="true"></i>';
      sell.disabled = item.productType === 'stock' && quantity <= 0;
      sell.addEventListener('click', () => this.quickSell(item));
      const order = document.createElement('button');
      order.type = 'button';
      order.className = 'btn btn-sm btn-outline-primary me-1';
      order.title = 'Crear pedido de este producto';
      order.setAttribute('aria-label', `Crear pedido para ${item.name}`);
      order.innerHTML = '<i class="bi bi-clipboard-plus" aria-hidden="true"></i>';
      order.addEventListener('click', () => this.quickOrder(item));
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.title = 'Editar'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.classList.toggle('d-none', !this.app.isAdmin);
      edit.addEventListener('click', () => this.openForm(item));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.title = 'Eliminar'; remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.classList.toggle('d-none', !this.app.isAdmin);
      remove.addEventListener('click', () => {
        if (!this.app.isAdmin) return this.app.showToast('Solo un administrador puede eliminar artículos.', 'error');
        if (!window.confirm(`¿Eliminar “${item.name}” del inventario?`)) return;
        this.items = this.items.filter(current => current.id !== item.id);
        this.persist();
        this.app.showToast('Artículo eliminado', 'info');
      });
      actions.append(view, sell, order, edit, remove);
      row.appendChild(actions);
      this.tableBody.appendChild(row);
    });
    Tables.end(this.tableBody);
  }

  formatMoney(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(Number(amount) || 0);
  }
}

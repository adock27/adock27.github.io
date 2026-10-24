import { Storage } from '../storage.js';
import { Tables } from './Tables.js';

const ORDER_STATUSES = ['Pendiente', 'En producción', 'Listo', 'Entregado', 'Cancelado'];

function localDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function normalizeDateInput(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
  if (/^\d{4,6}(\.\d+)?$/.test(text)) {
    const serialDate = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86400000);
    return `${serialDate.getUTCFullYear()}-${String(serialDate.getUTCMonth() + 1).padStart(2, '0')}-${String(serialDate.getUTCDate()).padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function makeId(prefix) {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${prefix}_${Date.now()}`;
}

export class Orders {
  constructor(app) {
    this.app = app;
    this.items = app.orders || [];
    this.modalElement = document.getElementById('orderModal');
    this.modal = window.bootstrap?.Modal && this.modalElement
      ? window.bootstrap.Modal.getOrCreateInstance(this.modalElement)
      : null;
    this.form = document.getElementById('orderForm');
    this.tableBody = document.getElementById('ordersTableBody');
    this.searchInput = document.getElementById('ordersSearch');
    this.statusFilter = document.getElementById('ordersStatusFilter');
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    document.getElementById('btnAddOrder')?.addEventListener('click', () => this.openForm());
    this.form?.addEventListener('submit', event => this.saveOrder(event));
    this.searchInput?.addEventListener('input', () => this.render());
    this.statusFilter?.addEventListener('change', () => this.render());
    document.getElementById('orderInventoryId')?.addEventListener('change', () => this.toggleCustomProduct());
    document.getElementById('orderStatus')?.addEventListener('change', () => this.toggleCustomProduct());
    document.getElementById('orderModal')?.addEventListener('hide.bs.modal', () => {
      const focusedElement = document.activeElement;
      if (focusedElement && this.modalElement.contains(focusedElement)) focusedElement.blur();
    });
    document.getElementById('orderModal')?.addEventListener('hidden.bs.modal', () => {
      const target = this.returnFocusTarget?.isConnected ? this.returnFocusTarget : document.getElementById('btnAddOrder');
      target?.focus({ preventScroll: true });
    });
  }

  openForm(order = null) {
    this.returnFocusTarget = document.activeElement;
    this.form?.reset();
    document.getElementById('orderAddCustomToInventory').checked = false;
    document.getElementById('orderId').value = order?.id || '';
    const inventoryItemExists = order?.inventoryId && this.app.inventoryModule.items.some(item => String(item.id) === String(order.inventoryId));
    this.renderInventoryOptions(inventoryItemExists ? order.inventoryId : '__custom__');
    document.getElementById('orderCustomProductName').value = inventoryItemExists ? '' : (order?.productName || '');
    document.getElementById('orderDate').value = normalizeDateInput(order?.date) || localDateInput();
    document.getElementById('orderDueDate').value = normalizeDateInput(order?.dueDate);
    document.getElementById('orderClientName').value = order?.clientName || '';
    document.getElementById('orderQuantity').value = order?.quantity ?? 1;
    document.getElementById('orderUnitPrice').value = order?.unitPrice ?? 0;
    document.getElementById('orderStatus').value = order?.status || 'Pendiente';
    this.toggleCustomProduct();
    document.getElementById('orderPaymentMethod').value = order?.paymentMethod || 'Efectivo';
    document.getElementById('orderNotes').value = order?.notes || '';
    document.getElementById('orderModalTitle').textContent = order ? `Editar pedido ${order.orderNumber || ''}` : 'Nuevo pedido';
    this.updateTotalPreview();
    this.modal?.show();
  }

  renderInventoryOptions(selectedId = '') {
    const select = document.getElementById('orderInventoryId');
    if (!select) return;
    const items = this.app.inventoryModule.items;
    select.replaceChildren();
    const customOption = document.createElement('option');
    customOption.value = '__custom__';
    customOption.textContent = 'Producto personalizado (sin inventario)';
    customOption.selected = selectedId === '__custom__';
    select.appendChild(customOption);
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.productType === 'on_demand'
        ? `${item.name} — bajo pedido`
        : `${item.name} — stock ${Number(item.quantity) || 0} ${item.unit || 'unidades'}`;
      option.selected = String(item.id) === String(selectedId);
      select.appendChild(option);
    });
    select.disabled = false;
  }

  toggleCustomProduct() {
    const isCustom = document.getElementById('orderInventoryId')?.value === '__custom__';
    const wrap = document.getElementById('orderCustomProductWrap');
    const input = document.getElementById('orderCustomProductName');
    const addToInventoryWrap = document.getElementById('orderAddCustomToInventoryWrap');
    const addToInventory = document.getElementById('orderAddCustomToInventory');
    wrap?.classList.toggle('d-none', !isCustom);
    addToInventoryWrap?.classList.toggle('d-none', !isCustom);
    if (input) input.required = isCustom;
    if (addToInventory) addToInventory.disabled = !this.app.isAdmin || !isCustom || document.getElementById('orderStatus')?.value !== 'Entregado';
  }

  updateTotalPreview() {
    const quantity = Number(document.getElementById('orderQuantity')?.value) || 0;
    const price = Number(document.getElementById('orderUnitPrice')?.value) || 0;
    const preview = document.getElementById('orderTotalPreview');
    if (preview) preview.textContent = price === 0 ? 'Por cotizar' : this.formatMoney(quantity * price);
  }

  saveOrder(event) {
    event.preventDefault();
    const id = document.getElementById('orderId').value;
    const inventoryId = document.getElementById('orderInventoryId').value;
    const product = inventoryId === '__custom__' ? null : this.app.inventoryModule.items.find(item => String(item.id) === String(inventoryId));
    const isCustom = inventoryId === '__custom__';
    const productName = isCustom ? document.getElementById('orderCustomProductName').value.trim() : product?.name;
    const clientName = document.getElementById('orderClientName').value.trim();
    const quantity = Number(document.getElementById('orderQuantity').value);
    const unitPrice = Number(document.getElementById('orderUnitPrice').value);
    if (!productName) return this.app.showToast('Selecciona un producto o escribe el nombre del producto personalizado.', 'error');
    if (!clientName) return this.app.showToast('Escribe el nombre del cliente.', 'error');
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return this.app.showToast('Revisa la cantidad y el precio del pedido.', 'error');
    }
    const index = this.items.findIndex(item => item.id === id);
    const existing = index >= 0 ? this.items[index] : null;
    if (existing && !this.app.canManageRecord(existing)) {
      this.app.showToast('Solo quien registró el pedido o un administrador puede editarlo.', 'error');
      return;
    }
    const status = document.getElementById('orderStatus').value;
    if (!ORDER_STATUSES.includes(status)) return this.app.showToast('Selecciona un estado válido para el pedido.', 'error');
    if (existing?.saleId) return this.app.showToast('Este pedido ya tiene una venta asociada y no se puede editar.', 'error');
    if (status === 'Entregado' && unitPrice <= 0) return this.app.showToast('Indica el precio de venta antes de entregar el pedido.', 'error');
    const order = {
      id: id || makeId('order'),
      orderNumber: existing?.orderNumber || `PED-${Date.now().toString().slice(-8)}`,
      inventoryId: product?.id || '',
      date: document.getElementById('orderDate').value || localDateInput(),
      dueDate: document.getElementById('orderDueDate').value,
      productName,
      clientName,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      status,
      paymentMethod: document.getElementById('orderPaymentMethod').value,
      notes: document.getElementById('orderNotes').value.trim(),
      saleId: existing?.saleId || ''
    };
    if (status === 'Entregado' && !order.saleId) {
      const addCustomToInventory = this.app.isAdmin && isCustom && document.getElementById('orderAddCustomToInventory').checked;
      if (!this.createSaleFromOrder(order, addCustomToInventory)) return;
    }
    if (index >= 0) this.items[index] = order;
    else this.items.push(order);
    this.persist();
    this.modal?.hide();
    this.app.showToast(index >= 0 ? 'Pedido actualizado' : 'Pedido creado', 'success');
  }

  persist() {
    this.app.orders = this.items;
    Storage.saveOrders(this.items);
    this.render();
  }

  createSaleFromOrder(order, addCustomToInventory = false) {
    if (order.saleId) return true;
    if (Number(order.unitPrice) <= 0) {
      this.app.showToast('Indica el precio de venta antes de entregar el pedido.', 'error');
      return false;
    }
    const inventory = this.app.inventoryModule.items;
    const product = order.inventoryId
      ? inventory.find(item => String(item.id) === String(order.inventoryId))
      : null;
    if (order.inventoryId && !product) order.inventoryId = '';
    const productTracksStock = product && product.productType !== 'on_demand';
    if (productTracksStock && Number(order.quantity) > (Number(product.quantity) || 0)) {
      this.app.showToast(`Existencias insuficientes. Disponibles: ${Number(product.quantity) || 0} ${product.unit || ''}.`, 'error');
      return false;
    }
    let addedToInventory = false;
    if (!product && addCustomToInventory) {
      const alreadyCatalogued = inventory.some(item => String(item.name || '').trim().toLocaleLowerCase() === String(order.productName || '').trim().toLocaleLowerCase());
      if (!alreadyCatalogued) {
        inventory.push({
          id: makeId('stock'), name: order.productName, category: 'General', quantity: 0,
          unit: 'unidades', minQuantity: 0, unitCost: 0, notes: '', productType: 'on_demand'
        });
        addedToInventory = true;
      }
    }
    const sale = {
      id: makeId('sale'),
      inventoryId: product?.id || '',
      date: localDateInput(),
      productName: product?.name || order.productName,
      clientName: order.clientName,
      quantity: Number(order.quantity),
      unitPrice: Number(order.unitPrice),
      total: Number(order.total),
      paymentMethod: order.paymentMethod || 'Otro',
      notes: `Registrada desde el pedido ${order.orderNumber}. ${order.notes || ''}`.trim()
    };
    if (productTracksStock) product.quantity = (Number(product.quantity) || 0) - sale.quantity;
    if (productTracksStock || addedToInventory) this.app.inventoryModule.persist();
    this.app.salesModule.items.push(sale);
    this.app.salesModule.persist();
    order.saleId = sale.id;
    order.status = 'Entregado';
    this.app.showToast(addedToInventory
      ? `Pedido ${order.orderNumber} entregado, venta registrada y producto agregado al inventario con stock 0.`
      : `Pedido ${order.orderNumber} entregado y registrado como venta.`, 'success');
    return true;
  }

  render() {
    if (!this.tableBody) return;
    Tables.begin(this.tableBody);
    const currentMonth = localDateInput().slice(0, 7);
    const open = this.items.filter(item => !['Entregado', 'Cancelado'].includes(item.status));
    const monthCount = this.items.filter(item => String(item.date || '').slice(0, 7) === currentMonth).length;
    const openCount = document.getElementById('ordersOpenCount');
    const openValue = document.getElementById('ordersOpenValue');
    const ordersMonthCount = document.getElementById('ordersMonthCount');
    if (openCount) openCount.textContent = String(open.length);
    if (openValue) openValue.textContent = this.formatMoney(open.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
    if (ordersMonthCount) ordersMonthCount.textContent = String(monthCount);

    const query = (this.searchInput?.value || '').trim().toLowerCase();
    const status = this.statusFilter?.value || '__active__';
    const visible = [...this.items]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter(item => (status === '__active__' ? !['Entregado', 'Cancelado'].includes(item.status) : (!status || item.status === status)) && `${item.orderNumber} ${item.clientName} ${item.productName} ${item.notes || ''}`.toLowerCase().includes(query));
    this.tableBody.replaceChildren();
    if (!visible.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.className = 'text-center text-secondary py-4';
      cell.textContent = this.items.length ? 'No hay pedidos que coincidan con la búsqueda.' : 'Aún no hay pedidos registrados.';
      row.appendChild(cell);
      this.tableBody.appendChild(row);
      Tables.end(this.tableBody);
      return;
    }
    visible.forEach(order => {
      const row = document.createElement('tr');
      const statusClass = order.status === 'Cancelado' ? 'text-bg-secondary' : order.status === 'Entregado' ? 'text-bg-success' : order.status === 'Listo' ? 'text-bg-primary' : 'text-bg-warning';
      [order.orderNumber, order.clientName, order.productName, order.dueDate || '—', `${order.quantity}`, Number(order.unitPrice) === 0 ? 'Por cotizar' : this.formatMoney(order.total), order.status]
        .forEach((value, index) => {
          const cell = document.createElement('td');
          cell.textContent = String(value || '—');
          if (index === 3) cell.dataset.order = String(order.dueDate || '');
          if (index === 6) cell.innerHTML = `<span class="badge ${statusClass}">${String(value || 'Pendiente')}</span>`;
          row.appendChild(cell);
        });
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      const canManage = this.app.canManageRecord(order);
      if (canManage && order.status === 'Listo' && !order.saleId) {
        const saleButton = document.createElement('button');
        saleButton.type = 'button';
        saleButton.className = 'btn btn-sm btn-outline-success me-1';
        saleButton.title = 'Entregar pedido y registrar como venta';
        saleButton.setAttribute('aria-label', 'Entregar pedido y registrar como venta');
        saleButton.innerHTML = '<i class="bi bi-cash-coin"></i>';
        saleButton.addEventListener('click', () => {
          this.openForm(order);
          document.getElementById('orderStatus').value = 'Entregado';
          this.toggleCustomProduct();
        });
        actions.appendChild(saleButton);
      }
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.title = 'Editar'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.disabled = Boolean(order.saleId) || !canManage;
      if (order.saleId) edit.title = 'El pedido ya está registrado como venta';
      else if (!canManage) edit.title = 'Solo quien registró el pedido o un administrador puede editarlo';
      else edit.addEventListener('click', () => this.openForm(order));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.title = 'Eliminar'; remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.disabled = Boolean(order.saleId) || !canManage;
      if (order.saleId) remove.title = 'El pedido ya está registrado como venta';
      else if (!canManage) remove.title = 'Solo quien registró el pedido o un administrador puede eliminarlo';
      else remove.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar el pedido ${order.orderNumber}?`)) return;
        this.items = this.items.filter(item => item.id !== order.id);
        this.persist();
        this.app.showToast('Pedido eliminado', 'info');
      });
      actions.append(edit, remove);
      row.appendChild(actions);
      this.tableBody.appendChild(row);
    });
    Tables.end(this.tableBody);
  }

  formatMoney(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
}

import { Storage } from '../storage.js';

const ORDER_STATUSES = ['Pendiente', 'En producción', 'Listo', 'Entregado', 'Cancelado'];

function localDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    document.getElementById('orderId').value = order?.id || '';
    this.renderInventoryOptions(order?.inventoryId || '');
    document.getElementById('orderDate').value = order?.date || localDateInput();
    document.getElementById('orderDueDate').value = order?.dueDate || '';
    document.getElementById('orderClientName').value = order?.clientName || '';
    document.getElementById('orderQuantity').value = order?.quantity ?? 1;
    document.getElementById('orderUnitPrice').value = order?.unitPrice ?? 0;
    document.getElementById('orderStatus').value = order?.status || 'Pendiente';
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
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = items.length ? 'Selecciona un producto' : 'Agrega productos al inventario primero';
    placeholder.disabled = true;
    placeholder.selected = !selectedId;
    select.appendChild(placeholder);
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} — stock ${Number(item.quantity) || 0} ${item.unit || 'unidades'}`;
      option.selected = String(item.id) === String(selectedId);
      select.appendChild(option);
    });
    select.disabled = items.length === 0;
  }

  updateTotalPreview() {
    const quantity = Number(document.getElementById('orderQuantity')?.value) || 0;
    const price = Number(document.getElementById('orderUnitPrice')?.value) || 0;
    const preview = document.getElementById('orderTotalPreview');
    if (preview) preview.textContent = this.formatMoney(quantity * price);
  }

  saveOrder(event) {
    event.preventDefault();
    const id = document.getElementById('orderId').value;
    const inventoryId = document.getElementById('orderInventoryId').value;
    const product = this.app.inventoryModule.items.find(item => String(item.id) === String(inventoryId));
    const clientName = document.getElementById('orderClientName').value.trim();
    const quantity = Number(document.getElementById('orderQuantity').value);
    const unitPrice = Number(document.getElementById('orderUnitPrice').value);
    if (!product) return this.app.showToast('Selecciona un producto del inventario.', 'error');
    if (!clientName) return this.app.showToast('Escribe el nombre del cliente.', 'error');
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return this.app.showToast('Revisa la cantidad y el precio del pedido.', 'error');
    }
    const index = this.items.findIndex(item => item.id === id);
    const existing = index >= 0 ? this.items[index] : null;
    const status = document.getElementById('orderStatus').value;
    if (!ORDER_STATUSES.includes(status)) return this.app.showToast('Selecciona un estado válido para el pedido.', 'error');
    if (status === 'Entregado' && !existing?.saleId) {
      return this.app.showToast('Primero cambia el pedido a “Listo” y usa Registrar venta para descontar inventario.', 'error');
    }
    const order = {
      id: id || makeId('order'),
      orderNumber: existing?.orderNumber || `PED-${Date.now().toString().slice(-8)}`,
      inventoryId: product.id,
      date: document.getElementById('orderDate').value || localDateInput(),
      dueDate: document.getElementById('orderDueDate').value,
      productName: product.name,
      clientName,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      status,
      paymentMethod: document.getElementById('orderPaymentMethod').value,
      notes: document.getElementById('orderNotes').value.trim(),
      saleId: existing?.saleId || ''
    };
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

  convertToSale(order) {
    if (order.saleId) return this.app.showToast('Este pedido ya tiene una venta registrada.', 'info');
    if (order.status !== 'Listo') return this.app.showToast('Cambia el estado del pedido a “Listo” antes de registrarlo como venta.', 'error');
    const product = this.app.inventoryModule.items.find(item => String(item.id) === String(order.inventoryId));
    const available = Number(product?.quantity) || 0;
    if (!product) return this.app.showToast('El producto ya no existe en el inventario.', 'error');
    if (Number(order.quantity) > available) {
      return this.app.showToast(`Existencias insuficientes. Disponibles: ${available} ${product.unit || ''}.`, 'error');
    }
    const sale = {
      id: makeId('sale'),
      inventoryId: product.id,
      date: localDateInput(),
      productName: product.name,
      clientName: order.clientName,
      quantity: Number(order.quantity),
      unitPrice: Number(order.unitPrice),
      total: Number(order.total),
      paymentMethod: order.paymentMethod || 'Otro',
      notes: `Registrada desde el pedido ${order.orderNumber}. ${order.notes || ''}`.trim()
    };
    product.quantity = available - sale.quantity;
    this.app.inventoryModule.persist();
    this.app.salesModule.items.push(sale);
    this.app.salesModule.persist();
    order.saleId = sale.id;
    order.status = 'Entregado';
    this.persist();
    this.app.showToast(`Pedido ${order.orderNumber} registrado como venta.`, 'success');
  }

  render() {
    if (!this.tableBody) return;
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
    const status = this.statusFilter?.value || '';
    const visible = [...this.items]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter(item => (!status || item.status === status) && `${item.orderNumber} ${item.clientName} ${item.productName} ${item.notes || ''}`.toLowerCase().includes(query));
    this.tableBody.replaceChildren();
    if (!visible.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.className = 'text-center text-secondary py-4';
      cell.textContent = this.items.length ? 'No hay pedidos que coincidan con la búsqueda.' : 'Aún no hay pedidos registrados.';
      row.appendChild(cell);
      this.tableBody.appendChild(row);
      return;
    }
    visible.forEach(order => {
      const row = document.createElement('tr');
      const statusClass = order.status === 'Cancelado' ? 'text-bg-secondary' : order.status === 'Entregado' ? 'text-bg-success' : order.status === 'Listo' ? 'text-bg-primary' : 'text-bg-warning';
      [order.orderNumber, order.clientName, order.productName, order.dueDate || '—', `${order.quantity}`, this.formatMoney(order.total), order.status]
        .forEach((value, index) => {
          const cell = document.createElement('td');
          cell.textContent = String(value || '—');
          if (index === 6) cell.innerHTML = `<span class="badge ${statusClass}">${String(value || 'Pendiente')}</span>`;
          row.appendChild(cell);
        });
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      if (order.status === 'Listo' && !order.saleId) {
        const saleButton = document.createElement('button');
        saleButton.type = 'button';
        saleButton.className = 'btn btn-sm btn-outline-success me-1';
        saleButton.title = 'Registrar como venta y descontar inventario';
        saleButton.setAttribute('aria-label', 'Registrar como venta y descontar inventario');
        saleButton.innerHTML = '<i class="bi bi-cash-coin"></i>';
        saleButton.addEventListener('click', () => this.convertToSale(order));
        actions.appendChild(saleButton);
      }
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.title = 'Editar'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.disabled = Boolean(order.saleId);
      if (order.saleId) edit.title = 'El pedido ya está registrado como venta';
      else edit.addEventListener('click', () => this.openForm(order));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.title = 'Eliminar'; remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.disabled = Boolean(order.saleId);
      if (order.saleId) remove.title = 'El pedido ya está registrado como venta';
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
  }

  formatMoney(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
}

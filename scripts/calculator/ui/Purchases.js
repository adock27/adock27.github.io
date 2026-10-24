import { Storage } from '../storage.js';

const PURCHASE_TYPES = {
  equipo: 'Equipo',
  insumo: 'Insumo',
  mantenimiento: 'Mantenimiento',
  gasto: 'Gasto del negocio'
};

function localDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `purchase_${Date.now()}`;
}

export class Purchases {
  constructor(app) {
    this.app = app;
    this.items = app.purchases || [];
    this.form = document.getElementById('purchaseForm');
    this.modalElement = document.getElementById('purchaseModal');
    this.modal = window.bootstrap?.Modal && this.modalElement
      ? window.bootstrap.Modal.getOrCreateInstance(this.modalElement)
      : null;
    this.tableBody = document.getElementById('purchasesTableBody');
    this.searchInput = document.getElementById('purchasesSearch');
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    document.getElementById('btnAddPurchase')?.addEventListener('click', () => this.openForm());
    this.form?.addEventListener('submit', event => this.savePurchase(event));
    this.searchInput?.addEventListener('input', () => this.renderTable());
    document.getElementById('purchaseType')?.addEventListener('change', () => this.toggleSupplyFields());
    document.getElementById('purchaseQuantity')?.addEventListener('input', event => {
      if (!document.getElementById('purchaseId').value) document.getElementById('purchaseRemainingQuantity').value = event.target.value;
    });
  }

  openForm(item = null) {
    this.form?.reset();
    document.getElementById('purchaseId').value = item?.id || '';
    document.getElementById('purchaseDate').value = item?.date || localDateInput();
    document.getElementById('purchaseType').value = item?.type || 'insumo';
    document.getElementById('purchaseItemName').value = item?.itemName || '';
    document.getElementById('purchaseQuantity').value = item?.quantity ?? 1;
    document.getElementById('purchaseUnit').value = item?.unit || 'unidades';
    document.getElementById('purchaseCost').value = item?.purchaseCost ?? item?.totalCost ?? 0;
    document.getElementById('purchaseShipping').value = item?.shippingCost ?? 0;
    document.getElementById('purchaseRemainingQuantity').value = item?.remainingQuantity ?? item?.quantity ?? 1;
    document.getElementById('purchaseSupplier').value = item?.supplier || '';
    document.getElementById('purchasePaymentMethod').value = item?.paymentMethod || 'Efectivo';
    document.getElementById('purchaseNotes').value = item?.notes || '';
    document.getElementById('purchaseModalTitle').textContent = item ? 'Editar compra o inversión' : 'Registrar compra o inversión';
    this.toggleSupplyFields();
    this.modal?.show();
  }

  toggleSupplyFields() {
    const isSupply = document.getElementById('purchaseType')?.value === 'insumo';
    document.getElementById('purchaseQuantityWrap')?.classList.toggle('d-none', !isSupply);
    document.getElementById('purchaseUnitWrap')?.classList.toggle('d-none', !isSupply);
    document.getElementById('purchaseRemainingWrap')?.classList.toggle('d-none', !isSupply);
  }

  savePurchase(event) {
    event.preventDefault();
    const id = document.getElementById('purchaseId').value;
    const type = document.getElementById('purchaseType').value;
    const quantity = Number(document.getElementById('purchaseQuantity').value);
    const purchaseCost = Number(document.getElementById('purchaseCost').value);
    const shippingCost = Number(document.getElementById('purchaseShipping').value) || 0;
    const remainingQuantity = Number(document.getElementById('purchaseRemainingQuantity').value);
    if (!PURCHASE_TYPES[type]) return this.app.showToast('Selecciona una categoría válida.', 'error');
    if (!Number.isFinite(purchaseCost) || purchaseCost <= 0 || !Number.isFinite(shippingCost) || shippingCost < 0) {
      return this.app.showToast('El costo debe ser mayor que 0 y el envío no puede ser negativo.', 'error');
    }
    if (type === 'insumo' && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(remainingQuantity) || remainingQuantity < 0 || remainingQuantity > quantity)) {
      return this.app.showToast('Revisa la cantidad comprada y la cantidad disponible del insumo.', 'error');
    }
    const purchase = {
      id: id || makeId(),
      date: document.getElementById('purchaseDate').value || localDateInput(),
      type,
      itemName: document.getElementById('purchaseItemName').value.trim(),
      quantity: type === 'insumo' ? quantity : 1,
      unit: type === 'insumo' ? document.getElementById('purchaseUnit').value.trim() : 'unidad',
      purchaseCost,
      shippingCost,
      totalCost: purchaseCost + shippingCost,
      remainingQuantity: type === 'insumo' ? remainingQuantity : 0,
      supplier: document.getElementById('purchaseSupplier').value.trim(),
      paymentMethod: document.getElementById('purchasePaymentMethod').value,
      notes: document.getElementById('purchaseNotes').value.trim()
    };
    if (!purchase.itemName) return this.app.showToast('Escribe el nombre de lo que compraste.', 'error');
    const index = this.items.findIndex(current => current.id === id);
    if (index >= 0) this.items[index] = purchase;
    else this.items.push(purchase);
    this.persist();
    this.modal?.hide();
    this.app.showToast(index >= 0 ? 'Compra actualizada' : 'Compra registrada', 'success');
  }

  persist() {
    this.app.purchases = this.items;
    Storage.savePurchases(this.items);
    this.render();
  }

  render() {
    this.renderSummary();
    this.renderTable();
  }

  renderSummary() {
    const spent = this.items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
    const sales = (this.app.salesModule?.items || this.app.sales || []).reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const stockValue = this.items.filter(item => item.type === 'insumo').reduce((sum, item) => {
      const quantity = Math.max(0, Number(item.remainingQuantity) || 0);
      const purchasedQuantity = Number(item.quantity) || 0;
      return sum + (purchasedQuantity > 0 ? quantity * ((Number(item.totalCost) || 0) / purchasedQuantity) : 0);
    }, 0);
    const covered = Math.min(spent, sales);
    const pending = Math.max(0, spent - sales);
    const percent = spent > 0 ? Math.min(100, (sales / spent) * 100) : 0;
    this.setText('purchasesTotalSpent', this.formatMoney(spent));
    this.setText('purchasesSalesTotal', this.formatMoney(sales));
    this.setText('purchasesRecoveryAmount', this.formatMoney(pending));
    this.setText('purchasesStockValue', this.formatMoney(stockValue));
    this.setText('purchasesRecoveredAmount', this.formatMoney(covered));
    this.setText('purchasesRecoveryPercent', `${percent.toFixed(0)}% cubierto por ventas`);
    const progress = document.getElementById('purchasesRecoveryProgress');
    if (progress) {
      progress.style.width = `${percent}%`;
      progress.setAttribute('aria-valuenow', String(percent));
    }
    const pendingLabel = document.getElementById('purchasesRecoveryLabel');
    if (pendingLabel) pendingLabel.textContent = pending > 0 ? 'Desembolsos pendientes de cubrir con ventas' : (spent > 0 ? `Desembolsos cubiertos; excedente de ventas ${this.formatMoney(sales - spent)}` : 'Registra compras e inversiones para ver el avance');
  }

  renderTable() {
    if (!this.tableBody) return;
    const query = (this.searchInput?.value || '').trim().toLocaleLowerCase();
    const items = [...this.items]
      .filter(item => `${item.itemName || ''} ${PURCHASE_TYPES[item.type] || ''} ${item.supplier || ''} ${item.notes || ''}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    this.tableBody.replaceChildren();
    if (!items.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'text-center text-secondary py-4';
      cell.textContent = this.items.length ? 'No hay compras que coincidan con la búsqueda.' : 'Aún no has registrado compras o inversiones.';
      row.appendChild(cell);
      this.tableBody.appendChild(row);
      return;
    }
    items.forEach(item => {
      const row = document.createElement('tr');
      const qty = item.type === 'insumo'
        ? `${Number(item.remainingQuantity) || 0} / ${Number(item.quantity) || 0} ${item.unit || ''}`
        : '—';
      [this.formatDate(item.date), PURCHASE_TYPES[item.type] || 'Compra', item.itemName || '', qty, item.supplier || '—', this.formatMoney(item.totalCost)].forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (index === 2) cell.classList.add('fw-semibold');
        row.appendChild(cell);
      });
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-sm btn-outline-primary me-1';
      edit.title = item.type === 'insumo' ? 'Editar compra o ajustar saldo disponible' : 'Editar compra';
      edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.addEventListener('click', () => this.openForm(item));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-sm btn-outline-danger';
      remove.title = 'Eliminar';
      remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar el registro de “${item.itemName}”?`)) return;
        this.items = this.items.filter(current => current.id !== item.id);
        this.persist();
        this.app.showToast('Registro eliminado', 'info');
      });
      actions.append(edit, remove);
      row.appendChild(actions);
      this.tableBody.appendChild(row);
    });
  }

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  formatMoney(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  formatDate(value) {
    const dateOnly = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
    const date = new Date(`${dateOnly?.[1] || value || ''}T00:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO').format(date);
  }
}

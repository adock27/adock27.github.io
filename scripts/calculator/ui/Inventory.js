import { Storage } from '../storage.js';

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
    this.searchInput?.addEventListener('input', () => this.render());
  }

  openForm(item = null) {
    this.form?.reset();
    document.getElementById('inventoryItemId').value = item?.id || '';
    document.getElementById('inventoryName').value = item?.name || '';
    document.getElementById('inventoryCategory').value = item?.category || '';
    document.getElementById('inventoryQuantity').value = item?.quantity ?? 0;
    document.getElementById('inventoryUnit').value = item?.unit || 'unidades';
    document.getElementById('inventoryMinQuantity').value = item?.minQuantity ?? 0;
    document.getElementById('inventoryUnitCost').value = item?.unitCost ?? 0;
    document.getElementById('inventoryNotes').value = item?.notes || '';
    document.getElementById('inventoryModalTitle').textContent = item ? 'Editar artículo' : 'Añadir artículo';
    this.modal?.show();
  }

  saveItem(event) {
    event.preventDefault();
    const id = document.getElementById('inventoryItemId').value;
    const item = {
      id: id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `stock_${Date.now()}`),
      name: document.getElementById('inventoryName').value.trim(),
      category: document.getElementById('inventoryCategory').value.trim() || 'General',
      quantity: Number(document.getElementById('inventoryQuantity').value) || 0,
      unit: document.getElementById('inventoryUnit').value,
      minQuantity: Number(document.getElementById('inventoryMinQuantity').value) || 0,
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
    this.render();
  }

  render() {
    if (!this.tableBody) return;
    const query = (this.searchInput?.value || '').trim().toLowerCase();
    const visibleItems = this.items.filter(item => `${item.name} ${item.category} ${item.notes || ''}`.toLowerCase().includes(query));
    const lowStock = this.items.filter(item => Number(item.minQuantity) > 0 && Number(item.quantity) <= Number(item.minQuantity)).length;
    const totalValue = this.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
    const itemCount = document.getElementById('inventoryItemCount');
    const lowCount = document.getElementById('inventoryLowCount');
    const value = document.getElementById('inventoryTotalValue');
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
      return;
    }
    visibleItems.forEach(item => {
      const row = document.createElement('tr');
      const low = Number(item.minQuantity) > 0 && Number(item.quantity) <= Number(item.minQuantity);
      const values = [item.name, item.category || 'General', `${item.quantity} ${item.unit}`, `${item.minQuantity} ${item.unit}`, this.formatMoney(item.unitCost), low ? 'Stock bajo' : 'Disponible'];
      values.forEach((text, index) => {
        const cell = document.createElement('td');
        cell.textContent = text;
        if (index === 5) cell.innerHTML = `<span class="badge ${low ? 'text-bg-warning' : 'text-bg-success'}">${text}</span>`;
        if (index === 0) cell.classList.add('fw-semibold');
        row.appendChild(cell);
      });
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.title = 'Editar'; edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.addEventListener('click', () => this.openForm(item));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.title = 'Eliminar'; remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar “${item.name}” del inventario?`)) return;
        this.items = this.items.filter(current => current.id !== item.id);
        this.persist();
        this.app.showToast('Artículo eliminado', 'info');
      });
      actions.append(edit, remove);
      row.appendChild(actions);
      this.tableBody.appendChild(row);
    });
  }

  formatMoney(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.app.config.currency || 'COP', maximumFractionDigits: 0 }).format(Number(amount) || 0);
  }
}

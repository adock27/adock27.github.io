import { Storage } from '../storage.js';

const PURCHASE_TYPES = {
  equipo: 'Equipo',
  filamento: 'Filamento',
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
    document.getElementById('btnBulkPurchases')?.addEventListener('click', () => this.openBulkForm());
    document.getElementById('btnPreviewBulkPurchases')?.addEventListener('click', () => this.prepareBulkPreview());
    document.getElementById('btnSaveBulkPurchases')?.addEventListener('click', () => this.saveBulkPurchases());
    this.form?.addEventListener('submit', event => this.savePurchase(event));
    this.searchInput?.addEventListener('input', () => this.renderTable());
    document.getElementById('purchaseType')?.addEventListener('change', () => this.toggleSupplyFields());
    document.getElementById('purchaseMaterialId')?.addEventListener('change', () => this.updateSelectedMaterialName());
    document.getElementById('btnAddPurchaseMaterial')?.addEventListener('click', () => this.addMaterialFromPurchase());
    document.getElementById('purchaseQuantity')?.addEventListener('input', event => {
      if (!document.getElementById('purchaseId').value) document.getElementById('purchaseRemainingQuantity').value = event.target.value;
    });
    document.getElementById('btnRegisterFilamentConsumption')?.addEventListener('click', () => this.registerCurrentJobConsumption());
  }

  openBulkForm() {
    document.getElementById('bulkPurchasesInput').value = '';
    document.getElementById('bulkPurchasesDate').value = localDateInput();
    document.getElementById('bulkPurchasesPreview').replaceChildren();
    document.getElementById('bulkPurchasesMessage').textContent = '';
    document.getElementById('btnSaveBulkPurchases').disabled = true;
    this.bulkModalElement = document.getElementById('bulkPurchasesModal');
    this.bulkModal = window.bootstrap?.Modal && this.bulkModalElement
      ? window.bootstrap.Modal.getOrCreateInstance(this.bulkModalElement)
      : null;
    this.bulkModal?.show();
  }

  inferBulkType(name) {
    const value = name.toLocaleLowerCase();
    if (/\bcajas?\b/.test(value)) return 'insumo';
    if (/env[ií]o|aeropost/.test(value)) return 'equipo';
    if (/\b(pla|petg|abs|asa|tpu|filamento|sunlu)\b/.test(value)) return 'filamento';
    if (/repuesto/.test(value)) return 'mantenimiento';
    if (/impresora|equipo|sensor|lijadora|pulidora|placa/.test(value)) return 'equipo';
    return 'insumo';
  }

  parseBulkRows(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
      let cells;
      if (line.startsWith('|')) cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
      else if (line.includes('\t')) cells = line.split('\t').map(cell => cell.trim());
      else if (line.includes(';')) cells = line.split(';').map(cell => cell.trim());
      else if (line.includes('|')) cells = line.split('|').map(cell => cell.trim());
      else cells = line.split(/\s{2,}/).map(cell => cell.trim());
      if (cells.length < 2 || /^[-:]+$/.test(cells[0]) || /^[-:]+$/.test(cells[1])) return [];
      const amountText = cells.slice(1).join(' ').replace(/[\s$]/g, '').replace(/COP/gi, '');
      const amount = Number(amountText.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
      if (!cells[0] || !Number.isFinite(amount) || amount <= 0 || /^(art[ií]culo|producto|nombre|valor|monto|total)$/i.test(cells[0])) return [];
      const type = this.inferBulkType(cells[0]);
      const grams = cells[0].match(/\b(\d+(?:[.,]\d+)?)\s*g\b/i);
      const count = cells[0].match(/\bx\s*(\d+)\b/i);
      return [{ name: cells[0], amount, type,
        quantity: type === 'filamento' && grams ? Number(grams[1].replace(',', '.')) : count ? Number(count[1]) : '',
        unit: type === 'filamento' && grams ? 'g' : 'unidades' }];
    });
  }

  prepareBulkPreview() {
    const rows = this.parseBulkRows(document.getElementById('bulkPurchasesInput').value);
    const container = document.getElementById('bulkPurchasesPreview');
    container.replaceChildren();
    if (!rows.length) {
      document.getElementById('bulkPurchasesMessage').textContent = 'No encontré filas válidas. Usa nombre y valor en columnas separadas.';
      document.getElementById('btnSaveBulkPurchases').disabled = true;
      return;
    }
    const table = document.createElement('table'); table.className = 'table table-sm table-bordered align-middle mb-0';
    const head = document.createElement('thead'); head.className = 'table-light';
    head.innerHTML = '<tr><th>Artículo</th><th>Valor COP</th><th>Categoría</th><th>Cantidad</th><th>Unidad</th><th>Filamento del catálogo</th></tr>'; table.appendChild(head);
    const body = document.createElement('tbody');
    rows.forEach(item => {
      const row = document.createElement('tr'); row._bulkItem = item;
      const name = document.createElement('td'); name.textContent = item.name; name.className = 'fw-semibold'; row.appendChild(name);
      const amount = document.createElement('td'); amount.textContent = this.formatMoney(item.amount); row.appendChild(amount);
      const typeCell = document.createElement('td'); const type = document.createElement('select'); type.className = 'form-select form-select-sm bulk-type';
      Object.entries(PURCHASE_TYPES).forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = item.type === value; type.appendChild(option); }); typeCell.appendChild(type); row.appendChild(typeCell);
      const quantityCell = document.createElement('td'); const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '0.001'; quantity.step = 'any'; quantity.placeholder = 'Cantidad'; quantity.className = 'form-control form-control-sm bulk-quantity'; quantity.value = item.quantity || ''; quantityCell.appendChild(quantity); row.appendChild(quantityCell);
      const unitCell = document.createElement('td'); const unit = document.createElement('select'); unit.className = 'form-select form-select-sm bulk-unit';
      [['kg','kg'],['g','g'],['unidades','unidades'],['rollos','rollos'],['ml','ml'],['litros','litros'],['metros','metros']].forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; unit.appendChild(option); });
      unit.value = item.unit || (item.type === 'filamento' ? 'kg' : 'unidades'); unitCell.appendChild(unit); row.appendChild(unitCell);
      const materialCell = document.createElement('td'); const material = document.createElement('select'); material.className = 'form-select form-select-sm bulk-material';
      const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Selecciona o se creará'; material.appendChild(placeholder);
      (this.app.config.materials || []).forEach(entry => { const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; option.selected = entry.name.trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase(); material.appendChild(option); });
      materialCell.appendChild(material); row.appendChild(materialCell);
      type.addEventListener('change', () => { unit.value = type.value === 'filamento' ? 'kg' : 'unidades'; this.updateBulkRowFields(row); });
      row.querySelectorAll('select,input').forEach(input => input.addEventListener('input', () => this.updateBulkSaveButton()));
      body.appendChild(row); this.updateBulkRowFields(row);
    });
    table.appendChild(body); container.appendChild(table);
    const total = rows.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('bulkPurchasesMessage').textContent = `${rows.length} filas · Total ${this.formatMoney(total)}. Revisa las categorías y completa cantidades para filamentos e insumos que quieras controlar en stock.`;
    this.updateBulkSaveButton();
  }

  updateBulkRowFields(row) {
    const type = row.querySelector('.bulk-type').value;
    row.querySelector('.bulk-quantity').disabled = type !== 'insumo' && type !== 'filamento';
    row.querySelector('.bulk-unit').disabled = type !== 'insumo' && type !== 'filamento';
    row.querySelector('.bulk-material').disabled = type !== 'filamento';
    if (type !== 'filamento') row.querySelector('.bulk-material').value = '';
    this.updateBulkSaveButton();
  }

  updateBulkSaveButton() {
    const rows = [...document.querySelectorAll('#bulkPurchasesPreview tbody tr')];
    const invalid = rows.some(row => {
      const type = row.querySelector('.bulk-type').value;
      const value = row.querySelector('.bulk-quantity').value;
      const quantity = Number(value);
      return (type === 'filamento' && (!quantity || quantity <= 0)) || (type === 'insumo' && value !== '' && (!quantity || quantity <= 0));
    });
    const button = document.getElementById('btnSaveBulkPurchases');
    if (button) button.disabled = !rows.length || invalid;
  }

  saveBulkPurchases() {
    const rows = [...document.querySelectorAll('#bulkPurchasesPreview tbody tr')];
    if (!rows.length) return;
    const materialIds = [];
    rows.forEach(row => {
      const source = row._bulkItem, type = row.querySelector('.bulk-type').value, unit = row.querySelector('.bulk-unit').value;
      const suppliedQuantity = Number(row.querySelector('.bulk-quantity').value);
      const tracksStock = type === 'filamento' || (type === 'insumo' && suppliedQuantity > 0);
      const quantity = tracksStock ? suppliedQuantity : 1;
      let materialId = '';
      if (type === 'filamento') {
        const selectedId = row.querySelector('.bulk-material').value;
        let material = (this.app.config.materials || []).find(entry => String(entry.id) === selectedId);
        if (!material) {
          material = { id: makeId(), name: source.name.trim(), pricePerKg: 0, color: '#10b981', note: 'Costo actualizado desde Compras e inversiones' };
          this.app.config.materials.push(material);
        }
        materialId = material.id; materialIds.push(materialId);
      }
      this.items.push({ id: makeId(), date: document.getElementById('bulkPurchasesDate').value || localDateInput(), type,
        itemName: type === 'filamento' ? this.app.config.materials.find(entry => String(entry.id) === String(materialId)).name : source.name.trim(),
        materialId, quantity, unit: tracksStock ? unit : 'unidad', purchaseCost: source.amount, shippingCost: 0, totalCost: source.amount,
        remainingQuantity: tracksStock ? quantity : 0, supplier: '', paymentMethod: 'Otro', notes: 'Importación masiva' });
    });
    Storage.saveConfig(this.app.config);
    this.syncMaterialPrice(materialIds);
    this.persist(); this.app.settings?.renderCatalogTables(); this.bulkModal?.hide();
    this.app.showToast(`${rows.length} compras registradas.`, 'success');
  }

  openForm(item = null) {
    this.form?.reset();
    document.getElementById('purchaseId').value = item?.id || '';
    document.getElementById('purchaseDate').value = item?.date || localDateInput();
    document.getElementById('purchaseType').value = item?.type || 'insumo';
    document.getElementById('purchaseItemName').value = item?.itemName || '';
    this.renderMaterialOptions(item?.materialId || '');
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
    const type = document.getElementById('purchaseType')?.value;
    const isSupply = type === 'insumo' || type === 'filamento';
    const isFilament = type === 'filamento';
    document.getElementById('purchaseQuantityWrap')?.classList.toggle('d-none', !isSupply);
    document.getElementById('purchaseUnitWrap')?.classList.toggle('d-none', !isSupply);
    document.getElementById('purchaseRemainingWrap')?.classList.toggle('d-none', !isSupply);
    document.getElementById('purchaseMaterialWrap')?.classList.toggle('d-none', !isFilament);
    document.getElementById('purchaseItemNameWrap')?.classList.toggle('d-none', isFilament);
    const materialSelect = document.getElementById('purchaseMaterialId');
    const itemNameInput = document.getElementById('purchaseItemName');
    const unitSelect = document.getElementById('purchaseUnit');
    if (materialSelect) materialSelect.required = isFilament;
    if (itemNameInput) itemNameInput.required = !isFilament;
    if (unitSelect) {
      [...unitSelect.options].forEach(option => {
        option.disabled = isFilament && !['kg', 'g'].includes(option.value);
        option.hidden = option.disabled;
      });
    }
    if (isFilament && !['kg', 'g'].includes(unitSelect?.value)) {
      unitSelect.value = 'kg';
    }
    if (isFilament) this.updateSelectedMaterialName();
  }

  renderMaterialOptions(selectedId = '') {
    const select = document.getElementById('purchaseMaterialId');
    if (!select) return;
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona un filamento del catálogo';
    placeholder.disabled = true;
    placeholder.selected = !selectedId;
    select.appendChild(placeholder);
    (this.app.config.materials || []).forEach(material => {
      const option = document.createElement('option');
      option.value = material.id;
      option.textContent = `${material.name} — ${this.formatMoney(material.pricePerKg)}/kg`;
      option.selected = String(material.id) === String(selectedId);
      select.appendChild(option);
    });
  }

  updateSelectedMaterialName() {
    const materialId = document.getElementById('purchaseMaterialId')?.value;
    const material = (this.app.config.materials || []).find(item => String(item.id) === String(materialId));
    if (material) document.getElementById('purchaseItemName').value = material.name;
  }

  addMaterialFromPurchase() {
    const name = window.prompt('Nombre del filamento para agregar al catálogo:');
    if (!name?.trim()) return;
    const material = {
      id: makeId(), name: name.trim(), pricePerKg: 0, color: '#10b981',
      note: 'Costo actualizado desde Compras e inversiones'
    };
    this.app.config.materials.push(material);
    Storage.saveConfig(this.app.config);
    this.app.settings?.renderCatalogTables();
    this.app.filaments?.renderPalette();
    this.renderMaterialOptions(material.id);
    this.updateSelectedMaterialName();
    this.app.showToast('Filamento añadido al catálogo. Registra ahora su compra.', 'success');
  }

  quantityToGrams(quantity, unit) {
    const value = Math.max(0, Number(quantity) || 0);
    return ['kg', 'kilogramo', 'kilogramos'].includes(String(unit || '').trim().toLowerCase()) ? value * 1000 : value;
  }

  availableGrams(materialId) {
    return this.items.filter(item => item.type === 'filamento' && String(item.materialId || '') === String(materialId))
      .reduce((sum, item) => sum + this.quantityToGrams(item.remainingQuantity, item.unit), 0);
  }

  filamentStockLabel(materialId) {
    const hasPurchases = this.items.some(item => item.type === 'filamento' && String(item.materialId || '') === String(materialId));
    return hasPurchases ? `${this.availableGrams(materialId).toFixed(1)} g disponibles` : 'Stock sin registrar';
  }

  syncMaterialPrice(materialIds = []) {
    const uniqueIds = [...new Set(materialIds.filter(Boolean).map(String))];
    let changed = false;
    this.app.config.filamentBasePrices ||= {};
    uniqueIds.forEach(materialId => {
      const material = (this.app.config.materials || []).find(item => String(item.id) === materialId);
      if (!material) return;
      const linkedPurchases = this.items.filter(item => item.type === 'filamento' && String(item.materialId || '') === materialId);
      if (!Object.prototype.hasOwnProperty.call(this.app.config.filamentBasePrices, materialId)) {
        this.app.config.filamentBasePrices[materialId] = Number(material.pricePerKg) || 0;
        changed = true;
      }
      const grams = linkedPurchases.reduce((sum, item) => sum + this.quantityToGrams(item.quantity, item.unit), 0);
      const cost = linkedPurchases.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
      if (grams > 0) {
        material.pricePerKg = cost * 1000 / grams;
        changed = true;
      } else {
        material.pricePerKg = Number(this.app.config.filamentBasePrices[materialId]) || 0;
        changed = true;
      }
    });
    if (changed) {
      Storage.saveConfig(this.app.config);
      this.app.settings?.renderCatalogTables();
      this.app.filaments?.renderPalette();
      this.app.recalculate();
    }
  }

  registerCurrentJobConsumption() {
    const usage = new Map();
    (this.app.currentJob.materialSlots || []).forEach(slot => {
      const grams = Math.max(0, Number(slot.grams) || 0);
      if (slot.materialId && grams > 0) usage.set(String(slot.materialId), (usage.get(String(slot.materialId)) || 0) + grams);
    });
    if (!usage.size) return this.app.showToast('Agrega al menos un filamento y sus gramos en la calculadora.', 'error');
    const shortages = [...usage.entries()].map(([materialId, grams]) => {
      const material = (this.app.config.materials || []).find(item => String(item.id) === materialId);
      const available = this.availableGrams(materialId);
      return { materialId, grams, available, name: material?.name || materialId };
    }).filter(item => item.grams > item.available + 0.0001);
    if (shortages.length) {
      return this.app.showToast(`Stock insuficiente: ${shortages.map(item => `${item.name} (${item.available.toFixed(1)} g disponibles)`).join(', ')}.`, 'error');
    }
    if (!window.confirm('¿Registrar como consumidos los gramos de filamento de este trabajo? Hazlo después de completar la impresión para descontar el stock una sola vez.')) return;
    usage.forEach((gramsToUse, materialId) => {
      let remainingToUse = gramsToUse;
      const lots = this.items.filter(item => item.type === 'filamento' && String(item.materialId || '') === materialId)
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      lots.forEach(lot => {
        if (remainingToUse <= 0) return;
        const unitGrams = ['kg', 'kilogramo', 'kilogramos'].includes(String(lot.unit || '').trim().toLowerCase()) ? 1000 : 1;
        const lotGrams = this.quantityToGrams(lot.remainingQuantity, lot.unit);
        const consumedGrams = Math.min(lotGrams, remainingToUse);
        lot.remainingQuantity = Math.max(0, (lotGrams - consumedGrams) / unitGrams);
        remainingToUse -= consumedGrams;
      });
    });
    this.persist();
    this.app.showToast('Consumo registrado y stock de filamentos actualizado.', 'success');
  }

  savePurchase(event) {
    event.preventDefault();
    const id = document.getElementById('purchaseId').value;
    const type = document.getElementById('purchaseType').value;
    const quantity = Number(document.getElementById('purchaseQuantity').value);
    const purchaseCost = Number(document.getElementById('purchaseCost').value);
    const shippingCost = Number(document.getElementById('purchaseShipping').value) || 0;
    const remainingQuantity = Number(document.getElementById('purchaseRemainingQuantity').value);
    const materialId = type === 'filamento' ? document.getElementById('purchaseMaterialId').value : '';
    const material = (this.app.config.materials || []).find(item => String(item.id) === String(materialId));
    if (!PURCHASE_TYPES[type]) return this.app.showToast('Selecciona una categoría válida.', 'error');
    if (!Number.isFinite(purchaseCost) || purchaseCost <= 0 || !Number.isFinite(shippingCost) || shippingCost < 0) {
      return this.app.showToast('El costo debe ser mayor que 0 y el envío no puede ser negativo.', 'error');
    }
    if ((type === 'insumo' || type === 'filamento') && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(remainingQuantity) || remainingQuantity < 0 || remainingQuantity > quantity)) {
      return this.app.showToast('Revisa la cantidad comprada y la cantidad disponible del insumo.', 'error');
    }
    if (type === 'filamento' && !material) return this.app.showToast('Selecciona un filamento del catálogo o agrégalo desde este formulario.', 'error');
    const oldItem = this.items.find(current => current.id === id);
    const purchase = {
      id: id || makeId(),
      date: document.getElementById('purchaseDate').value || localDateInput(),
      type,
      itemName: type === 'filamento' ? material?.name || '' : document.getElementById('purchaseItemName').value.trim(),
      materialId: type === 'filamento' ? materialId : '',
      quantity: type === 'insumo' || type === 'filamento' ? quantity : 1,
      unit: type === 'insumo' || type === 'filamento' ? document.getElementById('purchaseUnit').value.trim() : 'unidad',
      purchaseCost,
      shippingCost,
      totalCost: purchaseCost + shippingCost,
      remainingQuantity: type === 'insumo' || type === 'filamento' ? remainingQuantity : 0,
      supplier: document.getElementById('purchaseSupplier').value.trim(),
      paymentMethod: document.getElementById('purchasePaymentMethod').value,
      notes: document.getElementById('purchaseNotes').value.trim()
    };
    if (!purchase.itemName) return this.app.showToast('Escribe el nombre de lo que compraste.', 'error');
    const index = this.items.findIndex(current => current.id === id);
    if (index >= 0) this.items[index] = purchase;
    else this.items.push(purchase);
    this.syncMaterialPrice([oldItem?.materialId, purchase.materialId]);
    this.persist();
    this.modal?.hide();
    this.app.showToast(index >= 0 ? 'Compra actualizada' : 'Compra registrada', 'success');
  }

  persist() {
    this.app.purchases = this.items;
    Storage.savePurchases(this.items);
    this.app.filaments?.renderPalette();
    this.render();
  }

  render() {
    this.renderSummary();
    this.renderTable();
  }

  renderSummary() {
    const spent = this.items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
    const sales = (this.app.salesModule?.items || this.app.sales || []).reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const stockValue = this.items.filter(item => item.type === 'insumo' || item.type === 'filamento').reduce((sum, item) => {
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
      .filter(item => `${this.getItemName(item)} ${PURCHASE_TYPES[item.type] || ''} ${item.supplier || ''} ${item.notes || ''}`.toLocaleLowerCase().includes(query))
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
      const qty = item.type === 'insumo' || item.type === 'filamento'
        ? `${Number(item.remainingQuantity) || 0} / ${Number(item.quantity) || 0} ${item.unit || ''}`
        : '—';
      [this.formatDate(item.date), PURCHASE_TYPES[item.type] || 'Compra', this.getItemName(item), qty, item.supplier || '—', this.formatMoney(item.totalCost)].forEach((value, index) => {
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
      edit.title = item.type === 'insumo' || item.type === 'filamento' ? 'Editar compra o ajustar saldo disponible' : 'Editar compra';
      edit.innerHTML = '<i class="bi bi-pencil"></i>';
      edit.addEventListener('click', () => this.openForm(item));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-sm btn-outline-danger';
      remove.title = 'Eliminar';
      remove.innerHTML = '<i class="bi bi-trash"></i>';
      remove.addEventListener('click', () => {
        if (!window.confirm(`¿Eliminar el registro de “${this.getItemName(item)}”?`)) return;
        const materialId = item.materialId;
        this.items = this.items.filter(current => current.id !== item.id);
        this.syncMaterialPrice([materialId]);
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

  getItemName(item) {
    if (item.materialId) {
      return (this.app.config.materials || []).find(material => String(material.id) === String(item.materialId))?.name || item.itemName || '';
    }
    return item.itemName || '';
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

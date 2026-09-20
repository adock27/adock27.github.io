import { Engine } from '../engine.js';

export class Extras {
  constructor(app) {
    this.app = app;
    this.extrasContainer = document.getElementById('extrasContainer');
  }

  render() {
    if (!this.extrasContainer) return;
    this.extrasContainer.innerHTML = '';

    if (!this.app.config.extrasCatalog || this.app.config.extrasCatalog.length === 0) {
      this.extrasContainer.innerHTML = `<p class="text-muted small mb-0">No hay extras en el catálogo. Agrégalos en Configuración.</p>`;
      return;
    }

    this.app.config.extrasCatalog.forEach(extra => {
      const activeExtra = this.app.currentJob.extras.find(e => e.id === extra.id) || { quantity: 0, unitCost: extra.defaultCost };

      const row = document.createElement('div');
      row.className = 'row g-2 align-items-center mb-2 p-2 bg-light rounded-3 border';

      row.innerHTML = `
        <div class="col-6 col-sm-5">
          <div class="fw-semibold small text-dark">${extra.name}</div>
          <div class="text-muted" style="font-size: 11px;">${extra.category || 'General'}</div>
        </div>
        <div class="col-3 col-sm-3">
          <div class="input-group input-group-sm">
            <input type="number" class="form-control extra-qty-input" data-extra-id="${extra.id}" min="0" value="${activeExtra.quantity}" placeholder="0">
            <span class="input-group-text">ud</span>
          </div>
        </div>
        <div class="col-3 col-sm-4 text-end">
          <span class="fw-bold small text-dark extra-total-label">${Engine.formatMoney(activeExtra.quantity * extra.defaultCost)}</span>
          <div class="text-muted" style="font-size: 10px;">${Engine.formatMoney(extra.defaultCost)} c/u</div>
        </div>
      `;

      this.extrasContainer.appendChild(row);
    });

    this.extrasContainer.querySelectorAll('.extra-qty-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const extraId = e.target.dataset.extraId;
        const catalogItem = this.app.config.extrasCatalog.find(x => x.id === extraId);
        const qty = Math.max(0, parseInt(e.target.value) || 0);

        let existing = this.app.currentJob.extras.find(x => x.id === extraId);
        if (existing) {
          existing.quantity = qty;
        } else if (catalogItem) {
          this.app.currentJob.extras.push({
            id: extraId,
            name: catalogItem.name,
            quantity: qty,
            unitCost: catalogItem.defaultCost
          });
        }

        const label = e.target.closest('.row').querySelector('.extra-total-label');
        if (label && catalogItem) {
          label.textContent = Engine.formatMoney(qty * catalogItem.defaultCost);
        }

        this.app.recalculate();
      });
    });
  }
}

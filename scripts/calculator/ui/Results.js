import { Engine } from '../engine.js';

export class Results {
  constructor(app) {
    this.app = app;
    this.el = {
      statFilamentCost: document.getElementById('statFilamentCost'),
      statEnergyCost: document.getElementById('statEnergyCost'),
      statMachineCost: document.getElementById('statMachineCost'),
      statLaborCost: document.getElementById('statLaborCost'),
      statExtrasCost: document.getElementById('statExtrasCost'),
      statFailureCost: document.getElementById('statFailureCost'),
      statTotalCost: document.getElementById('statTotalCost'),
      unitCostContainer: document.getElementById('unitCostContainer'),
      statUnitCost: document.getElementById('statUnitCost'),
      breakdownBar: document.getElementById('breakdownBar'),
      breakdownLegend: document.getElementById('breakdownLegend'),
      tiersContainer: document.getElementById('tiersContainer'),
      quoteTierSelect: document.getElementById('quoteTierSelect')
    };
  }

  render(report) {
    const currency = this.app.config.currency || 'COP';
    if (this.el.statFilamentCost) this.el.statFilamentCost.textContent = Engine.formatMoney(report.filament.totalFilamentCost, currency);
    if (this.el.statEnergyCost) this.el.statEnergyCost.textContent = Engine.formatMoney(report.energy.energyCost, currency);
    if (this.el.statMachineCost) this.el.statMachineCost.textContent = Engine.formatMoney(report.machineWearCost, currency);
    if (this.el.statLaborCost) this.el.statLaborCost.textContent = Engine.formatMoney(report.laborCost, currency);
    if (this.el.statExtrasCost) this.el.statExtrasCost.textContent = Engine.formatMoney(report.extras.totalExtrasCost, currency);
    if (this.el.statFailureCost) this.el.statFailureCost.textContent = Engine.formatMoney(report.failureBufferCost, currency);
    if (this.el.statTotalCost) this.el.statTotalCost.textContent = Engine.formatMoney(report.totalProductionCost, currency);

    if (this.app.currentJob.isBatch && this.app.currentJob.batchQuantity > 1) {
      if (this.el.unitCostContainer) this.el.unitCostContainer.classList.remove('d-none');
      if (this.el.statUnitCost) this.el.statUnitCost.textContent = `Costo Unitario: ${Engine.formatMoney(report.totalProductionCost / this.app.currentJob.batchQuantity, currency)}`;
    } else {
      if (this.el.unitCostContainer) this.el.unitCostContainer.classList.add('d-none');
    }

    if (this.el.breakdownBar) {
      this.el.breakdownBar.innerHTML = report.costBreakdown.map(item => `
        <div class="progress-bar" style="width: ${item.percent}%; background-color: ${item.color};" title="${item.label}: ${Engine.formatMoney(item.cost, currency)} (${item.percent.toFixed(1)}%)"></div>
      `).join('');
    }

    if (this.el.breakdownLegend) {
      this.el.breakdownLegend.innerHTML = report.costBreakdown.map(item => `
        <span class="badge bg-light text-secondary border me-1 mb-1" style="font-weight: 500;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${item.color}; margin-right:4px;"></span>
          ${item.label} ${item.percent.toFixed(0)}%
        </span>
      `).join('');
    }

    if (this.el.tiersContainer) {
      this.el.tiersContainer.innerHTML = report.tiers.map(tier => {
        const isRec = tier.id === 'rec';
        return `
          <div class="col-12 col-md-4">
            <div class="card h-100 rounded-3 ${isRec ? 'border-success shadow-sm bg-success-subtle' : 'border shadow-sm bg-white'} p-3 text-center">
              <span class="badge ${isRec ? 'bg-success' : 'bg-secondary'} rounded-pill mb-2 align-self-center px-3 py-1">
                ${tier.tag}
              </span>
              <div class="fw-bold text-dark mb-1">${tier.icon} ${tier.name}</div>
              <div class="fs-4 fw-bold ${isRec ? 'text-success' : 'text-dark'}">${Engine.formatMoney(tier.price, currency)}</div>
              <div class="small text-muted mt-1">Ganancia: <strong class="text-dark">${Engine.formatMoney(tier.profit, currency)}</strong></div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (this.el.quoteTierSelect) {
      const selectedTierId = this.el.quoteTierSelect.value || 'rec';
      this.el.quoteTierSelect.innerHTML = report.tiers.map(t => `
        <option value="${t.id}" ${t.id === selectedTierId ? 'selected' : ''}>${t.name} — ${Engine.formatMoney(t.price, currency)}</option>
      `).join('');
    }

    if (this.app.quote) {
      this.app.quote.updateQuotePreview();
    }
  }
}

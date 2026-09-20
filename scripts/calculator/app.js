import { Engine } from './engine.js';
import { Storage } from './storage.js';

import { Tabs } from './ui/Tabs.js';
import { Presets } from './ui/Presets.js';
import { Filaments } from './ui/Filaments.js';
import { Extras } from './ui/Extras.js';
import { Results } from './ui/Results.js';
import { Quote } from './ui/Quote.js';
import { Settings } from './ui/Settings.js';

class CalculatorApp {
  constructor() {
    this.config = Storage.loadConfig();
    this.presets = Storage.loadPresets();
    
    this.currentJob = {
      projectName: 'Llavero Personalizado',
      clientName: '',
      hours: 1,
      minutes: 25,
      laborMinutes: 10,
      isBatch: false,
      batchQuantity: 2,
      materialSlots: [
        { id: 'slot_1', materialId: 'pla_std', grams: 50 }
      ],
      extras: []
    };

    this.el = {
      projectName: document.getElementById('projectName'),
      clientName: document.getElementById('clientName'),
      hours: document.getElementById('printHours'),
      minutes: document.getElementById('printMinutes'),
      laborMinutes: document.getElementById('laborMinutes'),
      isBatchPrint: document.getElementById('isBatchPrint'),
      batchQuantity: document.getElementById('batchQuantity'),
      batchQuantityContainer: document.getElementById('batchQuantityContainer'),
      toastContainer: document.getElementById('toastContainer')
    };

    this.initUI();
    this.initEvents();
    this.recalculate();
  }

  initUI() {
    this.tabs = new Tabs(this);
    this.presetsComponent = new Presets(this);
    this.filaments = new Filaments(this);
    this.extras = new Extras(this);
    this.results = new Results(this);
    this.quote = new Quote(this);
    this.settings = new Settings(this);

    // Initial renders
    this.presetsComponent.render();
    this.filaments.renderPalette();
    this.filaments.renderMaterialSlots();
    this.extras.render();
    this.settings.render();
  }

  initEvents() {
    const triggerRecalc = () => {
      this.syncJobState();
      this.recalculate();
    };

    [this.el.projectName, this.el.clientName, this.el.hours, this.el.minutes, this.el.laborMinutes, this.el.isBatchPrint, this.el.batchQuantity]
      .forEach(input => {
        if (input) input.addEventListener('input', triggerRecalc);
      });

    if (this.el.isBatchPrint) {
      this.el.isBatchPrint.addEventListener('change', () => {
        if (this.el.batchQuantityContainer) {
          if (this.el.isBatchPrint.checked) {
            this.el.batchQuantityContainer.classList.remove('d-none');
          } else {
            this.el.batchQuantityContainer.classList.add('d-none');
          }
        }
      });
    }
  }

  syncJobState() {
    this.currentJob.projectName = this.el.projectName?.value || 'Proyecto 3D';
    this.currentJob.clientName = this.el.clientName?.value || '';
    this.currentJob.hours = Number(this.el.hours?.value) || 0;
    this.currentJob.minutes = Number(this.el.minutes?.value) || 0;
    this.currentJob.laborMinutes = Number(this.el.laborMinutes?.value) || 0;
    this.currentJob.isBatch = this.el.isBatchPrint?.checked || false;
    this.currentJob.batchQuantity = Number(this.el.batchQuantity?.value) || 1;
  }

  recalculate() {
    const materialSlotsWithPrices = this.currentJob.materialSlots.map(slot => {
      const catalogMat = this.config.materials.find(m => m.id === slot.materialId) || { name: 'Material', pricePerKg: 50000 };
      return {
        ...slot,
        materialName: catalogMat.name,
        pricePerKg: catalogMat.pricePerKg
      };
    });

    const extrasWithPrices = this.currentJob.extras.map(extra => {
      const catalogExtra = this.config.extrasCatalog.find(x => x.id === extra.id);
      return {
        ...extra,
        name: catalogExtra ? catalogExtra.name : (extra.name || extra.id),
        unitCost: catalogExtra ? catalogExtra.defaultCost : extra.unitCost
      };
    });

    const report = Engine.calculate({
      materialSlots: materialSlotsWithPrices,
      hours: this.currentJob.hours,
      minutes: this.currentJob.minutes,
      laborMinutes: this.currentJob.laborMinutes,
      extras: extrasWithPrices
    }, this.config);

    this.latestReport = report;
    this.results.render(report);
  }

  showToast(message, type = 'success') {
    if (!this.el.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : type === 'info' ? 'info' : 'success'} shadow-sm py-2 px-3 mb-2 rounded-3 small d-flex align-items-center gap-2`;
    const icon = type === 'success' ? 'check-circle-fill' : type === 'error' ? 'exclamation-triangle-fill' : 'info-circle-fill';
    toast.innerHTML = `<i class="bi bi-${icon}"></i> <span>${message}</span>`;

    this.el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.calcApp = new CalculatorApp();
});

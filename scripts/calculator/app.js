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
    this.initInitialSetup();
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

  initInitialSetup() {
    const modalEl = document.getElementById('initialSetupModal');
    const reminder = document.getElementById('setupReminder');
    if (!modalEl || !window.bootstrap?.Modal) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const fields = {
      currency: document.getElementById('setupCurrency'),
      electricityRate: document.getElementById('setupElectricity'),
      powerKw: document.getElementById('setupPower'),
      wearRatePerHour: document.getElementById('setupWear'),
      laborRatePerHour: document.getElementById('setupLabor'),
      failureRatePercent: document.getElementById('setupFailure'),
      purgeWastePercent: document.getElementById('setupPurge'),
      roundingStep: document.getElementById('setupRounding')
    };
    const updateReminder = () => {
      const completed = Boolean(this.config.initialSetupCompleted);
      reminder?.classList.toggle('d-none', completed);
      reminder?.classList.toggle('d-flex', !completed);
    };
    const fillForm = () => {
      fields.currency.value = this.config.currency || 'COP';
      fields.electricityRate.value = this.config.electricityRate;
      fields.powerKw.value = this.config.powerKw;
      fields.wearRatePerHour.value = this.config.wearRatePerHour;
      fields.laborRatePerHour.value = this.config.laborRatePerHour;
      fields.failureRatePercent.value = this.config.failureRatePercent;
      fields.purgeWastePercent.value = this.config.purgeWastePercent;
      fields.roundingStep.value = this.config.roundingStep;
      document.querySelectorAll('.setupCurrencyCode').forEach(el => { el.textContent = fields.currency.value; });
    };

    fillForm();
    updateReminder();
    fields.currency.addEventListener('change', () => {
      [fields.electricityRate, fields.wearRatePerHour, fields.laborRatePerHour, fields.roundingStep]
        .forEach(input => { input.value = ''; });
      document.querySelectorAll('.setupCurrencyCode').forEach(el => { el.textContent = fields.currency.value; });
    });
    document.getElementById('btnOpenSetup')?.addEventListener('click', () => {
      fillForm();
      modal.show();
    });
    document.getElementById('btnSaveInitialSetup')?.addEventListener('click', () => {
      const currencyInputs = [fields.electricityRate, fields.wearRatePerHour, fields.laborRatePerHour, fields.roundingStep];
      const missingCurrencyInput = currencyInputs.find(input => input.value.trim() === '');
      if (missingCurrencyInput) {
        this.showToast('Completa los importes en la moneda seleccionada para continuar.', 'error');
        missingCurrencyInput.focus();
        return;
      }
      this.config.currency = fields.currency.value;
      this.config.electricityRate = Number(fields.electricityRate.value) || 0;
      this.config.powerKw = Number(fields.powerKw.value) || 0;
      this.config.wearRatePerHour = Number(fields.wearRatePerHour.value) || 0;
      this.config.laborRatePerHour = Number(fields.laborRatePerHour.value) || 0;
      this.config.failureRatePercent = Number(fields.failureRatePercent.value) || 0;
      this.config.purgeWastePercent = Number(fields.purgeWastePercent.value) || 0;
      this.config.roundingStep = Number(fields.roundingStep.value) || 0;
      this.config.initialSetupCompleted = true;
      this.config.initialSetupDismissed = true;
      Storage.saveConfig(this.config);
      this.settings.render();
      this.filaments.renderPalette();
      this.extras.render();
      this.recalculate();
      updateReminder();
      modal.hide();
      this.showToast('Configuración inicial guardada. Revisa los precios de tus catálogos.', 'success');
    });
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (!this.config.initialSetupCompleted) {
        this.config.initialSetupDismissed = true;
        Storage.saveConfig(this.config);
        updateReminder();
      }
    });

    if (!this.config.initialSetupCompleted && !this.config.initialSetupDismissed) modal.show();
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

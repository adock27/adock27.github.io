/**
 * 3D Print Calculator Controller & Reactive UI
 * Orquesta los eventos del usuario, renderizado dinámico, cotizador y persistencia.
 * Diseñado para interfaz Bootstrap 5 minimalista.
 */

import { Engine } from './engine.js';
import { Storage, DEFAULT_CONFIG } from './storage.js';

class CalculatorApp {
  constructor() {
    this.config = Storage.loadConfig();
    this.presets = Storage.loadPresets();

    // Estado del trabajo de impresión activo
    this.currentJob = {
      projectName: 'Llavero Personalizado',
      clientName: '',
      hours: 1,
      minutes: 25,
      laborMinutes: 10,
      materialSlots: [
        { id: 'slot_1', materialId: 'pla_std', grams: 50 }
      ],
      extras: []
    };

    this.initElements();
    this.initTabs();
    this.initEvents();
    this.renderPresets();
    this.renderMaterialSlots();
    this.renderActiveExtras();
    this.renderSettings();
    this.recalculate();
  }

  /**
   * Captura referencias a elementos del DOM
   */
  initElements() {
    this.el = {
      // Pestañas
      tabBtns: document.querySelectorAll('.nav-tab-btn'),
      tabPanes: document.querySelectorAll('.tab-pane-view'),

      // Inputs de impresión
      projectName: document.getElementById('projectName'),
      clientName: document.getElementById('clientName'),
      hours: document.getElementById('printHours'),
      minutes: document.getElementById('printMinutes'),
      laborMinutes: document.getElementById('laborMinutes'),
      materialSlotsContainer: document.getElementById('materialSlotsContainer'),
      btnAddMaterialSlot: document.getElementById('btnAddMaterialSlot'),
      extrasContainer: document.getElementById('extrasContainer'),

      // Presets
      presetsShelf: document.getElementById('presetsShelf'),
      btnSaveAsPreset: document.getElementById('btnSaveAsPreset'),

      // Estadísticas y resultados
      statFilamentCost: document.getElementById('statFilamentCost'),
      statEnergyCost: document.getElementById('statEnergyCost'),
      statMachineCost: document.getElementById('statMachineCost'),
      statLaborCost: document.getElementById('statLaborCost'),
      statExtrasCost: document.getElementById('statExtrasCost'),
      statFailureCost: document.getElementById('statFailureCost'),
      statTotalCost: document.getElementById('statTotalCost'),
      breakdownBar: document.getElementById('breakdownBar'),
      breakdownLegend: document.getElementById('breakdownLegend'),
      tiersContainer: document.getElementById('tiersContainer'),

      // Cotización
      quotePreview: document.getElementById('quotePreview'),
      btnCopyQuote: document.getElementById('btnCopyQuote'),
      quoteTierSelect: document.getElementById('quoteTierSelect'),

      // Configuración de máquina
      cfgElectricity: document.getElementById('cfgElectricity'),
      cfgPowerKw: document.getElementById('cfgPowerKw'),
      cfgWearRate: document.getElementById('cfgWearRate'),
      cfgFailureRate: document.getElementById('cfgFailureRate'),
      cfgPurgeWaste: document.getElementById('cfgPurgeWaste'),
      cfgLaborRate: document.getElementById('cfgLaborRate'),
      cfgRoundingStep: document.getElementById('cfgRoundingStep'),
      btnSaveConfig: document.getElementById('btnSaveConfig'),
      btnResetConfig: document.getElementById('btnResetConfig'),
      btnExportBackup: document.getElementById('btnExportBackup'),
      btnImportBackup: document.getElementById('btnImportBackup'),
      importFileInput: document.getElementById('importFileInput'),

      // Catálogos
      materialsTableBody: document.getElementById('materialsTableBody'),
      btnAddCatalogMaterial: document.getElementById('btnAddCatalogMaterial'),
      extrasTableBody: document.getElementById('extrasTableBody'),
      btnAddCatalogExtra: document.getElementById('btnAddCatalogExtra'),

      // Toast container
      toastContainer: document.getElementById('toastContainer')
    };
  }

  /**
   * Navegación por pestañas (Bootstrap Nav Pills)
   */
  initTabs() {
    this.el.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        this.switchTab(targetId);
      });
    });
  }

  switchTab(targetId) {
    this.el.tabBtns.forEach(b => {
      const isTarget = b.dataset.target === targetId;
      b.classList.toggle('active', isTarget);
      b.classList.toggle('bg-success', isTarget);
      b.classList.toggle('text-white', isTarget);
    });

    this.el.tabPanes.forEach(pane => {
      pane.classList.toggle('d-none', pane.id !== targetId);
    });

    if (targetId === 'tab-quote') {
      this.updateQuotePreview();
    }
  }

  /**
   * Enlace de eventos reactivos
   */
  initEvents() {
    const triggerRecalc = () => {
      this.syncJobState();
      this.recalculate();
    };

    [this.el.projectName, this.el.clientName, this.el.hours, this.el.minutes, this.el.laborMinutes]
      .forEach(input => {
        if (input) {
          input.addEventListener('input', triggerRecalc);
        }
      });

    // Añadir ranura de filamento (AMS multi-color)
    this.el.btnAddMaterialSlot?.addEventListener('click', () => {
      this.currentJob.materialSlots.push({
        id: 'slot_' + Date.now(),
        materialId: this.config.materials[0]?.id || 'pla_std',
        grams: 20
      });
      this.renderMaterialSlots();
      this.recalculate();
      this.showToast('Color / filamento adicional añadido', 'info');
    });

    // Guardar preset
    this.el.btnSaveAsPreset?.addEventListener('click', () => this.handleSaveCurrentAsPreset());

    // Configuración general
    this.el.btnSaveConfig?.addEventListener('click', () => this.handleSaveMachineConfig());
    this.el.btnResetConfig?.addEventListener('click', () => this.handleResetConfig());

    // Exportar / Importar
    this.el.btnExportBackup?.addEventListener('click', () => this.handleExportBackup());
    this.el.btnImportBackup?.addEventListener('click', () => this.el.importFileInput?.click());
    this.el.importFileInput?.addEventListener('change', (e) => this.handleImportBackup(e));

    // Copiar cotización
    this.el.btnCopyQuote?.addEventListener('click', () => this.handleCopyQuote());
    this.el.quoteTierSelect?.addEventListener('change', () => this.updateQuotePreview());

    // Añadir material y extra al catálogo
    this.el.btnAddCatalogMaterial?.addEventListener('click', () => this.handleAddNewCatalogMaterial());
    this.el.btnAddCatalogExtra?.addEventListener('click', () => this.handleAddNewCatalogExtra());
  }

  syncJobState() {
    this.currentJob.projectName = this.el.projectName?.value || 'Proyecto 3D';
    this.currentJob.clientName = this.el.clientName?.value || '';
    this.currentJob.hours = Number(this.el.hours?.value) || 0;
    this.currentJob.minutes = Number(this.el.minutes?.value) || 0;
    this.currentJob.laborMinutes = Number(this.el.laborMinutes?.value) || 0;
  }

  /**
   * Renderiza las ranuras de material (AMS) con clases Bootstrap
   */
  renderMaterialSlots() {
    if (!this.el.materialSlotsContainer) return;
    this.el.materialSlotsContainer.innerHTML = '';

    this.currentJob.materialSlots.forEach((slot, index) => {
      const row = document.createElement('div');
      row.className = 'row g-2 align-items-center mb-2 p-2 bg-light rounded-3 border';

      const selectHtml = `
        <div class="col-7 col-sm-6">
          <select class="form-select form-select-sm slot-material-select" data-slot-id="${slot.id}">
            ${this.config.materials.map(m => `
              <option value="${m.id}" ${m.id === slot.materialId ? 'selected' : ''}>
                ${m.name} (${Engine.formatMoney(m.pricePerKg)}/kg)
              </option>
            `).join('')}
          </select>
        </div>
      `;

      const gramsHtml = `
        <div class="col-3 col-sm-4">
          <div class="input-group input-group-sm">
            <input type="number" class="form-control slot-grams-input" data-slot-id="${slot.id}" min="0.1" step="0.5" value="${slot.grams}" placeholder="Gramos">
            <span class="input-group-text">g</span>
          </div>
        </div>
      `;

      const removeBtnHtml = this.currentJob.materialSlots.length > 1
        ? `<div class="col-2 col-sm-2 text-end">
            <button type="button" class="btn btn-sm btn-outline-danger btn-remove-slot" data-slot-id="${slot.id}" title="Eliminar filamento">
              <i class="bi bi-trash"></i>
            </button>
          </div>`
        : `<div class="col-2 col-sm-2 text-center text-muted small">Slot ${index + 1}</div>`;

      row.innerHTML = selectHtml + gramsHtml + removeBtnHtml;
      this.el.materialSlotsContainer.appendChild(row);
    });

    this.el.materialSlotsContainer.querySelectorAll('.slot-material-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const slotId = e.target.dataset.slotId;
        const slot = this.currentJob.materialSlots.find(s => s.id === slotId);
        if (slot) {
          slot.materialId = e.target.value;
          this.recalculate();
        }
      });
    });

    this.el.materialSlotsContainer.querySelectorAll('.slot-grams-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const slotId = e.target.dataset.slotId;
        const slot = this.currentJob.materialSlots.find(s => s.id === slotId);
        if (slot) {
          slot.grams = Math.max(0, Number(e.target.value) || 0);
          this.recalculate();
        }
      });
    });

    this.el.materialSlotsContainer.querySelectorAll('.btn-remove-slot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slotId = e.currentTarget.dataset.slotId;
        this.currentJob.materialSlots = this.currentJob.materialSlots.filter(s => s.id !== slotId);
        this.renderMaterialSlots();
        this.recalculate();
      });
    });
  }

  /**
   * Renderiza la lista de extras e insumos con clases Bootstrap
   */
  renderActiveExtras() {
    if (!this.el.extrasContainer) return;
    this.el.extrasContainer.innerHTML = '';

    if (!this.config.extrasCatalog || this.config.extrasCatalog.length === 0) {
      this.el.extrasContainer.innerHTML = `<p class="text-muted small mb-0">No hay extras en el catálogo. Agrégalos en Configuración.</p>`;
      return;
    }

    this.config.extrasCatalog.forEach(extra => {
      const activeExtra = this.currentJob.extras.find(e => e.id === extra.id) || { quantity: 0, unitCost: extra.defaultCost };

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

      this.el.extrasContainer.appendChild(row);
    });

    this.el.extrasContainer.querySelectorAll('.extra-qty-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const extraId = e.target.dataset.extraId;
        const catalogItem = this.config.extrasCatalog.find(x => x.id === extraId);
        const qty = Math.max(0, parseInt(e.target.value) || 0);

        let existing = this.currentJob.extras.find(x => x.id === extraId);
        if (existing) {
          existing.quantity = qty;
        } else if (catalogItem) {
          this.currentJob.extras.push({
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

        this.recalculate();
      });
    });
  }

  /**
   * Renderiza los botones de presets rápidos con botón de borrar
   */
  renderPresets() {
    if (!this.el.presetsShelf) return;
    this.el.presetsShelf.innerHTML = '';

    if (this.presets.length === 0) {
      this.el.presetsShelf.innerHTML = `<span class="text-muted small fst-italic">Sin presets guardados aún.</span>`;
      return;
    }

    this.presets.forEach(preset => {
      const wrapper = document.createElement('span');
      wrapper.className = 'preset-pill-wrapper me-2 mb-2';
      wrapper.style.cssText = 'display:inline-flex; align-items:center; border:1px solid #dee2e6; border-radius:50px; overflow:hidden; background:#fff;';

      // Botón principal: aplica el preset
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn btn-sm btn-outline-secondary border-0 rounded-0 rounded-start-pill px-3';
      applyBtn.style.cssText = 'border-right:1px solid #dee2e6 !important;';
      applyBtn.textContent = preset.name;
      applyBtn.title = preset.description || 'Aplicar preset';
      applyBtn.addEventListener('click', () => this.applyPreset(preset));

      // Botón borrar
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-sm btn-outline-danger border-0 rounded-0 rounded-end-pill px-2';
      delBtn.innerHTML = '<i class="bi bi-x"></i>';
      delBtn.title = 'Eliminar preset';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar el preset "${preset.name}"?`)) {
          this.presets = Storage.deletePreset(preset.id);
          this.renderPresets();
          this.showToast(`Preset eliminado`, 'info');
        }
      });

      wrapper.appendChild(applyBtn);
      wrapper.appendChild(delBtn);
      this.el.presetsShelf.appendChild(wrapper);
    });
  }

  applyPreset(preset) {
    if (this.el.projectName) this.el.projectName.value = preset.name.replace(/^[^\w\s]+/, '').trim();
    if (this.el.hours) this.el.hours.value = preset.hours ?? 0;
    if (this.el.minutes) this.el.minutes.value = preset.minutes ?? 0;
    if (this.el.laborMinutes) this.el.laborMinutes.value = preset.laborMinutes ?? 0;

    this.currentJob.hours = preset.hours ?? 0;
    this.currentJob.minutes = preset.minutes ?? 0;
    this.currentJob.laborMinutes = preset.laborMinutes ?? 0;

    this.currentJob.materialSlots = [{
      id: 'slot_1',
      materialId: preset.materialId || this.config.materials[0]?.id || 'pla_std',
      grams: preset.grams || 50
    }];

    this.currentJob.extras = Array.isArray(preset.extras) ? JSON.parse(JSON.stringify(preset.extras)) : [];

    this.renderMaterialSlots();
    this.renderActiveExtras();
    this.recalculate();
    this.showToast(`Preset cargado: ${preset.name}`, 'success');
  }

  handleSaveCurrentAsPreset() {
    const name = prompt('Nombre del preset:', this.currentJob.projectName || 'Mi Trabajo');
    if (!name || !name.trim()) return;

    const newPreset = {
      id: 'preset_' + Date.now(),
      name: '⭐ ' + name.trim(),
      description: `Gramos: ${this.currentJob.materialSlots.reduce((a, b) => a + b.grams, 0)}g | Tiempo: ${this.currentJob.hours}h ${this.currentJob.minutes}m`,
      materialId: this.currentJob.materialSlots[0]?.materialId || 'pla_std',
      grams: this.currentJob.materialSlots[0]?.grams || 50,
      hours: this.currentJob.hours,
      minutes: this.currentJob.minutes,
      laborMinutes: this.currentJob.laborMinutes,
      extras: this.currentJob.extras.filter(x => x.quantity > 0)
    };

    this.presets = Storage.savePreset(newPreset);
    this.renderPresets();
    this.showToast('¡Preset guardado!', 'success');
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
    this.renderResults(report);
  }

  /**
   * Renderiza resultados con componentes de Bootstrap
   */
  renderResults(report) {
    if (this.el.statFilamentCost) this.el.statFilamentCost.textContent = Engine.formatMoney(report.filament.totalFilamentCost);
    if (this.el.statEnergyCost) this.el.statEnergyCost.textContent = Engine.formatMoney(report.energy.energyCost);
    if (this.el.statMachineCost) this.el.statMachineCost.textContent = Engine.formatMoney(report.machineWearCost);
    if (this.el.statLaborCost) this.el.statLaborCost.textContent = Engine.formatMoney(report.laborCost);
    if (this.el.statExtrasCost) this.el.statExtrasCost.textContent = Engine.formatMoney(report.extras.totalExtrasCost);
    if (this.el.statFailureCost) this.el.statFailureCost.textContent = Engine.formatMoney(report.failureBufferCost);
    if (this.el.statTotalCost) this.el.statTotalCost.textContent = Engine.formatMoney(report.totalProductionCost);

    // Barra de desglose con Bootstrap Progress
    if (this.el.breakdownBar) {
      this.el.breakdownBar.innerHTML = report.costBreakdown.map(item => `
        <div class="progress-bar" style="width: ${item.percent}%; background-color: ${item.color};" title="${item.label}: ${Engine.formatMoney(item.cost)} (${item.percent.toFixed(1)}%)"></div>
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

    // Tiers con Cards limpias de Bootstrap
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
              <div class="fs-4 fw-bold ${isRec ? 'text-success' : 'text-dark'}">${Engine.formatMoney(tier.price)}</div>
              <div class="small text-muted mt-1">Ganancia: <strong class="text-dark">${Engine.formatMoney(tier.profit)}</strong></div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (this.el.quoteTierSelect && this.el.quoteTierSelect.children.length === 0) {
      this.el.quoteTierSelect.innerHTML = report.tiers.map(t => `
        <option value="${t.id}" ${t.id === 'rec' ? 'selected' : ''}>${t.name} — ${Engine.formatMoney(t.price)}</option>
      `).join('');
    }

    this.updateQuotePreview();
  }

  updateQuotePreview() {
    if (!this.el.quotePreview || !this.latestReport) return;

    const tierId = this.el.quoteTierSelect?.value || 'rec';
    const selectedTier = this.latestReport.tiers.find(t => t.id === tierId) || this.latestReport.tiers[1] || this.latestReport.tiers[0];

    const materialsText = this.latestReport.filament.items.map(item => `  • ${item.materialName}: ~${item.grams}g`).join('\n');
    const extrasText = this.latestReport.extras.items.length > 0
      ? this.latestReport.extras.items.map(item => `  • ${item.name} (x${item.quantity})`).join('\n')
      : '  • Ninguno';

    const clientGreeting = this.currentJob.clientName ? `Hola ${this.currentJob.clientName}! ` : '';
    const printTimeStr = `${this.currentJob.hours}h ${this.currentJob.minutes}m`;

    const quoteText = 
`🖨️ *COTIZACIÓN DE IMPRESIÓN 3D*
${clientGreeting}Detalles estimados para tu pedido:

📌 *Proyecto:* ${this.currentJob.projectName || 'Impresión 3D Personalizada'}
⚙️ *Tecnología:* Bambu Lab P1S + AMS (FDM Alta Precisión)
⏱️ *Tiempo estimado:* ${printTimeStr}
📦 *Materiales:*
${materialsText}
🛠️ *Insumos / Extras:*
${extrasText}

━━━━━━━━━━━━━━━━━━━━
💰 *PRECIO FINAL:* ${Engine.formatMoney(selectedTier.price)}
━━━━━━━━━━━━━━━━━━━━
✅ *Incluye:* Calibración de alta resolución, acabados y post-procesado básico.
🚀 *Tiempo de entrega:* 24 a 48 horas tras confirmación.

_Cotización válida por 7 días._`;

    this.el.quotePreview.textContent = quoteText;
  }

  async handleCopyQuote() {
    const text = this.el.quotePreview?.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.showToast('📋 ¡Cotización copiada para WhatsApp!', 'success');
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast('📋 ¡Cotización copiada al portapapeles!', 'success');
    }
  }

  renderSettings() {
    if (this.el.cfgElectricity) this.el.cfgElectricity.value = this.config.electricityRate;
    if (this.el.cfgPowerKw) this.el.cfgPowerKw.value = this.config.powerKw;
    if (this.el.cfgWearRate) this.el.cfgWearRate.value = this.config.wearRatePerHour;
    if (this.el.cfgFailureRate) this.el.cfgFailureRate.value = this.config.failureRatePercent;
    if (this.el.cfgPurgeWaste) this.el.cfgPurgeWaste.value = this.config.purgeWastePercent;
    if (this.el.cfgLaborRate) this.el.cfgLaborRate.value = this.config.laborRatePerHour;
    if (this.el.cfgRoundingStep) this.el.cfgRoundingStep.value = this.config.roundingStep;

    this.renderCatalogTables();
  }

  renderCatalogTables() {
    // Tabla Materiales
    if (this.el.materialsTableBody) {
      this.el.materialsTableBody.innerHTML = this.config.materials.map(m => `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${m.color || '#6c757d'};"></span>
              <div>
                <strong class="text-dark">${m.name}</strong>
                <div class="text-muted" style="font-size:11px;">${m.note || ''}</div>
              </div>
            </div>
          </td>
          <td style="max-width: 140px;">
            <div class="input-group input-group-sm">
              <span class="input-group-text">$</span>
              <input type="number" class="form-control cat-material-price" data-mat-id="${m.id}" value="${m.pricePerKg}" step="1000">
            </div>
          </td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-danger btn-del-mat" data-mat-id="${m.id}" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

      this.el.materialsTableBody.querySelectorAll('.cat-material-price').forEach(inp => {
        inp.addEventListener('change', (e) => {
          const matId = e.target.dataset.matId;
          const mat = this.config.materials.find(m => m.id === matId);
          if (mat) {
            mat.pricePerKg = Math.max(0, Number(e.target.value) || 0);
            Storage.saveConfig(this.config);
            this.renderMaterialSlots();
            this.recalculate();
          }
        });
      });

      this.el.materialsTableBody.querySelectorAll('.btn-del-mat').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const matId = e.currentTarget.dataset.matId;
          if (this.config.materials.length <= 1) {
            this.showToast('Debe haber al menos 1 material en el catálogo', 'error');
            return;
          }
          if (confirm('¿Eliminar este material del catálogo?')) {
            this.config.materials = this.config.materials.filter(m => m.id !== matId);
            Storage.saveConfig(this.config);
            this.renderCatalogTables();
            this.renderMaterialSlots();
            this.recalculate();
            this.showToast('Material eliminado', 'info');
          }
        });
      });
    }

    // Tabla Extras
    if (this.el.extrasTableBody) {
      this.el.extrasTableBody.innerHTML = this.config.extrasCatalog.map(x => `
        <tr>
          <td>
            <strong class="text-dark">${x.name}</strong>
            <div class="text-muted" style="font-size:11px;">${x.category || 'General'}</div>
          </td>
          <td style="max-width: 140px;">
            <div class="input-group input-group-sm">
              <span class="input-group-text">$</span>
              <input type="number" class="form-control cat-extra-price" data-extra-id="${x.id}" value="${x.defaultCost}" step="50">
            </div>
          </td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-danger btn-del-extra" data-extra-id="${x.id}" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

      this.el.extrasTableBody.querySelectorAll('.cat-extra-price').forEach(inp => {
        inp.addEventListener('change', (e) => {
          const extraId = e.target.dataset.extraId;
          const extra = this.config.extrasCatalog.find(x => x.id === extraId);
          if (extra) {
            extra.defaultCost = Math.max(0, Number(e.target.value) || 0);
            Storage.saveConfig(this.config);
            this.renderActiveExtras();
            this.recalculate();
          }
        });
      });

      this.el.extrasTableBody.querySelectorAll('.btn-del-extra').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const extraId = e.currentTarget.dataset.extraId;
          if (confirm('¿Eliminar este extra del catálogo?')) {
            this.config.extrasCatalog = this.config.extrasCatalog.filter(x => x.id !== extraId);
            Storage.saveConfig(this.config);
            this.renderCatalogTables();
            this.renderActiveExtras();
            this.recalculate();
            this.showToast('Extra eliminado', 'info');
          }
        });
      });
    }
  }

  handleAddNewCatalogMaterial() {
    const name = prompt('Nombre del nuevo filamento (ej. TPU 95A, PLA Silk):');
    if (!name || !name.trim()) return;

    const price = Number(prompt('Precio en COP por kg / bobina:', '60000')) || 60000;
    const note = prompt('Nota breve (opcional):', 'Resistente') || '';

    const newMat = {
      id: 'mat_' + Date.now(),
      name: name.trim(),
      pricePerKg: price,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      note
    };

    this.config.materials.push(newMat);
    Storage.saveConfig(this.config);
    this.renderCatalogTables();
    this.renderMaterialSlots();
    this.recalculate();
    this.showToast(`Material "${newMat.name}" añadido`, 'success');
  }

  handleAddNewCatalogExtra() {
    const name = prompt('Nombre del extra (ej. Resorte, Balinera, Inserto M4):');
    if (!name || !name.trim()) return;

    const cost = Number(prompt('Costo unitario en COP:', '500')) || 500;
    const category = prompt('Categoría (ej. Tornillería, Herrajes):', 'Herrajes') || 'General';

    const newExtra = {
      id: 'extra_' + Date.now(),
      name: name.trim(),
      defaultCost: cost,
      category
    };

    this.config.extrasCatalog.push(newExtra);
    Storage.saveConfig(this.config);
    this.renderCatalogTables();
    this.renderActiveExtras();
    this.recalculate();
    this.showToast(`Extra "${newExtra.name}" añadido`, 'success');
  }

  handleSaveMachineConfig() {
    this.config.electricityRate = Number(this.el.cfgElectricity?.value) || DEFAULT_CONFIG.electricityRate;
    this.config.powerKw = Number(this.el.cfgPowerKw?.value) || DEFAULT_CONFIG.powerKw;
    this.config.wearRatePerHour = Number(this.el.cfgWearRate?.value) || DEFAULT_CONFIG.wearRatePerHour;
    this.config.failureRatePercent = Number(this.el.cfgFailureRate?.value) || DEFAULT_CONFIG.failureRatePercent;
    this.config.purgeWastePercent = Number(this.el.cfgPurgeWaste?.value) || DEFAULT_CONFIG.purgeWastePercent;
    this.config.laborRatePerHour = Number(this.el.cfgLaborRate?.value) || DEFAULT_CONFIG.laborRatePerHour;
    this.config.roundingStep = Number(this.el.cfgRoundingStep?.value) || DEFAULT_CONFIG.roundingStep;

    Storage.saveConfig(this.config);
    this.recalculate();
    this.showToast('Configuración de costos guardada', 'success');
  }

  handleResetConfig() {
    if (confirm('¿Restablecer configuración a valores de fábrica?')) {
      this.config = Storage.resetConfig();
      this.renderSettings();
      this.renderMaterialSlots();
      this.renderActiveExtras();
      this.recalculate();
      this.showToast('Valores restablecidos a fábrica', 'info');
    }
  }

  handleExportBackup() {
    const json = Storage.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculadora_3d_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Backup JSON exportado', 'success');
  }

  handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        Storage.importBackup(e.target.result);
        this.config = Storage.loadConfig();
        this.presets = Storage.loadPresets();
        this.renderSettings();
        this.renderPresets();
        this.renderMaterialSlots();
        this.renderActiveExtras();
        this.recalculate();
        this.showToast('Backup restaurado correctamente', 'success');
      } catch (err) {
        this.showToast('Error al importar archivo JSON', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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

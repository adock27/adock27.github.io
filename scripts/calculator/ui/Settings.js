import { Storage, DEFAULT_CONFIG } from '../storage.js';

export class Settings {
  constructor(app) {
    this.app = app;
    this.el = {
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
      materialsTableBody: document.getElementById('materialsTableBody'),
      btnAddCatalogMaterial: document.getElementById('btnAddCatalogMaterial'),
      extrasTableBody: document.getElementById('extrasTableBody'),
      btnAddCatalogExtra: document.getElementById('btnAddCatalogExtra')
    };

    this.init();
  }

  init() {
    this.el.btnSaveConfig?.addEventListener('click', () => this.handleSaveMachineConfig());
    this.el.btnResetConfig?.addEventListener('click', () => this.handleResetConfig());
    this.el.btnExportBackup?.addEventListener('click', () => this.handleExportBackup());
    this.el.btnImportBackup?.addEventListener('click', () => this.el.importFileInput?.click());
    this.el.importFileInput?.addEventListener('change', (e) => this.handleImportBackup(e));
    this.el.btnAddCatalogMaterial?.addEventListener('click', () => this.handleAddNewCatalogMaterial());
    this.el.btnAddCatalogExtra?.addEventListener('click', () => this.handleAddNewCatalogExtra());
  }

  render() {
    if (this.el.cfgElectricity) this.el.cfgElectricity.value = this.app.config.electricityRate;
    if (this.el.cfgPowerKw) this.el.cfgPowerKw.value = this.app.config.powerKw;
    if (this.el.cfgWearRate) this.el.cfgWearRate.value = this.app.config.wearRatePerHour;
    if (this.el.cfgFailureRate) this.el.cfgFailureRate.value = this.app.config.failureRatePercent;
    if (this.el.cfgPurgeWaste) this.el.cfgPurgeWaste.value = this.app.config.purgeWastePercent;
    if (this.el.cfgLaborRate) this.el.cfgLaborRate.value = this.app.config.laborRatePerHour;
    if (this.el.cfgRoundingStep) this.el.cfgRoundingStep.value = this.app.config.roundingStep;

    this.renderCatalogTables();
  }

  renderCatalogTables() {
    if (this.el.materialsTableBody) {
      this.el.materialsTableBody.innerHTML = this.app.config.materials.map(m => `
        <tr data-mat-id="${m.id}">
          <td>
            <div class="d-flex align-items-center gap-2">
              <input type="color" class="cat-material-color" data-mat-id="${m.id}" value="${m.color || '#6c757d'}" title="Color del filamento"
                style="width:28px; height:28px; padding:2px; border-radius:50%; border:1.5px solid #dee2e6; cursor:pointer; flex-shrink:0;">
              <div>
                <strong class="text-dark mat-name-display">${m.name}</strong>
                <div class="text-muted mat-note-display" style="font-size:11px;">${m.note || ''}</div>
              </div>
            </div>
          </td>
          <td style="max-width: 140px;">
            <div class="input-group input-group-sm">
              <span class="input-group-text">$</span>
              <input type="number" class="form-control cat-material-price" data-mat-id="${m.id}" value="${m.pricePerKg}" step="1000">
            </div>
          </td>
          <td class="text-end" style="white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-outline-primary btn-edit-mat me-1" data-mat-id="${m.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-del-mat" data-mat-id="${m.id}" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

      this.el.materialsTableBody.querySelectorAll('.cat-material-price').forEach(inp => {
        inp.addEventListener('change', (e) => {
          const matId = e.target.dataset.matId;
          const mat = this.app.config.materials.find(m => m.id === matId);
          if (mat) {
            mat.pricePerKg = Math.max(0, Number(e.target.value) || 0);
            Storage.saveConfig(this.app.config);
            this.app.filaments.renderMaterialSlots();
            this.app.recalculate();
          }
        });
      });

      this.el.materialsTableBody.querySelectorAll('.cat-material-color').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const matId = e.target.dataset.matId;
          const mat = this.app.config.materials.find(m => m.id === matId);
          if (mat) {
            mat.color = e.target.value;
            Storage.saveConfig(this.app.config);
            this.app.filaments.renderPalette();
            this.app.filaments.renderMaterialSlots();
          }
        });
      });

      this.el.materialsTableBody.querySelectorAll('.btn-edit-mat').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const matId = e.currentTarget.dataset.matId;
          const mat = this.app.config.materials.find(m => m.id === matId);
          if (!mat) return;

          const existingEditRow = this.el.materialsTableBody.querySelector(`tr.edit-row[data-edit-for="${matId}"]`);
          if (existingEditRow) {
            existingEditRow.remove();
            return;
          }
          this.el.materialsTableBody.querySelectorAll('tr.edit-row').forEach(r => r.remove());

          const mainRow = this.el.materialsTableBody.querySelector(`tr[data-mat-id="${matId}"]`);
          if (!mainRow) return;

          const editRow = document.createElement('tr');
          editRow.className = 'edit-row bg-primary-subtle';
          editRow.dataset.editFor = matId;
          editRow.innerHTML = `
            <td colspan="3" class="py-2 px-3">
              <div class="d-flex flex-wrap gap-2 align-items-end">
                <div>
                  <label class="form-label small fw-semibold mb-1 text-secondary">Nombre</label>
                  <input type="text" class="form-control form-control-sm edit-mat-name" value="${mat.name}" style="min-width:150px;">
                </div>
                <div>
                  <label class="form-label small fw-semibold mb-1 text-secondary">Nota</label>
                  <input type="text" class="form-control form-control-sm edit-mat-note" value="${mat.note || ''}" style="min-width:150px;" placeholder="Ej: Resistente...">
                </div>
                <div>
                  <label class="form-label small fw-semibold mb-1 text-secondary">Color</label><br>
                  <input type="color" class="edit-mat-color" value="${mat.color || '#6c757d'}" style="width:36px; height:32px; padding:2px; border-radius:6px; border:1.5px solid #dee2e6; cursor:pointer;">
                </div>
                <div class="d-flex gap-1">
                  <button type="button" class="btn btn-success btn-sm btn-save-edit-mat px-3"><i class="bi bi-check-lg"></i></button>
                  <button type="button" class="btn btn-outline-secondary btn-sm btn-cancel-edit-mat px-2"><i class="bi bi-x-lg"></i></button>
                </div>
              </div>
            </td>
          `;

          mainRow.insertAdjacentElement('afterend', editRow);
          editRow.querySelector('.btn-cancel-edit-mat').addEventListener('click', () => editRow.remove());
          editRow.querySelector('.btn-save-edit-mat').addEventListener('click', () => {
            const newName = editRow.querySelector('.edit-mat-name').value.trim();
            const newNote = editRow.querySelector('.edit-mat-note').value.trim();
            const newColor = editRow.querySelector('.edit-mat-color').value;

            if (!newName) { this.app.showToast('El nombre no puede estar vacío', 'error'); return; }

            mat.name = newName;
            mat.note = newNote;
            mat.color = newColor;
            Storage.saveConfig(this.app.config);
            editRow.remove();
            this.renderCatalogTables();
            this.app.filaments.renderPalette();
            this.app.filaments.renderMaterialSlots();
            this.app.recalculate();
            this.app.showToast(`Material actualizado`, 'success');
          });
        });
      });

      this.el.materialsTableBody.querySelectorAll('.btn-del-mat').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const matId = e.currentTarget.dataset.matId;
          if (this.app.config.materials.length <= 1) {
            this.app.showToast('Debe haber al menos 1 material en el catálogo', 'error');
            return;
          }
          if (!btn.classList.contains('confirming')) {
            btn.classList.add('confirming', 'btn-danger', 'text-white');
            btn.classList.remove('btn-outline-danger');
            btn.innerHTML = '<i class="bi bi-question-lg"></i>';
            setTimeout(() => {
              btn.classList.remove('confirming', 'btn-danger', 'text-white');
              btn.classList.add('btn-outline-danger');
              btn.innerHTML = '<i class="bi bi-trash"></i>';
            }, 3000);
            return;
          }
          this.app.config.materials = this.app.config.materials.filter(m => m.id !== matId);
          Storage.saveConfig(this.app.config);
          this.renderCatalogTables();
          this.app.filaments.renderPalette();
          this.app.filaments.renderMaterialSlots();
          this.app.recalculate();
          this.app.showToast('Material eliminado', 'info');
        });
      });
    }

    if (this.el.extrasTableBody) {
      this.el.extrasTableBody.innerHTML = this.app.config.extrasCatalog.map(x => `
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
          const extra = this.app.config.extrasCatalog.find(x => x.id === extraId);
          if (extra) {
            extra.defaultCost = Math.max(0, Number(e.target.value) || 0);
            Storage.saveConfig(this.app.config);
            this.app.extras.render();
            this.app.recalculate();
          }
        });
      });

      this.el.extrasTableBody.querySelectorAll('.btn-del-extra').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const extraId = e.currentTarget.dataset.extraId;
          if (!btn.classList.contains('confirming')) {
            btn.classList.add('confirming', 'btn-danger', 'text-white');
            btn.classList.remove('btn-outline-danger');
            btn.innerHTML = '<i class="bi bi-question-lg"></i>';
            setTimeout(() => {
              btn.classList.remove('confirming', 'btn-danger', 'text-white');
              btn.classList.add('btn-outline-danger');
              btn.innerHTML = '<i class="bi bi-trash"></i>';
            }, 3000);
            return;
          }
          this.app.config.extrasCatalog = this.app.config.extrasCatalog.filter(x => x.id !== extraId);
          Storage.saveConfig(this.app.config);
          this.renderCatalogTables();
          this.app.extras.render();
          this.app.recalculate();
          this.app.showToast('Extra eliminado', 'info');
        });
      });
    }
  }

  handleAddNewCatalogMaterial() {
    const randomColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:1rem;padding:1.5rem;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h6 class="fw-bold mb-3 text-dark"><i class="bi bi-plus-circle-fill text-success me-2"></i>Agregar Filamento</h6>
        <div class="mb-3">
          <label class="form-label small fw-semibold text-secondary">Nombre *</label>
          <input type="text" id="newMatName" class="form-control" autofocus>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-semibold text-secondary">Precio por kg (COP) *</label>
          <input type="number" id="newMatPrice" class="form-control" value="60000">
        </div>
        <div class="mb-4 d-flex align-items-center gap-3">
          <div><input type="color" id="newMatColor" value="${randomColor}"></div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" id="newMatCancel" class="btn btn-outline-secondary">Cancelar</button>
          <button type="button" id="newMatSave" class="btn btn-success">Agregar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#newMatName');
    const priceInput = overlay.querySelector('#newMatPrice');
    const colorInput = overlay.querySelector('#newMatColor');

    const close = () => overlay.remove();
    overlay.querySelector('#newMatCancel').addEventListener('click', close);
    overlay.querySelector('#newMatSave').addEventListener('click', () => {
      const name = nameInput.value.trim();
      const price = Number(priceInput.value) || 60000;
      if (!name) return;

      this.app.config.materials.push({ id: 'mat_' + Date.now(), name, pricePerKg: price, color: colorInput.value });
      Storage.saveConfig(this.app.config);
      this.renderCatalogTables();
      this.app.filaments.renderPalette();
      this.app.filaments.renderMaterialSlots();
      this.app.recalculate();
      this.app.showToast(`Material añadido`, 'success');
      close();
    });
  }

  handleAddNewCatalogExtra() {
    const name = prompt('Nombre del extra:');
    if (!name || !name.trim()) return;

    const cost = Number(prompt('Costo unitario en COP:', '500')) || 500;
    this.app.config.extrasCatalog.push({ id: 'extra_' + Date.now(), name: name.trim(), defaultCost: cost, category: 'General' });
    Storage.saveConfig(this.app.config);
    this.renderCatalogTables();
    this.app.extras.render();
    this.app.recalculate();
    this.app.showToast(`Extra añadido`, 'success');
  }

  handleSaveMachineConfig() {
    this.app.config.electricityRate = Number(this.el.cfgElectricity?.value) || DEFAULT_CONFIG.electricityRate;
    this.app.config.powerKw = Number(this.el.cfgPowerKw?.value) || DEFAULT_CONFIG.powerKw;
    this.app.config.wearRatePerHour = Number(this.el.cfgWearRate?.value) || DEFAULT_CONFIG.wearRatePerHour;
    this.app.config.failureRatePercent = Number(this.el.cfgFailureRate?.value) || DEFAULT_CONFIG.failureRatePercent;
    this.app.config.purgeWastePercent = Number(this.el.cfgPurgeWaste?.value) || DEFAULT_CONFIG.purgeWastePercent;
    this.app.config.laborRatePerHour = Number(this.el.cfgLaborRate?.value) || DEFAULT_CONFIG.laborRatePerHour;
    this.app.config.roundingStep = Number(this.el.cfgRoundingStep?.value) || DEFAULT_CONFIG.roundingStep;

    Storage.saveConfig(this.app.config);
    this.app.recalculate();
    this.app.showToast('Configuración guardada', 'success');
  }

  handleResetConfig() {
    const btn = this.el.btnResetConfig;
    if (btn && !btn.classList.contains('confirming')) {
      const originalText = btn.innerHTML;
      btn.classList.add('confirming', 'btn-danger', 'text-white');
      btn.innerHTML = '¿Seguro?';
      setTimeout(() => {
        btn.classList.remove('confirming', 'btn-danger', 'text-white');
        btn.innerHTML = originalText;
      }, 3000);
      return;
    }

    this.app.config = Storage.resetConfig();
    this.render();
    this.app.filaments.renderPalette();
    this.app.filaments.renderMaterialSlots();
    this.app.extras.render();
    this.app.recalculate();
    this.app.showToast('Restablecido a fábrica', 'info');
    if (btn) btn.innerHTML = 'Valores de Fábrica';
  }

  handleExportBackup() {
    const json = Storage.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculadora_3d_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.app.showToast('Backup JSON exportado', 'success');
  }

  handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        Storage.importBackup(e.target.result);
        this.app.config = Storage.loadConfig();
        this.app.presets = Storage.loadPresets();
        this.render();
        this.app.presetsComponent.render();
        this.app.filaments.renderPalette();
        this.app.filaments.renderMaterialSlots();
        this.app.extras.render();
        this.app.recalculate();
        this.app.showToast('Backup restaurado', 'success');
      } catch (err) {
        this.app.showToast('Error al importar', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
}

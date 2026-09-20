import { Storage } from '../storage.js';

export class Presets {
  constructor(app) {
    this.app = app;
    this.presetsShelf = document.getElementById('presetsShelf');
    this.btnSaveAsPreset = document.getElementById('btnSaveAsPreset');
    this.init();
  }

  init() {
    this.btnSaveAsPreset?.addEventListener('click', () => this.handleSaveCurrentAsPreset());
  }

  render() {
    if (!this.presetsShelf) return;
    this.presetsShelf.innerHTML = '';

    if (this.app.presets.length === 0) {
      this.presetsShelf.innerHTML = `<span class="text-muted small fst-italic">Sin presets guardados aún.</span>`;
      return;
    }

    this.app.presets.forEach(preset => {
      const wrapper = document.createElement('span');
      wrapper.className = 'preset-pill-wrapper me-2 mb-2';
      wrapper.style.cssText = 'display:inline-flex; align-items:center; border:1px solid #dee2e6; border-radius:50px; overflow:hidden; background:#fff;';

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn btn-sm btn-outline-secondary border-0 rounded-0 rounded-start-pill px-3';
      applyBtn.style.cssText = 'border-right:1px solid #dee2e6 !important;';
      applyBtn.textContent = preset.name;
      applyBtn.title = preset.description || 'Aplicar preset';
      applyBtn.addEventListener('click', () => this.applyPreset(preset));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-sm btn-outline-danger border-0 rounded-0 rounded-end-pill px-2';
      delBtn.innerHTML = '<i class="bi bi-x"></i>';
      delBtn.title = 'Eliminar preset';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!delBtn.classList.contains('confirming')) {
          delBtn.classList.add('confirming', 'bg-danger', 'text-white');
          delBtn.innerHTML = '<i class="bi bi-question-lg"></i>';
          setTimeout(() => {
            delBtn.classList.remove('confirming', 'bg-danger', 'text-white');
            delBtn.innerHTML = '<i class="bi bi-x"></i>';
          }, 3000);
          return;
        }
        this.app.presets = Storage.deletePreset(preset.id);
        this.render();
        this.app.showToast(`Preset eliminado`, 'info');
      });

      wrapper.appendChild(applyBtn);
      wrapper.appendChild(delBtn);
      this.presetsShelf.appendChild(wrapper);
    });
  }

  applyPreset(preset) {
    const el = this.app.el;
    if (el.projectName) el.projectName.value = preset.name.replace(/^[^\w\s]+/, '').trim();
    if (el.hours) el.hours.value = preset.hours ?? 0;
    if (el.minutes) el.minutes.value = preset.minutes ?? 0;
    if (el.laborMinutes) el.laborMinutes.value = preset.laborMinutes ?? 0;

    this.app.currentJob.hours = preset.hours ?? 0;
    this.app.currentJob.minutes = preset.minutes ?? 0;
    this.app.currentJob.laborMinutes = preset.laborMinutes ?? 0;

    this.app.currentJob.materialSlots = [{
      id: 'slot_1',
      materialId: preset.materialId || this.app.config.materials[0]?.id || 'pla_std',
      grams: preset.grams || 50
    }];

    this.app.currentJob.extras = Array.isArray(preset.extras) ? JSON.parse(JSON.stringify(preset.extras)) : [];

    this.app.filaments.renderMaterialSlots();
    this.app.extras.render();
    this.app.recalculate();
    this.app.showToast(`Preset cargado: ${preset.name}`, 'success');
  }

  handleSaveCurrentAsPreset() {
    const name = prompt('Nombre del preset:', this.app.currentJob.projectName || 'Mi Trabajo');
    if (!name || !name.trim()) return;

    const newPreset = {
      id: 'preset_' + Date.now(),
      name: '⭐ ' + name.trim(),
      description: `Gramos: ${this.app.currentJob.materialSlots.reduce((a, b) => a + b.grams, 0)}g | Tiempo: ${this.app.currentJob.hours}h ${this.app.currentJob.minutes}m`,
      materialId: this.app.currentJob.materialSlots[0]?.materialId || 'pla_std',
      grams: this.app.currentJob.materialSlots[0]?.grams || 50,
      hours: this.app.currentJob.hours,
      minutes: this.app.currentJob.minutes,
      laborMinutes: this.app.currentJob.laborMinutes,
      extras: this.app.currentJob.extras.filter(x => x.quantity > 0)
    };

    this.app.presets = Storage.savePreset(newPreset);
    this.render();
    this.app.showToast('¡Preset guardado!', 'success');
  }
}

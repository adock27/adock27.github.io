import { Engine } from '../engine.js';

export class Filaments {
  constructor(app) {
    this.app = app;
    this.paletteContainers = document.querySelectorAll('.filament-palette-container');
    this.materialSlotsContainer = document.getElementById('materialSlotsContainer');
    this._dragEventsBound = false;
  }

  renderPalette() {
    if (!this.paletteContainers || this.paletteContainers.length === 0) return;
    
    this.paletteContainers.forEach(container => {
      container.innerHTML = '';
    });

    const usedIds = new Set(this.app.currentJob.materialSlots.map(s => s.materialId));
    const available = this.app.config.materials.filter(m => !usedIds.has(m.id));

    if (available.length === 0) {
      this.paletteContainers.forEach(container => {
        container.innerHTML = `
          <div class="text-center py-3 text-muted" style="font-size:12px;">
            <i class="bi bi-check-circle" style="font-size:20px;display:block;margin-bottom:4px;opacity:0.4;"></i>
            Todos los filamentos en uso
          </div>
        `;
      });
      return;
    }

    const grouped = {};
    available.forEach(mat => {
      const brand = mat.brand || mat.name.split(' ')[0] || 'Otros';
      if (!grouped[brand]) grouped[brand] = [];
      grouped[brand].push(mat);
    });

    this.paletteContainers.forEach(container => {
      Object.keys(grouped).sort().forEach(brand => {
        const header = document.createElement('div');
        header.className = 'text-muted fw-bold mt-2 mb-1 px-1';
        header.style.fontSize = '10px';
        header.style.textTransform = 'uppercase';
        header.style.letterSpacing = '0.5px';
        header.style.position = 'sticky';
        header.style.top = '0';
        header.style.backgroundColor = '#fff';
        header.style.zIndex = '1';
        header.innerText = brand;
        container.appendChild(header);
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'brand-chips';
        container.appendChild(chipsContainer);

        grouped[brand].forEach(mat => {
          const chip = document.createElement('div');
          chip.className = 'filament-chip d-flex align-items-center gap-2 p-2 mb-1 rounded-3 border bg-white';
          chip.draggable = true;
          chip.style.cursor = 'pointer';
          chip.dataset.materialId = mat.id;
          chip.title = `Toca para añadir o Arrastra "${mat.name}" al panel AMS`;

          // Icono diferente en móvil vs escritorio
          const isMobile = container.id === 'filamentPaletteMobile';
          const iconHtml = isMobile 
            ? `<i class="bi bi-plus-circle text-success" style="font-size:16px;"></i>`
            : `<i class="bi bi-grip-vertical text-muted" style="font-size:13px;opacity:0.5;"></i>`;

          chip.innerHTML = `
            <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${mat.color || '#6c757d'};border:1.5px solid rgba(0,0,0,0.12);flex-shrink:0;"></span>
            <div style="min-width:0;flex:1;">
              <div class="small fw-semibold text-dark text-truncate" style="line-height:1.2;">${mat.name}</div>
              <div class="text-muted" style="font-size:10px;">${Engine.formatMoney(mat.pricePerKg, this.app.config.currency)}/kg</div>
            </div>
            ${iconHtml}
          `;

          if (!isMobile) {
            chip.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('materialId', mat.id);
              e.dataTransfer.effectAllowed = 'move';
              chip.classList.add('dragging');
            });
            chip.addEventListener('dragend', () => {
              chip.classList.remove('dragging');
            });
          }

          chip.addEventListener('click', () => {
            const matExists = this.app.config.materials.find(m => m.id === mat.id);
            const alreadyUsed = this.app.currentJob.materialSlots.some(s => s.materialId === mat.id);
            if (mat.id && matExists && !alreadyUsed) {
              this.app.currentJob.materialSlots.push({
                id: 'slot_' + Date.now(),
                materialId: mat.id,
                grams: 20
              });
              this.renderPalette();
              this.renderMaterialSlots();
              this.app.recalculate();
              
              if (isMobile) {
                const offcanvasEl = document.getElementById('offcanvasFilamentPalette');
                if (offcanvasEl) {
                  const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
                  if (bsOffcanvas) bsOffcanvas.hide();
                }
              }
            }
          });

          chipsContainer.appendChild(chip);
        });
      });
    });
  }

  renderMaterialSlots() {
    if (!this.materialSlotsContainer) return;
    const zone = this.materialSlotsContainer;
    zone.innerHTML = '';

    if (this.app.currentJob.materialSlots.length === 0) {
      zone.innerHTML = `
        <div class="text-center py-3 text-muted" style="pointer-events:none;">
          <i class="bi bi-box-arrow-in-right" style="font-size:22px;display:block;margin-bottom:4px;opacity:0.4;"></i>
          <span style="font-size:12px;">Toca o arrastra un filamento aquí</span>
        </div>
      `;
    } else {
      this.app.currentJob.materialSlots.forEach(slot => {
        const mat = this.app.config.materials.find(m => m.id === slot.materialId)
          || { name: 'Desconocido', color: '#6c757d', pricePerKg: 0 };

        const card = document.createElement('div');
        card.className = 'ams-slot-card d-flex align-items-center gap-2 p-2 mb-1 rounded-3 border bg-light';
        card.dataset.slotId = slot.id;

        card.innerHTML = `
          <span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${mat.color || '#6c757d'};border:1.5px solid rgba(0,0,0,0.12);flex-shrink:0;"></span>
          <span class="small fw-semibold text-dark text-truncate" style="flex:1;min-width:0;font-size:12px;">${mat.name}</span>
          <div class="input-group input-group-sm" style="max-width:82px;">
            <input type="number" class="form-control slot-grams-input" data-slot-id="${slot.id}" min="0.1" step="0.5" value="${slot.grams}" style="font-size:12px;padding:3px 6px;">
            <span class="input-group-text" style="font-size:11px;padding:3px 5px;">g</span>
          </div>
          <button type="button" class="btn btn-sm btn-outline-danger btn-remove-slot p-0" data-slot-id="${slot.id}" title="Quitar" style="width:24px;height:24px;line-height:1;flex-shrink:0;">
            <i class="bi bi-x" style="font-size:14px;"></i>
          </button>
        `;
        zone.appendChild(card);
      });
    }

    if (!this._dragEventsBound) {
      this._dragEventsBound = true;
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('drag-over');
        }
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const materialId = e.dataTransfer.getData('materialId');
        const matExists = this.app.config.materials.find(m => m.id === materialId);
        const alreadyUsed = this.app.currentJob.materialSlots.some(s => s.materialId === materialId);
        if (materialId && matExists && !alreadyUsed) {
          this.app.currentJob.materialSlots.push({
            id: 'slot_' + Date.now(),
            materialId,
            grams: 20
          });
          this.renderPalette();
          this.renderMaterialSlots();
          this.app.recalculate();
        }
      });
    }

    zone.querySelectorAll('.slot-grams-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const slotId = e.target.dataset.slotId;
        const slot = this.app.currentJob.materialSlots.find(s => s.id === slotId);
        if (slot) {
          slot.grams = Math.max(0, Number(e.target.value) || 0);
          this.app.recalculate();
        }
      });
    });

    zone.querySelectorAll('.btn-remove-slot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slotId = e.currentTarget.dataset.slotId;
        this.app.currentJob.materialSlots = this.app.currentJob.materialSlots.filter(s => s.id !== slotId);
        this.renderPalette();
        this.renderMaterialSlots();
        this.app.recalculate();
      });
    });
  }
}

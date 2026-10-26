import { Tables } from './Tables.js';

export class Tabs {
  constructor(app) {
    this.app = app;
    this.tabBtns = document.querySelectorAll('.nav-tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane-view');
    this.init();
    this.applyRolePermissions();
  }

  applyRolePermissions() {
    const allowed = this.app.isAdmin
      ? new Set(['tab-calculator', 'tab-quote', 'tab-settings', 'tab-inventory', 'tab-purchases', 'tab-orders', 'tab-sales', 'tab-users'])
      : new Set(['tab-calculator', 'tab-quote', 'tab-inventory', 'tab-orders', 'tab-sales']);
    this.tabBtns.forEach(btn => {
      const visible = allowed.has(btn.dataset.target);
      btn.closest('.nav-item')?.classList.toggle('d-none', !visible);
      btn.setAttribute('aria-current', btn.classList.contains('active') ? 'page' : 'false');
    });
    this.tabPanes.forEach(pane => {
      if (!allowed.has(pane.id)) pane.classList.add('d-none');
    });
    document.getElementById('adminUsersNav')?.classList.toggle('d-none', !this.app.isAdmin);
    document.getElementById('btnAddInventoryItem')?.classList.toggle('d-none', !this.app.isAdmin);
    document.getElementById('btnQuickAddInventory')?.classList.toggle('d-none', !this.app.isAdmin);
    document.getElementById('orderAddCustomToInventoryWrap')?.classList.toggle('d-none', !this.app.isAdmin);
  }

  init() {
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(btn.dataset.target);
      });
    });
  }

  switchTab(targetId) {
    if ([...this.tabBtns].some(btn => btn.dataset.target === targetId && btn.closest('.nav-item')?.classList.contains('d-none'))) return;
    this.tabBtns.forEach(b => {
      const isTarget = b.dataset.target === targetId;
      b.classList.toggle('active', isTarget);
      b.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });

    this.tabPanes.forEach(pane => {
      pane.classList.toggle('d-none', pane.id !== targetId);
    });
    this.app.appearance?.closeMobileNav();
    const selectedLink = [...this.tabBtns].find(btn => btn.dataset.target === targetId);
    const heading = document.getElementById('currentSectionLabel');
    if (heading && selectedLink) heading.textContent = selectedLink.querySelector('span')?.textContent.trim() || 'Operaciones';

    const loading = this.app.loadTab?.(targetId);
    loading?.then(() => requestAnimationFrame(() => Tables.adjustVisible())).catch(() => {});
    if (targetId === 'tab-quote' && this.app.quote) {
      this.app.quote.updateQuotePreview();
    }
    requestAnimationFrame(() => Tables.adjustVisible());
  }
}

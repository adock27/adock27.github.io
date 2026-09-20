export class Tabs {
  constructor(app) {
    this.app = app;
    this.tabBtns = document.querySelectorAll('.nav-tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane-view');
    this.init();
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
    this.tabBtns.forEach(b => {
      const isTarget = b.dataset.target === targetId;
      b.classList.toggle('active', isTarget);
      b.classList.toggle('bg-success', isTarget);
      b.classList.toggle('text-white', isTarget);
    });

    this.tabPanes.forEach(pane => {
      pane.classList.toggle('d-none', pane.id !== targetId);
    });

    if (targetId === 'tab-quote' && this.app.quote) {
      this.app.quote.updateQuotePreview();
    }
  }
}

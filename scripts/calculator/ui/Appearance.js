const THEME_KEY = 'calc3d_theme_v1';
const SIDEBAR_KEY = 'calc3d_sidebar_collapsed_v1';

export class Appearance {
  constructor() {
    this.shell = document.getElementById('calculatorAppShell');
    this.mobileToggle = document.getElementById('btnMobileNav');
    this.mobileBackdrop = document.getElementById('mobileNavBackdrop');
    this.sidebarToggle = document.getElementById('btnToggleSidebar');
    this.themeToggle = document.getElementById('btnToggleTheme');
    this.applyTheme(this.readPreference(THEME_KEY, 'light'));
    this.applySidebar(this.readPreference(SIDEBAR_KEY, 'false') === 'true');
    this.bindEvents();
  }

  readPreference(key, fallback) {
    try { return localStorage.getItem(key) || fallback; }
    catch (_) { return fallback; }
  }

  writePreference(key, value) {
    try { localStorage.setItem(key, value); }
    catch (_) { /* Appearance still works when storage is unavailable. */ }
  }

  bindEvents() {
    this.themeToggle?.addEventListener('click', () => {
      this.applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    this.sidebarToggle?.addEventListener('click', () => {
      this.applySidebar(!this.shell?.classList.contains('sidebar-collapsed'));
    });
    this.mobileToggle?.addEventListener('click', () => this.setMobileNav(true));
    this.mobileBackdrop?.addEventListener('click', () => this.closeMobileNav());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.closeMobileNav();
    });
  }

  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    this.writePreference(THEME_KEY, isDark ? 'dark' : 'light');
    if (this.themeToggle) {
      this.themeToggle.setAttribute('aria-pressed', String(isDark));
      this.themeToggle.setAttribute('aria-label', isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      this.themeToggle.title = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
      const icon = document.getElementById('themeToggleIcon');
      if (icon) icon.className = `bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}`;
    }
  }

  applySidebar(collapsed) {
    this.shell?.classList.toggle('sidebar-collapsed', collapsed);
    this.sidebarToggle?.setAttribute('aria-pressed', String(collapsed));
    this.sidebarToggle?.setAttribute('aria-label', collapsed ? 'Expandir menú' : 'Contraer menú');
    this.sidebarToggle?.setAttribute('title', collapsed ? 'Expandir menú' : 'Contraer menú');
    this.writePreference(SIDEBAR_KEY, String(collapsed));
  }

  setMobileNav(open) {
    this.shell?.classList.toggle('mobile-nav-open', open);
    document.body.classList.toggle('mobile-navigation-open', open);
    this.mobileToggle?.setAttribute('aria-expanded', String(open));
    this.mobileToggle?.setAttribute('aria-label', open ? 'Cerrar navegación' : 'Abrir navegación');
  }

  closeMobileNav() {
    this.setMobileNav(false);
  }
}

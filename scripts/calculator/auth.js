import { ApiSync } from './api-sync.js';

export const Auth = {
  init() {
    const authScreen = document.getElementById('authScreen');
    const appShell = document.getElementById('calculatorAppShell');
    const session = ApiSync.getSession();
    if (session?.token) {
      authScreen?.classList.add('d-none');
      appShell?.classList.remove('d-none');
      const account = document.getElementById('accountEmail');
      if (account) account.textContent = session.email;
    } else {
      authScreen?.classList.remove('d-none');
      appShell?.classList.add('d-none');
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const message = document.getElementById('authMessage');
    document.getElementById('authRetry')?.addEventListener('click', () => window.location.reload());
    document.getElementById('authClearSession')?.addEventListener('click', () => {
      ApiSync.clearSession();
      window.location.reload();
    });
    const showMessage = (text, type = 'danger') => {
      if (!message) return;
      message.className = `alert alert-${type} py-2 small`;
      message.textContent = text;
      message.classList.remove('d-none');
    };
    document.getElementById('showRegister')?.addEventListener('click', () => {
      loginForm?.classList.add('d-none');
      registerForm?.classList.remove('d-none');
      message?.classList.add('d-none');
    });
    document.getElementById('showLogin')?.addEventListener('click', () => {
      registerForm?.classList.add('d-none');
      loginForm?.classList.remove('d-none');
      message?.classList.add('d-none');
    });
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      ApiSync.clearSession();
      window.location.reload();
    });
    window.addEventListener('calculator-auth-expired', () => {
      ApiSync.clearSession();
      window.location.reload();
    });

    loginForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = loginForm.querySelector('button[type="submit"]');
      const originalLabel = button?.innerHTML;
      button.disabled = true;
      if (button) button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Conectando…';
      try {
        await ApiSync.login(loginForm.elements.email.value.trim(), loginForm.elements.password.value);
        window.location.reload();
      } catch (error) {
        showMessage(error.message || 'No se pudo iniciar sesión.');
      } finally {
        button.disabled = false;
        if (button && originalLabel) button.innerHTML = originalLabel;
      }
    });
    registerForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const password = registerForm.elements.password.value;
      if (password !== registerForm.elements.confirmPassword.value) {
        showMessage('Las contraseñas no coinciden.');
        return;
      }
      if (password.length < 8) {
        showMessage('Usa una contraseña de al menos 8 caracteres.');
        return;
      }
      const button = registerForm.querySelector('button[type="submit"]');
      const originalLabel = button?.innerHTML;
      button.disabled = true;
      if (button) button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Creando cuenta…';
      try {
        await ApiSync.register(registerForm.elements.email.value.trim(), password);
        window.location.reload();
      } catch (error) {
        showMessage(error.message || 'No se pudo crear la cuenta.');
      } finally {
        button.disabled = false;
        if (button && originalLabel) button.innerHTML = originalLabel;
      }
    });
  },

  showConnectionError(error) {
    document.getElementById('calculatorAppShell')?.classList.add('d-none');
    document.getElementById('authScreen')?.classList.remove('d-none');
    document.getElementById('loginForm')?.classList.add('d-none');
    document.getElementById('registerForm')?.classList.add('d-none');
    const message = document.getElementById('authMessage');
    if (message) {
      message.className = 'alert alert-danger py-2 small';
      message.textContent = `No se pudieron cargar tus datos desde el backend. ${error?.message || 'Verifica la conexión y la implementación de Apps Script.'}`;
    }
    document.getElementById('authConnectionActions')?.classList.remove('d-none');
  }
};

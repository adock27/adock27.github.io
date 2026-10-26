import { ApiSync } from '../api-sync.js';
import { Tables } from './Tables.js';
import { RecordDetails } from './RecordDetails.js';

export class Users {
  constructor(app) {
    this.app = app;
    this.body = document.getElementById('adminUsersTableBody');
    document.getElementById('adminCreateUserForm')?.addEventListener('submit', event => this.create(event));
    document.getElementById('btnReloadUsers')?.addEventListener('click', () => this.render());
  }

  async create(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await ApiSync.createEmployee(document.getElementById('adminNewUserEmail').value.trim(), document.getElementById('adminNewUserPassword').value);
      form.reset();
      this.app.showToast('Cuenta de empleado creada.', 'success');
      await this.render();
    } catch (error) {
      this.app.showToast(error.message || 'No se pudo crear la cuenta.', 'error');
    } finally { button.disabled = false; }
  }

  async render(loadedUsers = null) {
    if (!this.body) return;
    Tables.begin(this.body);
    this.body.replaceChildren();
    const loading = document.createElement('tr');
    const cell = document.createElement('td'); cell.colSpan = 4; cell.className = 'text-secondary text-center py-3'; cell.textContent = 'Cargando usuarios…'; loading.appendChild(cell); this.body.appendChild(loading);
    try {
      const users = Array.isArray(loadedUsers) ? loadedUsers : await ApiSync.listUsers();
      this.body.replaceChildren();
      users.forEach(user => this.renderRow(user));
      if (!users.length) {
        const row = document.createElement('tr'), empty = document.createElement('td');
        empty.colSpan = 4; empty.className = 'text-secondary text-center py-3'; empty.textContent = 'No hay cuentas registradas.'; row.appendChild(empty); this.body.appendChild(row);
      }
      Tables.end(this.body, { searching: true });
      return true;
    } catch (error) {
      this.body.replaceChildren();
      const row = document.createElement('tr'), cell = document.createElement('td');
      cell.colSpan = 4; cell.className = 'text-danger text-center py-3'; cell.textContent = error.message || 'No se pudo cargar la lista.'; row.appendChild(cell); this.body.appendChild(row);
      return false;
    }
  }

  renderRow(user) {
    const row = document.createElement('tr');
    const email = document.createElement('td'); email.textContent = user.email || ''; row.appendChild(email);
    const roleCell = document.createElement('td');
    const role = document.createElement('select'); role.className = 'form-select form-select-sm'; role.style.maxWidth = '170px';
    [['admin','Administrador'],['employee','Empleado']].forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = (user.role || 'employee') === value; role.appendChild(option); });
    role.disabled = String(user.id) === String(ApiSync.getSession()?.id);
    role.addEventListener('change', async () => this.runAction(user, 'setrole', { role: role.value }, 'Rol actualizado.'));
    roleCell.appendChild(role); row.appendChild(roleCell);
    const statusCell = document.createElement('td');
    const badge = document.createElement('span'); badge.className = `badge ${user.active ? 'text-bg-success' : 'text-bg-secondary'}`; badge.textContent = user.active ? 'Activo' : 'Desactivado'; statusCell.appendChild(badge); row.appendChild(statusCell);
    const actions = document.createElement('td'); actions.className = 'text-end text-nowrap';
    const view = document.createElement('button'); view.type = 'button'; view.className = 'btn btn-sm btn-outline-secondary me-1'; view.title = 'Ver detalle de la cuenta'; view.setAttribute('aria-label', `Ver cuenta de ${user.email}`); view.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
    view.addEventListener('click', () => RecordDetails.show('Detalle de usuario', [
      ['Correo electrónico', user.email], ['Rol', user.role === 'admin' ? 'Administrador' : 'Empleado'],
      ['Estado', user.active ? 'Activo' : 'Desactivado'], ['Fecha de creación', this.formatDate(user.createdAt)],
      ['Última actualización', this.formatDate(user.updatedAt)], ['ID', user.id, true]
    ]));
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = `btn btn-sm ${user.active ? 'btn-outline-warning' : 'btn-outline-success'} me-1`;
    toggle.textContent = user.active ? 'Desactivar' : 'Activar'; toggle.disabled = String(user.id) === String(ApiSync.getSession()?.id);
    toggle.addEventListener('click', () => this.runAction(user, 'setactive', { active: !user.active }, user.active ? 'Cuenta desactivada.' : 'Cuenta activada.'));
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn btn-sm btn-outline-primary me-1'; reset.textContent = 'Cambiar contraseña';
    reset.addEventListener('click', async () => {
      const password = window.prompt(`Nueva contraseña temporal para ${user.email} (mínimo 8 caracteres):`);
      if (!password) return;
      if (password.length < 8) return this.app.showToast('Usa al menos 8 caracteres.', 'error');
      await this.runAction(user, 'resetpassword', { password }, 'Contraseña actualizada.');
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.textContent = 'Eliminar';
    remove.disabled = user.role === 'admin' || String(user.id) === String(ApiSync.getSession()?.id);
    remove.addEventListener('click', () => {
      if (window.confirm(`¿Eliminar la cuenta de ${user.email}? Sus registros del negocio se conservan.`)) this.runAction(user, 'delete', {}, 'Cuenta eliminada.');
    });
    actions.append(view, toggle, reset, remove); row.appendChild(actions); this.body.appendChild(row);
  }

  formatDate(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  async runAction(user, action, fields, successMessage) {
    try {
      await ApiSync.updateUser(action, user.id, fields);
      this.app.showToast(successMessage, 'success');
      await this.render();
    } catch (error) { this.app.showToast(error.message || 'No se pudo actualizar el usuario.', 'error'); await this.render(); }
  }
}

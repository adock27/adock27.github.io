export class RecordDetails {
  static formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  static show(title, fields) {
    const modalElement = document.getElementById('recordDetailsModal');
    const titleElement = document.getElementById('recordDetailsTitle');
    const bodyElement = document.getElementById('recordDetailsBody');
    if (!modalElement || !titleElement || !bodyElement) return;

    titleElement.textContent = title;
    const content = document.createElement('dl');
    content.className = 'row g-3 mb-0';
    fields.forEach(([label, value, fullWidth = false]) => {
      const column = document.createElement('div');
      column.className = fullWidth ? 'col-12' : 'col-12 col-sm-6';
      const term = document.createElement('dt');
      term.className = 'small text-secondary fw-semibold mb-1';
      term.textContent = label;
      const description = document.createElement('dd');
      description.className = 'record-detail-value mb-0';
      description.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
      column.append(term, description);
      content.appendChild(column);
    });
    bodyElement.replaceChildren(content);
    const Modal = window.bootstrap?.Modal;
    if (Modal) Modal.getOrCreateInstance(modalElement).show();
  }
}

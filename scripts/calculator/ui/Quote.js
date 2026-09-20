import { Engine } from '../engine.js';

export class Quote {
  constructor(app) {
    this.app = app;
    this.quotePreview = document.getElementById('quotePreview');
    this.btnCopyQuote = document.getElementById('btnCopyQuote');
    this.quoteTierSelect = document.getElementById('quoteTierSelect');

    this.init();
  }

  init() {
    this.btnCopyQuote?.addEventListener('click', () => this.handleCopyQuote());
    this.quoteTierSelect?.addEventListener('change', () => this.updateQuotePreview());
  }

  updateQuotePreview() {
    if (!this.quotePreview || !this.app.latestReport) return;

    const tierId = this.quoteTierSelect?.value || 'rec';
    const selectedTier = this.app.latestReport.tiers.find(t => t.id === tierId) || this.app.latestReport.tiers[1] || this.app.latestReport.tiers[0];

    const materialsText = this.app.latestReport.filament.items.map(item => `  • ${item.materialName}: ~${item.grams}g`).join('\n');
    const extrasText = this.app.latestReport.extras.items.length > 0
      ? this.app.latestReport.extras.items.map(item => `  • ${item.name} (x${item.quantity})`).join('\n')
      : '  • Ninguno';

    const clientGreeting = this.app.currentJob.clientName ? `Hola ${this.app.currentJob.clientName}! ` : '';
    const printTimeStr = `${this.app.currentJob.hours}h ${this.app.currentJob.minutes}m`;

    let unitPriceText = '';
    if (this.app.currentJob.isBatch && this.app.currentJob.batchQuantity > 1) {
      const unitPrice = selectedTier.price / this.app.currentJob.batchQuantity;
      unitPriceText = `\n_(${Engine.formatMoney(unitPrice)} por unidad)_`;
    }

    const quoteText = 
`🖨️ *COTIZACIÓN DE IMPRESIÓN 3D*
${clientGreeting}Detalles estimados para tu pedido:

📌 *Proyecto:* ${this.app.currentJob.projectName || 'Impresión 3D Personalizada'}
⚙️ *Tecnología:* Bambu Lab P1S + AMS (FDM Alta Precisión)
⏱️ *Tiempo estimado:* ${printTimeStr}
📦 *Materiales:*
${materialsText}
🛠️ *Insumos / Extras:*
${extrasText}

━━━━━━━━━━━━━━━━━━━━
💰 *PRECIO FINAL:* ${Engine.formatMoney(selectedTier.price)}${unitPriceText}
━━━━━━━━━━━━━━━━━━━━
✅ *Incluye:* Calibración de alta resolución, acabados y post-procesado básico.
🚀 *Tiempo de entrega:* 24 a 48 horas tras confirmación.

_Cotización válida por 7 días._`;

    this.quotePreview.textContent = quoteText;
  }

  async handleCopyQuote() {
    const text = this.quotePreview?.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.app.showToast('📋 ¡Cotización copiada para WhatsApp!', 'success');
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.app.showToast('📋 ¡Cotización copiada al portapapeles!', 'success');
    }
  }
}

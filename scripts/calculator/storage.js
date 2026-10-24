import { ApiSync } from './api-sync.js';

/**
 * 3D Print Storage & Configuration Layer
 * Maneja persistencia, catálogos dinámicos (materiales, extras), presets y copias de seguridad.
 */

const cloneData = value => JSON.parse(JSON.stringify(value));
const runtimeData = { config: null, presets: null, inventory: null, sales: null, orders: null, purchases: null };

export const DEFAULT_CONFIG = {
  version: 2,
  currency: 'COP',
  initialSetupCompleted: false,
  initialSetupDismissed: false,
  electricityRate: 1000,      // Valor de ejemplo por kWh en la moneda seleccionada
  powerKw: 0.12,              // kW promedio Bambu Lab P1S (rango real: 0.08–0.15 kW según carga)
  wearRatePerHour: 800,       // Desgaste y amortización máquina por hora
  printerMonthlyPayment: 0,   // Cuota mensual de la impresora que se recupera con producción
  productiveHoursPerMonth: 100, // Horas productivas facturables estimadas al mes
  ownerMarginPercent: 25,     // Margen bruto del dueño sobre el precio al vendedor
  sellerMarginPercent: 30,    // Margen bruto del vendedor sobre el precio al cliente
  failureRatePercent: 5,      // Merma y riesgo de fallos (5%)
  purgeWastePercent: 5,       // Purga / desecho de filamento AMS (5%)
  laborRatePerHour: 10000,    // Tarifa mano de obra por hora
  roundingStep: 100,          // Redondeo a la centena superior
  
  // Catálogo dinámico de materiales
  materials: [
    { id: 'pla_std', name: 'PLA Estándar', pricePerKg: 55000, color: '#10b981', note: 'Uso general, decorativo' },
    { id: 'petgw', name: 'PETG Blanco', pricePerKg: 37000, color: '#e2e8f0', note: 'Resistente a humedad y temperatura' },
    { id: 'petgb', name: 'PETG Negro', pricePerKg: 32000, color: '#1e293b', note: 'Resistente y económico' },
    { id: 'tpu_95a', name: 'TPU 95A Flexible', pricePerKg: 85000, color: '#f59e0b', note: 'Elástico, absorbe impactos' },
    { id: 'abs_asa', name: 'ABS / ASA Técnico', pricePerKg: 65000, color: '#6366f1', note: 'Resistente a intemperie y rayos UV' },
    { id: 'pla_silk', name: 'PLA Seda / Bicolor', pricePerKg: 72000, color: '#ec4899', note: 'Acabado brillante premium' }
  ],

  // Catálogo dinámico de extras / hardware
  extrasCatalog: [
    { id: 'keychains', name: 'Argolla para llavero con cadena', defaultCost: 200, category: 'Herrajes' },
    { id: 'clicks', name: 'Switch de teclado mecánico', defaultCost: 600, category: 'Electrónica' },
    { id: 'magnets', name: 'Imán de neodimio 6x3mm', defaultCost: 450, category: 'Herrajes' },
    { id: 'screws_m3', name: 'Tornillo M3 + Inserto roscado', defaultCost: 350, category: 'Tornillería' },
    { id: 'packaging', name: 'Caja para regalo / Empaque especial', defaultCost: 1500, category: 'Empaque' }
  ],

  // Tiers de ganancia
  pricingTiers: [
    { id: 'min', name: 'Mínimo', margin: 30, icon: '📉', tag: 'Costo base + 30%' },
    { id: 'rec', name: 'Recomendado', margin: 50, icon: '⭐', tag: 'Equilibrado + 50%' },
    { id: 'pre', name: 'Premium / Urgente', margin: 100, icon: '🚀', tag: 'Prioridad + 100%' }
  ]
};

export const DEFAULT_PRESETS = [
  {
    id: 'preset_llavero',
    name: '🔑 Llavero Personalizado',
    description: 'Impresión rápida de llavero con argolla incluida',
    materialId: 'pla_std',
    grams: 18,
    hours: 0,
    minutes: 35,
    laborMinutes: 5,
    extras: [{ id: 'keychains', quantity: 1, unitCost: 200 }]
  },
  {
    id: 'preset_clicker',
    name: '⌨️ Clicker / Fidget Toy',
    description: 'Juguete antiestrés con switch mecánico',
    materialId: 'pla_std',
    grams: 25,
    hours: 0,
    minutes: 45,
    laborMinutes: 5,
    extras: [{ id: 'clicks', quantity: 1, unitCost: 600 }]
  },
  {
    id: 'preset_figura',
    name: '🗿 Figura Decorativa Mediana',
    description: 'Estatua o modelo de colección sin extras',
    materialId: 'pla_std',
    grams: 130,
    hours: 4,
    minutes: 20,
    laborMinutes: 15,
    extras: []
  },
  {
    id: 'preset_soporte',
    name: '🛠️ Pieza Mecánica / Soporte',
    description: 'Pieza resistente en PETG con tornillería',
    materialId: 'petgb',
    grams: 95,
    hours: 3,
    minutes: 15,
    laborMinutes: 10,
    extras: [{ id: 'screws_m3', quantity: 2, unitCost: 350 }]
  }
];

export const Storage = {
  setSnapshot(snapshot = {}) {
    ['config', 'presets', 'inventory', 'sales', 'orders', 'purchases'].forEach(key => {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) runtimeData[key] = cloneData(snapshot[key]);
    });
  },

  /**
   * Devuelve configuración cargada en memoria desde backend, o valores iniciales antes de autenticar.
   */
  loadConfig() {
    return runtimeData.config === null ? cloneData(DEFAULT_CONFIG) : cloneData(runtimeData.config);
  },

  /**
   * Guarda la configuración actual.
   * @param {Object} config
   */
  saveConfig(config) {
    runtimeData.config = cloneData(config);
    ApiSync.setSnapshot({ config: runtimeData.config });
    ApiSync.schedule('config');
    return true;
  },

  /**
   * Restablece la configuración original de fábrica.
   */
  resetConfig() {
    runtimeData.config = cloneData(DEFAULT_CONFIG);
    ApiSync.setSnapshot({ config: runtimeData.config });
    ApiSync.schedule('config');
    return cloneData(runtimeData.config);
  },

  /**
   * Carga la lista de presets guardados.
   */
  loadPresets() {
    return runtimeData.presets === null ? cloneData(DEFAULT_PRESETS) : cloneData(runtimeData.presets);
  },

  loadInventory() {
    return runtimeData.inventory === null ? [] : cloneData(runtimeData.inventory);
  },

  saveInventory(items) {
    runtimeData.inventory = cloneData(items);
    ApiSync.setSnapshot({ inventory: runtimeData.inventory });
    ApiSync.schedule('inventory');
    return true;
  },

  loadSales() {
    return runtimeData.sales === null ? [] : cloneData(runtimeData.sales);
  },

  saveSales(items) {
    runtimeData.sales = cloneData(items);
    ApiSync.setSnapshot({ sales: runtimeData.sales });
    ApiSync.schedule('sales');
    return true;
  },

  loadOrders() {
    return runtimeData.orders === null ? [] : cloneData(runtimeData.orders);
  },

  saveOrders(items) {
    runtimeData.orders = cloneData(items);
    ApiSync.setSnapshot({ orders: runtimeData.orders });
    ApiSync.schedule('orders');
    return true;
  },

  loadPurchases() {
    return runtimeData.purchases === null ? [] : cloneData(runtimeData.purchases);
  },

  savePurchases(items) {
    runtimeData.purchases = cloneData(items);
    ApiSync.setSnapshot({ purchases: runtimeData.purchases });
    ApiSync.schedule('purchases');
    return true;
  },

  /**
   * Guarda un nuevo preset o actualiza uno existente.
   * @param {Object} preset
   */
  savePreset(preset) {
    const presets = this.loadPresets();
    const existingIdx = presets.findIndex(p => p.id === preset.id);
    if (existingIdx >= 0) presets[existingIdx] = preset;
    else presets.push({ ...preset, id: preset.id || 'preset_' + Date.now() });
    runtimeData.presets = presets;
    ApiSync.setSnapshot({ presets });
    ApiSync.schedule('presets');
    return presets;
  },

  /**
   * Elimina un preset.
   * @param {string} presetId
   */
  deletePreset(presetId) {
    const presets = this.loadPresets().filter(p => p.id !== presetId);
    runtimeData.presets = presets;
    ApiSync.setSnapshot({ presets });
    ApiSync.schedule('presets');
    return presets;
  },

  /**
   * Exporta toda la configuración y presets en un JSON.
   */
  exportBackup() {
    const data = ApiSync.getSnapshot();
    return JSON.stringify({
      version: 3,
      exportDate: new Date().toISOString(),
      config: data.config || this.loadConfig(),
      presets: data.presets || this.loadPresets(),
      inventory: data.inventory || this.loadInventory(),
      sales: data.sales || this.loadSales(),
      orders: data.orders || this.loadOrders(),
      purchases: data.purchases || this.loadPurchases()
    }, null, 2);
  },

  /**
   * Importa configuración y presets desde una cadena JSON.
   * @param {string} jsonString
   */
  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Formato inválido');
      const current = ApiSync.getSnapshot();
      const next = {
        config: data.config || current.config,
        presets: Array.isArray(data.presets) ? data.presets : current.presets,
        inventory: Array.isArray(data.inventory) ? data.inventory : current.inventory,
        sales: Array.isArray(data.sales) ? data.sales : current.sales,
        orders: Array.isArray(data.orders) ? data.orders : current.orders,
        purchases: Array.isArray(data.purchases) ? data.purchases : current.purchases
      };
      this.setSnapshot(next);
      ApiSync.setSnapshot(next);
      ApiSync.schedule('all');
      return true;
    } catch (e) {
      console.error('Error importando copia de seguridad:', e);
      throw e;
    }
  }
};


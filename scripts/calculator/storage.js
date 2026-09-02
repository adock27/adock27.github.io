/**
 * 3D Print Storage & Configuration Layer
 * Maneja persistencia, catálogos dinámicos (materiales, extras), presets y copias de seguridad.
 */

const STORAGE_KEY = 'calc3d_config_v2';
const PRESETS_KEY = 'calc3d_presets_v2';

export const DEFAULT_CONFIG = {
  version: 2,
  currency: 'COP',
  electricityRate: 569.53,    // COP / kWh
  powerKw: 0.15,              // kW promedio Bambu Lab P1S
  wearRatePerHour: 800,       // Desgaste y amortización máquina COP / h
  failureRatePercent: 5,      // Merma y riesgo de fallos (5%)
  purgeWastePercent: 5,       // Purga / desecho de filamento AMS (5%)
  laborRatePerHour: 10000,    // Tarifa mano de obra COP / h
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
  /**
   * Carga la configuración combinando defaults y valores en localStorage.
   */
  loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };

      const parsed = JSON.parse(raw);
      // Migración o combinación limpia de arrays
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        materials: (parsed.materials && parsed.materials.length > 0) ? parsed.materials : DEFAULT_CONFIG.materials,
        extrasCatalog: (parsed.extrasCatalog && parsed.extrasCatalog.length > 0) ? parsed.extrasCatalog : DEFAULT_CONFIG.extrasCatalog,
        pricingTiers: (parsed.pricingTiers && parsed.pricingTiers.length > 0) ? parsed.pricingTiers : DEFAULT_CONFIG.pricingTiers
      };
    } catch (e) {
      console.error('Error cargando configuración, usando defaults:', e);
      return { ...DEFAULT_CONFIG };
    }
  },

  /**
   * Guarda la configuración actual.
   * @param {Object} config
   */
  saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error('Error guardando configuración:', e);
      return false;
    }
  },

  /**
   * Restablece la configuración original de fábrica.
   */
  resetConfig() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return { ...DEFAULT_CONFIG };
    } catch (e) {
      console.error(e);
      return { ...DEFAULT_CONFIG };
    }
  },

  /**
   * Carga la lista de presets guardados.
   */
  loadPresets() {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (!raw) return [...DEFAULT_PRESETS];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_PRESETS];
    } catch (e) {
      console.error('Error cargando presets:', e);
      return [...DEFAULT_PRESETS];
    }
  },

  /**
   * Guarda un nuevo preset o actualiza uno existente.
   * @param {Object} preset
   */
  savePreset(preset) {
    try {
      const presets = this.loadPresets();
      const existingIdx = presets.findIndex(p => p.id === preset.id);
      if (existingIdx >= 0) {
        presets[existingIdx] = preset;
      } else {
        presets.push({
          ...preset,
          id: preset.id || 'preset_' + Date.now()
        });
      }
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
      return presets;
    } catch (e) {
      console.error('Error guardando preset:', e);
      return null;
    }
  },

  /**
   * Elimina un preset.
   * @param {string} presetId
   */
  deletePreset(presetId) {
    try {
      const presets = this.loadPresets().filter(p => p.id !== presetId);
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
      return presets;
    } catch (e) {
      console.error('Error eliminando preset:', e);
      return null;
    }
  },

  /**
   * Exporta toda la configuración y presets en un JSON.
   */
  exportBackup() {
    return JSON.stringify({
      version: 2,
      exportDate: new Date().toISOString(),
      config: this.loadConfig(),
      presets: this.loadPresets()
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
      if (data.config) this.saveConfig(data.config);
      if (Array.isArray(data.presets)) localStorage.setItem(PRESETS_KEY, JSON.stringify(data.presets));
      return true;
    } catch (e) {
      console.error('Error importando copia de seguridad:', e);
      throw e;
    }
  }
};

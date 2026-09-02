/**
 * 3D Print Cost Engine
 * Motor de cálculo puro, desacoplado de la interfaz y 100% testeable.
 * Diseñado para impresoras 3D FDM / SLA (optimizada para Bambu Lab P1S + AMS 2 Pro).
 */

export const Engine = {
  /**
   * Formatea un número como moneda colombiana (COP) o formato estándar.
   * @param {number} amount
   * @param {string} currency
   * @returns {string}
   */
  formatMoney(amount, currency = 'COP') {
    const rounded = Math.round(amount || 0);
    return `$${rounded.toLocaleString('es-CO')} ${currency}`;
  },

  /**
   * Redondea un valor hacia arriba a la centena o valor especificado más cercano.
   * @param {number} value
   * @param {number} step
   * @returns {number}
   */
  roundUp(value, step = 100) {
    if (step <= 0) return Math.round(value);
    return Math.ceil(value / step) * step;
  },

  /**
   * Calcula el tiempo total en horas decimales.
   * @param {number} hours
   * @param {number} minutes
   * @returns {number}
   */
  toTotalHours(hours = 0, minutes = 0) {
    return (Number(hours) || 0) + ((Number(minutes) || 0) / 60);
  },

  /**
   * Calcula el costo de filamento.
   * Soporta impresión estándar (1 material) o múltiple (AMS / multicolor).
   * @param {Array<{ materialId: string, grams: number, pricePerKg: number }>} materialSlots
   * @param {number} purgeWastePercent Porcentaje de merma / purga de filamento (ej. 5% = 5)
   * @returns {{ totalGrams: number, rawFilamentCost: number, purgeCost: number, totalFilamentCost: number, items: Array }}
   */
  calculateFilamentCost(materialSlots = [], purgeWastePercent = 0) {
    let totalGrams = 0;
    let rawFilamentCost = 0;
    const items = [];

    materialSlots.forEach(slot => {
      const grams = Number(slot.grams) || 0;
      const pricePerKg = Number(slot.pricePerKg) || 0;
      const cost = grams * (pricePerKg / 1000);

      totalGrams += grams;
      rawFilamentCost += cost;

      items.push({
        materialId: slot.materialId,
        materialName: slot.materialName || slot.materialId,
        grams,
        pricePerKg,
        cost
      });
    });

    const wasteFactor = Math.max(0, Number(purgeWastePercent) || 0) / 100;
    const purgeCost = rawFilamentCost * wasteFactor;
    const totalFilamentCost = rawFilamentCost + purgeCost;

    return {
      totalGrams,
      rawFilamentCost,
      purgeCost,
      totalFilamentCost,
      items
    };
  },

  /**
   * Calcula los costos energéticos de la impresión.
   * @param {number} totalHours Horas totales decimales
   * @param {number} powerKw Consumo promedio en kW (ej. 0.15 kW para Bambu P1S)
   * @param {number} electricityRate Costo por kWh (ej. 569.53 COP)
   * @returns {{ totalKwh: number, energyCost: number }}
   */
  calculateEnergyCost(totalHours = 0, powerKw = 0.15, electricityRate = 569.53) {
    const hours = Math.max(0, Number(totalHours) || 0);
    const kw = Math.max(0, Number(powerKw) || 0);
    const rate = Math.max(0, Number(electricityRate) || 0);

    const totalKwh = hours * kw;
    const energyCost = totalKwh * rate;

    return {
      totalKwh,
      energyCost
    };
  },

  /**
   * Calcula el desgaste de máquina y depreciación por hora de uso.
   * (Boquillas, hotend, correas, rodamientos, cama PEI, vida útil de impresora).
   * @param {number} totalHours Horas de impresión
   * @param {number} wearRatePerHour Costo de desgaste por hora (ej. 500 - 1500 COP)
   * @returns {number}
   */
  calculateMachineWearCost(totalHours = 0, wearRatePerHour = 0) {
    const hours = Math.max(0, Number(totalHours) || 0);
    const rate = Math.max(0, Number(wearRatePerHour) || 0);
    return hours * rate;
  },

  /**
   * Calcula el costo de mano de obra (preparación de archivo, laminado, limpieza y post-procesado).
   * @param {number} laborMinutes Minutos dedicados por el operador
   * @param {number} laborRatePerHour Tarifa por hora de trabajo
   * @returns {number}
   */
  calculateLaborCost(laborMinutes = 0, laborRatePerHour = 0) {
    const minutes = Math.max(0, Number(laborMinutes) || 0);
    const rate = Math.max(0, Number(laborRatePerHour) || 0);
    return (minutes / 60) * rate;
  },

  /**
   * Calcula el costo total de extras e insumos de ferretería.
   * @param {Array<{ id: string, name: string, quantity: number, unitCost: number }>} extras
   * @returns {{ totalExtrasCost: number, items: Array }}
   */
  calculateExtrasCost(extras = []) {
    let totalExtrasCost = 0;
    const items = [];

    extras.forEach(extra => {
      const quantity = Math.max(0, Number(extra.quantity) || 0);
      const unitCost = Math.max(0, Number(extra.unitCost) || 0);
      const cost = quantity * unitCost;

      if (quantity > 0) {
        totalExtrasCost += cost;
        items.push({
          id: extra.id,
          name: extra.name,
          quantity,
          unitCost,
          cost
        });
      }
    });

    return {
      totalExtrasCost,
      items
    };
  },

  /**
   * Cálculo integral de un trabajo de impresión 3D.
   * @param {Object} params
   * @param {Array} params.materialSlots - Materiales usados
   * @param {number} params.hours - Horas enteras
   * @param {number} params.minutes - Minutos enteros
   * @param {Array} params.extras - Insumos y extras
   * @param {number} params.laborMinutes - Minutos de mano de obra
   * @param {Object} config - Parámetros de máquina y configuración
   * @returns {Object} Informe completo de costos, márgenes y precios
   */
  calculate(params = {}, config = {}) {
    const totalHours = this.toTotalHours(params.hours, params.minutes);

    // 1. Filamento
    const purgeWaste = Number(config.purgeWastePercent) || 0;
    const filament = this.calculateFilamentCost(params.materialSlots, purgeWaste);

    // 2. Electricidad
    const energy = this.calculateEnergyCost(totalHours, config.powerKw, config.electricityRate);

    // 3. Desgaste de máquina
    const machineWearCost = this.calculateMachineWearCost(totalHours, config.wearRatePerHour);

    // 4. Mano de obra
    const laborCost = this.calculateLaborCost(params.laborMinutes, config.laborRatePerHour);

    // 5. Insumos / Extras
    const extras = this.calculateExtrasCost(params.extras);

    // Subtotal directo de producción
    const directCost = filament.totalFilamentCost + energy.energyCost + machineWearCost + laborCost + extras.totalExtrasCost;

    // 6. Margen de fallo / riesgo de impresión (scrap buffer)
    const failureRate = Math.max(0, Number(config.failureRatePercent) || 0) / 100;
    const failureBufferCost = directCost * failureRate;

    // Costo base total de producción
    const totalProductionCost = directCost + failureBufferCost;

    // 7. Niveles de precios (Tiers)
    const roundingStep = Number(config.roundingStep) || 100;
    const tiers = (config.pricingTiers || [
      { id: 'min', name: 'Mínimo', margin: 30, icon: '📉', tag: 'Margen base' },
      { id: 'rec', name: 'Recomendado', margin: 50, icon: '⭐', tag: 'Mejor balance' },
      { id: 'pre', name: 'Premium / Urgente', margin: 100, icon: '🚀', tag: 'Alta exigencia' }
    ]).map(tier => {
      const marginPercent = Number(tier.margin) || 0;
      const rawPrice = totalProductionCost * (1 + marginPercent / 100);
      const roundedPrice = this.roundUp(rawPrice, roundingStep);
      const profit = Math.max(0, roundedPrice - totalProductionCost);
      const effectiveMargin = totalProductionCost > 0 ? (profit / totalProductionCost) * 100 : 0;

      return {
        ...tier,
        marginPercent,
        rawPrice,
        price: roundedPrice,
        profit,
        effectiveMargin
      };
    });

    // Desglose porcentual para gráfico o barra visual
    const costBreakdown = [
      { label: 'Filamento', cost: filament.totalFilamentCost, color: '#10b981' },
      { label: 'Energía', cost: energy.energyCost, color: '#f59e0b' },
      { label: 'Máquina', cost: machineWearCost, color: '#6366f1' },
      { label: 'Extras', cost: extras.totalExtrasCost, color: '#ec4899' },
      { label: 'Mano de Obra', cost: laborCost, color: '#06b6d4' },
      { label: 'Fallo/Merma', cost: failureBufferCost, color: '#ef4444' }
    ].map(item => ({
      ...item,
      percent: totalProductionCost > 0 ? (item.cost / totalProductionCost) * 100 : 0
    }));

    return {
      totalHours,
      filament,
      energy,
      machineWearCost,
      laborCost,
      extras,
      directCost,
      failureBufferCost,
      totalProductionCost,
      tiers,
      costBreakdown
    };
  }
};

// Persistencia remota de todos los datos de la calculadora en Google Apps Script.
const API_URL = 'https://script.google.com/macros/s/AKfycbwIK7JC4Me4vaboluWaY6tJ6CTe2fjdl1dDyoUfCtnBUngv5a069JAldSfGakdRdsa5/exec';
const SESSION_KEY = 'calc3d_session_v1';
const LEGACY_KEYS = ['calc3d_config_v2', 'calc3d_presets_v2', 'calc3d_inventory_v1', 'calc3d_sales_v1', 'calc3d_orders_v1'];
let syncTimer = null;
let syncing = Promise.resolve();
const pendingScopes = new Set();
let snapshot = { config: null, presets: null, inventory: null, sales: null, orders: null, purchases: null };

async function request(entity, action, fields = {}) {
  const session = ApiSync.getSession();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ entity, action, ...fields, ...(session?.token ? { token: session.token } : {}) })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'La API rechazó la solicitud.');
  return result.data;
}

async function replaceCollection(entity, items) {
  const userId = ApiSync.getSession()?.id;
  const remote = await request(entity, 'list', { userId });
  const remoteById = new Map(remote.map(item => [String(item.id), item]));
  const currentIds = new Set();
  for (const item of items) {
    const id = String(item.id || '');
    if (!id) continue;
    currentIds.add(id);
    if (remoteById.has(id)) await request(entity, 'update', { ...item, userId, id });
    else await request(entity, 'create', { ...item, userId, id });
  }
  for (const item of remote) {
    if (!currentIds.has(String(item.id))) await request(entity, 'delete', { id: item.id, userId });
  }
}

function readLegacyData(defaults) {
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  };
  const oldConfig = read(LEGACY_KEYS[0], null);
  const config = oldConfig && typeof oldConfig === 'object' ? {
    ...defaults.config,
    ...oldConfig,
    materials: Array.isArray(oldConfig.materials) && oldConfig.materials.length ? oldConfig.materials : defaults.config.materials,
    extrasCatalog: Array.isArray(oldConfig.extrasCatalog) && oldConfig.extrasCatalog.length ? oldConfig.extrasCatalog : defaults.config.extrasCatalog,
    pricingTiers: Array.isArray(oldConfig.pricingTiers) && oldConfig.pricingTiers.length ? oldConfig.pricingTiers : defaults.config.pricingTiers
  } : defaults.config;
  const oldPresets = read(LEGACY_KEYS[1], defaults.presets);
  const oldInventory = read(LEGACY_KEYS[2], defaults.inventory);
  const oldSales = read(LEGACY_KEYS[3], defaults.sales);
  const oldOrders = read(LEGACY_KEYS[4], defaults.orders);
  return {
    config,
    presets: Array.isArray(oldPresets) && oldPresets.length ? oldPresets : defaults.presets,
    inventory: Array.isArray(oldInventory) ? oldInventory : defaults.inventory,
    sales: Array.isArray(oldSales) ? oldSales : defaults.sales,
    orders: Array.isArray(oldOrders) ? oldOrders : defaults.orders,
    purchases: []
  };
}

function clearLegacyData() {
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
}

async function pushSnapshot(scopes, current = snapshot) {
  const { config, presets, inventory, sales, orders, purchases } = current;
  const userId = ApiSync.getSession()?.id;
  if (!userId) throw new Error('Inicia sesión para guardar los datos.');
  const all = scopes.has('all');
  if (all || scopes.has('config')) {
    await request('configuracion', 'save', { userId, data: config });
    await replaceCollection('materiales', config.materials || []);
    await replaceCollection('extras', config.extrasCatalog || []);
  }
  if (all || scopes.has('presets')) await replaceCollection('presets', presets || []);
  if (all || scopes.has('inventory')) await replaceCollection('inventario', inventory || []);
  if (all || scopes.has('sales')) await replaceCollection('ventas', sales || []);
  if (all || scopes.has('orders')) await replaceCollection('pedidos', orders || []);
  if (all || scopes.has('purchases')) await replaceCollection('compras', purchases || []);
}

export const ApiSync = {
  getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (_) { return null; }
  },

  getSnapshot() { return JSON.parse(JSON.stringify(snapshot)); },

  setSnapshot(data = {}) {
    snapshot = { ...snapshot, ...JSON.parse(JSON.stringify(data)) };
  },

  saveSession(session) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clearSession() { sessionStorage.removeItem(SESSION_KEY); },

  async register(email, password) {
    await request('usuarios', 'create', { email, password });
    return this.login(email, password);
  },

  async login(email, password) {
    const user = await request('usuarios', 'login', { email, password });
    const session = { id: user.id, email: user.email, token: user.sessionToken };
    this.saveSession(session);
    return session;
  },

  async listMaterials() {
    return request('materiales', 'list', { userId: this.getSession()?.id });
  },

  async load(defaults) {
    window.dispatchEvent(new CustomEvent('calculator-api-sync-start', { detail: { scopes: ['load'] } }));
    try {
      const userId = this.getSession()?.id;
      if (!userId) throw new Error('Inicia sesión para cargar tus datos.');
      const [remoteConfigRecord, materials, extras, presets, inventory, sales, orders, purchases] = await Promise.all([
        request('configuracion', 'get', { userId }),
        request('materiales', 'list', { userId }),
        request('extras', 'list', { userId }),
        request('presets', 'list', { userId }),
        request('inventario', 'list', { userId }),
        request('ventas', 'list', { userId }),
        request('pedidos', 'list', { userId }),
        request('compras', 'list', { userId })
      ]);
      const remoteConfig = remoteConfigRecord?.data;
      const hasRemoteData = Boolean(remoteConfig || materials.length || extras.length || presets.length || inventory.length || sales.length || orders.length || purchases.length);
      if (!hasRemoteData) {
        const initial = readLegacyData(defaults);
        this.setSnapshot(initial);
        await pushSnapshot(new Set(['all']), this.getSnapshot());
        clearLegacyData();
        const loaded = { ...this.getSnapshot(), connected: true };
        window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: ['load'] } }));
        return loaded;
      }
      const legacy = remoteConfigRecord ? defaults : readLegacyData(defaults);
      const config = {
        ...legacy.config,
        ...(remoteConfig || {}),
        materials: remoteConfigRecord ? materials : (materials.length ? materials : legacy.config.materials),
        extrasCatalog: remoteConfigRecord ? extras : (extras.length ? extras : legacy.config.extrasCatalog)
      };
      const snapshotData = {
        config,
        presets: remoteConfigRecord ? presets : (presets.length ? presets : legacy.presets),
        inventory: remoteConfigRecord || inventory.length ? inventory : legacy.inventory,
        sales: remoteConfigRecord || sales.length ? sales : legacy.sales,
        orders: remoteConfigRecord || orders.length ? orders : legacy.orders,
        purchases
      };
      this.setSnapshot(snapshotData);
      if (!remoteConfigRecord) await pushSnapshot(new Set(['all']), this.getSnapshot());
      clearLegacyData();
      const loaded = { ...this.getSnapshot(), connected: true };
      window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: ['load'] } }));
      return loaded;
    } catch (error) {
      console.error('No se pudieron cargar los datos desde Apps Script.', error);
      window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: { scopes: ['load'], error } }));
      if (/sesión|cuenta ya no existe|no autorizado/i.test(error.message || '')) {
        window.dispatchEvent(new Event('calculator-auth-expired'));
      }
      throw error;
    }
  },

  schedule(scope = 'all') {
    pendingScopes.add(scope);
    clearTimeout(syncTimer);
    window.dispatchEvent(new CustomEvent('calculator-api-sync-start', { detail: { scopes: Array.from(pendingScopes) } }));
    syncTimer = setTimeout(() => {
      const scopes = new Set(pendingScopes);
      pendingScopes.clear();
      syncing = syncing.then(async () => {
        await pushSnapshot(scopes);
        window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: Array.from(scopes) } }));
      }).catch(error => {
        console.error('No se pudo guardar en Apps Script.', error);
        window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: { scopes: Array.from(scopes), error } }));
      });
    }, 700);
  }
};

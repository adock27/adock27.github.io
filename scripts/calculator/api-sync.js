// Persistencia remota de todos los datos de la calculadora en Google Apps Script.
const API_URL = 'https://script.google.com/macros/s/AKfycbwIK7JC4Me4vaboluWaY6tJ6CTe2fjdl1dDyoUfCtnBUngv5a069JAldSfGakdRdsa5/exec';
const SESSION_KEY = 'calc3d_session_v1';
const MATERIAL_CACHE_PREFIX = 'calc3d_materials_cache_v1_';
const CORE_CACHE_PREFIX = 'calc3d_core_cache_v1_';
const MATERIAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LEGACY_KEYS = ['calc3d_config_v2', 'calc3d_presets_v2', 'calc3d_inventory_v1', 'calc3d_sales_v1', 'calc3d_orders_v1'];
let syncTimer = null;
let syncing = Promise.resolve();
let activeApiRequests = 0;
const pendingScopes = new Set();
const loadingEntities = new Map();
let snapshot = { config: null, presets: null, inventory: null, sales: null, orders: null, purchases: null };

function materialCacheKey(userId) {
  return `${MATERIAL_CACHE_PREFIX}${encodeURIComponent(String(userId || ''))}`;
}

function readMaterialCache(userId) {
  try {
    const cached = JSON.parse(localStorage.getItem(materialCacheKey(userId)) || 'null');
    const age = Date.now() - Number(cached?.savedAt);
    return Array.isArray(cached?.materials) && age >= 0 && age < MATERIAL_CACHE_TTL_MS ? cached.materials : null;
  } catch (_) { return null; }
}

function writeMaterialCache(userId, materials) {
  if (!Array.isArray(materials) || !userId) return;
  try {
    localStorage.setItem(materialCacheKey(userId), JSON.stringify({ savedAt: Date.now(), materials }));
  } catch (_) { /* If browser storage is unavailable, fetch the catalog on next load. */ }
}

function readCoreCache(userId, part) {
  try {
    const cache = JSON.parse(localStorage.getItem(`${CORE_CACHE_PREFIX}${encodeURIComponent(String(userId || ''))}`) || 'null');
    const entry = cache?.[part];
    const age = Date.now() - Number(entry?.savedAt);
    if (!entry || age < 0 || age >= MATERIAL_CACHE_TTL_MS) return null;
    if (part === 'config') return entry.data && typeof entry.data === 'object' ? entry.data : null;
    return Array.isArray(entry.data) ? entry.data : null;
  } catch (_) { return null; }
}

function writeCoreCache(userId, part, data) {
  if (!userId || (part === 'config' ? !data || typeof data !== 'object' : !Array.isArray(data))) return;
  const key = `${CORE_CACHE_PREFIX}${encodeURIComponent(String(userId))}`;
  try {
    const cache = JSON.parse(localStorage.getItem(key) || '{}') || {};
    cache[part] = { savedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (_) { /* The remote backend remains the source of truth. */ }
}

async function request(entity, action, fields = {}) {
  const session = ApiSync.getSession();
  activeApiRequests += 1;
  window.dispatchEvent(new CustomEvent('calculator-api-request-start', { detail: { entity, action, activeRequests: activeApiRequests } }));
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ entity, action, ...fields, ...(session?.token ? { token: session.token } : {}) })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'La API rechazó la solicitud.');
    return result.data;
  } finally {
    activeApiRequests = Math.max(0, activeApiRequests - 1);
    window.dispatchEvent(new CustomEvent('calculator-api-request-end', { detail: { entity, action, activeRequests: activeApiRequests } }));
  }
}

async function replaceCollection(entity, items) {
  const session = ApiSync.getSession();
  const userId = session?.businessId || session?.id;
  const remote = await request(entity, 'list', { userId });
  const remoteById = new Map(remote.map(item => [String(item.id), item]));
  const currentIds = new Set();
  for (const item of items) {
    const id = String(item.id || '');
    if (!id) continue;
    currentIds.add(id);
    if (remoteById.has(id)) {
      const existing = remoteById.get(id);
      const canUpdate = session?.role === 'admin'
        || (entity === 'inventario' && session?.role === 'employee')
        || (['cotizaciones', 'ventas', 'pedidos'].includes(entity) && String(existing.createdBy || '') === String(session?.id || ''));
      if (canUpdate && comparableRecord(item) !== comparableRecord(existing)) await request(entity, 'update', { ...item, userId, id });
    }
    else await request(entity, 'create', { ...item, userId, id });
  }
  for (const item of remote) {
    const canDelete = session?.role === 'admin' || (['cotizaciones', 'ventas', 'pedidos'].includes(entity) && String(item.createdBy || '') === String(session?.id || ''));
    if (canDelete && !currentIds.has(String(item.id))) await request(entity, 'delete', { id: item.id, userId });
  }
}

function comparableRecord(record) {
  const comparable = { ...record };
  ['userId', 'createdBy', 'createdByEmail', 'createdAt', 'updatedAt'].forEach(key => delete comparable[key]);
  return JSON.stringify(Object.keys(comparable).sort().reduce((sorted, key) => {
    sorted[key] = comparable[key];
    return sorted;
  }, {}));
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
  const session = ApiSync.getSession();
  const userId = session?.businessId || session?.id;
  if (!userId) throw new Error('Inicia sesión para guardar los datos.');
  const all = scopes.has('all');
  if (all || scopes.has('config')) {
    await request('configuracion', 'save', { userId, data: config });
    writeCoreCache(userId, 'config', config);
    await replaceCollection('materiales', config.materials || []);
    writeMaterialCache(userId, config.materials || []);
    await replaceCollection('extras', config.extrasCatalog || []);
    writeCoreCache(userId, 'extras', config.extrasCatalog || []);
  }
  if (all || scopes.has('presets')) {
    await replaceCollection('presets', presets || []);
    writeCoreCache(userId, 'presets', presets || []);
  }
  if (all || scopes.has('inventory')) await replaceCollection('inventario', inventory || []);
  if (all || scopes.has('sales')) await replaceCollection('ventas', sales || []);
  if (all || scopes.has('orders')) await replaceCollection('pedidos', orders || []);
  if (all || scopes.has('purchases')) await replaceCollection('compras', purchases || []);
}

export const ApiSync = {
  getSession() {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
      // Migra sesiones abiertas antes de persistir el acceso entre recargas móviles.
      const temporary = sessionStorage.getItem(SESSION_KEY);
      if (!temporary) return null;
      localStorage.setItem(SESSION_KEY, temporary);
      sessionStorage.removeItem(SESSION_KEY);
      return JSON.parse(temporary);
    } catch (_) { return null; }
  },

  getSnapshot() { return JSON.parse(JSON.stringify(snapshot)); },

  setSnapshot(data = {}) {
    snapshot = { ...snapshot, ...JSON.parse(JSON.stringify(data)) };
  },

  saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  async register(email, password) {
    await request('usuarios', 'create', { email, password });
    return this.login(email, password);
  },

  async login(email, password) {
    const user = await request('usuarios', 'login', { email, password });
    const session = { id: user.id, email: user.email, token: user.sessionToken, role: user.role || 'admin', businessId: user.businessId || user.id };
    this.saveSession(session);
    return session;
  },

  async listMaterials() {
    const session = this.getSession();
    const userId = session?.businessId || session?.id;
    const materials = await request('materiales', 'list', { userId });
    writeMaterialCache(userId, materials);
    return materials;
  },

  async listUsers() { return request('usuarios', 'list'); },

  async loadUsers() {
    window.dispatchEvent(new CustomEvent('calculator-api-sync-start', { detail: { scopes: ['usuarios'], operation: 'load' } }));
    try {
      const users = await this.listUsers();
      window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: ['usuarios'], operation: 'load' } }));
      return users;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: { scopes: ['usuarios'], operation: 'load', error } }));
      if (/sesión|cuenta ya no existe|cuenta está desactivada|no autorizado/i.test(error.message || '')) window.dispatchEvent(new Event('calculator-auth-expired'));
      throw error;
    }
  },

  async loadEntity(entity) {
    const entities = {
      inventario: 'inventory',
      ventas: 'sales',
      pedidos: 'orders',
      compras: 'purchases'
    };
    const key = entities[entity];
    if (!key) throw new Error(`No se reconoce el módulo ${entity}.`);
    if (loadingEntities.has(entity)) return loadingEntities.get(entity);
    const session = this.getSession();
    const userId = session?.businessId || session?.id;
    if (!userId) throw new Error('Inicia sesión para cargar este módulo.');
    const task = (async () => {
      window.dispatchEvent(new CustomEvent('calculator-api-sync-start', { detail: { scopes: [entity], operation: 'load' } }));
      try {
        const records = await request(entity, 'list', { userId });
        this.setSnapshot({ [key]: records });
        window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: [entity], operation: 'load' } }));
        return records;
      } catch (error) {
        window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: { scopes: [entity], operation: 'load', error } }));
        if (/sesión|cuenta ya no existe|cuenta está desactivada|no autorizado/i.test(error.message || '')) {
          window.dispatchEvent(new Event('calculator-auth-expired'));
        }
        throw error;
      } finally {
        loadingEntities.delete(entity);
      }
    })();
    loadingEntities.set(entity, task);
    return task;
  },

  async createEmployee(email, password) { return request('usuarios', 'createuser', { email, password }); },

  async updateUser(action, id, fields = {}) { return request('usuarios', action, { id, ...fields }); },

  async flushPending(allowRetryAfterActiveFailure = true) {
    clearTimeout(syncTimer);
    syncTimer = null;
    if (!pendingScopes.size) {
      await syncing;
      if (pendingScopes.size) {
        if (allowRetryAfterActiveFailure) return this.flushPending(false);
        throw new Error('No se pudieron guardar los cambios pendientes. Revisa la conexión antes de sincronizar.');
      }
      return;
    }
    const scopes = new Set(pendingScopes);
    pendingScopes.clear();
    window.dispatchEvent(new CustomEvent('calculator-api-sync-start', { detail: { scopes: Array.from(scopes) } }));
    const task = syncing.then(() => pushSnapshot(scopes));
    syncing = task.catch(error => {
      scopes.forEach(scope => pendingScopes.add(scope));
      console.error('No se pudieron guardar los cambios pendientes antes de sincronizar.', error);
      window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: { scopes: Array.from(scopes), error } }));
    });
    await task;
    window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: Array.from(scopes) } }));
  },

  async refreshSales() {
    await this.flushPending();
    const session = this.getSession();
    const userId = session?.businessId || session?.id;
    if (!userId) throw new Error('Inicia sesión para sincronizar las ventas.');
    const sales = await request('ventas', 'list', { userId });
    this.setSnapshot({ sales });
    return sales;
  },

  async load(defaults) {
    window.dispatchEvent(new CustomEvent('calculator-api-sync-start', { detail: { scopes: ['load'] } }));
    try {
      let session = this.getSession();
      if (!session?.id) throw new Error('Inicia sesión para cargar tus datos.');
      const currentUser = await request('usuarios', 'me');
      session = { ...session, id: currentUser.id, email: currentUser.email, role: currentUser.role || 'admin', businessId: currentUser.businessId || currentUser.id };
      this.saveSession(session);
      const userId = session.businessId;
      const cachedConfig = readCoreCache(userId, 'config');
      const cachedExtras = readCoreCache(userId, 'extras');
      const cachedPresets = readCoreCache(userId, 'presets');
      const cachedMaterials = readMaterialCache(userId);
      const configPromise = cachedConfig !== null
        ? Promise.resolve({ data: cachedConfig })
        : request('configuracion', 'get', { userId }).then(record => {
          if (record?.data) writeCoreCache(userId, 'config', record.data);
          return record;
        });
      const extrasPromise = cachedExtras !== null
        ? Promise.resolve(cachedExtras)
        : request('extras', 'list', { userId }).then(extras => {
          writeCoreCache(userId, 'extras', extras);
          return extras;
        });
      const presetsPromise = cachedPresets !== null
        ? Promise.resolve(cachedPresets)
        : request('presets', 'list', { userId }).then(presets => {
          writeCoreCache(userId, 'presets', presets);
          return presets;
        });
      const materialsPromise = cachedMaterials !== null
        ? Promise.resolve(cachedMaterials)
        : request('materiales', 'list', { userId }).then(materials => {
          writeMaterialCache(userId, materials);
          return materials;
        });
      const [remoteConfigRecord, materials, extras, presets] = await Promise.all([
        configPromise,
        materialsPromise,
        extrasPromise,
        presetsPromise
      ]);
      const remoteConfig = remoteConfigRecord?.data;
      // Cuentas ya inicializadas cargan solo lo que necesita la calculadora.
      // La lectura completa se reserva para migraciones o el primer inicio.
      if (remoteConfigRecord) {
        const config = {
          ...defaults.config,
          ...remoteConfig,
          materials,
          extrasCatalog: extras
        };
        const snapshotData = { config, presets, inventory: [], sales: [], orders: [], purchases: [] };
        this.setSnapshot(snapshotData);
        const loaded = { ...this.getSnapshot(), connected: true, deferred: ['inventario', 'ventas', 'pedidos', ...(session.role === 'admin' ? ['compras'] : [])] };
        window.dispatchEvent(new CustomEvent('calculator-api-sync-success', { detail: { scopes: ['load'] } }));
        return loaded;
      }

      const purchaseRequest = session.role === 'admin' ? request('compras', 'list', { userId }) : Promise.resolve([]);
      const [inventory, sales, orders, purchases] = await Promise.all([
        request('inventario', 'list', { userId }),
        request('ventas', 'list', { userId }),
        request('pedidos', 'list', { userId }),
        purchaseRequest
      ]);
      const hasRemoteData = Boolean(remoteConfig || materials.length || extras.length || presets.length || inventory.length || sales.length || orders.length || purchases.length);
      if (!hasRemoteData) {
        if (session.role !== 'admin') throw new Error('El administrador debe inicializar primero los datos del negocio.');
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
      if (/sesión|cuenta ya no existe|cuenta está desactivada|no autorizado/i.test(error.message || '')) {
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
        scopes.forEach(scope => pendingScopes.add(scope));
        console.error('No se pudo guardar en Apps Script.', error);
        window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: { scopes: Array.from(scopes), error } }));
      });
    }, 700);
  }
};

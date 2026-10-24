// Sincronización con Google Apps Script; localStorage conserva una copia local.
const API_URL = 'https://script.google.com/macros/s/AKfycbwIK7JC4Me4vaboluWaY6tJ6CTe2fjdl1dDyoUfCtnBUngv5a069JAldSfGakdRdsa5/exec';
const CONFIG_KEY = 'calc3d_config_v2';
const PRESETS_KEY = 'calc3d_presets_v2';
const INVENTORY_KEY = 'calc3d_inventory_v1';
const SALES_KEY = 'calc3d_sales_v1';
const SESSION_KEY = 'calc3d_session_v1';
let syncTimer = null;
let syncing = Promise.resolve();
const pendingScopes = new Set();

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

function localSnapshot() {
  let config = {}, presets = [], inventory = [], sales = [];
  try { config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch (_) { /* usa defaults */ }
  try { presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch (_) { /* usa lista vacía */ }
  try { inventory = JSON.parse(localStorage.getItem(INVENTORY_KEY) || '[]'); } catch (_) { /* usa lista vacía */ }
  try { sales = JSON.parse(localStorage.getItem(SALES_KEY) || '[]'); } catch (_) { /* usa lista vacía */ }
  return { config, presets, inventory, sales };
}

async function replaceCollection(entity, items) {
  const userId = ApiSync.getSession()?.id;
  const remote = await request(entity, 'list', { userId });
  const remoteById = new Map(remote.map(item => [String(item.id), item]));
  const localIds = new Set();
  for (const item of items) {
    const id = String(item.id || '');
    if (!id) continue;
    localIds.add(id);
    if (remoteById.has(id)) await request(entity, 'update', { ...item, userId, id });
    else await request(entity, 'create', { ...item, userId, id });
  }
  for (const item of remote) {
    if (!localIds.has(String(item.id))) await request(entity, 'delete', { id: item.id, userId });
  }
}

async function pushSnapshot(scopes) {
  const { config, presets, inventory, sales } = localSnapshot();
  const userId = ApiSync.getSession()?.id;
  if (!userId) throw new Error('Inicia sesión para sincronizar.');
  const all = scopes.has('all');
  if (all || scopes.has('config')) {
    await request('configuracion', 'save', { userId, data: config });
    await replaceCollection('materiales', config.materials || []);
    await replaceCollection('extras', config.extrasCatalog || []);
  }
  if (all || scopes.has('presets')) await replaceCollection('presets', presets || []);
  if (all || scopes.has('inventory')) await replaceCollection('inventario', inventory || []);
  if (all || scopes.has('sales')) await replaceCollection('ventas', sales || []);
}

export const ApiSync = {
  getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (_) { return null; }
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

  async load(localConfig, localPresets, localInventory = [], localSales = []) {
    try {
      const userId = this.getSession()?.id;
      if (!userId) throw new Error('Inicia sesión para cargar tus datos.');
      const [remoteConfigRecord, materials, extras, presets, inventory, sales] = await Promise.all([
        request('configuracion', 'get', { userId }),
        request('materiales', 'list', { userId }),
        request('extras', 'list', { userId }),
        request('presets', 'list', { userId }),
        request('inventario', 'list', { userId }),
        request('ventas', 'list', { userId })
      ]);
      const remoteConfig = remoteConfigRecord?.data;
      const hasRemoteData = Boolean(remoteConfig || materials.length || extras.length || presets.length || inventory.length || sales.length);
      if (!hasRemoteData) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(localConfig));
        localStorage.setItem(PRESETS_KEY, JSON.stringify(localPresets));
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(localInventory));
        localStorage.setItem(SALES_KEY, JSON.stringify(localSales));
        this.schedule(); // Migra los datos locales iniciales a la cuenta.
        return { config: localConfig, presets: localPresets, inventory: localInventory, sales: localSales, connected: true };
      }
      const config = {
        ...localConfig,
        ...(remoteConfig || {}),
        materials: remoteConfigRecord ? materials : (materials.length ? materials : localConfig.materials),
        extrasCatalog: remoteConfigRecord ? extras : (extras.length ? extras : localConfig.extrasCatalog)
      };
      const finalPresets = remoteConfigRecord ? presets : (presets.length ? presets : localPresets);
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      localStorage.setItem(PRESETS_KEY, JSON.stringify(finalPresets));
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
      localStorage.setItem(SALES_KEY, JSON.stringify(sales));
      return { config, presets: finalPresets, inventory, sales, connected: true };
    } catch (error) {
      console.warn('Apps Script no disponible; se usará el almacenamiento local.', error);
      if (/sesión|cuenta ya no existe|no autorizado/i.test(error.message || '')) {
        window.dispatchEvent(new Event('calculator-auth-expired'));
      }
      return { config: localConfig, presets: localPresets, inventory: localInventory, sales: localSales, connected: false };
    }
  },

  schedule(scope = 'all') {
    pendingScopes.add(scope);
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const scopes = new Set(pendingScopes);
      pendingScopes.clear();
      syncing = syncing.then(() => pushSnapshot(scopes)).catch(error => {
        console.warn('No se pudo sincronizar con Apps Script.', error);
        window.dispatchEvent(new CustomEvent('calculator-api-sync-error', { detail: error }));
      });
    }, 700);
  }
};

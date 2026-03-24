/**
 * Data merge and optional server sync.
 * - Import merges by id: same id = update, new id = add (no duplicates).
 * - Optional DATA_CONFIG.serverUrl for load/save to a shared backend.
 */

function getTerritoryId(feature) {
  return (feature && feature.properties && feature.properties.id) || null;
}

function getPoiId(poi) {
  return (poi && poi.id) || null;
}

/**
 * Merge territories by id. Incoming wins on conflict (so their export updates yours).
 */
function mergeTerritories(existing, incoming) {
  const byId = new Map();
  existing.forEach((f) => {
    const id = getTerritoryId(f);
    if (id) byId.set(id, f);
  });
  incoming.forEach((f) => {
    if (!f.properties) f.properties = {};
    let id = getTerritoryId(f);
    if (!id) {
      f.properties.id = typeof generateId === 'function' ? generateId() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      id = f.properties.id;
    }
    byId.set(id, f);
  });
  return Array.from(byId.values());
}

/**
 * Merge POIs by id. Incoming wins on conflict.
 */
function mergePoi(existing, incoming) {
  const byId = new Map();
  existing.forEach((p) => {
    const id = getPoiId(p);
    if (id) byId.set(id, p);
  });
  incoming.forEach((p) => {
    let id = getPoiId(p);
    if (!id) {
      p.id = typeof generateId === 'function' ? generateId() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      id = p.id;
    }
    byId.set(id, p);
  });
  return Array.from(byId.values());
}

/**
 * Merge category colors: incoming overwrites existing for same key.
 */
function mergeCategoryColors(existing, incoming) {
  if (!incoming || typeof incoming !== 'object') return existing;
  var out = {};
  Object.keys(existing).forEach(function (k) { out[k] = existing[k]; });
  Object.keys(incoming).forEach(function (k) {
    if (incoming[k] && typeof incoming[k] === 'string') out[k] = incoming[k];
  });
  return out;
}

/**
 * Merge imported data with current storage and persist. Returns { territories, poi } counts.
 */
function mergeImportData(data) {
  const existingTerritories = getTerritoriesFromStorage();
  const existingPoi = getPoiFromStorage();
  const territories = (data.territories && Array.isArray(data.territories)) ? mergeTerritories(existingTerritories, data.territories) : existingTerritories;
  const poi = (data.poi && Array.isArray(data.poi)) ? mergePoi(existingPoi, data.poi) : existingPoi;
  saveTerritoriesToStorage(territories);
  savePoiToStorage(poi);
  if (typeof getCategoryColorsFromStorage === 'function' && typeof saveCategoryColorsToStorage === 'function') {
    var existingColors = getCategoryColorsFromStorage();
    var mergedColors = mergeCategoryColors(existingColors, data.categoryColors);
    saveCategoryColorsToStorage(mergedColors);
  }
  if (data.hiddenTerritoryIds && Array.isArray(data.hiddenTerritoryIds) && typeof saveHiddenTerritoryIds === 'function') {
    saveHiddenTerritoryIds(data.hiddenTerritoryIds);
  }
  if (data.hiddenPoiIds && Array.isArray(data.hiddenPoiIds) && typeof saveHiddenPoiIds === 'function') {
    saveHiddenPoiIds(data.hiddenPoiIds);
  }
  if (data.settings && typeof mergeMapSettingsFromImport === 'function') {
    mergeMapSettingsFromImport(data.settings);
  }
  return { territories: territories.length, poi: poi.length };
}

function isFirebaseConfigured() {
  return typeof DATA_CONFIG !== 'undefined' && DATA_CONFIG && DATA_CONFIG.firebase && DATA_CONFIG.firebase.apiKey;
}

function isRestServerConfigured() {
  return typeof DATA_CONFIG !== 'undefined' && DATA_CONFIG && DATA_CONFIG.serverUrl;
}

function isServerSyncConfigured() {
  return isFirebaseConfigured() || isRestServerConfigured();
}

/**
 * Fetch shared data from server (GET). Uses Firebase if configured, else REST URL.
 */
async function loadFromServer(mergeWithCurrent = true) {
  if (typeof loadFromFirebase === 'function' && isFirebaseConfigured()) {
    return loadFromFirebase(mergeWithCurrent);
  }
  const url = isRestServerConfigured() ? DATA_CONFIG.serverUrl : null;
  if (!url) throw new Error('No server configured. Set DATA_CONFIG.firebase or DATA_CONFIG.serverUrl in js/config.js');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Server returned ' + res.status);
  const data = await res.json();
  if (mergeWithCurrent) mergeImportData(data);
  return data;
}

/**
 * Save current data to server. Uses Firebase if configured, else REST POST/PUT.
 */
async function saveToServer() {
  if (typeof saveToFirebase === 'function' && isFirebaseConfigured()) {
    return saveToFirebase();
  }
  const url = isRestServerConfigured() ? DATA_CONFIG.serverUrl : null;
  if (!url) throw new Error('No server configured. Set DATA_CONFIG.firebase or DATA_CONFIG.serverUrl in js/config.js');
  const data = {
    version: 2,
    territories: getTerritoriesFromStorage(),
    poi: getPoiFromStorage(),
    categories: typeof getAllCategoriesFromPois === 'function' ? getAllCategoriesFromPois() : [],
    categoryColors: typeof getCategoryColorsFromStorage === 'function' ? getCategoryColorsFromStorage() : {},
    hiddenTerritoryIds: typeof getHiddenTerritoryIds === 'function' ? getHiddenTerritoryIds() : [],
    hiddenPoiIds: typeof getHiddenPoiIds === 'function' ? getHiddenPoiIds() : [],
    settings: typeof getMapSettings === 'function' ? getMapSettings() : {},
  };
  const method = (DATA_CONFIG && DATA_CONFIG.saveMethod) || 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Server returned ' + res.status);
  return data;
}

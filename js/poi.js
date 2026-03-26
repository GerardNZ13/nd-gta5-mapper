/**
 * Points of interest: markers with category, name, notes.
 */
let poiLayerGroup;
let isAddingPoi = false;
let pendingPoiLatLng = null;
let editingPoiId = null;
let tempPoiMarker = null; // Track the temporary marker before saving

const POI_STORAGE_KEY = 'gta5-map-poi';
const CATEGORY_COLORS_STORAGE_KEY = 'gta5-map-poi-category-colors';
const HIDDEN_POI_KEY = 'gta5-map-hidden-poi';
const POI_CATEGORY_UI_COLLAPSED_KEY = 'gta5-map-ui-poi-category-collapsed';

// --- Storage & Helpers ---

function getPoiCategoryUiCollapsed() {
  try {
    var raw = localStorage.getItem(POI_CATEGORY_UI_COLLAPSED_KEY);
    if (!raw) return {};
    var o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function savePoiCategoryUiCollapsed(obj) {
  try {
    localStorage.setItem(POI_CATEGORY_UI_COLLAPSED_KEY, JSON.stringify(obj && typeof obj === 'object' ? obj : {}));
  } catch (e) {
    console.warn('poi category ui collapsed save', e);
  }
}

function getHiddenPoiIds() {
  try {
    var raw = localStorage.getItem(HIDDEN_POI_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHiddenPoiIds(ids) {
  try {
    localStorage.setItem(HIDDEN_POI_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch (e) {
    console.warn('Failed to save hidden POIs', e);
  }
}

var POI_CATEGORY_PALETTE = [
  '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#eab308', '#64748b', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#d946ef', '#3b82f6',
  '#10b981', '#94a3b8',
];

function getCategoryColorsFromStorage() {
  try {
    var raw = localStorage.getItem(CATEGORY_COLORS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCategoryColorsToStorage(colors) {
  try {
    localStorage.setItem(CATEGORY_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch (err) {
    console.error('Failed to save category colors:', err);
  }
}

function pickPoiColorFromSettingsCategory(category, poiId) {
  var key = (category && String(category).trim().toLowerCase()) || '';
  if (!key) return null;
  var settings = typeof getMapSettings === 'function' ? getMapSettings() : {};
  var rules = (settings && settings.poiCategoryColors) || {};
  var shades = rules[key];
  if (!Array.isArray(shades) || shades.length === 0) return null;
  var valid = shades.filter(function (c) {
    return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.trim());
  }).map(function (c) { return c.trim().toLowerCase(); });
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  var hkey = (poiId != null && poiId !== '') ? (String(poiId) + '|' + key) : ('__cat__|' + key);
  var hash = 0;
  for (var i = 0; i < hkey.length; i++) hash = (hash * 31 + hkey.charCodeAt(i)) >>> 0;
  return valid[hash % valid.length];
}

function getCategoryConfig(category, poiId) {
  var label = (category && String(category).trim()) ? String(category).trim() : 'Other';
  var fromSettings = pickPoiColorFromSettingsCategory(label, poiId);
  if (fromSettings) return { label: label, color: fromSettings };
  var colors = getCategoryColorsFromStorage();
  if (colors[label]) return { label: label, color: colors[label] };
  var allCats = getAllCategoriesFromPois();
  var combined = {};
  allCats.forEach(function (c) { combined[c] = true; });
  Object.keys(colors).forEach(function (c) { combined[c] = true; });
  combined[label] = true;
  var ordered = Object.keys(combined).sort();
  var idx = ordered.indexOf(label);
  var color = POI_CATEGORY_PALETTE[idx % POI_CATEGORY_PALETTE.length];
  colors[label] = color;
  saveCategoryColorsToStorage(colors);
  return { label: label, color: color };
}

function getAllCategoriesFromPois() {
  var pois = getPoiFromStorage();
  var seen = {};
  pois.forEach(function (p) {
    var c = p.category && String(p.category).trim();
    if (!c) c = 'Other';
    seen[c] = true;
  });
  return Object.keys(seen).sort();
}

function refreshPoiCategoryDropdown() {
  var sel = document.getElementById('poi-category');
  if (!sel) return;
  var categories = getAllCategoriesFromPois();
  sel.innerHTML = '';
  if (categories.length === 0) {
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '(type
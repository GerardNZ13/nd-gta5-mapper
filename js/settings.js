/**
 * App settings (territory + POI category color palettes). localStorage + export/import + server.
 */
const MAP_SETTINGS_KEY = 'gta5-map-settings';

const DEFAULT_MAP_SETTINGS = {
  territoryCategoryColors: {
    defunct: ['#6b7280'],
    mc: ['#f97316', '#fb923c', '#ea580c', '#fdba74'],
    southside: ['#16a34a', '#22c55e', '#15803d', '#4ade80'],
  },
  poiCategoryColors: {},
};

function isValidHexColor(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

function normalizeTerritorySettingsKey(k) {
  return (k && String(k).trim().toLowerCase()) || '';
}

function sanitizeTerritoryCategoryColors(obj) {
  var out = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.keys(obj).forEach(function (k) {
    var nk = normalizeTerritorySettingsKey(k);
    if (!nk) return;
    var arr = obj[k];
    if (!Array.isArray(arr)) return;
    var colors = arr.map(function (c) { return String(c).trim().toLowerCase(); }).filter(isValidHexColor);
    if (colors.length) out[nk] = colors;
  });
  return out;
}

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_MAP_SETTINGS));
}

function getMapSettings() {
  try {
    var defaults = cloneDefaultSettings();
    var raw = localStorage.getItem(MAP_SETTINGS_KEY);
    if (!raw) {
      return {
        territoryCategoryColors: defaults.territoryCategoryColors,
        poiCategoryColors: {},
      };
    }
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {
        territoryCategoryColors: defaults.territoryCategoryColors,
        poiCategoryColors: {},
      };
    }
    var t = sanitizeTerritoryCategoryColors(parsed.territoryCategoryColors || {});
    var p = sanitizeTerritoryCategoryColors(parsed.poiCategoryColors || {});
    if (Object.keys(t).length === 0) {
      t = defaults.territoryCategoryColors;
    }
    return { territoryCategoryColors: t, poiCategoryColors: p };
  } catch {
    var d = cloneDefaultSettings();
    return { territoryCategoryColors: d.territoryCategoryColors, poiCategoryColors: {} };
  }
}

function persistMapSettings(settingsObj) {
  try {
    var t = sanitizeTerritoryCategoryColors(settingsObj.territoryCategoryColors || {});
    var p = sanitizeTerritoryCategoryColors(settingsObj.poiCategoryColors || {});
    localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify({
      territoryCategoryColors: t,
      poiCategoryColors: p,
    }));
  } catch (e) {
    console.warn('persistMapSettings', e);
  }
}

/**
 * Merge imported settings (territory + POI palette rules).
 */
function mergeMapSettingsFromImport(incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  var hasT = incoming.territoryCategoryColors && typeof incoming.territoryCategoryColors === 'object';
  var hasP = incoming.poiCategoryColors && typeof incoming.poiCategoryColors === 'object';
  if (!hasT && !hasP) return;
  var cur = getMapSettings();
  if (hasT) {
    var incT = sanitizeTerritoryCategoryColors(incoming.territoryCategoryColors);
    Object.keys(incT).forEach(function (k) {
      cur.territoryCategoryColors[k] = incT[k].slice();
    });
  }
  if (hasP) {
    var incP = sanitizeTerritoryCategoryColors(incoming.poiCategoryColors);
    Object.keys(incP).forEach(function (k) {
      cur.poiCategoryColors[k] = incP[k].slice();
    });
  }
  persistMapSettings(cur);
}

function addSettingsColorRow(wrap, hex) {
  var line = document.createElement('div');
  line.className = 'settings-color-line';
  var inp = document.createElement('input');
  inp.type = 'color';
  inp.className = 'settings-rule-color';
  inp.value = isValidHexColor(hex) ? hex : '#6b7280';
  var rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'btn btn-outline settings-rule-remove-color';
  rm.setAttribute('aria-label', 'Remove shade');
  rm.textContent = '\u00d7';
  line.appendChild(inp);
  line.appendChild(rm);
  wrap.appendChild(line);
}

function addSettingsRuleRow(container, categoryKey, colors) {
  var row = document.createElement('div');
  row.className = 'settings-rule-row';
  var lab = document.createElement('label');
      lab.className = 'settings-rule-cat-label';
  lab.textContent = 'Category ';
  var catIn = document.createElement('input');
  catIn.type = 'text';
  catIn.className = 'settings-rule-cat';
  catIn.placeholder = 'e.g. landmark, stores';
  catIn.value = categoryKey || '';
  lab.appendChild(catIn);
  var colorsWrap = document.createElement('div');
  colorsWrap.className = 'settings-rule-colors';
  var arr = Array.isArray(colors) && colors.length ? colors : ['#6b7280'];
  arr.forEach(function (c) { addSettingsColorRow(colorsWrap, c); });
  var addShade = document.createElement('button');
  addShade.type = 'button';
  addShade.className = 'btn btn-outline settings-rule-add-color';
  addShade.textContent = '+ shade';
  var rmCat = document.createElement('button');
  rmCat.type = 'button';
  rmCat.className = 'btn btn-outline btn-danger settings-rule-remove-cat';
  rmCat.textContent = 'Remove category';
  row.appendChild(lab);
  row.appendChild(colorsWrap);
  row.appendChild(addShade);
  row.appendChild(rmCat);
  container.appendChild(row);
}

function collectRulesFromContainer(containerSelector) {
  var out = {};
  var root = document.querySelector(containerSelector);
  if (!root) return out;
  root.querySelectorAll('.settings-rule-row').forEach(function (row) {
    var catIn = row.querySelector('.settings-rule-cat');
    var cat = catIn && normalizeTerritorySettingsKey(catIn.value);
    if (!cat) return;
    var colors = [];
    row.querySelectorAll('.settings-rule-color').forEach(function (inp) {
      var v = inp.value && inp.value.trim();
      if (isValidHexColor(v)) colors.push(v.toLowerCase());
    });
    if (colors.length) out[cat] = colors;
  });
  return out;
}

function renderSettingsTerritoryRulesEditor() {
  var container = document.getElementById('settings-territory-rules');
  if (!container) return;
  container.innerHTML = '';
  var rules = getMapSettings().territoryCategoryColors || {};
  var keys = Object.keys(rules).sort();
  if (keys.length === 0) {
    addSettingsRuleRow(container, '', ['#6b7280']);
  } else {
    keys.forEach(function (k) {
      addSettingsRuleRow(container, k, rules[k]);
    });
  }
}

function renderSettingsPoiRulesEditor() {
  var container = document.getElementById('settings-poi-rules');
  if (!container) return;
  container.innerHTML = '';
  var rules = getMapSettings().poiCategoryColors || {};
  var keys = Object.keys(rules).sort();
  if (keys.length === 0) {
    addSettingsRuleRow(container, '', ['#22c55e']);
  } else {
    keys.forEach(function (k) {
      addSettingsRuleRow(container, k, rules[k]);
    });
  }
}

function renderAllSettingsEditors() {
  renderSettingsTerritoryRulesEditor();
  renderSettingsPoiRulesEditor();
}

function initSettingsPanel() {
  var root = document.getElementById('settings-editor-root');
  var btnAddTerr = document.getElementById('btn-settings-add-territory-category');
  var btnAddPoi = document.getElementById('btn-settings-add-poi-category');
  var btnSave = document.getElementById('btn-settings-save');
  var btnReset = document.getElementById('btn-settings-reset');
  if (!root || !btnAddTerr || !btnAddPoi || !btnSave || !btnReset) return;
  if (root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';
  renderAllSettingsEditors();

  btnAddTerr.addEventListener('click', function () {
    var c = document.getElementById('settings-territory-rules');
    if (c) addSettingsRuleRow(c, '', ['#6b7280']);
  });
  btnAddPoi.addEventListener('click', function () {
    var c = document.getElementById('settings-poi-rules');
    if (c) addSettingsRuleRow(c, '', ['#22c55e']);
  });

  btnSave.addEventListener('click', function () {
    var terr = collectRulesFromContainer('#settings-territory-rules');
    var poi = collectRulesFromContainer('#settings-poi-rules');
    if (Object.keys(terr).length === 0 && Object.keys(poi).length === 0) {
      if (!confirm('No valid rows in either section. Clear all custom map settings (territory + POI rules)?')) return;
      try {
        localStorage.removeItem(MAP_SETTINGS_KEY);
      } catch (e) {
        console.warn(e);
      }
      renderAllSettingsEditors();
      if (typeof refreshAllPoiMarkerIcons === 'function') refreshAllPoiMarkerIcons();
      if (typeof renderPoiList === 'function') renderPoiList();
      alert('Using built-in defaults for territory colors; POI palettes unchanged until you add rules.');
      return;
    }
    var def = cloneDefaultSettings();
    var cur = getMapSettings();
    if (Object.keys(terr).length > 0) {
      cur.territoryCategoryColors = terr;
    } else {
      cur.territoryCategoryColors = def.territoryCategoryColors;
    }
    cur.poiCategoryColors = poi;
    persistMapSettings(cur);
    renderAllSettingsEditors();
    if (typeof refreshAllPoiMarkerIcons === 'function') refreshAllPoiMarkerIcons();
    if (typeof renderPoiList === 'function') renderPoiList();
    alert('Settings saved. Included in Export / Import and server sync.');
  });

  btnReset.addEventListener('click', function () {
    if (!confirm('Reset territory rules to built-in defaults and clear all POI category palette rules?')) return;
    try {
      localStorage.removeItem(MAP_SETTINGS_KEY);
    } catch (e) {
      console.warn(e);
    }
    renderAllSettingsEditors();
    if (typeof refreshAllPoiMarkerIcons === 'function') refreshAllPoiMarkerIcons();
    if (typeof renderPoiList === 'function') renderPoiList();
  });

  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList.contains('settings-rule-remove-cat')) {
      var row = t.closest('.settings-rule-row');
      if (row) row.remove();
      return;
    }
    if (t.classList.contains('settings-rule-add-color')) {
      var row = t.closest('.settings-rule-row');
      if (row) {
        var wrap = row.querySelector('.settings-rule-colors');
        if (wrap) addSettingsColorRow(wrap, '#6b7280');
      }
      return;
    }
    if (t.classList.contains('settings-rule-remove-color')) {
      var line = t.closest('.settings-color-line');
      var wrap = t.closest('.settings-rule-colors');
      if (line && wrap && wrap.querySelectorAll('.settings-color-line').length > 1) line.remove();
    }
  });
}

/**
 * Points of interest: markers with category, name, notes.
 */
let poiLayerGroup;
let isAddingPoi = false;
let pendingPoiLatLng = null;
let editingPoiId = null;

function keyPoi() {
  return typeof profileScopedKey === 'function' ? profileScopedKey('gta5-map-poi') : 'gta5-map-poi';
}
function keyPoiCategoryColors() {
  return typeof profileScopedKey === 'function' ? profileScopedKey('gta5-map-poi-category-colors') : 'gta5-map-poi-category-colors';
}
function keyHiddenPoi() {
  return typeof profileScopedKey === 'function' ? profileScopedKey('gta5-map-hidden-poi') : 'gta5-map-hidden-poi';
}
function keyPoiCategoryUiCollapsed() {
  return typeof profileScopedKey === 'function' ? profileScopedKey('gta5-map-ui-poi-category-collapsed') : 'gta5-map-ui-poi-category-collapsed';
}

function getPoiCategoryUiCollapsed() {
  try {
    var raw = localStorage.getItem(keyPoiCategoryUiCollapsed());
    if (!raw) return {};
    var o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function savePoiCategoryUiCollapsed(obj) {
  try {
    localStorage.setItem(keyPoiCategoryUiCollapsed(), JSON.stringify(obj && typeof obj === 'object' ? obj : {}));
  } catch (e) {
    console.warn('poi category ui collapsed save', e);
  }
}

function getHiddenPoiIds() {
  try {
    var raw = localStorage.getItem(keyHiddenPoi());
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHiddenPoiIds(ids) {
  try {
    localStorage.setItem(keyHiddenPoi(), JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch (e) {
    console.warn('Failed to save hidden POIs', e);
  }
}

/** Palette of 18 colors for category pins – auto-assigned when a category is first used. */
var POI_CATEGORY_PALETTE = [
  '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#eab308', '#64748b', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#d946ef', '#3b82f6',
  '#10b981', '#94a3b8',
];

var CUSTOM_CATEGORY_COLOR = '#94a3b8';

function getCategoryColorsFromStorage() {
  try {
    var raw = localStorage.getItem(keyPoiCategoryColors());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCategoryColorsToStorage(colors) {
  try {
    localStorage.setItem(keyPoiCategoryColors(), JSON.stringify(colors));
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
  if (fromSettings) {
    return { label: label, color: fromSettings };
  }
  var colors = getCategoryColorsFromStorage();
  if (colors[label]) {
    return { label: label, color: colors[label] };
  }
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
    empty.textContent = '(type category below)';
    sel.appendChild(empty);
  } else {
    categories.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }
}

function getPoiFromStorage() {
  try {
    const raw = localStorage.getItem(keyPoi());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePoiToStorage(pois) {
  try {
    var json = JSON.stringify(pois);
    localStorage.setItem(keyPoi(), json);
  } catch (err) {
    console.error('Failed to save POIs to localStorage:', err);
    if (err && err.name === 'QuotaExceededError') {
      alert('Storage full: could not save. Try removing some POIs or clear site data for this origin.');
    }
  }
}

function createPoiIcon(category, poiId) {
  const cfg = getCategoryConfig(category, poiId);
  return L.divIcon({
    className: 'poi-marker',
    html: `<span style="background:${cfg.color};border:2px solid #fff;border-radius:50%;width:14px;height:14px;display:block;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function escapeHtmlPoi(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function createPoiMarker(poi) {
  const [lat, lng] = poi.position;
  const marker = L.marker([lat, lng], { icon: createPoiIcon(poi.category, poi.id) });
  const catLabel = getCategoryConfig(poi.category, poi.id).label;
  var name = escapeHtmlPoi(poi.name || 'POI');
  var notes = poi.notes ? escapeHtmlPoi(poi.notes) : '';
  var imageUrl = (poi.imageUrl && String(poi.imageUrl).trim()) || '';
  var imageBlock = '';
  if (imageUrl) {
    var safeUrl = escapeHtmlPoi(imageUrl);
    imageBlock = '<div class="poi-popup-image"><a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="poi-image-link">View screenshot</a>' +
      '<img src="' + safeUrl + '" alt="POI screenshot" class="poi-popup-thumb" loading="lazy" onerror="this.style.display=\'none\'" /></div>';
  }
  var popupContent = '<div class="map-feature-popup" data-type="poi" data-id="' + escapeHtmlPoi(poi.id || '') + '">' +
    '<strong>' + name + '</strong><br/><span class="popup-meta">' + escapeHtmlPoi(catLabel) + '</span>' +
    (notes ? '<br/><br/>' + notes : '') +
    (imageBlock ? '<br/>' + imageBlock : '') +
    '<div class="popup-actions"><button type="button" class="btn-popup btn-popup-edit" data-action="edit">Edit</button> ' +
    '<button type="button" class="btn-popup btn-popup-delete" data-action="delete">Delete</button> ' +
    '<button type="button" class="btn-popup btn-popup-cancel" data-action="cancel">Cancel</button></div></div>';
  marker.bindPopup(popupContent);
  marker.on('click', function () {
    var m = typeof getMap === 'function' ? getMap() : null;
    if (m) m.panTo(marker.getLatLng());
  });
  marker.poiData = poi;
  return marker;
}

function createPoiParentGroup(map) {
  var el = document.getElementById('layer-poi-cluster');
  var useCluster = el && el.checked && typeof L.markerClusterGroup === 'function';
  if (useCluster) {
    return L.markerClusterGroup({
      maxClusterRadius: 55,
      disableClusteringAtZoom: 1,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
  }
  return L.layerGroup();
}

function loadAllPoisIntoCurrentGroup() {
  if (!poiLayerGroup) return;
  if (poiLayerGroup.clearLayers) poiLayerGroup.clearLayers();
  const pois = getPoiFromStorage();
  const hiddenIds = getHiddenPoiIds();
  pois.forEach((poi) => {
    try {
      const marker = createPoiMarker(poi);
      poiLayerGroup.addLayer(marker);
      const hidden = poi.id && hiddenIds.indexOf(poi.id) !== -1;
      marker.setOpacity(hidden ? 0 : 1);
    } catch (e) {
      console.warn('Skip invalid POI', poi, e);
    }
  });
}

function initPoiLayer(map) {
  poiLayerGroup = createPoiParentGroup(map);
  map.addLayer(poiLayerGroup);
  loadAllPoisIntoCurrentGroup();
  return poiLayerGroup;
}

function rebuildPoiLayer(map) {
  var m = map || (typeof getMap === 'function' ? getMap() : null);
  if (!m) return;
  if (poiLayerGroup) {
    try {
      m.removeLayer(poiLayerGroup);
    } catch (e) {}
  }
  poiLayerGroup = null;
  initPoiLayer(m);
  if (typeof rebuildHeatmapLayer === 'function') rebuildHeatmapLayer();
}

function refreshAllPoiMarkerOpacities() {
  if (!poiLayerGroup) return;
  var hiddenIds = getHiddenPoiIds();
  poiLayerGroup.eachLayer(function (layer) {
    if (layer.poiData && layer.poiData.id) {
      layer.setOpacity(hiddenIds.indexOf(layer.poiData.id) !== -1 ? 0 : 1);
    }
  });
}

function refreshAllPoiMarkerIcons() {
  if (!poiLayerGroup) return;
  var hiddenIds = getHiddenPoiIds();
  poiLayerGroup.eachLayer(function (layer) {
    var d = layer.poiData;
    if (!d || !layer.setIcon) return;
    layer.setIcon(createPoiIcon(d.category, d.id));
    layer.setOpacity(hiddenIds.indexOf(d.id) !== -1 ? 0 : 1);
  });
}

function setPoiItemVisibility(id, visible) {
  if (!poiLayerGroup || !id) return;
  var hiddenIds = getHiddenPoiIds();
  var idx = hiddenIds.indexOf(id);
  if (visible) {
    if (idx !== -1) {
      hiddenIds = hiddenIds.filter(function (x) { return x !== id; });
      saveHiddenPoiIds(hiddenIds);
    }
  } else {
    if (idx === -1) {
      hiddenIds = hiddenIds.concat(id);
      saveHiddenPoiIds(hiddenIds);
    }
  }
  refreshAllPoiMarkerOpacities();
  if (typeof renderPoiList === 'function') renderPoiList();
}

function togglePoiCategoryMapHidden(catKey) {
  var pois = getPoiFromStorage().filter(function (p) {
    var c = p.category && String(p.category).trim() ? p.category : 'Other';
    return c === catKey;
  });
  if (!pois.length) return;
  var hiddenIds = getHiddenPoiIds();
  var allHidden = pois.every(function (p) { return p.id && hiddenIds.indexOf(p.id) !== -1; });
  var next = hiddenIds.slice();
  pois.forEach(function (p) {
    if (!p.id) return;
    var i = next.indexOf(p.id);
    if (allHidden) {
      if (i !== -1) next.splice(i, 1);
    } else {
      if (i === -1) next.push(p.id);
    }
  });
  saveHiddenPoiIds(next);
  refreshAllPoiMarkerOpacities();
  if (typeof renderPoiList === 'function') renderPoiList();
}

function toggleAllPoisMapHidden() {
  var pois = getPoiFromStorage();
  var ids = pois.map(function (p) { return p.id; }).filter(Boolean);
  if (!ids.length) return;
  var hidden = getHiddenPoiIds();
  var allHidden = ids.every(function (id) { return hidden.indexOf(id) !== -1; });
  if (allHidden) saveHiddenPoiIds([]);
  else saveHiddenPoiIds(ids.slice());
  refreshAllPoiMarkerOpacities();
  if (typeof renderPoiList === 'function') renderPoiList();
}

function updatePoiSectionHeaderButtons() {
  var btn = document.getElementById('btn-hide-all-pois');
  if (!btn) return;
  var pois = getPoiFromStorage();
  if (pois.length === 0) {
    btn.disabled = true;
    btn.textContent = '\u25cf';
    btn.title = 'Hide all POIs on map';
    return;
  }
  btn.disabled = false;
  var hiddenIds = getHiddenPoiIds();
  var ids = pois.map(function (p) { return p.id; }).filter(Boolean);
  var allHidden = ids.length > 0 && ids.every(function (id) { return hiddenIds.indexOf(id) !== -1; });
  btn.textContent = allHidden ? '\u25cb' : '\u25cf';
  btn.title = allHidden ? 'Show all POIs on map' : 'Hide all POIs on map';
}

function startAddingPoi(map) {
  if (isAddingPoi) return;
  isAddingPoi = true;
  pendingPoiLatLng = null;
  editingPoiId = null;

  // 1. Change cursor to indicate the map is waiting for a click
  map.getContainer().style.cursor = 'crosshair';

  // NOTE: We DO NOT open the workbench here anymore. We wait.

  const handler = (e) => {
    // 2. The user clicked the map! Capture location and clean up the listener.
    map.off('click', handler);
    map.getContainer().style.cursor = ''; 
    pendingPoiLatLng = e.latlng;

    // 3. Drop a temporary visual marker so they see where they clicked
    if (window.tempPoiMarker) map.removeLayer(window.tempPoiMarker);
    window.tempPoiMarker = L.marker(e.latlng, { opacity: 0.6 }).addTo(map);

    // 4. NOW open the form to start entering details
    document.getElementById('poi-form-title').textContent = 'New point of interest';
    document.getElementById('poi-delete').style.display = 'none';
    
    if (typeof openWorkbench === 'function') openWorkbench('poi');
    refreshPoiCategoryDropdown();
    
    // 5. Reset the form fields
    document.getElementById('poi-name').value = '';
    document.getElementById('poi-notes').value = '';
    var imgUrl = document.getElementById('poi-image-url');
    if (imgUrl) imgUrl.value = '';
    
    var sel = document.getElementById('poi-category');
    if (sel.options.length > 0) sel.value = sel.options[0].value; else sel.value = '';
    var customCat = document.getElementById('poi-category-custom');
    if (customCat) customCat.value = '';
    if (window._prefillPoiCategory) {
      if (customCat) customCat.value = window._prefillPoiCategory;
      window._prefillPoiCategory = '';
    }

    // 6. Focus the name field (slight delay ensures the UI has time to render)
    setTimeout(() => {
        const nameInput = document.getElementById('poi-name');
        if (nameInput) nameInput.focus();
    }, 50);
  };

  // Start listening for the click
  map.once('click', handler);

  // Global cancel fallback
  window._poiCancel = () => {
    map.off('click', handler);
    map.getContainer().style.cursor = '';
    if (window.tempPoiMarker) {
      map.removeLayer(window.tempPoiMarker);
      window.tempPoiMarker = null;
    }
    isAddingPoi = false;
    pendingPoiLatLng = null;
    if (typeof closeWorkbench === 'function') closeWorkbench();
  };
}

function getPoiById(id) {
  return getPoiFromStorage().find((p) => p.id === id) || null;
}

function duplicatePoi(id) {
  var poi = getPoiById(id);
  if (!poi || !poi.position || !Array.isArray(poi.position)) return;
  var copy = JSON.parse(JSON.stringify(poi));
  copy.id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  copy.name = (poi.name || 'POI') + ' (copy)';
  copy.position = [
    poi.position[0] + (Math.random() - 0.5) * 0.002,
    poi.position[1] + (Math.random() - 0.5) * 0.002,
  ];
  var pois = getPoiFromStorage();
  pois.push(copy);
  savePoiToStorage(pois);
  if (poiLayerGroup) poiLayerGroup.addLayer(createPoiMarker(copy));
  if (typeof renderPoiList === 'function') renderPoiList();
  if (typeof rebuildHeatmapLayer === 'function') rebuildHeatmapLayer();
}

function openPoiFormForEdit(id, mapInstance) {
  const poi = getPoiById(id);
  if (!poi) return;
  editingPoiId = id;
  pendingPoiLatLng = null;
  document.getElementById('poi-name').value = poi.name || '';
  document.getElementById('poi-notes').value = poi.notes || '';
  var imgUrlEl = document.getElementById('poi-image-url');
  if (imgUrlEl) imgUrlEl.value = (poi.imageUrl && String(poi.imageUrl).trim()) ? poi.imageUrl : '';
  refreshPoiCategoryDropdown();
  var customCatEl = document.getElementById('poi-category-custom');
  var sel = document.getElementById('poi-category');
  var cat = poi.category && String(poi.category).trim() ? poi.category : 'Other';
  var hasOption = sel && Array.prototype.find.call(sel.options, function (o) { return o.value === cat; });
  if (hasOption) {
    sel.value = cat;
    if (customCatEl) customCatEl.value = '';
  } else {
    if (sel.options.length > 0) sel.selectedIndex = 0;
    if (customCatEl) customCatEl.value = cat;
  }
  document.getElementById('poi-form-title').textContent = 'Edit point of interest';
  document.getElementById('poi-delete').style.display = 'inline-block';
  if (typeof openWorkbench === 'function') openWorkbench('poi');
  document.getElementById('poi-name').focus();
  if (mapInstance && poiLayerGroup) {
    poiLayerGroup.eachLayer((layer) => {
      if (layer.poiData && layer.poiData.id === id) {
        mapInstance.panTo(layer.getLatLng());
        mapInstance.setZoom(Math.max(mapInstance.getZoom(), 0));
      }
    });
  }
}

function getCategoryFromForm() {
  var custom = document.getElementById('poi-category-custom');
  var customVal = (custom && custom.value && typeof custom.value === 'string') ? custom.value.trim() : '';
  if (customVal) return customVal;
  var sel = document.getElementById('poi-category');
  var v = (sel && sel.value && typeof sel.value === 'string') ? sel.value.trim() : '';
  return v || 'Other';
}

function updatePoiFromForm() {
  if (!editingPoiId || !poiLayerGroup) return;
  var category = getCategoryFromForm();
  if (!category || typeof category !== 'string') category = 'Other';
  category = category.trim() || 'Other';

  const name = document.getElementById('poi-name').value.trim() || 'Unnamed';
  const notes = document.getElementById('poi-notes').value.trim();
  var imgUrlEl = document.getElementById('poi-image-url');
  const imageUrl = (imgUrlEl && imgUrlEl.value && String(imgUrlEl.value).trim()) ? imgUrlEl.value.trim() : '';
  const poi = getPoiById(editingPoiId);
  if (!poi) return;
  poi.name = name;
  poi.category = category;
  poi.notes = notes;
  poi.imageUrl = imageUrl;
  poiLayerGroup.eachLayer((layer) => {
    if (layer.poiData && layer.poiData.id === editingPoiId) {
      poiLayerGroup.removeLayer(layer);
    }
  });
  poiLayerGroup.addLayer(createPoiMarker(poi));
  const pois = getPoiFromStorage().map((p) => (p.id === editingPoiId ? poi : p));
  savePoiToStorage(pois);
  editingPoiId = null;
  if (typeof closeWorkbench === 'function') closeWorkbench();
  document.getElementById('poi-delete').style.display = 'none';
  document.getElementById('poi-form-title').textContent = 'New point of interest';
  if (typeof renderPoiList === 'function') renderPoiList();
  if (typeof rebuildHeatmapLayer === 'function') rebuildHeatmapLayer();
}

function deletePoi(id) {
  if (!confirm('Delete this point of interest?')) return;
  poiLayerGroup.eachLayer((layer) => {
    if (layer.poiData && layer.poiData.id === id) {
      poiLayerGroup.removeLayer(layer);
    }
  });
  const pois = getPoiFromStorage().filter((p) => p.id !== id);
  savePoiToStorage(pois);
  editingPoiId = null;
  if (typeof closeWorkbench === 'function') closeWorkbench();
  document.getElementById('poi-delete').style.display = 'none';
  document.getElementById('poi-form-title').textContent = 'New point of interest';
  if (typeof renderPoiList === 'function') renderPoiList();
  if (typeof rebuildHeatmapLayer === 'function') rebuildHeatmapLayer();
}

function renderPoiList() {
  const container = document.getElementById('poi-list-container');
  const empty = document.getElementById('poi-list-empty');
  if (!container) return;
  container.innerHTML = '';
  const allPois = getPoiFromStorage();
  var q = (typeof getMapSearchQuery === 'function' ? getMapSearchQuery() : '').trim();
  var pois = allPois;
  if (q) {
    pois = allPois.filter(function (p) {
      if (typeof poiMatchesSearch === 'function') return poiMatchesSearch(p, q);
      var ql = q.toLowerCase();
      var hay = [p.name, p.category, p.notes, p.imageUrl].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(ql) !== -1;
    });
  }
  if (empty) {
    empty.hidden = pois.length > 0;
    if (allPois.length === 0) {
      empty.textContent = 'None yet. Use Add POI to add.';
    } else if (pois.length === 0) {
      empty.textContent = 'No matching POIs.';
    } else {
      empty.textContent = 'None yet. Use Add POI to add.';
    }
  }
  if (pois.length === 0) {
    updatePoiSectionHeaderButtons();
    return;
  }
  var hiddenIds = getHiddenPoiIds();
  var byCategory = {};
  pois.forEach(function (p) {
    var cat = p.category && String(p.category).trim() ? p.category : 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });
  var categoryUiCollapsed = getPoiCategoryUiCollapsed();
  Object.keys(byCategory).sort().forEach(function (catKey) {
    var items = byCategory[catKey];
    var cfg = getCategoryConfig(catKey);
    var group = document.createElement('div');
    group.className = 'poi-category-group';
    if (categoryUiCollapsed[catKey]) group.classList.add('is-collapsed');

    var headerRow = document.createElement('div');
    headerRow.className = 'poi-category-header-row';

    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'section-collapse-btn poi-category-collapse';
    collapseBtn.setAttribute('aria-expanded', categoryUiCollapsed[catKey] ? 'false' : 'true');
    collapseBtn.innerHTML = categoryUiCollapsed[catKey] ? '&#9654;' : '&#9660;';
    collapseBtn.title = categoryUiCollapsed[catKey] ? 'Expand category list' : 'Collapse category list';
    collapseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var o = getPoiCategoryUiCollapsed();
      o[catKey] = !o[catKey];
      savePoiCategoryUiCollapsed(o);
      group.classList.toggle('is-collapsed', !!o[catKey]);
      collapseBtn.setAttribute('aria-expanded', o[catKey] ? 'false' : 'true');
      collapseBtn.innerHTML = o[catKey] ? '&#9654;' : '&#9660;';
      collapseBtn.title = o[catKey] ? 'Expand category list' : 'Collapse category list';
    });

    var catAllHidden = items.every(function (p) { return p.id && hiddenIds.indexOf(p.id) !== -1; });
    var mapToggleBtn = document.createElement('button');
    mapToggleBtn.type = 'button';
    mapToggleBtn.className = 'section-map-toggle-btn';
    mapToggleBtn.textContent = catAllHidden ? '\u25cb' : '\u25cf';
    mapToggleBtn.title = catAllHidden ? 'Show this category on map' : 'Hide this category on map';
    mapToggleBtn.setAttribute('aria-label', mapToggleBtn.title);
    mapToggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePoiCategoryMapHidden(catKey);
    });

    var heading = document.createElement('h3');
    heading.className = 'poi-category-heading';
    heading.textContent = cfg.label;
    heading.style.borderLeftColor = cfg.color;

    headerRow.appendChild(collapseBtn);
    headerRow.appendChild(mapToggleBtn);
    headerRow.appendChild(heading);

    var ul = document.createElement('ul');
    ul.className = 'item-list';
    items.forEach(function (p) {
      var name = p.name || 'Unnamed';
      var dotCfg = getCategoryConfig(p.category, p.id);
      var hidden = p.id && hiddenIds.indexOf(p.id) !== -1;
      var li = document.createElement('li');
      li.setAttribute('data-id', p.id);
      if (hidden) li.classList.add('item-hidden');
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'item-visibility-toggle';
      toggle.title = hidden ? 'Show on map' : 'Hide on map';
      toggle.setAttribute('aria-label', hidden ? 'Show on map' : 'Hide on map');
      toggle.textContent = hidden ? '\u25cb' : '\u25cf';
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        setPoiItemVisibility(p.id, hidden);
      });
      var dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'item-dup-poi';
      dupBtn.title = 'Duplicate POI';
      dupBtn.setAttribute('aria-label', 'Duplicate POI');
      dupBtn.textContent = '\u2398';
      dupBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (typeof duplicatePoi === 'function') duplicatePoi(p.id);
      });
      var dot = document.createElement('span');
      dot.className = 'item-dot';
      dot.style.background = dotCfg.color;
      var label = document.createElement('span');
      label.className = 'item-name';
      label.textContent = name;
      li.appendChild(toggle);
      li.appendChild(dupBtn);
      li.appendChild(dot);
      li.appendChild(label);
      ul.appendChild(li);
    });
    var itemsWrap = document.createElement('div');
    itemsWrap.className = 'poi-category-items';
    itemsWrap.appendChild(ul);
    group.appendChild(headerRow);
    group.appendChild(itemsWrap);
    container.appendChild(group);
  });
  updatePoiSectionHeaderButtons();
}


function cancelAddingPoi() {
  if (window._poiCancel) window._poiCancel();
}

function savePoiFromForm() {
  if (!pendingPoiLatLng || !poiLayerGroup) {
      alert("Click on the map to set a location first.");
      return;
  }
  
  var category = getCategoryFromForm();
  const name = document.getElementById('poi-name').value.trim() || 'Unnamed';
  const notes = document.getElementById('poi-notes').value.trim();
  var imgUrlEl = document.getElementById('poi-image-url');
  const imageUrl = (imgUrlEl && imgUrlEl.value && String(imgUrlEl.value).trim()) ? imgUrlEl.value.trim() : '';

  const poi = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: name,
    category: category,
    notes: notes,
    position: [pendingPoiLatLng.lat, pendingPoiLatLng.lng],
  };
  if (imageUrl) poi.imageUrl = imageUrl;

  poiLayerGroup.addLayer(createPoiMarker(poi));
  const pois = getPoiFromStorage();
  pois.push(poi);
  
  // 1. We call your perfectly fine storage function here
  savePoiToStorage(pois);

  // 2. We clean up the map marker right AFTER saving
  if (window.tempPoiMarker) {
      const m = typeof getMap === 'function' ? getMap() : null;
      if (m) m.removeLayer(window.tempPoiMarker);
      window.tempPoiMarker = null;
  }
  
  // 3. Reset the form state
  pendingPoiLatLng = null;
  isAddingPoi = false;
  if (window._poiCancel) window._poiCancel();
  if (typeof renderPoiList === 'function') renderPoiList();
  if (typeof rebuildHeatmapLayer === 'function') rebuildHeatmapLayer();
}

function closePoiPopup(id) {
  if (!poiLayerGroup) return;
  poiLayerGroup.eachLayer(function (layer) {
    if (layer.poiData && layer.poiData.id === id && layer.closePopup) {
      layer.closePopup();
    }
  });
}

function setPoiVisibility(visible, mapInstance) {
  const m = mapInstance || (typeof getMap === 'function' ? getMap() : null);
  if (!m || !poiLayerGroup) return;
  if (visible) m.addLayer(poiLayerGroup);
  else m.removeLayer(poiLayerGroup);
}

function deleteCurrentPoi() {
  if (editingPoiId) deletePoi(editingPoiId);
}

function handlePoiSave() {
  if (editingPoiId) {
    updatePoiFromForm();
  } else {
    savePoiFromForm();
  }
}

window.rebuildPoiLayer = rebuildPoiLayer;
window.duplicatePoi = duplicatePoi;

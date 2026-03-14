/**
 * Points of interest: markers with category, name, notes.
 */
let poiLayerGroup;
let isAddingPoi = false;
let pendingPoiLatLng = null;
let editingPoiId = null;

const POI_STORAGE_KEY = 'gta5-map-poi';
const CATEGORY_COLORS_STORAGE_KEY = 'gta5-map-poi-category-colors';
const HIDDEN_POI_KEY = 'gta5-map-hidden-poi';

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

/** Palette of 18 colors for category pins – auto-assigned when a category is first used. */
var POI_CATEGORY_PALETTE = [
  '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#0ea5e9', '#eab308', '#64748b', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#d946ef', '#3b82f6',
  '#10b981', '#94a3b8',
];

var CUSTOM_CATEGORY_COLOR = '#94a3b8';

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

function getCategoryConfig(category) {
  var label = (category && String(category).trim()) ? String(category).trim() : 'Other';
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
    const raw = localStorage.getItem(POI_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePoiToStorage(pois) {
  try {
    var json = JSON.stringify(pois);
    localStorage.setItem(POI_STORAGE_KEY, json);
  } catch (err) {
    console.error('Failed to save POIs to localStorage:', err);
    if (err && err.name === 'QuotaExceededError') {
      alert('Storage full: could not save. Try removing some POIs or clear site data for this origin.');
    }
  }
}

function createPoiIcon(category) {
  const cfg = getCategoryConfig(category);
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
  const marker = L.marker([lat, lng], { icon: createPoiIcon(poi.category) });
  const catLabel = getCategoryConfig(poi.category).label;
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

function initPoiLayer(map) {
  poiLayerGroup = new L.LayerGroup();
  map.addLayer(poiLayerGroup);

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

  return poiLayerGroup;
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
    poiLayerGroup.eachLayer(function (layer) {
      if (layer.poiData && layer.poiData.id === id) layer.setOpacity(1);
    });
  } else {
    if (idx === -1) {
      hiddenIds = hiddenIds.concat(id);
      saveHiddenPoiIds(hiddenIds);
    }
    poiLayerGroup.eachLayer(function (layer) {
      if (layer.poiData && layer.poiData.id === id) layer.setOpacity(0);
    });
  }
  if (typeof renderPoiList === 'function') renderPoiList();
}

function startAddingPoi(map) {
  if (isAddingPoi) return;
  isAddingPoi = true;
  pendingPoiLatLng = null;
  editingPoiId = null;
  document.getElementById('poi-form-title').textContent = 'New point of interest';
  document.getElementById('poi-delete').style.display = 'none';
  document.getElementById('panel-poi-form').hidden = false;
  refreshPoiCategoryDropdown();
  document.getElementById('poi-name').value = '';
  document.getElementById('poi-notes').value = '';
  var imgUrl = document.getElementById('poi-image-url');
  if (imgUrl) imgUrl.value = '';
  var sel = document.getElementById('poi-category');
  if (sel.options.length > 0) sel.value = sel.options[0].value; else sel.value = '';
  var customCat = document.getElementById('poi-category-custom');
  if (customCat) customCat.value = '';

  const handler = (e) => {
    map.off('click', handler);
    pendingPoiLatLng = e.latlng;
    document.getElementById('poi-name').focus();
  };
  map.once('click', handler);
  window._poiCancel = () => {
    map.off('click', handler);
    isAddingPoi = false;
    pendingPoiLatLng = null;
    document.getElementById('panel-poi-form').hidden = true;
  };
}

function getPoiById(id) {
  return getPoiFromStorage().find((p) => p.id === id) || null;
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
  document.getElementById('panel-poi-form').hidden = false;
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
  document.getElementById('panel-poi-form').hidden = true;
  document.getElementById('poi-delete').style.display = 'none';
  document.getElementById('poi-form-title').textContent = 'New point of interest';
  if (typeof renderPoiList === 'function') renderPoiList();
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
  document.getElementById('panel-poi-form').hidden = true;
  document.getElementById('poi-delete').style.display = 'none';
  document.getElementById('poi-form-title').textContent = 'New point of interest';
  if (typeof renderPoiList === 'function') renderPoiList();
}

function renderPoiList() {
  const container = document.getElementById('poi-list-container');
  const empty = document.getElementById('poi-list-empty');
  if (!container) return;
  container.innerHTML = '';
  const pois = getPoiFromStorage();
  if (empty) empty.hidden = pois.length > 0;
  if (pois.length === 0) return;
  var hiddenIds = getHiddenPoiIds();
  var byCategory = {};
  pois.forEach(function (p) {
    var cat = p.category && String(p.category).trim() ? p.category : 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });
  Object.keys(byCategory).sort().forEach(function (catKey) {
    var items = byCategory[catKey];
    var cfg = getCategoryConfig(catKey);
    var group = document.createElement('div');
    group.className = 'poi-category-group';
    var heading = document.createElement('h3');
    heading.className = 'poi-category-heading';
    heading.textContent = cfg.label;
    heading.style.borderLeftColor = cfg.color;
    var ul = document.createElement('ul');
    ul.className = 'item-list';
    items.forEach(function (p) {
      var name = p.name || 'Unnamed';
      var dotCfg = getCategoryConfig(p.category);
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
      var dot = document.createElement('span');
      dot.className = 'item-dot';
      dot.style.background = dotCfg.color;
      var label = document.createElement('span');
      label.className = 'item-name';
      label.textContent = name;
      li.appendChild(toggle);
      li.appendChild(dot);
      li.appendChild(label);
      ul.appendChild(li);
    });
    group.appendChild(heading);
    group.appendChild(ul);
    container.appendChild(group);
  });
}


function cancelAddingPoi() {
  if (window._poiCancel) window._poiCancel();
}

function savePoiFromForm() {
  if (!pendingPoiLatLng || !poiLayerGroup) return;
  var category = getCategoryFromForm();
  if (!category || typeof category !== 'string') category = 'Other';
  category = category.trim() || 'Other';

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
  savePoiToStorage(pois);

  pendingPoiLatLng = null;
  document.getElementById('panel-poi-form').hidden = true;
  isAddingPoi = false;
  if (window._poiCancel) window._poiCancel();
  if (typeof renderPoiList === 'function') renderPoiList();
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

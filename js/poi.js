/**
 * Points of interest: markers with category, name, notes.
 */
let poiLayerGroup;
let isAddingPoi = false;
let pendingPoiLatLng = null;
let editingPoiId = null;

const POI_STORAGE_KEY = 'gta5-map-poi';

const POI_CATEGORIES = {
  store: { label: 'Store', color: '#22c55e' },
  weapon: { label: 'Weapon / Ammu-Nation', color: '#ef4444' },
  clothing: { label: 'Clothing', color: '#8b5cf6' },
  mission: { label: 'Mission', color: '#f59e0b' },
  collectible: { label: 'Collectible', color: '#eab308' },
  spawn: { label: 'Spawn / Safehouse', color: '#0ea5e9' },
  landmark: { label: 'Landmark', color: '#64748b' },
  other: { label: 'Other', color: '#94a3b8' },
};

var CUSTOM_CATEGORY_COLOR = '#94a3b8';

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

function getCategoryConfig(category) {
  if (category && POI_CATEGORIES[category]) return POI_CATEGORIES[category];
  return { label: category && String(category).trim() ? String(category).trim() : 'Other', color: CUSTOM_CATEGORY_COLOR };
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
  localStorage.setItem(POI_STORAGE_KEY, JSON.stringify(pois));
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

function createPoiMarker(poi) {
  const [lat, lng] = poi.position;
  const marker = L.marker([lat, lng], { icon: createPoiIcon(poi.category) });
  const catLabel = getCategoryConfig(poi.category).label;
  let popup = `<strong>${poi.name || 'POI'}</strong><br/><span style="color:#8a8a94;font-size:0.85em">${catLabel}</span>`;
  if (poi.notes) popup += `<br/><br/>${poi.notes}`;
  marker.bindPopup(popup);
  marker.poiData = poi;
  return marker;
}

function initPoiLayer(map) {
  poiLayerGroup = new L.LayerGroup();
  map.addLayer(poiLayerGroup);

  const pois = getPoiFromStorage();
  pois.forEach((poi) => {
    try {
      poiLayerGroup.addLayer(createPoiMarker(poi));
    } catch (e) {
      console.warn('Skip invalid POI', poi, e);
    }
  });

  return poiLayerGroup;
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
  var customVal = custom && custom.value && custom.value.trim();
  if (customVal) return customVal.trim();
  var sel = document.getElementById('poi-category');
  var v = sel && sel.value && sel.value.trim();
  return v || 'Other';
}

function updatePoiFromForm() {
  if (!editingPoiId || !poiLayerGroup) return;
  const name = document.getElementById('poi-name').value.trim() || 'Unnamed';
  const category = getCategoryFromForm();
  const notes = document.getElementById('poi-notes').value.trim();
  const poi = getPoiById(editingPoiId);
  if (!poi) return;
  poi.name = name;
  poi.category = category;
  poi.notes = notes;
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
      var li = document.createElement('li');
      li.setAttribute('data-id', p.id);
      var dot = document.createElement('span');
      dot.className = 'item-dot';
      dot.style.background = dotCfg.color;
      var label = document.createElement('span');
      label.className = 'item-name';
      label.textContent = name;
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
  const name = document.getElementById('poi-name').value.trim() || 'Unnamed';
  const category = getCategoryFromForm();
  const notes = document.getElementById('poi-notes').value.trim();

  const poi = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name,
    category,
    notes,
    position: [pendingPoiLatLng.lat, pendingPoiLatLng.lng],
  };

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

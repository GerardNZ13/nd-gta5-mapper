/**
 * Territory layer: gang zones / regions as polygons.
 * Each territory has: name, gang/type, color, latlngs (polygon).
 */
let territoryLayerGroup;
let drawnItems;
let drawControl;
let isDrawingTerritory = false;
let pendingTerritoryLayer = null;
let editingTerritoryId = null;
let redrawTerritoryId = null;

const TERRITORY_STORAGE_KEY = 'gta5-map-territories';
const HIDDEN_TERRITORIES_KEY = 'gta5-map-hidden-territories';

function normalizeTerritoryCategory(category) {
  return (category && String(category).trim().toLowerCase()) || '';
}

function getTerritoryCategoryShades(category) {
  var key = normalizeTerritoryCategory(category);
  if (!key) return null;
  var settings = typeof getMapSettings === 'function' ? getMapSettings() : {};
  var rules = (settings && settings.territoryCategoryColors) || {};
  var shades = rules[key];
  if (!Array.isArray(shades) || shades.length === 0) return null;
  return shades.filter(function (c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.trim()); });
}

function pickTerritoryColorForCategory(category, territoryId) {
  if (!normalizeTerritoryCategory(category)) return null;
  var shades = getTerritoryCategoryShades(category);
  if (!shades || shades.length === 0) return null;
  if (shades.length === 1) return shades[0];
  var key = String(territoryId || '') + '|' + normalizeTerritoryCategory(category);
  var hash = 0;
  for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return shades[hash % shades.length];
}

function applyTerritoryCategoryColorToForm(territoryId) {
  var auto = document.getElementById('territory-auto-color');
  var categoryEl = document.getElementById('territory-category');
  var colorEl = document.getElementById('territory-color');
  if (!auto || !categoryEl || !colorEl || !auto.checked) return;
  if (!normalizeTerritoryCategory(categoryEl.value)) return;
  var picked = pickTerritoryColorForCategory(categoryEl.value, territoryId || editingTerritoryId || '');
  if (picked) colorEl.value = picked;
}

function initTerritoryCategoryUi() {
  var categoryEl = document.getElementById('territory-category');
  var auto = document.getElementById('territory-auto-color');
  var colorEl = document.getElementById('territory-color');
  if (!categoryEl || !auto || !colorEl || categoryEl.dataset.boundCategoryUi === '1') return;
  categoryEl.dataset.boundCategoryUi = '1';
  categoryEl.addEventListener('input', function () {
    applyTerritoryCategoryColorToForm();
  });
  auto.addEventListener('change', function () {
    if (auto.checked) applyTerritoryCategoryColorToForm();
  });
  colorEl.addEventListener('input', function () {
    auto.checked = false;
  });
  colorEl.addEventListener('change', function () {
    auto.checked = false;
  });
}

function getHiddenTerritoryIds() {
  try {
    const raw = localStorage.getItem(HIDDEN_TERRITORIES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHiddenTerritoryIds(ids) {
  try {
    localStorage.setItem(HIDDEN_TERRITORIES_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch (e) {
    console.warn('Failed to save hidden territories', e);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getTerritoriesFromStorage() {
  try {
    const raw = localStorage.getItem(TERRITORY_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    let changed = false;
    const out = list.map((f) => {
      if (!f.properties) f.properties = {};
      if (!f.properties.id) {
        f.properties.id = generateId();
        changed = true;
      }
      return f;
    });
    if (changed) saveTerritoriesToStorage(out);
    return out;
  } catch {
    return [];
  }
}

function saveTerritoriesToStorage(territories) {
  localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(territories));
}

function latLngsToGeo(latlngs) {
  return latlngs.map((ll) => [ll.lng, ll.lat]);
}

function geoToLatLngs(geo) {
  return geo.map(([lng, lat]) => [lat, lng]);
}

function escapeHtml(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function createTerritoryLayer(feature) {
  const props = feature.properties || {};
  const id = props.id || '';
  const color = props.color || '#8B5CF6';
  const layer = L.polygon(feature.geometry.coordinates.map(geoToLatLngs), {
    color,
    fillColor: color,
    fillOpacity: 0.35,
    weight: 2,
  });
  layer.feature = feature;
  var name = escapeHtml(props.name || 'Territory');
  var gang = props.gang ? escapeHtml(props.gang) : '';
  var category = props.category ? escapeHtml(props.category) : '';
  var popupContent = '<div class="map-feature-popup" data-type="territory" data-id="' + escapeHtml(id) + '">' +
    '<strong>' + name + '</strong>' +
    (category ? '<br/><span class="popup-meta">' + category + '</span>' : '') +
    (gang ? '<br/><span class="popup-meta">' + gang + '</span>' : '') +
    '<div class="popup-actions"><button type="button" class="btn-popup btn-popup-edit" data-action="edit">Edit</button> ' +
    '<button type="button" class="btn-popup btn-popup-delete" data-action="delete">Delete</button> ' +
    '<button type="button" class="btn-popup btn-popup-cancel" data-action="cancel">Cancel</button></div></div>';
  layer.bindPopup(popupContent);
  layer.on('click', function () {
    var m = typeof getMap === 'function' ? getMap() : null;
    if (m) m.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 1 });
  });
  return layer;
}

function initTerritoriesLayer(map) {
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  territoryLayerGroup = new L.FeatureGroup();
  map.addLayer(territoryLayerGroup);

  const territories = getTerritoriesFromStorage();
  const hiddenIds = getHiddenTerritoryIds();
  territories.forEach((feature) => {
    try {
      const layer = createTerritoryLayer(feature);
      territoryLayerGroup.addLayer(layer);
      const id = feature.properties && feature.properties.id;
      const hidden = id && hiddenIds.indexOf(id) !== -1;
      layer.setStyle(hidden ? { opacity: 0, fillOpacity: 0, weight: 0 } : {});
    } catch (e) {
      console.warn('Skip invalid territory', feature, e);
    }
  });

  return { territoryLayerGroup, drawnItems };
}

function setTerritoryVisibility(id, visible) {
  if (!territoryLayerGroup || !id) return;
  let hiddenIds = getHiddenTerritoryIds();
  const idx = hiddenIds.indexOf(id);
  if (visible) {
    if (idx !== -1) {
      hiddenIds = hiddenIds.filter(function (x) { return x !== id; });
      saveHiddenTerritoryIds(hiddenIds);
    }
    territoryLayerGroup.eachLayer(function (layer) {
      if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
        const c = (layer.feature.properties && layer.feature.properties.color) || '#8B5CF6';
        layer.setStyle({ color: c, fillColor: c, fillOpacity: 0.35, weight: 2, opacity: 1 });
      }
    });
  } else {
    if (idx === -1) {
      hiddenIds = hiddenIds.concat(id);
      saveHiddenTerritoryIds(hiddenIds);
    }
    territoryLayerGroup.eachLayer(function (layer) {
      if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
        layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
      }
    });
  }
  if (typeof renderTerritoryList === 'function') renderTerritoryList();
}

function refreshAllTerritoryLayerStyles() {
  if (!territoryLayerGroup) return;
  var hiddenIds = getHiddenTerritoryIds();
  territoryLayerGroup.eachLayer(function (layer) {
    if (!layer.feature || !layer.feature.properties) return;
    var id = layer.feature.properties.id;
    var hidden = id && hiddenIds.indexOf(id) !== -1;
    var c = (layer.feature.properties.color) || '#8B5CF6';
    if (hidden) layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
    else layer.setStyle({ color: c, fillColor: c, fillOpacity: 0.35, weight: 2, opacity: 1 });
  });
}

function toggleAllTerritoriesMapHidden() {
  var territories = getTerritoriesFromStorage();
  var ids = territories.map(function (f) { return f.properties && f.properties.id; }).filter(Boolean);
  if (!ids.length) return;
  var hidden = getHiddenTerritoryIds();
  var allHidden = ids.every(function (id) { return hidden.indexOf(id) !== -1; });
  if (allHidden) saveHiddenTerritoryIds([]);
  else saveHiddenTerritoryIds(ids.slice());
  refreshAllTerritoryLayerStyles();
  if (typeof renderTerritoryList === 'function') renderTerritoryList();
}

function updateTerritorySectionHeaderButtons() {
  var btn = document.getElementById('btn-hide-all-territories');
  if (!btn) return;
  var territories = getTerritoriesFromStorage();
  if (territories.length === 0) {
    btn.disabled = true;
    btn.textContent = '\u25cf';
    btn.title = 'Hide all territories on map';
    return;
  }
  btn.disabled = false;
  var hiddenIds = getHiddenTerritoryIds();
  var allHidden = territories.every(function (f) {
    var id = f.properties && f.properties.id;
    return id && hiddenIds.indexOf(id) !== -1;
  });
  btn.textContent = allHidden ? '\u25cb' : '\u25cf';
  btn.title = allHidden ? 'Show all territories on map' : 'Hide all territories on map';
}

function startDrawingTerritory(map) {
  startDrawingTerritoryManual(map);
}

function cancelDrawingTerritory() {
  if (window._territoryCancel) window._territoryCancel();
  isDrawingTerritory = false;
  drawnItems.clearLayers();
  pendingTerritoryLayer = null;
  editingTerritoryId = null;
  redrawTerritoryId = null;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-redraw').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
  document.getElementById('territory-category').value = '';
  document.getElementById('territory-auto-color').checked = true;
  if (typeof closeWorkbench === 'function') closeWorkbench();
}

function getTerritoryById(id) {
  return getTerritoriesFromStorage().find((f) => (f.properties && f.properties.id) === id) || null;
}

function openTerritoryFormForEdit(id, mapInstance) {
  const feature = getTerritoryById(id);
  if (!feature) return;
  const props = feature.properties || {};
  editingTerritoryId = id;
  pendingTerritoryLayer = null;
  document.getElementById('territory-name').value = props.name || '';
  document.getElementById('territory-category').value = props.category || '';
  document.getElementById('territory-gang').value = props.gang || '';
  document.getElementById('territory-color').value = props.color || '#8B5CF6';
  document.getElementById('territory-auto-color').checked = false;
  document.getElementById('territory-form-title').textContent = 'Edit territory';
  document.getElementById('territory-delete').style.display = 'inline-block';
  document.getElementById('territory-redraw').style.display = 'inline-block';
  if (typeof openWorkbench === 'function') openWorkbench('territory');
  document.getElementById('territory-name').focus();
  if (mapInstance && territoryLayerGroup) {
    territoryLayerGroup.eachLayer((layer) => {
      if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
        mapInstance.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 1 });
      }
    });
  }
}

function updateTerritoryFromForm() {
  if (!editingTerritoryId || !territoryLayerGroup) return;
  const name = document.getElementById('territory-name').value.trim() || 'Unnamed';
  const category = document.getElementById('territory-category').value.trim() || '';
  const gang = document.getElementById('territory-gang').value.trim() || '';
  var autoCol = document.getElementById('territory-auto-color').checked;
  var pickedColor = (category && autoCol) ? pickTerritoryColorForCategory(category, editingTerritoryId) : null;
  const color = pickedColor || document.getElementById('territory-color').value;
  const feature = getTerritoryById(editingTerritoryId);
  if (!feature) return;
  if (pendingTerritoryLayer && pendingTerritoryLayer.latlngs && pendingTerritoryLayer.latlngs.length >= 3) {
    feature.geometry.coordinates = [latLngsToGeo(pendingTerritoryLayer.latlngs)];
  }
  feature.properties.name = name;
  feature.properties.category = category;
  feature.properties.gang = gang;
  feature.properties.color = color;
  territoryLayerGroup.eachLayer((layer) => {
    if (layer.feature && layer.feature.properties && layer.feature.properties.id === editingTerritoryId) {
      territoryLayerGroup.removeLayer(layer);
    }
  });
  const newLayer = createTerritoryLayer(feature);
  territoryLayerGroup.addLayer(newLayer);
  const hiddenIds = getHiddenTerritoryIds();
  setTerritoryVisibility(editingTerritoryId, hiddenIds.indexOf(editingTerritoryId) === -1);
  const territories = getTerritoriesFromStorage().map((f) =>
    (f.properties && f.properties.id) === editingTerritoryId ? feature : f
  );
  saveTerritoriesToStorage(territories);
  pendingTerritoryLayer = null;
  editingTerritoryId = null;
  redrawTerritoryId = null;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-redraw').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
  document.getElementById('territory-category').value = '';
  document.getElementById('territory-auto-color').checked = true;
  if (typeof closeWorkbench === 'function') closeWorkbench();
}

function deleteTerritory(id) {
  if (!confirm('Delete this territory?')) return;
  territoryLayerGroup.eachLayer((layer) => {
    if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
      territoryLayerGroup.removeLayer(layer);
    }
  });
  const territories = getTerritoriesFromStorage().filter((f) => (f.properties && f.properties.id) !== id);
  saveTerritoriesToStorage(territories);
  pendingTerritoryLayer = null;
  editingTerritoryId = null;
  redrawTerritoryId = null;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-redraw').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
  document.getElementById('territory-category').value = '';
  document.getElementById('territory-auto-color').checked = true;
  if (typeof closeWorkbench === 'function') closeWorkbench();
  if (typeof renderTerritoryList === 'function') renderTerritoryList();
}

function deleteCurrentTerritory() {
  if (editingTerritoryId) deleteTerritory(editingTerritoryId);
}

function handleTerritorySave() {
  if (editingTerritoryId) {
    updateTerritoryFromForm();
  } else {
    saveTerritoryFromForm();
  }
}

function renderTerritoryList() {
  const list = document.getElementById('territory-list');
  const empty = document.getElementById('territory-list-empty');
  if (!list) return;
  list.innerHTML = '';
  const territories = getTerritoriesFromStorage();
  const hiddenIds = getHiddenTerritoryIds();
  if (empty) empty.hidden = territories.length > 0;
  territories.forEach((f) => {
    const id = f.properties && f.properties.id;
    const name = (f.properties && f.properties.name) || 'Unnamed';
    const category = (f.properties && f.properties.category) || '';
    const color = (f.properties && f.properties.color) || '#8B5CF6';
    const hidden = id && hiddenIds.indexOf(id) !== -1;
    const li = document.createElement('li');
    li.setAttribute('data-id', id);
    if (hidden) li.classList.add('item-hidden');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'item-visibility-toggle';
    toggle.title = hidden ? 'Show on map' : 'Hide on map';
    toggle.setAttribute('aria-label', hidden ? 'Show on map' : 'Hide on map');
    toggle.textContent = hidden ? '\u25cb' : '\u25cf';
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setTerritoryVisibility(id, hidden);
    });
    const dot = document.createElement('span');
    dot.className = 'item-dot';
    dot.style.background = color;
    const label = document.createElement('span');
    label.className = 'item-name';
    label.textContent = category ? (name + ' [' + category + ']') : name;
    li.appendChild(toggle);
    li.appendChild(dot);
    li.appendChild(label);
    list.appendChild(li);
  });
  updateTerritorySectionHeaderButtons();
}

function saveTerritoryFromForm() {
  if (!pendingTerritoryLayer) return;
  const name = document.getElementById('territory-name').value.trim() || 'Unnamed';
  const category = document.getElementById('territory-category').value.trim() || '';
  const gang = document.getElementById('territory-gang').value.trim() || '';
  const tempId = generateId();
  var autoCol = document.getElementById('territory-auto-color').checked;
  var pickedColor = (category && autoCol) ? pickTerritoryColorForCategory(category, tempId) : null;
  const color = pickedColor || document.getElementById('territory-color').value;

  const coords = latLngsToGeo(pendingTerritoryLayer.latlngs);
  const feature = {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: { id: tempId, name, category, gang, color },
  };

  const layer = createTerritoryLayer(feature);
  territoryLayerGroup.addLayer(layer);

  const territories = getTerritoriesFromStorage();
  territories.push(feature);
  saveTerritoriesToStorage(territories);

  drawnItems.clearLayers();
  pendingTerritoryLayer = null;
  if (typeof closeWorkbench === 'function') closeWorkbench();
  document.getElementById('territory-name').value = '';
  document.getElementById('territory-category').value = '';
  document.getElementById('territory-gang').value = '';
  document.getElementById('territory-auto-color').checked = true;
  document.getElementById('territory-color').value = '#8B5CF6';
  document.getElementById('territory-redraw').style.display = 'none';
  isDrawingTerritory = false;
  if (typeof renderTerritoryList === 'function') renderTerritoryList();
}

function startRedrawingCurrentTerritory(mapInstance) {
  if (!editingTerritoryId) return;
  var map = mapInstance || (typeof getMap === 'function' ? getMap() : null);
  if (!map) return;
  redrawTerritoryId = editingTerritoryId;
  pendingTerritoryLayer = null;
  if (typeof closeWorkbench === 'function') closeWorkbench();
  startDrawingTerritoryManual(map);
}

function closeTerritoryPopup(id) {
  if (!territoryLayerGroup) return;
  territoryLayerGroup.eachLayer(function (layer) {
    if (layer.feature && layer.feature.properties && layer.feature.properties.id === id && layer.closePopup) {
      layer.closePopup();
    }
  });
}

function setTerritoriesVisibility(visible, mapInstance) {
  const m = mapInstance || (typeof getMap === 'function' ? getMap() : null);
  if (!m) return;
  if (territoryLayerGroup) {
    if (visible) m.addLayer(territoryLayerGroup);
    else m.removeLayer(territoryLayerGroup);
  }
  if (drawnItems) {
    if (visible) m.addLayer(drawnItems);
    else m.removeLayer(drawnItems);
  }
}

// Manual polygon drawing: click to add points, double-click to finish.
let polygonPoints = [];
let polygonTempLine = null;
let polygonMarkerLayer = null;

function startDrawingTerritoryManual(map) {
  if (isDrawingTerritory) return;
  isDrawingTerritory = true;
  polygonPoints = [];
  drawnItems.clearLayers();
  if (polygonMarkerLayer) {
    map.removeLayer(polygonMarkerLayer);
    polygonMarkerLayer = null;
  }
  if (polygonTempLine) {
    map.removeLayer(polygonTempLine);
    polygonTempLine = null;
  }

  polygonMarkerLayer = new L.LayerGroup();
  map.addLayer(polygonMarkerLayer);

  const onMapClick = (e) => {
    polygonPoints.push(e.latlng);
    L.marker(e.latlng, { icon: L.divIcon({ className: 'poly-dot', html: '', iconSize: [8, 8] }) })
      .addTo(polygonMarkerLayer);

    if (polygonTempLine) map.removeLayer(polygonTempLine);
    if (polygonPoints.length > 1) {
      polygonTempLine = L.polyline(polygonPoints, { color: '#f59e0b', weight: 2, dashArray: '5,5' })
        .addTo(map);
    }
  };

  const finishDrawing = () => {
    if (polygonPoints.length < 3) {
      alert('Draw at least 3 points to create a territory.');
      return;
    }
    map.off('click', onMapClick);
    map.off('dblclick', finishDrawing);
    if (polygonMarkerLayer) map.removeLayer(polygonMarkerLayer);
    if (polygonTempLine) map.removeLayer(polygonTempLine);
    pendingTerritoryLayer = { latlngs: [...polygonPoints] };
    if (redrawTerritoryId) {
      editingTerritoryId = redrawTerritoryId;
      document.getElementById('territory-form-title').textContent = 'Edit territory';
      document.getElementById('territory-delete').style.display = 'inline-block';
      document.getElementById('territory-redraw').style.display = 'inline-block';
      redrawTerritoryId = null;
    } else {
      editingTerritoryId = null;
      document.getElementById('territory-form-title').textContent = 'New territory';
      document.getElementById('territory-delete').style.display = 'none';
      document.getElementById('territory-redraw').style.display = 'none';
    }
    if (typeof openWorkbench === 'function') openWorkbench('territory');
    document.getElementById('territory-name').focus();
    polygonPoints = [];
    polygonMarkerLayer = null;
    polygonTempLine = null;
  };

  map.on('click', onMapClick);
  map.on('dblclick', finishDrawing);
  window._territoryCancel = () => {
    map.off('click', onMapClick);
    map.off('dblclick', finishDrawing);
    if (polygonMarkerLayer) map.removeLayer(polygonMarkerLayer);
    if (polygonTempLine) map.removeLayer(polygonTempLine);
    polygonPoints = [];
    polygonMarkerLayer = null;
    polygonTempLine = null;
    isDrawingTerritory = false;
    redrawTerritoryId = null;
  };
}


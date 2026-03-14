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

const TERRITORY_STORAGE_KEY = 'gta5-map-territories';
const HIDDEN_TERRITORIES_KEY = 'gta5-map-hidden-territories';

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
  var popupContent = '<div class="map-feature-popup" data-type="territory" data-id="' + escapeHtml(id) + '">' +
    '<strong>' + name + '</strong>' + (gang ? '<br/><span class="popup-meta">' + gang + '</span>' : '') +
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

function startDrawingTerritory(map) {
  startDrawingTerritoryManual(map);
}

function cancelDrawingTerritory() {
  if (window._territoryCancel) window._territoryCancel();
  isDrawingTerritory = false;
  drawnItems.clearLayers();
  pendingTerritoryLayer = null;
  editingTerritoryId = null;
  document.getElementById('panel-territory-form').hidden = true;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
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
  document.getElementById('territory-gang').value = props.gang || '';
  document.getElementById('territory-color').value = props.color || '#8B5CF6';
  document.getElementById('territory-form-title').textContent = 'Edit territory';
  document.getElementById('territory-delete').style.display = 'inline-block';
  document.getElementById('panel-territory-form').hidden = false;
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
  const gang = document.getElementById('territory-gang').value.trim() || '';
  const color = document.getElementById('territory-color').value;
  const feature = getTerritoryById(editingTerritoryId);
  if (!feature) return;
  feature.properties.name = name;
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
  editingTerritoryId = null;
  document.getElementById('panel-territory-form').hidden = true;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
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
  editingTerritoryId = null;
  document.getElementById('panel-territory-form').hidden = true;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
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
    label.textContent = name;
    li.appendChild(toggle);
    li.appendChild(dot);
    li.appendChild(label);
    list.appendChild(li);
  });
}

function saveTerritoryFromForm() {
  if (!pendingTerritoryLayer) return;
  const name = document.getElementById('territory-name').value.trim() || 'Unnamed';
  const gang = document.getElementById('territory-gang').value.trim() || '';
  const color = document.getElementById('territory-color').value;

  const coords = latLngsToGeo(pendingTerritoryLayer.latlngs);
  const feature = {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: { id: generateId(), name, gang, color },
  };

  const layer = createTerritoryLayer(feature);
  territoryLayerGroup.addLayer(layer);

  const territories = getTerritoriesFromStorage();
  territories.push(feature);
  saveTerritoriesToStorage(territories);

  drawnItems.clearLayers();
  pendingTerritoryLayer = null;
  document.getElementById('panel-territory-form').hidden = true;
  document.getElementById('territory-name').value = '';
  document.getElementById('territory-gang').value = '';
  document.getElementById('territory-color').value = '#8B5CF6';
  isDrawingTerritory = false;
  if (typeof renderTerritoryList === 'function') renderTerritoryList();
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
    map.removeLayer(polygonMarkerLayer);
    if (polygonTempLine) map.removeLayer(polygonTempLine);
    pendingTerritoryLayer = { latlngs: [...polygonPoints] };
    editingTerritoryId = null;
    document.getElementById('territory-form-title').textContent = 'New territory';
    document.getElementById('territory-delete').style.display = 'none';
    document.getElementById('panel-territory-form').hidden = false;
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
  };
}


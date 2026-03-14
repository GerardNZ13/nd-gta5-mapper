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

function createTerritoryLayer(feature) {
  const props = feature.properties || {};
  const color = props.color || '#8B5CF6';
  const layer = L.polygon(feature.geometry.coordinates.map(geoToLatLngs), {
    color,
    fillColor: color,
    fillOpacity: 0.35,
    weight: 2,
  });
  layer.feature = feature;
  layer.bindPopup(
    `<strong>${props.name || 'Territory'}</strong><br/>${props.gang ? `Gang: ${props.gang}` : ''}`
  );
  return layer;
}

function initTerritoriesLayer(map) {
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  territoryLayerGroup = new L.FeatureGroup();
  map.addLayer(territoryLayerGroup);

  const territories = getTerritoriesFromStorage();
  territories.forEach((feature) => {
    try {
      const layer = createTerritoryLayer(feature);
      territoryLayerGroup.addLayer(layer);
    } catch (e) {
      console.warn('Skip invalid territory', feature, e);
    }
  });

  return { territoryLayerGroup, drawnItems };
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
  const territories = getTerritoriesFromStorage().map((f) =>
    (f.properties && f.properties.id) === editingTerritoryId ? feature : f
  );
  saveTerritoriesToStorage(territories);
  editingTerritoryId = null;
  document.getElementById('panel-territory-form').hidden = true;
  document.getElementById('territory-delete').style.display = 'none';
  document.getElementById('territory-form-title').textContent = 'New territory';
  if (typeof renderTerritoryList === 'function') renderTerritoryList();
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
  if (empty) empty.hidden = territories.length > 0;
  territories.forEach((f) => {
    const id = f.properties && f.properties.id;
    const name = (f.properties && f.properties.name) || 'Unnamed';
    const color = (f.properties && f.properties.color) || '#8B5CF6';
    const li = document.createElement('li');
    li.setAttribute('data-id', id);
    const dot = document.createElement('span');
    dot.className = 'item-dot';
    dot.style.background = color;
    const label = document.createElement('span');
    label.className = 'item-name';
    label.textContent = name;
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


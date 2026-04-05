/**
 * POI density heatmap, territory "declutter" (distance-based fade), UI wiring.
 */
var heatLayer = null;
var ghostMoveListener = null;

function getHeatToggle() {
  return document.getElementById('layer-heatmap');
}

function getGhostToggle() {
  return document.getElementById('layer-territory-ghost');
}

function rebuildHeatmapLayer() {
  var map = typeof getMap === 'function' ? getMap() : null;
  if (!map || typeof L.heatLayer !== 'function') return;
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
  var on = getHeatToggle() && getHeatToggle().checked;
  if (!on) return;
  var pois = typeof getPoiFromStorage === 'function' ? getPoiFromStorage() : [];
  var pts = [];
  pois.forEach(function (p) {
    if (!p.position || !Array.isArray(p.position) || p.position.length < 2) return;
    pts.push([p.position[0], p.position[1], 0.4]);
  });
  if (pts.length === 0) return;
  if (!map.getPane || !map.getPane('heatPane')) {
    var pane = map.createPane('heatPane');
    pane.style.zIndex = 450;
    pane.style.pointerEvents = 'none';
  }
  heatLayer = L.heatLayer(pts, {
    pane: 'heatPane',
    radius: 28,
    blur: 22,
    minOpacity: 0.25,
    maxZoom: 4,
    gradient: { 0.2: '#1e3a8a', 0.45: '#22c55e', 0.65: '#eab308', 0.85: '#ef4444', 1: '#f97316' },
  });
  map.addLayer(heatLayer);
}

function applyTerritoryGhost() {
  var map = typeof getMap === 'function' ? getMap() : null;
  if (!map || typeof territoryLayerGroup === 'undefined' || !territoryLayerGroup) return;
  var ghost = getGhostToggle() && getGhostToggle().checked;
  var hiddenIds = typeof getHiddenTerritoryIds === 'function' ? getHiddenTerritoryIds() : [];
  var center = map.getCenter();

  territoryLayerGroup.eachLayer(function (layer) {
    if (!layer.feature || !layer.feature.properties) return;
    var id = layer.feature.properties.id;
    var hidden = id && hiddenIds.indexOf(id) !== -1;
    var baseColor = (layer.feature.properties && layer.feature.properties.color) || '#8B5CF6';
    if (hidden) {
      layer.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
      return;
    }
    if (!ghost) {
      layer.setStyle({
        color: baseColor,
        fillColor: baseColor,
        fillOpacity: 0.35,
        weight: 2,
        opacity: 1,
      });
      return;
    }
    var b = layer.getBounds();
    var c = b.getCenter();
    var d = center.distanceTo(c);
    var sz = map.getSize();
    var maxD = Math.max(sz.x || 0, sz.y || 0) * 8;
    if (!maxD || !isFinite(maxD)) maxD = 4000;
    var t = Math.min(1, d / maxD);
    var fillOpacity = 0.12 + (1 - t) * 0.38;
    var lineOpacity = 0.35 + (1 - t) * 0.65;
    layer.setStyle({
      color: baseColor,
      fillColor: baseColor,
      fillOpacity: fillOpacity,
      weight: 2,
      opacity: lineOpacity,
    });
  });
}

function bindTerritoryGhostMapEvents() {
  var map = typeof getMap === 'function' ? getMap() : null;
  if (!map) return;
  if (ghostMoveListener) {
    map.off('moveend', ghostMoveListener);
    map.off('zoomend', ghostMoveListener);
  }
  ghostMoveListener = function () {
    applyTerritoryGhost();
  };
  map.on('moveend', ghostMoveListener);
  map.on('zoomend', ghostMoveListener);
}

function initMapExtras() {
  var h = getHeatToggle();
  if (h) {
    h.addEventListener('change', function () {
      rebuildHeatmapLayer();
    });
  }
  var g = getGhostToggle();
  if (g) {
    g.addEventListener('change', function () {
      applyTerritoryGhost();
    });
  }
  rebuildHeatmapLayer();
  bindTerritoryGhostMapEvents();
  applyTerritoryGhost();
}

window.rebuildHeatmapLayer = rebuildHeatmapLayer;
window.applyTerritoryGhost = applyTerritoryGhost;
window.initMapExtras = initMapExtras;

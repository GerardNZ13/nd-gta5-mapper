/**
 * Leaflet map with GTA 5 map image overlay.
 * Uses simple CRS so coordinates match image pixels: [y, x] with (0,0) top-left.
 */
let map;
let mapImageLayer;

function initMap() {
  const bounds = L.latLngBounds(
    [0, 0],
    [MAP_CONFIG.imageSize[1], MAP_CONFIG.imageSize[0]]
  );

  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    center: bounds.getCenter(),
    zoom: -1,
    maxBounds: bounds,
    maxBoundsViscosity: 1,
  });

  // Load map image if URL is set and valid
  const url = MAP_CONFIG.imageUrl;
  if (url) {
    mapImageLayer = L.imageOverlay(url, bounds, {
      opacity: 1,
      interactive: true,
      className: 'map-image-overlay',
    }).addTo(map);

    mapImageLayer.on('loaderror', () => {
      document.getElementById('map-placeholder').classList.remove('hidden');
    });
    mapImageLayer.on('load', () => {
      document.getElementById('map-placeholder').classList.add('hidden');
    });
  } else {
    document.getElementById('map-placeholder').classList.remove('hidden');
  }

  // Fit the map to the image with some padding
  map.fitBounds(bounds, { padding: [20, 20] });

  return map;
}

function getMap() {
  return map;
}

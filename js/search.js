/**
 * Global map search: filters sidebar lists; Enter flies to first match.
 */
window.__mapSearchQuery = '';

function getMapSearchQuery() {
  return typeof window.__mapSearchQuery === 'string' ? window.__mapSearchQuery : '';
}

function setMapSearchQuery(q) {
  window.__mapSearchQuery = typeof q === 'string' ? q : '';
}

function territoryMatchesSearch(f, q) {
  if (!q) return true;
  var ql = q.toLowerCase();
  var p = f.properties || {};
  var hay = [p.name, p.category, p.gang].filter(Boolean).join(' ').toLowerCase();
  return hay.indexOf(ql) !== -1;
}

function poiMatchesSearch(p, q) {
  if (!q) return true;
  var ql = q.toLowerCase();
  var hay = [p.name, p.category, p.notes, p.imageUrl].filter(Boolean).join(' ').toLowerCase();
  return hay.indexOf(ql) !== -1;
}

function flyToFirstSearchMatch() {
  var q = getMapSearchQuery().trim();
  if (!q) return;
  var map = typeof getMap === 'function' ? getMap() : null;
  if (!map) return;

  var terr = typeof getTerritoriesFromStorage === 'function' ? getTerritoriesFromStorage() : [];
  for (var i = 0; i < terr.length; i++) {
    if (territoryMatchesSearch(terr[i], q)) {
      var id = terr[i].properties && terr[i].properties.id;
      if (id && typeof territoryLayerGroup !== 'undefined' && territoryLayerGroup) {
        territoryLayerGroup.eachLayer(function (layer) {
          if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
            map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 2 });
          }
        });
      }
      return;
    }
  }

  var pois = typeof getPoiFromStorage === 'function' ? getPoiFromStorage() : [];
  for (var j = 0; j < pois.length; j++) {
    if (poiMatchesSearch(pois[j], q) && pois[j].position && pois[j].position.length >= 2) {
      map.setView([pois[j].position[0], pois[j].position[1]], Math.max(map.getZoom(), 0));
      return;
    }
  }
}

function initMapSearchUI() {
  var input = document.getElementById('map-search');
  var clearBtn = document.getElementById('map-search-clear');
  if (!input) return;

  var debounceTimer = null;
  function apply() {
    setMapSearchQuery(input.value);
    if (clearBtn) clearBtn.hidden = !input.value.trim();
    if (typeof renderTerritoryList === 'function') renderTerritoryList();
    if (typeof renderPoiList === 'function') renderPoiList();
  }
  function debouncedApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(apply, 200);
  }

  input.addEventListener('input', debouncedApply);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      setMapSearchQuery(input.value);
      apply();
      flyToFirstSearchMatch();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      setMapSearchQuery('');
      clearBtn.hidden = true;
      apply();
      input.focus();
    });
  }
}

window.getMapSearchQuery = getMapSearchQuery;
window.initMapSearchUI = initMapSearchUI;
window.flyToFirstSearchMatch = flyToFirstSearchMatch;
window.territoryMatchesSearch = territoryMatchesSearch;
window.poiMatchesSearch = poiMatchesSearch;

/**
 * App entry: init map, layers, UI, export/import.
 * When AUTH_CONFIG.requireAuth is true, init runs only after sign-in.
 */
(function () {
  var map;

  function initMapApp() {
    map = initMap();
    initTerritoriesLayer(map);
    initPoiLayer(map);
    renderTerritoryList();
    renderPoiList();
    bindAppEvents();
  }

  function bindAppEvents() {
  const btnDrawTerritory = document.getElementById('btn-draw-territory');
  const btnAddPoi = document.getElementById('btn-add-poi');
  const layerTerritories = document.getElementById('layer-territories');
  const layerPoi = document.getElementById('layer-poi');
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const inputImport = document.getElementById('input-import');

  btnDrawTerritory.addEventListener('click', () => {
    if (btnDrawTerritory.classList.contains('active')) {
      cancelDrawingTerritory();
      btnDrawTerritory.classList.remove('active');
      return;
    }
    btnAddPoi.classList.remove('active');
    if (window._poiCancel) window._poiCancel();
    document.getElementById('panel-poi-form').hidden = true;
    btnDrawTerritory.classList.add('active');
    startDrawingTerritory(map);
  });

  btnAddPoi.addEventListener('click', () => {
    if (btnAddPoi.classList.contains('active')) {
      cancelAddingPoi();
      btnAddPoi.classList.remove('active');
      return;
    }
    btnDrawTerritory.classList.remove('active');
    cancelDrawingTerritory();
    btnAddPoi.classList.add('active');
    startAddingPoi(map);
  });

  document.getElementById('territory-save').addEventListener('click', () => {
    handleTerritorySave();
    btnDrawTerritory.classList.remove('active');
  });
  document.getElementById('territory-delete').addEventListener('click', () => {
    deleteCurrentTerritory();
    btnDrawTerritory.classList.remove('active');
  });
  document.getElementById('territory-cancel').addEventListener('click', () => {
    cancelDrawingTerritory();
    btnDrawTerritory.classList.remove('active');
  });

  document.getElementById('poi-save').addEventListener('click', () => {
    handlePoiSave();
    btnAddPoi.classList.remove('active');
  });
  document.getElementById('poi-delete').addEventListener('click', () => {
    deleteCurrentPoi();
    btnAddPoi.classList.remove('active');
  });
  document.getElementById('poi-cancel').addEventListener('click', () => {
    cancelAddingPoi();
    btnAddPoi.classList.remove('active');
  });

  document.getElementById('territory-list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) {
      btnDrawTerritory.classList.remove('active');
      btnAddPoi.classList.remove('active');
      cancelDrawingTerritory();
      cancelAddingPoi();
      openTerritoryFormForEdit(li.getAttribute('data-id'), map);
    }
  });
  document.getElementById('poi-list-container').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) {
      btnDrawTerritory.classList.remove('active');
      btnAddPoi.classList.remove('active');
      cancelDrawingTerritory();
      cancelAddingPoi();
      openPoiFormForEdit(li.getAttribute('data-id'), map);
    }
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.map-feature-popup [data-action]');
    if (!btn) return;
    var popup = btn.closest('.map-feature-popup');
    if (!popup) return;
    var type = popup.getAttribute('data-type');
    var id = popup.getAttribute('data-id');
    var action = btn.getAttribute('data-action');
    if (!id) return;
    if (action === 'cancel') {
      if (type === 'territory') closeTerritoryPopup(id); else closePoiPopup(id);
      return;
    }
    if (action === 'edit') {
      btnDrawTerritory.classList.remove('active');
      btnAddPoi.classList.remove('active');
      cancelDrawingTerritory();
      cancelAddingPoi();
      if (type === 'territory') { closeTerritoryPopup(id); openTerritoryFormForEdit(id, map); }
      else { closePoiPopup(id); openPoiFormForEdit(id, map); }
      return;
    }
    if (action === 'delete') {
      if (!confirm('Delete this ' + (type === 'territory' ? 'territory' : 'point of interest') + '?')) return;
      if (type === 'territory') { deleteTerritory(id); closeTerritoryPopup(id); }
      else { deletePoi(id); closePoiPopup(id); }
    }
  });

  layerTerritories.addEventListener('change', () => {
    setTerritoriesVisibility(layerTerritories.checked, map);
  });
  layerPoi.addEventListener('change', () => {
    setPoiVisibility(layerPoi.checked, map);
  });

  function exportData() {
    const data = {
      version: 2,
      territories: getTerritoriesFromStorage(),
      poi: getPoiFromStorage(),
      categories: typeof getAllCategoriesFromPois === 'function' ? getAllCategoriesFromPois() : [],
      categoryColors: typeof getCategoryColorsFromStorage === 'function' ? getCategoryColorsFromStorage() : {},
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gta5-map-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const result = mergeImportData(data);
        alert('Merged: ' + result.territories + ' territories, ' + result.poi + ' POIs. Same IDs = updated; new IDs = added.');
        window.location.reload();
      } catch (e) {
        alert('Invalid file: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function hasServerConfig() {
    return typeof isServerSyncConfigured === 'function' && isServerSyncConfigured();
  }

  const btnLoadServer = document.getElementById('btn-load-server');
  const btnSaveServer = document.getElementById('btn-save-server');
  if (!hasServerConfig()) {
    btnLoadServer.style.display = 'none';
    btnSaveServer.style.display = 'none';
  }

  btnLoadServer.addEventListener('click', async () => {
    if (!hasServerConfig()) {
      alert('Set DATA_CONFIG.firebase or DATA_CONFIG.serverUrl in js/config.js to use server sync.');
      return;
    }
    try {
      await loadFromServer(true);
      alert('Loaded and merged from server. Reloading.');
      window.location.reload();
    } catch (e) {
      alert('Load failed: ' + e.message);
    }
  });

  btnSaveServer.addEventListener('click', async () => {
    if (!hasServerConfig()) {
      alert('Set DATA_CONFIG.firebase or DATA_CONFIG.serverUrl in js/config.js to use server sync.');
      return;
    }
    try {
      await saveToServer();
      alert('Saved to server.');
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  });

  btnExport.addEventListener('click', exportData);
  btnImport.addEventListener('click', () => inputImport.click());
  inputImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });
  }

  var requireAuth = typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG && AUTH_CONFIG.requireAuth === true;
  var btnSignOut = document.getElementById('btn-signout');
  if (btnSignOut) {
    if (requireAuth) btnSignOut.style.display = 'inline-block';
    btnSignOut.addEventListener('click', function () {
      if (typeof signOut === 'function') signOut();
    });
  }

  initAuth(function (user) {
    if (requireAuth && !user) return;
    initMapApp();
  });
})();

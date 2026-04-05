/**
 * Rolling autosave snapshots + restore point before import.
 */
var SNAPSHOT_INDEX_KEY = 'gta5-map-snapshots-index-v1';
var SNAPSHOT_BLOB_BASE = 'gta5-map-snapshot-data-v1';
var PRE_IMPORT_FLAG_KEY = 'gta5-map-last-preimport-id';
var MAX_SNAPSHOTS = 5;
var AUTOSAVE_MS = 5 * 60 * 1000;

function snapshotIndexKey() {
  return typeof profileScopedKey === 'function' ? profileScopedKey(SNAPSHOT_INDEX_KEY) : SNAPSHOT_INDEX_KEY;
}

function snapshotDataKey(id) {
  var base = typeof profileScopedKey === 'function' ? profileScopedKey(SNAPSHOT_BLOB_BASE) : SNAPSHOT_BLOB_BASE;
  return base + '-' + id;
}

function preImportFlagKey() {
  return typeof profileScopedKey === 'function' ? profileScopedKey(PRE_IMPORT_FLAG_KEY) : PRE_IMPORT_FLAG_KEY;
}

function readSnapshotIndex() {
  try {
    var raw = localStorage.getItem(snapshotIndexKey());
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writeSnapshotIndex(arr) {
  try {
    localStorage.setItem(snapshotIndexKey(), JSON.stringify(arr.slice(0, MAX_SNAPSHOTS)));
  } catch (e) {
    console.warn('writeSnapshotIndex', e);
  }
}

function captureMapDataPayload() {
  return {
    version: 2,
    capturedAt: new Date().toISOString(),
    profileId: typeof getActiveProfileId === 'function' ? getActiveProfileId() : 'default',
    territories: typeof getTerritoriesFromStorage === 'function' ? getTerritoriesFromStorage() : [],
    poi: typeof getPoiFromStorage === 'function' ? getPoiFromStorage() : [],
    categories: typeof getAllCategoriesFromPois === 'function' ? getAllCategoriesFromPois() : [],
    categoryColors: typeof getCategoryColorsFromStorage === 'function' ? getCategoryColorsFromStorage() : {},
    hiddenTerritoryIds: typeof getHiddenTerritoryIds === 'function' ? getHiddenTerritoryIds() : [],
    hiddenPoiIds: typeof getHiddenPoiIds === 'function' ? getHiddenPoiIds() : [],
    settings: typeof getMapSettings === 'function' ? getMapSettings() : {},
  };
}

function applyMapDataPayload(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof saveTerritoriesToStorage === 'function' && data.territories) {
    saveTerritoriesToStorage(Array.isArray(data.territories) ? data.territories : []);
  }
  if (typeof savePoiToStorage === 'function' && data.poi) {
    savePoiToStorage(Array.isArray(data.poi) ? data.poi : []);
  }
  if (data.categoryColors && typeof saveCategoryColorsToStorage === 'function') {
    saveCategoryColorsToStorage(data.categoryColors);
  }
  if (data.hiddenTerritoryIds && typeof saveHiddenTerritoryIds === 'function') {
    saveHiddenTerritoryIds(data.hiddenTerritoryIds);
  }
  if (data.hiddenPoiIds && typeof saveHiddenPoiIds === 'function') {
    saveHiddenPoiIds(data.hiddenPoiIds);
  }
  if (data.settings && typeof window.persistMapSettings === 'function') {
    window.persistMapSettings(data.settings);
  }
}

/** Call before mergeImportData to allow undo */
function savePreImportSnapshot() {
  var id = 'preimport-' + Date.now();
  var payload = captureMapDataPayload();
  try {
    localStorage.setItem(snapshotDataKey(id), JSON.stringify(payload));
    localStorage.setItem(preImportFlagKey(), id);
  } catch (e) {
    console.warn('savePreImportSnapshot', e);
    return;
  }
  var idx = readSnapshotIndex();
  idx.unshift({ id: id, label: 'Before last import', ts: Date.now(), kind: 'import' });
  while (idx.length > MAX_SNAPSHOTS) {
    var last = idx.pop();
    if (last && last.id) {
      try {
        localStorage.removeItem(snapshotDataKey(last.id));
      } catch (e2) {}
    }
  }
  writeSnapshotIndex(idx);
}

function pushRollingAutosave() {
  var id = 'auto-' + Date.now();
  var payload = captureMapDataPayload();
  try {
    localStorage.setItem(snapshotDataKey(id), JSON.stringify(payload));
  } catch (e) {
    console.warn('pushRollingAutosave', e);
    return;
  }
  var idx = readSnapshotIndex();
  var autos = idx.filter(function (x) { return x.kind === 'auto'; });
  var rest = idx.filter(function (x) { return x.kind !== 'auto'; });
  autos.unshift({ id: id, label: 'Autosave', ts: Date.now(), kind: 'auto' });
  while (autos.length > 3) {
    var rem = autos.pop();
    if (rem && rem.id) {
      try {
        localStorage.removeItem(snapshotDataKey(rem.id));
      } catch (e2) {}
    }
  }
  var merged = autos.concat(rest).slice(0, MAX_SNAPSHOTS);
  writeSnapshotIndex(merged);
}

function restoreSnapshotById(id) {
  if (!id) return false;
  try {
    var raw = localStorage.getItem(snapshotDataKey(id));
    if (!raw) return false;
    var data = JSON.parse(raw);
    applyMapDataPayload(data);
    return true;
  } catch (e) {
    console.warn('restoreSnapshotById', e);
    return false;
  }
}

function undoLastImport() {
  try {
    var id = localStorage.getItem(preImportFlagKey());
    if (!id) {
      alert('No pre-import snapshot found.');
      return;
    }
    if (restoreSnapshotById(id)) {
      localStorage.removeItem(preImportFlagKey());
      alert('Restored data from before the last import. Reloading.');
      window.location.reload();
    } else {
      alert('Could not restore snapshot.');
    }
  } catch (e) {
    alert('Restore failed: ' + e.message);
  }
}

function initSnapshotAutosaveAndUI() {
  setInterval(function () {
    if (typeof document === 'undefined' || document.hidden) return;
    pushRollingAutosave();
  }, AUTOSAVE_MS);

  var btnUndo = document.getElementById('btn-undo-import');
  if (btnUndo) {
    btnUndo.addEventListener('click', function () {
      if (!confirm('Restore data from before the last import merge? Current map data will be replaced.')) return;
      undoLastImport();
    });
  }

  var btnSnap = document.getElementById('btn-save-snapshot-now');
  if (btnSnap) {
    btnSnap.addEventListener('click', function () {
      var label = window.prompt('Label for this snapshot (optional):', 'Manual save') || 'Manual save';
      var id = 'manual-' + Date.now();
      try {
        localStorage.setItem(snapshotDataKey(id), JSON.stringify(captureMapDataPayload()));
      } catch (e) {
        alert('Could not save snapshot: ' + e.message);
        return;
      }
      var idx = readSnapshotIndex();
      idx.unshift({ id: id, label: label, ts: Date.now(), kind: 'manual' });
      writeSnapshotIndex(idx);
      alert('Snapshot saved. Use Restore in the list to reload it (or we can add restore picker next).');
    });
  }
}

window.savePreImportSnapshot = savePreImportSnapshot;
window.restoreSnapshotById = restoreSnapshotById;
window.initSnapshotAutosaveAndUI = initSnapshotAutosaveAndUI;
window.captureMapDataPayload = captureMapDataPayload;

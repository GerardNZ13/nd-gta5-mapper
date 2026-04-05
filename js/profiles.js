/**
 * Mapping profiles: separate map data per profile (all are personal sandboxes except main).
 * Storage keys are suffixed with __<profileId>. Legacy unsuffixed keys migrate to __default once.
 */
var PROFILES_META_KEY = 'gta5-map-profiles-meta';
var ACTIVE_PROFILE_KEY = 'gta5-map-active-profile-id';
var LEGACY_MIGRATED_KEY = 'gta5-map-profiles-legacy-migrated-v1';

var LEGACY_KEYS = [
  'gta5-map-poi',
  'gta5-map-poi-category-colors',
  'gta5-map-hidden-poi',
  'gta5-map-ui-poi-category-collapsed',
  'gta5-map-territories',
  'gta5-map-hidden-territories',
  'gta5-map-settings',
  'gta5-map-ui-sidebar-sections',
];

function defaultProfilesMeta() {
  return {
    profiles: [
      { id: 'default', name: 'Main map (default)', kind: 'main' },
      { id: 'shared', name: 'Second map', kind: 'personal' },
    ],
  };
}

function sanitizeProfileId(name) {
  var s = String(name || 'profile')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';
  return s.slice(0, 48);
}

function getProfilesMeta() {
  try {
    var raw = localStorage.getItem(PROFILES_META_KEY);
    if (!raw) return defaultProfilesMeta();
    var o = JSON.parse(raw);
    if (!o || !Array.isArray(o.profiles) || o.profiles.length === 0) return defaultProfilesMeta();
    var changed = false;
    o.profiles.forEach(function (p) {
      if (p.id === 'default' && p.name === 'Default') {
        p.name = 'Main map (default)';
        p.kind = 'main';
        changed = true;
      }
      if (p.kind === 'shared') {
        p.kind = 'personal';
        changed = true;
      }
      if (p.name === 'Shared (everyone)') {
        p.name = 'Second map';
        changed = true;
      }
    });
    if (changed) saveProfilesMeta(o);
    return o;
  } catch (e) {
    return defaultProfilesMeta();
  }
}

function saveProfilesMeta(meta) {
  try {
    localStorage.setItem(PROFILES_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('saveProfilesMeta', e);
  }
}

function migrateLegacyProfileKeysOnce() {
  try {
    if (localStorage.getItem(LEGACY_MIGRATED_KEY) === '1') return;
    var targetSuffix = '__default';
    LEGACY_KEYS.forEach(function (legacyKey) {
      var val = localStorage.getItem(legacyKey);
      if (val == null || val === '') return;
      var newKey = legacyKey + targetSuffix;
      if (localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, val);
      }
    });
    localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
  } catch (e) {
    console.warn('migrateLegacyProfileKeysOnce', e);
  }
}

function getActiveProfileId() {
  migrateLegacyProfileKeysOnce();
  try {
    var id = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (id && String(id).trim()) return String(id).trim();
  } catch (e) {}
  return 'default';
}

function setActiveProfileId(id) {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch (e) {
    console.warn('setActiveProfileId', e);
  }
}

/** Suffix for all profile-scoped storage keys, e.g. __default */
function profileStorageSuffix() {
  return '__' + getActiveProfileId();
}

function profileScopedKey(baseKey) {
  return baseKey + profileStorageSuffix();
}

function getProfileList() {
  return getProfilesMeta().profiles.slice();
}

function ensureProfileExists(id) {
  var meta = getProfilesMeta();
  return meta.profiles.some(function (p) { return p.id === id; });
}

function addProfile(displayName) {
  var meta = getProfilesMeta();
  var base = sanitizeProfileId(displayName);
  var id = base;
  var n = 1;
  while (meta.profiles.some(function (p) { return p.id === id; })) {
    id = base + '-' + n;
    n++;
  }
  meta.profiles.push({
    id: id,
    name: (displayName && String(displayName).trim()) || id,
    kind: 'personal',
  });
  saveProfilesMeta(meta);
  return id;
}

function switchToProfile(profileId) {
  if (!ensureProfileExists(profileId)) return;
  setActiveProfileId(profileId);
  window.location.reload();
}

function profileOptionLabel(p) {
  if (p.id === 'default') return p.name + ' — main map';
  return p.name;
}

/** Short label + CSS variant for the header badge. */
function getProfileIndicatorMeta() {
  var id = getActiveProfileId();
  var list = getProfileList();
  var p = list.filter(function (x) { return x.id === id; })[0];
  if (!p) {
    return { line: 'Profile: ' + id, title: 'Active profile id: ' + id, variant: 'unknown' };
  }
  if (p.id === 'default') {
    return {
      line: 'Main view',
      title: 'Main map (default) — your usual map. Switch profiles in Map options.',
      variant: 'main',
    };
  }
  return {
    line: 'Personal view · ' + p.name,
    title: 'Profile: ' + p.name + '. Import/export use whichever profile is active. Switch in Map options.',
    variant: 'personal',
  };
}

function updateProfileIndicator() {
  var el = document.getElementById('profile-indicator');
  if (!el) return;
  var meta = getProfileIndicatorMeta();
  el.textContent = meta.line;
  el.title = meta.title;
  el.className = 'header-profile-indicator header-profile-indicator--' + meta.variant;
}

/** Read all map data for a profile id (raw localStorage), for merge/replace. */
function readProfileDataBundle(profileId) {
  function pk(base) {
    return base + '__' + profileId;
  }
  function parseJson(key, fallback) {
    try {
      var r = localStorage.getItem(key);
      if (r == null || r === '') return fallback;
      return JSON.parse(r);
    } catch (e) {
      return fallback;
    }
  }
  var territories = parseJson(pk('gta5-map-territories'), []);
  var poi = parseJson(pk('gta5-map-poi'), []);
  var categoryColors = parseJson(pk('gta5-map-poi-category-colors'), {});
  var hiddenTerritoryIds = parseJson(pk('gta5-map-hidden-territories'), []);
  var hiddenPoiIds = parseJson(pk('gta5-map-hidden-poi'), []);
  var settingsRaw = localStorage.getItem(pk('gta5-map-settings'));
  var settings = null;
  if (settingsRaw) {
    try {
      settings = JSON.parse(settingsRaw);
    } catch (e) {}
  }
  return {
    version: 2,
    territories: Array.isArray(territories) ? territories : [],
    poi: Array.isArray(poi) ? poi : [],
    categoryColors: categoryColors && typeof categoryColors === 'object' ? categoryColors : {},
    hiddenTerritoryIds: Array.isArray(hiddenTerritoryIds) ? hiddenTerritoryIds : [],
    hiddenPoiIds: Array.isArray(hiddenPoiIds) ? hiddenPoiIds : [],
    settings: settings && typeof settings === 'object' ? settings : undefined,
  };
}

/**
 * Copy another profile into the active one.
 * merge: same rules as JSON import merge (IDs match = update).
 * replace: current profile storage becomes a full copy of the source (except profile list / active id).
 */
function copyFromProfileIntoCurrent(sourceProfileId, mode) {
  var cur = getActiveProfileId();
  if (!sourceProfileId || sourceProfileId === cur) {
    alert('Choose a source profile that is not the current one.');
    return;
  }
  if (!ensureProfileExists(sourceProfileId)) {
    alert('Source profile not found.');
    return;
  }
  if (mode === 'replace') {
    if (!confirm('Replace ALL map data in the current profile with a copy of the source profile?\n\nThis overwrites territories, POIs, visibility, colors, and settings for the profile you have open now. It cannot be undone.')) {
      return;
    }
    LEGACY_KEYS.forEach(function (base) {
      var src = base + '__' + sourceProfileId;
      var dst = base + '__' + cur;
      var v = localStorage.getItem(src);
      if (v != null) localStorage.setItem(dst, v);
      else localStorage.removeItem(dst);
    });
    alert('Current profile now matches the source. Reloading.');
    window.location.reload();
    return;
  }
  var data = readProfileDataBundle(sourceProfileId);
  if (typeof mergeImportData === 'function') {
    mergeImportData(data);
  }
  alert('Merged data from the source profile into the current one (same rules as Import merge). Reloading.');
  window.location.reload();
}

function refillCopyFromProfileSelect() {
  var sel = document.getElementById('copy-from-profile-select');
  var btn = document.getElementById('btn-copy-from-profile');
  if (!sel) return;
  var current = getActiveProfileId();
  sel.innerHTML = '';
  var list = getProfileList().filter(function (p) { return p.id !== current; });
  if (list.length === 0) {
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(no other profiles)';
    opt.disabled = true;
    sel.appendChild(opt);
    if (btn) btn.disabled = true;
    return;
  }
  if (btn) btn.disabled = false;
  list.forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = profileOptionLabel(p);
    sel.appendChild(opt);
  });
}

function initCopyFromProfileUI() {
  var btn = document.getElementById('btn-copy-from-profile');
  var sel = document.getElementById('copy-from-profile-select');
  if (!btn || !sel) return;
  refillCopyFromProfileSelect();
  btn.addEventListener('click', function () {
    var sourceId = sel.value;
    if (!sourceId) {
      alert('Pick a source profile.');
      return;
    }
    var modeMerge = document.getElementById('copy-mode-merge');
    var mode = modeMerge && modeMerge.checked ? 'merge' : 'replace';
    copyFromProfileIntoCurrent(sourceId, mode);
  });
}

function initProfileSelectorUI() {
  var sel = document.getElementById('profile-select');
  var btnNew = document.getElementById('btn-profile-new');
  if (!sel) return;

  function refill() {
    var current = getActiveProfileId();
    sel.innerHTML = '';
    getProfileList().forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = profileOptionLabel(p);
      if (p.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
    refillCopyFromProfileSelect();
  }

  refill();

  sel.addEventListener('change', function () {
    var v = sel.value;
    if (v && v !== getActiveProfileId()) switchToProfile(v);
  });

  if (btnNew) {
    btnNew.addEventListener('click', function () {
      var name = window.prompt('Name for the new profile (sandbox / alternate map). Most of the time you only need Main map (default).', '');
      if (name == null || !String(name).trim()) return;
      var id = addProfile(name.trim());
      setActiveProfileId(id);
      window.location.reload();
    });
  }

  if (typeof initCopyFromProfileUI === 'function') initCopyFromProfileUI();
}

window.profileStorageSuffix = profileStorageSuffix;
window.profileScopedKey = profileScopedKey;
window.getActiveProfileId = getActiveProfileId;
window.getProfileList = getProfileList;
window.addProfile = addProfile;
window.switchToProfile = switchToProfile;
window.initProfileSelectorUI = initProfileSelectorUI;
window.migrateLegacyProfileKeysOnce = migrateLegacyProfileKeysOnce;
window.readProfileDataBundle = readProfileDataBundle;
window.copyFromProfileIntoCurrent = copyFromProfileIntoCurrent;
window.refillCopyFromProfileSelect = refillCopyFromProfileSelect;
window.updateProfileIndicator = updateProfileIndicator;

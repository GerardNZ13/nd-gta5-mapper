/**
 * Modal workbench: territory form, POI form, and settings (not in sidebar).
 */
var workbenchOpenMode = null;

function openWorkbench(mode) {
  var overlay = document.getElementById('workbench-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.querySelectorAll('.workbench-pane').forEach(function (p) {
    p.hidden = true;
  });
  var pane = document.getElementById('workbench-pane-' + mode);
  if (pane) pane.hidden = false;
  workbenchOpenMode = mode;
  var titles = {
    territory: 'Territory',
    poi: 'Point of interest',
    settings: 'Map settings',
  };
  var t = document.getElementById('workbench-title');
  if (t) t.textContent = titles[mode] || '';
  document.body.style.overflow = 'hidden';
  if (mode === 'settings' && typeof renderAllSettingsEditors === 'function') {
    renderAllSettingsEditors();
  }
}

function closeWorkbench() {
  var overlay = document.getElementById('workbench-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.workbench-pane').forEach(function (p) {
    p.hidden = true;
  });
  workbenchOpenMode = null;
  document.body.style.overflow = '';
}

function isWorkbenchOpen() {
  var overlay = document.getElementById('workbench-overlay');
  return overlay && !overlay.classList.contains('hidden');
}

function initWorkbench() {
  var closeBtn = document.getElementById('workbench-close');
  var backdrop = document.getElementById('workbench-backdrop');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (workbenchOpenMode === 'territory' && typeof cancelDrawingTerritory === 'function') {
        cancelDrawingTerritory();
      } else if (workbenchOpenMode === 'poi' && typeof cancelAddingPoi === 'function') {
        cancelAddingPoi();
      } else {
        closeWorkbench();
      }
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', function () {
      if (closeBtn) closeBtn.click();
    });
  }
}

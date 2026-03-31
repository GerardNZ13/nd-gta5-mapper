/**
 * One-time "What's new" overlay per version.
 * Uses localStorage to remember the last seen version.
 */
(function () {
  var CHANGELOG_KEY = 'gta5-map-changelog-version';
  // Bump this when you want the overlay to show again on the next load.
  var CURRENT_CHANGELOG_VERSION = '2026-03-25-workbench-poi-settings';

  function getLastSeenVersion() {
    try {
      var v = localStorage.getItem(CHANGELOG_KEY);
      return typeof v === 'string' ? v : null;
    } catch (e) {
      console.warn('changelog read failed', e);
      return null;
    }
  }

  function setLastSeenVersion(v) {
    try {
      localStorage.setItem(CHANGELOG_KEY, v);
    } catch (e) {
      console.warn('changelog write failed', e);
    }
  }

  function showOverlayIfNeeded() {
    var overlay = document.getElementById('changelog-overlay');
    var closeBtn = document.getElementById('changelog-close');
    if (!overlay || !closeBtn) return;

    function hide() {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      setLastSeenVersion(CURRENT_CHANGELOG_VERSION);
    }

    // Always wire the close button; overlay may already be hidden.
    closeBtn.addEventListener('click', function () {
      hide();
    });

    // Only show if this version hasn't been seen yet.
    var last = getLastSeenVersion();
    if (last === CURRENT_CHANGELOG_VERSION) {
      return;
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  window.initChangelogOverlay = function () {
    // Defer slightly so layout is stable.
    setTimeout(showOverlayIfNeeded, 300);
  };
})();


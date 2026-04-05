/**
 * Slide-in panel for profile, layers, and snapshot actions.
 */
function initOptionsDrawer() {
  var root = document.getElementById('options-drawer');
  var openBtn = document.getElementById('btn-map-options');
  var closeBtn = document.getElementById('options-drawer-close');
  var doneBtn = document.getElementById('options-drawer-done');
  var backdrop = document.getElementById('options-drawer-backdrop');
  if (!root) return;

  function open() {
    if (typeof refillCopyFromProfileSelect === 'function') refillCopyFromProfileSelect();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('options-drawer-open');
  }

  function close() {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('options-drawer-open');
  }

  if (openBtn) {
    openBtn.addEventListener('click', function () {
      open();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (doneBtn) doneBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-open')) {
      close();
    }
  });

  var sel = document.getElementById('profile-select');
  if (sel) {
    sel.addEventListener('change', function () {
      /* Reload follows switchToProfile; drawer closes with page */
    });
  }
}

window.initOptionsDrawer = initOptionsDrawer;

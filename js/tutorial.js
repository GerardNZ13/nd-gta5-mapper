/**
 * Interactive tutorial: step-by-step guide with UI highlighting.
 * Steps explain add/change/remove detail and import/export workflow.
 */
(function () {
  const HIGHLIGHT_CLASS = 'tutorial-highlight';

  const STEPS = [
    {
      title: 'Welcome',
      target: null,
      tryIt: null,
      body: '<p>This short guide walks you through <strong>adding</strong>, <strong>editing</strong>, and <strong>removing</strong> map details (territories and points of interest), plus <strong>importing</strong> and <strong>exporting</strong> data so you can share the latest version.</p><p>Use <strong>Next</strong> to move through the steps. The highlighted areas show where to click in the app.</p>',
    },
    {
      title: 'Add a point of interest (POI)',
      target: '#btn-add-poi',
      tryIt: '#btn-add-poi',
      body: '<p><strong>Add POI</strong> places a marker on the map (e.g. store, mission, collectible).</p><p>Click <strong>Add POI</strong>, then click on the map where you want the pin. A modal opens: enter <strong>Name</strong>, <strong>Category</strong> (or type a new one), and optional <strong>Notes</strong>, then <strong>Save</strong>.</p>',
    },
    {
      title: 'Add a territory (polygon)',
      target: '#btn-draw-territory',
      tryIt: '#btn-draw-territory',
      body: '<p><strong>Draw territory</strong> creates a colored zone (e.g. gang turf, district).</p><p>Click <strong>Draw territory</strong>, then on the map <strong>click</strong> each corner of the polygon. <strong>Double-click</strong> to finish (need at least 3 points). In the modal, set <strong>Name</strong>, <strong>Gang / Type</strong>, and <strong>Color</strong>, then <strong>Save</strong>.</p>',
    },
    {
      title: 'Edit a detail',
      target: '.sidebar',
      tryIt: null,
      body: '<p>To <strong>change</strong> a POI or territory: click its name in the <strong>Territories</strong> or <strong>Points of interest</strong> list in the sidebar, or click the marker/polygon on the map and choose <strong>Edit</strong> in the popup.</p><p>The same modal opens for edits. Update the fields and click <strong>Save</strong>. Territory shape cannot be changed—delete and redraw if needed.</p>',
    },
    {
      title: 'Remove a detail',
      target: null,
      tryIt: null,
      body: '<p>To <strong>delete</strong> a POI or territory: click it on the map and click <strong>Delete</strong> in the popup, or open it for edit from the list and click <strong>Delete</strong> in the modal. Confirm when prompted.</p><p>If you use server sync, click <strong>Save to server</strong> after deleting so the server stays in sync.</p>',
    },
    {
      title: 'Import new changes',
      target: '#btn-import',
      tryIt: null,
      body: '<p>Use <strong>Import data (merge)</strong> when someone sends you a JSON export. Their data is <strong>merged</strong> with yours: same ID = updated, new ID = added; your items not in the file stay.</p><p>Choose the JSON file when prompted. The page reloads with the merged map. You can also use <strong>Load from server</strong> if Firebase or a REST server is configured.</p>',
    },
    {
      title: 'Export your changes',
      target: '#btn-export',
      tryIt: null,
      body: '<p>When you’re done editing, use <strong>Export data</strong> to download a JSON file with all territories and POIs. That file is the “latest version” to share—others use <strong>Import data (merge)</strong> with it.</p><p>If you use a server, click <strong>Save to server</strong> to push your current data so others can <strong>Load from server</strong>.</p>',
    },
    {
      title: 'You’re all set',
      target: null,
      tryIt: null,
      body: '<p><strong>Quick recap:</strong> Add POI / Draw territory to create; click an item (list or map) to edit or delete; use <strong>Settings</strong> for territory and POI category color palettes (saved locally and included in export/import); Export to share a file, Import to merge someone’s file; use Load/Save to server when configured.</p><p>Close the tutorial anytime with <strong>Close</strong>, or reopen it with the <strong>Tutorial</strong> button in the header.</p>',
    },
  ];

  let currentStep = 0;
  let overlayEl;
  let dotsEl;
  let titleEl;
  let bodyEl;
  let prevBtn;
  let nextBtn;
  let tryBtn;
  let closeBtn;
  let indicatorEl;

  function getEl(id) {
    return document.getElementById(id);
  }

  function clearHighlight() {
    document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(function (el) {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  function highlight(selector) {
    if (!selector) return;
    var el = document.querySelector(selector);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updateDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    STEPS.forEach(function (_, i) {
      var dot = document.createElement('span');
      dot.className = 'tutorial-dot' + (i === currentStep ? ' active' : '') + (i < currentStep ? ' done' : '');
      dot.setAttribute('aria-label', 'Step ' + (i + 1));
      dotsEl.appendChild(dot);
    });
  }

  function showStep(index) {
    if (index < 0 || index >= STEPS.length) return;
    currentStep = index;
    var step = STEPS[currentStep];

    clearHighlight();
    if (step.target) highlight(step.target);

    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.innerHTML = step.body;
    if (indicatorEl) indicatorEl.textContent = 'Step ' + (currentStep + 1) + ' of ' + STEPS.length;

    updateDots();

    if (prevBtn) {
      prevBtn.hidden = currentStep === 0;
    }
    if (nextBtn) {
      nextBtn.hidden = currentStep === STEPS.length - 1;
      nextBtn.textContent = currentStep === STEPS.length - 1 ? 'Done' : 'Next';
    }
    if (tryBtn) {
      if (step.tryIt) {
        tryBtn.classList.remove('hidden');
        tryBtn.hidden = false;
      } else {
        tryBtn.classList.add('hidden');
        tryBtn.hidden = true;
      }
    }
  }

  function openTutorial() {
    overlayEl = getEl('tutorial-overlay');
    dotsEl = getEl('tutorial-dots');
    titleEl = getEl('tutorial-title');
    bodyEl = getEl('tutorial-body');
    prevBtn = getEl('tutorial-prev');
    nextBtn = getEl('tutorial-next');
    tryBtn = getEl('tutorial-try');
    closeBtn = getEl('tutorial-close');
    indicatorEl = getEl('tutorial-step-indicator');

    if (!overlayEl) return;
    overlayEl.classList.remove('hidden');
    overlayEl.setAttribute('aria-hidden', 'false');
    currentStep = 0;
    showStep(0);
  }

  function closeTutorial() {
    if (overlayEl) {
      overlayEl.classList.add('hidden');
      overlayEl.setAttribute('aria-hidden', 'true');
    }
    clearHighlight();
  }

  function bindTutorialEvents() {
    var btnTutorial = getEl('btn-tutorial');
    if (btnTutorial) {
      btnTutorial.addEventListener('click', openTutorial);
    }

    prevBtn = getEl('tutorial-prev');
    nextBtn = getEl('tutorial-next');
    tryBtn = getEl('tutorial-try');
    closeBtn = getEl('tutorial-close');
    dotsEl = getEl('tutorial-dots');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        showStep(currentStep - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentStep < STEPS.length - 1) {
          showStep(currentStep + 1);
        } else {
          closeTutorial();
        }
      });
    }
    if (tryBtn) {
      tryBtn.addEventListener('click', function () {
        var step = STEPS[currentStep];
        if (step && step.tryIt) {
          var el = document.querySelector(step.tryIt);
          if (el) el.click();
        }
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeTutorial);
    }

    if (dotsEl) {
      dotsEl.addEventListener('click', function (e) {
        var dot = e.target.closest('.tutorial-dot');
        if (!dot) return;
        var idx = Array.prototype.indexOf.call(dotsEl.children, dot);
        if (idx >= 0) showStep(idx);
      });
    }

    overlayEl = getEl('tutorial-overlay');
    if (overlayEl) {
      overlayEl.addEventListener('click', function (e) {
        if (e.target === overlayEl || e.target.classList.contains('tutorial-backdrop')) {
          closeTutorial();
        }
      });
    }
  }

  // Expose for app to init after DOM ready
  window.initTutorial = function () {
    bindTutorialEvents();
  };

  window.openTutorial = openTutorial;
  window.closeTutorial = closeTutorial;
})();

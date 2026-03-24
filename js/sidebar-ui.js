/**
 * Sidebar section minimize (collapse list only; map unchanged). Persisted in localStorage.
 */
const SIDEBAR_SECTIONS_KEY = 'gta5-map-ui-sidebar-sections';

function getSidebarSectionsCollapsed() {
  try {
    var r = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    var o = r ? JSON.parse(r) : {};
    return { territories: !!o.territories, poi: !!o.poi };
  } catch {
    return { territories: false, poi: false };
  }
}

function setSidebarSectionCollapsed(section, collapsed) {
  var o = getSidebarSectionsCollapsed();
  o[section] = collapsed;
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(o));
  } catch (e) {
    console.warn('sidebar ui save', e);
  }
  applySidebarSectionCollapseDom(section, collapsed);
}

function applySidebarSectionCollapseDom(section, collapsed) {
  var map = {
    territories: { id: 'panel-territory-list', btn: 'btn-collapse-territory-section' },
    poi: { id: 'panel-poi-list', btn: 'btn-collapse-poi-section' },
  };
  var m = map[section];
  if (!m) return;
  var el = document.getElementById(m.id);
  var btn = document.getElementById(m.btn);
  if (el) el.classList.toggle('is-collapsed', collapsed);
  if (btn) {
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.innerHTML = collapsed ? '&#9654;' : '&#9660;';
    btn.title = collapsed ? 'Expand list (map unchanged)' : 'Collapse list (map unchanged)';
  }
}

function applyAllSidebarSectionCollapseFromStorage() {
  var o = getSidebarSectionsCollapsed();
  applySidebarSectionCollapseDom('territories', o.territories);
  applySidebarSectionCollapseDom('poi', o.poi);
}

function toggleSidebarSection(section) {
  var o = getSidebarSectionsCollapsed();
  setSidebarSectionCollapsed(section, !o[section]);
}

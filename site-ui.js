// One interaction layer for every static page and generated archive template.
const mobileNav = matchMedia('(max-width: 720px)');
const mobileFilters = matchMedia('(max-width: 900px)');
const nav = document.querySelector('.site-nav');
const navToggle = document.querySelector('.site-nav__toggle');
const navLinks = document.getElementById('siteNavLinks');
const navBackdrop = document.getElementById('siteNavBackdrop');
const filters = document.getElementById('controlsPanel');
const filterButtons = [...document.querySelectorAll('.mobile-filter-toggle')];
const filterClose = document.getElementById('controlsPanelClose');
const filterOverlay = document.getElementById('mobileFilterOverlay');
let activeOverlay = null;
let restoreFocus = null;
let isolated = [];

const focusable = (root) => [...root.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex="0"]')]
  .filter((element) => !element.disabled && !element.closest('[inert]') && element.getClientRects().length);

const restoreBackground = () => {
  isolated.forEach(([element, wasInert]) => { element.inert = wasInert; });
  isolated = [];
};
const isolateBackground = (root) => {
  restoreBackground();
  for (let element = root; element && element !== document.body; element = element.parentElement) {
    [...element.parentElement.children].forEach((sibling) => {
      if (sibling === element || sibling === navBackdrop || sibling === filterOverlay || sibling.tagName === 'SCRIPT') return;
      isolated.push([sibling, sibling.inert]);
      sibling.inert = true;
    });
  }
};

const closeOverlay = (returnFocus = true) => {
  if (!activeOverlay) return;
  const previous = activeOverlay;
  activeOverlay = null;
  restoreBackground();
  document.body.classList.remove('nav-open', 'filters-open');
  navLinks?.classList.remove('is-open');
  navBackdrop?.classList.remove('is-open');
  navToggle?.setAttribute('aria-expanded', 'false');
  navToggle?.setAttribute('aria-label', 'Open navigation');
  filterButtons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
  previous.removeAttribute('aria-modal');
  previous.removeAttribute('role');
  previous.querySelectorAll('details[open]').forEach((details) => { details.open = false; });
  if (returnFocus && restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  restoreFocus = null;
};

const openOverlay = (root, trigger, kind) => {
  closeOverlay(false);
  activeOverlay = root;
  restoreFocus = trigger;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', kind === 'nav' ? 'Navigation' : 'Filter players');
  isolateBackground(root);
  document.body.classList.add(kind === 'nav' ? 'nav-open' : 'filters-open');
  if (kind === 'nav') {
    navLinks.classList.add('is-open');
    navBackdrop?.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close navigation');
    navLinks.querySelector('details')?.setAttribute('open', '');
    focusable(navLinks)[0]?.focus();
  } else {
    filters.inert = false;
    filterButtons.forEach((button) => button.setAttribute('aria-expanded', 'true'));
    requestAnimationFrame(() => {
      if (activeOverlay === filters) filterClose?.focus({ preventScroll: true });
    });
  }
};

if (navToggle && navLinks) {
  navToggle.setAttribute('aria-label', 'Open navigation');
  navToggle.addEventListener('click', () => {
    if (activeOverlay === nav) closeOverlay();
    else if (mobileNav.matches) openOverlay(nav, navToggle, 'nav');
  });
  navBackdrop?.addEventListener('click', () => closeOverlay());
  navLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeOverlay(false);
  });
  mobileNav.addEventListener('change', () => closeOverlay(false));
  // Older generated pages share this module, including the Compare entry.
  const menu = navLinks.querySelector('.site-nav__menu');
  if (menu && !menu.querySelector('a[href*="compare"]')) {
    const compare = document.createElement('a');
    compare.className = 'site-nav__link';
    compare.href = new URL('compare/', import.meta.url).href;
    compare.textContent = 'Compare Players';
    menu.insertBefore(compare, menu.lastElementChild);
  }
  const currentPath = location.pathname.replace(/index\.html$/, '');
  navLinks.querySelectorAll('a').forEach((link) => {
    const path = new URL(link.href).pathname.replace(/index\.html$/, '');
    if (path === currentPath) link.setAttribute('aria-current', 'page');
  });
}

if (filters) {
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    if (mobileFilters.matches) openOverlay(filters, button, 'filters');
  }));
  filterClose?.addEventListener('click', () => closeOverlay());
  filterOverlay?.addEventListener('click', () => closeOverlay());
  mobileFilters.addEventListener('change', () => closeOverlay(false));
  // Off-screen fields must not be reachable when the sheet is closed.
  const syncFilterAccess = () => { filters.inert = mobileFilters.matches && activeOverlay !== filters; };
  new MutationObserver(syncFilterAccess).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  mobileFilters.addEventListener('change', syncFilterAccess);
  syncFilterAccess();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (activeOverlay) { event.preventDefault(); closeOverlay(); }
    else document.querySelectorAll('.site-nav__dropdown[open], .country-filter__dropdown[open]').forEach((details) => {
      if (details.contains(document.activeElement)) details.querySelector('summary')?.focus();
      details.open = false;
    });
  }
  if (event.key !== 'Tab' || !activeOverlay) return;
  const elements = focusable(activeOverlay);
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && (document.activeElement === first || !activeOverlay.contains(document.activeElement))) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !activeOverlay.contains(document.activeElement))) {
    event.preventDefault(); first?.focus();
  }
});
document.addEventListener('click', (event) => {
  document.querySelectorAll('.site-nav__dropdown[open]').forEach((details) => {
    if (!details.contains(event.target) && !mobileNav.matches) details.open = false;
  });
});

const ensureSkipLink = () => {
  if (document.querySelector('.skip-link')) return;
  const main = document.querySelector('main:not(:empty)') || document.querySelector('.sport-band');
  if (!main) return;
  if (!main.id) main.id = 'main-content';
  main.tabIndex = -1;
  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = `#${main.id}`;
  skip.textContent = 'Skip to content';
  document.body.prepend(skip);
};
ensureSkipLink();
document.getElementById('activeOnlyToggle')?.setAttribute('aria-label', 'Show active players only');

const scheduleTabs = [...document.querySelectorAll('.schedule__toggle-btn')];
scheduleTabs.forEach((tab, index) => {
  tab.id = `schedule-tab-${tab.dataset.view}`;
  tab.setAttribute('aria-controls', `schedule-panel-${tab.dataset.view}`);
  const panel = document.querySelector(`.schedule__panel[data-panel="${tab.dataset.view}"]`);
  if (panel) {
    panel.id = `schedule-panel-${tab.dataset.view}`;
    panel.setAttribute('aria-labelledby', tab.id);
  }
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % scheduleTabs.length;
    if (event.key === 'ArrowLeft') next = (index + scheduleTabs.length - 1) % scheduleTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = scheduleTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    scheduleTabs[next].focus();
    scheduleTabs[next].click();
  });
});

const tableHints = new Map();
const refreshTables = () => {
  ensureSkipLink();
  tableHints.forEach((hint, wrap) => {
    if (!wrap.isConnected) { hint.remove(); tableHints.delete(wrap); }
  });
  document.querySelectorAll('.table-wrap').forEach((wrap) => {
    const table = wrap.querySelector('table');
    if (!table) return;
    let hint = tableHints.get(wrap);
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'table-scroll-hint';
      hint.textContent = 'Swipe or scroll to see all columns →';
      wrap.before(hint);
      wrap.setAttribute('role', 'region');
      const heading = wrap.closest('section')?.querySelector('h2');
      wrap.setAttribute('aria-label', `${heading?.textContent || 'Results'} table`);
      tableHints.set(wrap, hint);
    }
    const overflow = wrap.clientWidth > 0 && wrap.scrollWidth > wrap.clientWidth + 2;
    hint.hidden = !overflow;
    wrap.tabIndex = overflow ? 0 : -1;
    const headers = [...table.querySelectorAll('thead th')];
    const playerColumn = headers.findIndex((header) => /^(player|opponent)\s*[↕↑↓]?$/.test(header.textContent.trim().toLowerCase()));
    if (playerColumn >= 0) {
      headers[playerColumn].classList.add('is-pinned');
      table.querySelectorAll('tbody tr:not(.detail-row):not(.state-row)').forEach((row) => {
        row.children[playerColumn]?.classList.add('is-pinned');
      });
    }
  });
};
let refreshPending = false;
const scheduleRefresh = () => {
  if (refreshPending) return;
  refreshPending = true;
  requestAnimationFrame(() => { refreshPending = false; refreshTables(); });
};
new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', scheduleRefresh, { passive: true });
refreshTables();

const filterBar = document.getElementById('mobileFilterBar');
const updateFilterBar = () => {
  if (!filterBar) return;
  const table = filters?.closest('section')?.querySelector('.table-wrap');
  const bounds = table?.getBoundingClientRect();
  const visible = mobileFilters.matches && bounds && bounds.top < 140 && bounds.bottom > 180;
  filterBar.classList.toggle('is-visible', Boolean(visible));
  filterBar.inert = !visible;
};
if (filterBar) {
  let scrollPending = false;
  window.addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => { scrollPending = false; updateFilterBar(); });
  }, { passive: true });
  window.addEventListener('resize', updateFilterBar, { passive: true });
  updateFilterBar();
}

/**
 * Tesseract Backlog Engine
 * Notion-style tabular executive backlogs with multi-group filtering,
 * Petty Errands category, mobile-friendly severity dropdowns,
 * 5-second vanishing completion timer, and dedicated Completed Backlogs archive.
 */

const BACKLOG_STORAGE_KEY = 'tesseract_backlog_data';

const BACKLOG_GROUPS = {
  work: { key: 'work', label: 'Work', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', icon: 'briefcase' },
  household: { key: 'household', label: 'Household', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', icon: 'home' },
  physical: { key: 'physical', label: 'Physical', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: 'activity' },
  petty: { key: 'petty', label: 'Petty Errands', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', icon: 'shopping-bag' },
  other: { key: 'other', label: 'Other', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: 'tag' },
  tesseract: { key: 'tesseract', label: 'Tesseract', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', icon: 'box' }
};

const BACKLOG_SEVERITIES = {
  low: { key: 'low', label: 'Low', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.28)' },
  moderate: { key: 'moderate', label: 'Moderate', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.28)' },
  high: { key: 'high', label: 'High', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.28)' }
};

const DUMMY_BACKLOG_IDS = new Set(['bkl_01', 'bkl_02', 'bkl_03', 'bkl_04', 'bkl_05', 'bkl_06']);
const DUMMY_BACKLOG_TITLES = new Set([
  'refactor core architecture & clean codebase',
  'upgrade home network & server backup strategy',
  'full mobility & functional strength assessment routine',
  'tesseract native push engine & real-time sync pipeline',
  'tax & annual corporate document organization',
  'drop off dry cleaning & pick up courier package'
]);

function isDummyBacklogItem(item) {
  if (!item) return false;
  if (item.id && DUMMY_BACKLOG_IDS.has(item.id)) return true;
  const title = (item.objective || '').trim().toLowerCase();
  return DUMMY_BACKLOG_TITLES.has(title);
}

const BACKLOG_INITIAL_DATA = [];

const BacklogEngine = {
  items: [],
  activeGroup: 'all',
  searchQuery: '',
  sortColumn: null,
  sortDirection: 'asc',
  showInlineForm: false,
  selectedIds: new Set(),
  pendingVanishes: {}, // { [itemId]: { timer, interval, startTime } }
  pendingDeletions: {}, // { [itemId]: { timer, interval, startTime } }

  getTodayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  init() {
    this.load();
    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
    if (page === 'backlogs' || page === 'completed_backlogs') {
      this.render();
      this.bindEvents();
      this.bindTableScroll();
      if (typeof DocketEngine !== 'undefined' && typeof DocketEngine.syncBacklogsDueToday === 'function') {
        DocketEngine.syncBacklogsDueToday();
      }
    }
  },

  load() {
    const saved = localStorage.getItem(BACKLOG_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Permanently purge any legacy dummy objectives
          this.items = parsed
            .filter(item => !isDummyBacklogItem(item))
            .map(item => ({
              ...item,
              group: (item.group && BACKLOG_GROUPS[item.group]) ? item.group : 'work',
              severity: (item.severity && BACKLOG_SEVERITIES[item.severity]) ? item.severity : 'low'
            }));

          // If dummy items were purged, save the cleaned dataset immediately and trigger cloud sync
          if (parsed.length !== this.items.length) {
            this.save();
          }
        } else {
          this.items = [];
          this.save();
        }
      } catch (e) {
        console.error('Failed to parse backlog data from localStorage', e);
        this.items = [];
      }
    } else {
      this.items = [];
      this.save();
    }
  },

  restoreInitialObjectives() {
    if (typeof showToast === 'function') {
      showToast('Sample data removed. Create a new objective to get started!', 'info');
    }
  },

  save() {
    localStorage.setItem(BACKLOG_STORAGE_KEY, JSON.stringify(this.items));
    if (typeof SyncEngine !== 'undefined') {
      SyncEngine.queuePush();
    }
  },

  bindEvents() {
    const searchInput = document.getElementById('backlog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTable();
      });
    }
    this.bindFilterScrollGestures();
    this.bindTableScroll();
    this.bindSortHeaders();
  },

  bindFilterScrollGestures() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('backlog-filter-scroll-container') || document.querySelector('.backlog-filter-scroll');
    if (!container || container._hasFilterScrollBound) return;
    container._hasFilterScrollBound = true;

    // Listen to scroll to update chevron visibility
    container.addEventListener('scroll', () => {
      this.updateFilterScrollArrows();
    }, { passive: true });

    // Listen to window resize & orientation
    window.addEventListener('resize', () => {
      this.updateFilterScrollArrows();
    }, { passive: true });

    // Mouse / Desktop Click-and-Drag to Scroll
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      hasMoved = false;
      container.classList.add('is-dragging');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      container.classList.remove('is-dragging');
      setTimeout(() => { hasMoved = false; }, 40);
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(x - startX) > 5) {
        hasMoved = true;
      }
      container.scrollLeft = scrollLeft - walk;
    });

    // Prevent accidental pill click when user was dragging
    container.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);

    // Initial arrow check
    setTimeout(() => {
      this.updateFilterScrollArrows();
    }, 100);
  },

  scrollFilters(direction) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('backlog-filter-scroll-container') || document.querySelector('.backlog-filter-scroll');
    if (!container) return;
    const scrollAmount = 220;
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
    setTimeout(() => this.updateFilterScrollArrows(), 350);
  },

  updateFilterScrollArrows() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('backlog-filter-scroll-container') || document.querySelector('.backlog-filter-scroll');
    const leftBtn = document.getElementById('btn-filter-scroll-left');
    const rightBtn = document.getElementById('btn-filter-scroll-right');
    if (!container) return;

    const canScroll = container.scrollWidth > container.clientWidth + 4;
    if (!canScroll) {
      if (leftBtn) leftBtn.style.display = 'none';
      if (rightBtn) rightBtn.style.display = 'none';
      return;
    }

    const atStart = container.scrollLeft <= 5;
    const atEnd = container.scrollLeft >= (container.scrollWidth - container.clientWidth - 5);

    if (leftBtn) leftBtn.style.display = atStart ? 'none' : 'flex';
    if (rightBtn) rightBtn.style.display = atEnd ? 'none' : 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ════════════════════════════════════════════════════════════
  // ↔️ TABLE HORIZONTAL SCROLLBAR CONTROLLER
  // ════════════════════════════════════════════════════════════

  bindTableScroll() {
    if (typeof document === 'undefined') return;
    const scroller = document.getElementById('backlog-table-scroller') || document.querySelector('.backlog-table-scroller');
    const panel = document.getElementById('backlog-scroll-bar-panel');
    const thumb = document.getElementById('table-scroll-thumb');
    const track = document.getElementById('table-scroll-track');
    if (!scroller) return;

    if (!scroller._hasScrollBound) {
      scroller._hasScrollBound = true;

      scroller.addEventListener('scroll', () => {
        this.updateTableScrollIndicator();
      }, { passive: true });

      window.addEventListener('resize', () => {
        this.updateTableScrollIndicator();
      }, { passive: true });
    }

    if (thumb && track && !track._hasThumbBound) {
      track._hasThumbBound = true;

      // Mouse drag on thumb
      let isDragging = false;
      let startMouseX = 0;
      let startScrollLeft = 0;

      const onMouseDown = (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startMouseX = e.clientX;
        startScrollLeft = scroller.scrollLeft;
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startMouseX;
        const trackWidth = track.clientWidth;
        const thumbWidth = thumb.clientWidth;
        const availableTrack = Math.max(1, trackWidth - thumbWidth);
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        if (maxScroll <= 0) return;
        const scrollDelta = (deltaX / availableTrack) * maxScroll;
        scroller.scrollLeft = startScrollLeft + scrollDelta;
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
      };

      if (typeof thumb.addEventListener === 'function') {
        thumb.addEventListener('mousedown', onMouseDown);
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }

        // Touch drag on thumb for mobile
        let touchStartX = 0;
        let touchStartScrollLeft = 0;

        thumb.addEventListener('touchstart', (e) => {
          if (e.touches && e.touches.length !== 1) return;
          touchStartX = e.touches ? e.touches[0].clientX : 0;
          touchStartScrollLeft = scroller.scrollLeft;
          if (e.stopPropagation) e.stopPropagation();
        }, { passive: true });

        thumb.addEventListener('touchmove', (e) => {
          if (e.touches && e.touches.length !== 1) return;
          const deltaX = (e.touches ? e.touches[0].clientX : 0) - touchStartX;
          const trackWidth = track.clientWidth || 200;
          const thumbWidth = thumb.clientWidth || 40;
          const availableTrack = Math.max(1, trackWidth - thumbWidth);
          const maxScroll = scroller.scrollWidth - scroller.clientWidth;
          if (maxScroll <= 0) return;
          const scrollDelta = (deltaX / availableTrack) * maxScroll;
          scroller.scrollLeft = touchStartScrollLeft + scrollDelta;
          if (e.stopPropagation) e.stopPropagation();
        }, { passive: true });
      }
    }

    setTimeout(() => {
      this.updateTableScrollIndicator();
    }, 80);
  },

  updateTableScrollIndicator() {
    if (typeof document === 'undefined') return;
    const scroller = document.getElementById('backlog-table-scroller') || document.querySelector('.backlog-table-scroller');
    const panel = document.getElementById('backlog-scroll-bar-panel');
    const thumb = document.getElementById('table-scroll-thumb');
    const track = document.getElementById('table-scroll-track');
    const btnLeft = document.getElementById('btn-table-scroll-left');
    const btnRight = document.getElementById('btn-table-scroll-right');

    if (!scroller || !panel || !thumb || !track) return;

    const scrollWidth = scroller.scrollWidth || 0;
    const clientWidth = scroller.clientWidth || 0;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 4) {
      // Content completely fits without scroll
      if (panel.classList) panel.classList.add('is-hidden');
      return;
    }

    if (panel.classList) panel.classList.remove('is-hidden');

    const visibleRatio = clientWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 0.5;
    const trackWidth = track.clientWidth || 200;
    const thumbWidth = Math.max(42, Math.round(trackWidth * visibleRatio));
    const availableTrack = Math.max(1, trackWidth - thumbWidth);
    const scrollRatio = maxScroll > 0 ? Math.max(0, Math.min(1, (scroller.scrollLeft || 0) / maxScroll)) : 0;
    const thumbLeft = Math.round(scrollRatio * availableTrack);

    if (thumb.style) {
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.transform = `translateX(${thumbLeft}px)`;
    }

    if (btnLeft) btnLeft.disabled = (scroller.scrollLeft || 0) <= 5;
    if (btnRight) btnRight.disabled = (scroller.scrollLeft || 0) >= maxScroll - 5;
  },

  scrollTable(direction) {
    if (typeof document === 'undefined') return;
    const scroller = document.getElementById('backlog-table-scroller') || document.querySelector('.backlog-table-scroller');
    if (!scroller) return;
    const delta = 240;
    scroller.scrollBy({
      left: direction === 'left' ? -delta : delta,
      behavior: 'smooth'
    });
    setTimeout(() => this.updateTableScrollIndicator(), 350);
  },

  handleScrollTrackClick(e) {
    if (e.target && e.target.id === 'table-scroll-thumb') return;
    const scroller = document.getElementById('backlog-table-scroller') || document.querySelector('.backlog-table-scroller');
    const track = document.getElementById('table-scroll-track');
    if (!scroller || !track) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollTo({
      left: ratio * maxScroll,
      behavior: 'smooth'
    });
    setTimeout(() => this.updateTableScrollIndicator(), 350);
  },

  isCompletedView() {
    return typeof Components !== 'undefined' && Components.getCurrentPage() === 'completed_backlogs';
  },

  getFilteredItems() {
    const isCompleted = this.isCompletedView();

    return this.items.filter(item => {
      // Completed vs Active
      if (isCompleted) {
        if (!item.completed) return false;
      } else {
        if (item.completed) return false;
      }

      // Group filter
      if (this.activeGroup !== 'all' && item.group !== this.activeGroup) {
        return false;
      }

      // Search filter
      if (this.searchQuery) {
        const matchObj = item.objective && item.objective.toLowerCase().includes(this.searchQuery);
        const groupMeta = BACKLOG_GROUPS[item.group];
        const matchGroup = groupMeta && groupMeta.label.toLowerCase().includes(this.searchQuery);
        const matchSev = item.severity && item.severity.toLowerCase().includes(this.searchQuery);
        if (!matchObj && !matchGroup && !matchSev) return false;
      }
      return true;
    });
  },

  // ════════════════════════════════════════════════════════════
  // 🔃 COLUMN SORTING & HIGHLIGHT CONTROLLER
  // ════════════════════════════════════════════════════════════

  bindSortHeaders() {
    if (typeof document === 'undefined') return;
    const table = document.getElementById('backlog-table');
    if (!table || table._hasSortHeadersBound) return;
    table._hasSortHeadersBound = true;

    // Delegated click handler on thead as a safeguard for touches anywhere in the th cell
    const thead = table.querySelector('thead');
    if (thead) {
      thead.addEventListener('click', (e) => {
        // If click was directly inside the .th-sort-btn, the button's inline onclick handles it
        if (e.target.closest('.th-sort-btn')) return;

        const th = e.target.closest('th.sortable-th');
        if (th) {
          const col = th.getAttribute('data-sort-col');
          if (col) {
            e.preventDefault();
            this.toggleSort(col);
          }
        }
      });
    }
  },

  getSortedAndFilteredItems() {
    const items = this.getFilteredItems();
    if (!this.sortColumn) {
      return items;
    }

    const col = this.sortColumn;
    const isAsc = this.sortDirection === 'asc';
    const mult = isAsc ? 1 : -1;

    return [...items].sort((a, b) => {
      let primaryDiff = 0;

      if (col === 'objective') {
        const titleA = (a.objective || '').trim().toLowerCase();
        const titleB = (b.objective || '').trim().toLowerCase();
        primaryDiff = titleA.localeCompare(titleB);
      } else if (col === 'group') {
        const labelA = (BACKLOG_GROUPS[a.group]?.label || a.group || '').toLowerCase();
        const labelB = (BACKLOG_GROUPS[b.group]?.label || b.group || '').toLowerCase();
        primaryDiff = labelA.localeCompare(labelB);
      } else if (col === 'severity') {
        const SEV_WEIGHT = { low: 1, moderate: 2, high: 3 };
        const weightA = SEV_WEIGHT[a.severity] || 0;
        const weightB = SEV_WEIGHT[b.severity] || 0;
        primaryDiff = weightA - weightB;
      } else if (col === 'createdAt') {
        const dateA = a.completed ? (a.completedAt || a.createdAt || '') : (a.createdAt || '');
        const dateB = b.completed ? (b.completedAt || b.createdAt || '') : (b.createdAt || '');
        if (!dateA && !dateB) primaryDiff = 0;
        else if (!dateA) primaryDiff = 1;
        else if (!dateB) primaryDiff = -1;
        else primaryDiff = dateA.localeCompare(dateB);
      } else if (col === 'dueDate') {
        const dueA = a.dueDate || '';
        const dueB = b.dueDate || '';
        if (!dueA && !dueB) primaryDiff = 0;
        else if (!dueA) primaryDiff = 1;
        else if (!dueB) primaryDiff = -1;
        else primaryDiff = dueA.localeCompare(dueB);
      }

      if (primaryDiff !== 0) {
        return primaryDiff * mult;
      }

      // Secondary Tiebreaker 1: Objective title (multiplied by mult so descending visibly reverses order even when primary values match)
      const secObjA = (a.objective || '').trim().toLowerCase();
      const secObjB = (b.objective || '').trim().toLowerCase();
      const objDiff = secObjA.localeCompare(secObjB);
      if (objDiff !== 0) {
        return objDiff * mult;
      }

      // Secondary Tiebreaker 2: Created Date
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      const dateDiff = dateA.localeCompare(dateB);
      if (dateDiff !== 0) {
        return dateDiff * mult;
      }

      // Tertiary Tiebreaker: Item ID
      return ((a.id || '').localeCompare(b.id || '')) * mult;
    });
  },

  toggleSort(columnKey) {
    if (this.sortColumn !== columnKey) {
      this.sortColumn = columnKey;
      this.sortDirection = 'asc';
    } else {
      if (this.sortDirection === 'asc') {
        this.sortDirection = 'desc';
      } else {
        // Reset to default natural order
        this.sortColumn = null;
        this.sortDirection = 'asc';
      }
    }

    this.renderTable();
    this.updateHeaderSortIndicators();
    this.renderSortBadge();

    if (typeof showToast === 'function') {
      const colNames = {
        objective: 'Objective Name',
        group: 'Group',
        createdAt: this.isCompletedView() ? 'Completed Date' : 'Created Date',
        severity: 'Severity',
        dueDate: 'Estimated End Date'
      };
      if (this.sortColumn) {
        let dirLabel = '';
        if (this.sortColumn === 'severity') {
          dirLabel = this.sortDirection === 'asc' ? 'Low → High' : 'High → Low';
        } else if (this.sortColumn === 'createdAt' || this.sortColumn === 'dueDate') {
          dirLabel = this.sortDirection === 'asc' ? 'Earliest first' : 'Latest first';
        } else {
          dirLabel = this.sortDirection === 'asc' ? 'A → Z' : 'Z → A';
        }
        showToast(`Ordered by ${colNames[columnKey] || columnKey} (${dirLabel})`, 'info');
      } else {
        showToast('Order reset to default', 'info');
      }
    }
  },

  clearSort() {
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.renderTable();
    this.updateHeaderSortIndicators();
    this.renderSortBadge();
    if (typeof showToast === 'function') {
      showToast('Order reset to default', 'info');
    }
  },

  updateHeaderSortIndicators() {
    if (typeof document === 'undefined') return;
    const headers = document.querySelectorAll('th.sortable-th');
    if (!headers || headers.length === 0) return;

    headers.forEach(th => {
      const col = th.getAttribute('data-sort-col');
      if (!col) return;

      const isCurrent = this.sortColumn === col;
      const orderTag = th.querySelector('.th-order-tag') || document.getElementById(`order-tag-${col}`);

      if (isCurrent) {
        const isAsc = this.sortDirection === 'asc';
        th.classList.add('is-sorted');
        th.setAttribute('aria-sort', isAsc ? 'ascending' : 'descending');

        let dirText = '';
        if (col === 'severity') {
          dirText = isAsc ? 'LOW → HIGH' : 'HIGH → LOW';
        } else if (col === 'createdAt' || col === 'dueDate') {
          dirText = isAsc ? 'EARLIEST' : 'LATEST';
        } else {
          dirText = isAsc ? 'A → Z' : 'Z → A';
        }

        if (orderTag) {
          orderTag.textContent = `ORDERED • ${dirText}`;
          orderTag.style.display = 'inline-flex';
        }

        th.setAttribute('title', `Active sort: ${dirText}. Click to ${isAsc ? 'reverse order' : 'reset to default'}.`);
      } else {
        th.classList.remove('is-sorted');
        th.removeAttribute('aria-sort');
        const colName = th.getAttribute('data-sort-name') || col;
        th.setAttribute('title', `Click to order by ${colName}`);

        if (orderTag) {
          orderTag.textContent = '';
          orderTag.style.display = 'none';
        }
      }
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  renderSortBadge() {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('backlog-active-sort-badge');
    if (!badge) return;

    if (!this.sortColumn) {
      badge.style.display = 'none';
      badge.innerHTML = '';
      return;
    }

    const colNames = {
      objective: 'Objective Name',
      group: 'Group',
      createdAt: this.isCompletedView() ? 'Completed Date' : 'Created Date',
      severity: 'Severity',
      dueDate: 'Estimated End Date'
    };

    let dirLabel = '';
    if (this.sortColumn === 'severity') {
      dirLabel = this.sortDirection === 'asc' ? 'Low → High' : 'High → Low';
    } else if (this.sortColumn === 'createdAt' || this.sortColumn === 'dueDate') {
      dirLabel = this.sortDirection === 'asc' ? 'Earliest first' : 'Latest first';
    } else {
      dirLabel = this.sortDirection === 'asc' ? 'A → Z' : 'Z → A';
    }

    badge.style.display = 'inline-flex';
    badge.innerHTML = `
      <i data-lucide="check" class="sort-badge-icon"></i>
      <span class="sort-badge-text">Ordered by: <strong>${colNames[this.sortColumn] || this.sortColumn}</strong> (${dirLabel})</span>
      <button class="sort-badge-clear" onclick="BacklogEngine.clearSort()" title="Clear order (Reset to default)">
        <i data-lucide="x"></i>
      </button>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  setGroupFilter(groupKey) {
    this.activeGroup = groupKey;
    this.selectedIds.clear();
    this.render();

    // Auto-scroll selected pill into view smoothly
    setTimeout(() => {
      const activePill = typeof document !== 'undefined' ? document.querySelector(`.backlog-pill[data-group="${groupKey}"]`) : null;
      if (activePill && typeof activePill.scrollIntoView === 'function') {
        activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      this.updateFilterScrollArrows();
    }, 60);
  },

  // ════════════════════════════════════════════════════════════
  // ⚡ 5-SECOND VANISHING COMPLETION FLOW
  // ════════════════════════════════════════════════════════════

  markDoneWithCountdown(id, isSync = false) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    // If currently deleting, cancel deletion first
    if (this.pendingDeletions[id]) {
      this.cancelDelete(id);
    }

    // If currently vanishing, clicking again cancels / undoes it
    if (this.pendingVanishes[id]) {
      this.cancelVanish(id, isSync);
      return;
    }

    // Set 5-second countdown timer with live per-second label updates
    let remaining = 5;
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
      } else {
        const undoBtnText = typeof document !== 'undefined' ? document.querySelector(`.backlog-row[data-id="${id}"] .btn-vanish-undo span`) : null;
        if (undoBtnText) {
          undoBtnText.textContent = `Undo (${remaining}s)`;
        }
      }
    }, 1000);

    const timer = setTimeout(() => {
      this.finalizeVanish(id);
    }, 5000);

    this.pendingVanishes[id] = {
      timer,
      interval,
      startTime: Date.now()
    };

    // Update row visual state immediately
    const row = typeof document !== 'undefined' ? document.querySelector(`.backlog-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-completing');
      const actionCell = row.querySelector('.col-actions');
      if (actionCell) {
        actionCell.innerHTML = `
          <button class="btn-vanish-undo" onclick="BacklogEngine.cancelVanish('${id}')" title="Undo completion">
            <i data-lucide="rotate-ccw"></i>
            <span>Undo (5s)</span>
          </button>
        `;
      }
      const objCell = row.querySelector('.objective-cell');
      if (objCell) {
        const existingBar = objCell.querySelector('.vanish-progress-bar');
        if (!existingBar) {
          const progressBar = document.createElement('div');
          progressBar.className = 'vanish-progress-bar';
          objCell.appendChild(progressBar);
        }
      }
    }

    // Two-way sync: If this backlog item is in Today's Docket, mark done in Docket too!
    if (!isSync && typeof DocketEngine !== 'undefined' && Array.isArray(DocketEngine.items)) {
      const linkedDocket = DocketEngine.items.find(d => d.backlogId === id || d.id === 'dkt_bkl_' + id);
      if (linkedDocket && !linkedDocket.completed && !DocketEngine.pendingVanishes[linkedDocket.id]) {
        DocketEngine.markDoneWithCountdown(linkedDocket.id, true);
      }
    }

    if (typeof showToast === 'function') {
      showToast('Done! Moving to Completed Backlogs in 5s... Tap Undo to cancel.', 'info');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  cancelVanish(id, isSync = false) {
    if (this.pendingVanishes[id]) {
      clearTimeout(this.pendingVanishes[id].timer);
      if (this.pendingVanishes[id].interval) {
        clearInterval(this.pendingVanishes[id].interval);
      }
      delete this.pendingVanishes[id];
    }
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.completed = false;
    }
    this.renderTable();

    // Two-way sync: Cancel vanish in Docket too
    if (!isSync && typeof DocketEngine !== 'undefined' && Array.isArray(DocketEngine.items)) {
      const linkedDocket = DocketEngine.items.find(d => d.backlogId === id || d.id === 'dkt_bkl_' + id);
      if (linkedDocket) {
        DocketEngine.cancelVanish(linkedDocket.id, true);
      }
    }

    if (typeof showToast === 'function') {
      showToast('Restored objective to active backlogs', 'info');
    }
  },

  finalizeVanish(id, isSync = false) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    if (this.pendingVanishes[id]) {
      clearTimeout(this.pendingVanishes[id].timer);
      if (this.pendingVanishes[id].interval) {
        clearInterval(this.pendingVanishes[id].interval);
      }
      delete this.pendingVanishes[id];
    }

    item.completed = true;
    item.completedAt = new Date().toISOString();
    this.save();

    // Two-way sync: Finalize vanish in Docket too!
    if (!isSync && typeof DocketEngine !== 'undefined' && Array.isArray(DocketEngine.items)) {
      const linkedDocket = DocketEngine.items.find(d => d.backlogId === id || d.id === 'dkt_bkl_' + id);
      if (linkedDocket && !linkedDocket.completed) {
        DocketEngine.finalizeVanish(linkedDocket.id, true);
      }
    }

    const row = typeof document !== 'undefined' ? document.querySelector(`.backlog-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-vanished');
      setTimeout(() => {
        this.render();
      }, 350);
    } else {
      this.render();
    }
  },

  restoreItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.completed = false;
    item.completedAt = null;
    this.save();
    this.render();

    // If due today, restore in Today's Docket as well
    if (typeof DocketEngine !== 'undefined' && typeof DocketEngine.syncBacklogsDueToday === 'function') {
      DocketEngine.syncBacklogsDueToday();
    }

    if (typeof showToast === 'function') {
      showToast('Moved back to Active Backlogs: ' + item.objective, 'success');
    }
  },

  // ════════════════════════════════════════════════════════════
  // 📋 CRUD & SEVERITY DROPDOWN
  // ════════════════════════════════════════════════════════════

  addItem({ objective, group, severity, dueDate }) {
    if (!objective || !objective.trim()) {
      if (typeof showToast === 'function') showToast('Objective name cannot be empty', 'error');
      return null;
    }

    const todayStr = this.getTodayStr();
    const assignedGroup = group && BACKLOG_GROUPS[group] ? group : (this.activeGroup !== 'all' ? this.activeGroup : 'work');

    const newItem = {
      id: 'bkl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      objective: objective.trim(),
      group: assignedGroup,
      severity: severity && BACKLOG_SEVERITIES[severity] ? severity : 'low',
      createdAt: todayStr,
      dueDate: dueDate || null,
      completed: false,
      completedAt: null
    };

    this.items.unshift(newItem);
    this.save();
    this.showInlineForm = false;
    this.render();

    // If due date is today, automatically sync into Today's Docket
    if (typeof DocketEngine !== 'undefined' && typeof DocketEngine.syncBacklogsDueToday === 'function') {
      DocketEngine.syncBacklogsDueToday();
    }

    if (typeof showToast === 'function') {
      if (newItem.dueDate === todayStr) {
        showToast('Added to backlogs & Today\'s Docket: ' + newItem.objective, 'success');
      } else {
        showToast('Added to backlogs: ' + newItem.objective, 'success');
      }
    }
    return newItem;
  },

  deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    // If currently deleting, clicking again cancels / retrieves it
    if (this.pendingDeletions[id]) {
      this.cancelDelete(id);
      return;
    }

    // Cancel completion vanish if pending
    if (this.pendingVanishes[id]) {
      this.cancelVanish(id);
    }

    // Start 5-second retrieval countdown with live per-second label updates
    let remaining = 5;
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
      } else {
        const retrieveBtnText = typeof document !== 'undefined' ? document.querySelector(`.backlog-row[data-id="${id}"] .btn-retrieve-undo span`) : null;
        if (retrieveBtnText) {
          retrieveBtnText.textContent = `Retrieve (${remaining}s)`;
        }
      }
    }, 1000);

    const timer = setTimeout(() => {
      this.finalizeDelete(id);
    }, 5000);

    this.pendingDeletions[id] = {
      timer,
      interval,
      startTime: Date.now()
    };

    // Update row visual state immediately
    const row = typeof document !== 'undefined' ? document.querySelector(`.backlog-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-deleting');
      const actionCell = row.querySelector('.col-actions');
      if (actionCell) {
        actionCell.innerHTML = `
          <button class="btn-retrieve-undo" onclick="BacklogEngine.cancelDelete('${id}')" title="Retrieve deleted objective">
            <i data-lucide="rotate-ccw"></i>
            <span>Retrieve (5s)</span>
          </button>
        `;
      }
      const objCell = row.querySelector('.objective-cell');
      if (objCell) {
        const existingBar = objCell.querySelector('.delete-progress-bar');
        if (!existingBar) {
          const progressBar = document.createElement('div');
          progressBar.className = 'vanish-progress-bar delete-progress-bar';
          objCell.appendChild(progressBar);
        }
      }
    }

    if (typeof showToast === 'function') {
      showToast('Deleting objective in 5s... Tap Retrieve to cancel.', 'warning');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  cancelDelete(id) {
    if (this.pendingDeletions[id]) {
      clearTimeout(this.pendingDeletions[id].timer);
      if (this.pendingDeletions[id].interval) {
        clearInterval(this.pendingDeletions[id].interval);
      }
      delete this.pendingDeletions[id];
    }
    const item = this.items.find(i => i.id === id);
    this.renderTable();
    if (typeof showToast === 'function' && item) {
      showToast('Retrieved objective: ' + item.objective, 'success');
    }
  },

  finalizeDelete(id, isSync = false) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    if (this.pendingDeletions[id]) {
      clearTimeout(this.pendingDeletions[id].timer);
      if (this.pendingDeletions[id].interval) {
        clearInterval(this.pendingDeletions[id].interval);
      }
      delete this.pendingDeletions[id];
    }

    const row = typeof document !== 'undefined' ? document.querySelector(`.backlog-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-vanished');
      setTimeout(() => {
        this.items = this.items.filter(i => i.id !== id);
        this.save();
        this.render();
      }, 350);
    } else {
      this.items = this.items.filter(i => i.id !== id);
      this.save();
      this.render();
    }

    // Two-way sync: If linked docket task exists, delete it too!
    if (!isSync && typeof DocketEngine !== 'undefined' && Array.isArray(DocketEngine.items)) {
      const linkedDocket = DocketEngine.items.find(d => d.backlogId === id || d.id === 'dkt_bkl_' + id);
      if (linkedDocket) {
        DocketEngine.finalizeDelete(linkedDocket.id, true);
      }
    }

    if (typeof showToast === 'function') {
      showToast('Objective permanently deleted', 'info');
    }
  },

  updateField(id, field, value) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item[field] = value;
    this.save();
    this.render();

    // Two-way sync: Sync with Today's Docket if dueDate, objective, or severity changed
    if (typeof DocketEngine !== 'undefined' && typeof DocketEngine.syncBacklogsDueToday === 'function') {
      DocketEngine.syncBacklogsDueToday();
    }

    if (field === 'severity' && typeof showToast === 'function') {
      const sevMeta = BACKLOG_SEVERITIES[value] || BACKLOG_SEVERITIES.low;
      showToast(`Severity updated to ${sevMeta.label}`, 'info');
    }
    if (field === 'group' && typeof showToast === 'function') {
      const groupMeta = BACKLOG_GROUPS[value] || { label: value };
      showToast(`Moved to ${groupMeta.label} group`, 'info');
    }
    if (field === 'dueDate' && typeof showToast === 'function') {
      const todayStr = this.getTodayStr();
      if (value === todayStr) {
        showToast('Due today! Automatically added to Today\'s Docket 🌅', 'success');
      }
    }
  },

  updateInlineGroupPill(groupKey) {
    const pill = document.getElementById('inline-group-pill');
    const meta = BACKLOG_GROUPS[groupKey];
    if (pill && meta) {
      pill.style.setProperty('--group-color', meta.color);
      pill.style.setProperty('--group-bg', meta.bg);
    }
  },

  toggleInlineForm(force) {
    this.showInlineForm = typeof force === 'boolean' ? force : !this.showInlineForm;
    this.renderTable();
    if (this.showInlineForm) {
      setTimeout(() => {
        const input = document.getElementById('inline-add-objective');
        if (input) input.focus();
        this.updateTableScrollIndicator();
        const panel = document.getElementById('backlog-scroll-bar-panel');
        if (panel) {
          panel.classList.add('pulse-highlight');
          setTimeout(() => panel.classList.remove('pulse-highlight'), 1800);
        }
      }, 50);
    }
  },

  getStats() {
    const total = this.items.length;
    const completed = this.items.filter(i => i.completed).length;
    const open = total - completed;
    const highSev = this.items.filter(i => !i.completed && i.severity === 'high').length;
    
    // Check overdue
    const today = new Date().toISOString().split('T')[0];
    const overdue = this.items.filter(i => !i.completed && i.dueDate && i.dueDate < today).length;

    // Counts per group
    const counts = { all: this.isCompletedView() ? completed : open };
    Object.keys(BACKLOG_GROUPS).forEach(k => {
      counts[k] = this.items.filter(i => (this.isCompletedView() ? i.completed : !i.completed) && i.group === k).length;
    });

    return { total, completed, open, highSev, overdue, counts };
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  render() {
    if (typeof document === 'undefined') return;
    this.renderStats();
    this.renderFilters();
    this.renderTable();
    this.updateHeaderSortIndicators();
    this.renderSortBadge();
    this.updateTableScrollIndicator();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderStats() {
    const stats = this.getStats();

    const elTotal = document.getElementById('stat-backlog-total');
    if (elTotal) elTotal.textContent = stats.total;

    const elOpen = document.getElementById('stat-backlog-open');
    if (elOpen) elOpen.textContent = stats.open;

    const elHigh = document.getElementById('stat-backlog-high');
    if (elHigh) elHigh.textContent = stats.highSev;

    const elOverdue = document.getElementById('stat-backlog-overdue');
    if (elOverdue) elOverdue.textContent = stats.overdue;

    // Completed Backlogs Page Button on backlogs.html:
    // Only visible when completed tasks exist!
    const elCompletedBtn = document.getElementById('btn-completed-backlogs');
    const elCompletedCount = document.getElementById('completed-count-badge');
    if (elCompletedBtn) {
      if (stats.completed > 0) {
        elCompletedBtn.style.display = 'inline-flex';
        if (elCompletedCount) elCompletedCount.textContent = stats.completed;
      } else {
        elCompletedBtn.style.display = 'none';
      }
    }
  },

  renderFilters() {
    const stats = this.getStats();
    const filterContainer = document.getElementById('backlog-filter-pills');
    if (!filterContainer) return;

    const groupsList = [
      { key: 'all', label: 'All Groups', icon: 'layers', color: '#3b82f6' },
      ...Object.values(BACKLOG_GROUPS)
    ];

    filterContainer.innerHTML = groupsList.map(g => {
      const isActive = this.activeGroup === g.key;
      const count = stats.counts[g.key] || 0;
      return `
        <button class="backlog-pill ${isActive ? 'active-bold' : ''}" 
                data-group="${g.key}" 
                style="--group-accent: ${g.color || '#3b82f6'};"
                onclick="BacklogEngine.setGroupFilter('${g.key}')"
                title="Filter by ${g.label}">
          <i data-lucide="${g.icon || 'folder'}" class="backlog-pill-icon"></i>
          <span class="backlog-pill-text">${g.label}</span>
          <span class="backlog-pill-count">${count}</span>
        </button>
      `;
    }).join('');

    // Update scroll arrows and bind gestures if not yet done
    this.bindFilterScrollGestures();
    setTimeout(() => {
      this.updateFilterScrollArrows();
    }, 50);
  },

  renderTable() {
    const tbody = document.getElementById('backlog-table-body');
    const emptyState = document.getElementById('backlog-empty-state');
    if (!tbody) return;

    const items = this.getSortedAndFilteredItems();
    const today = new Date().toISOString().split('T')[0];
    const isCompleted = this.isCompletedView();

    if (items.length === 0 && !this.showInlineForm) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = items.map((item, idx) => {
      const sev = BACKLOG_SEVERITIES[item.severity] || BACKLOG_SEVERITIES.low;
      const groupMeta = BACKLOG_GROUPS[item.group] || BACKLOG_GROUPS.work;
      const isOverdue = !item.completed && item.dueDate && item.dueDate < today;
      const isPending = !!this.pendingVanishes[item.id];
      const isDeleting = !!this.pendingDeletions[item.id];

      return `
        <tr class="backlog-row ${item.completed ? 'row-completed' : ''} ${isPending ? 'row-completing' : ''} ${isDeleting ? 'row-deleting' : ''}" data-id="${item.id}">
          <!-- Col 1: Done Checkbox (Starts 5s Vanish) or Restore Checkbox on Completed page -->
          <td class="col-select">
            ${isCompleted ? `
              <label class="backlog-checkbox-wrap" title="Click to restore to active backlogs">
                <input type="checkbox" 
                       class="backlog-done-checkbox" 
                       checked 
                       ${isDeleting ? 'disabled' : ''}
                       onchange="BacklogEngine.restoreItem('${item.id}')">
                <span class="backlog-custom-box checked"></span>
              </label>
            ` : `
              <label class="backlog-checkbox-wrap" title="Mark Done (Moves to Completed Backlogs in 5s)">
                <input type="checkbox" 
                       class="backlog-done-checkbox" 
                       ${isPending ? 'checked' : ''} 
                       ${isDeleting ? 'disabled' : ''}
                       onchange="BacklogEngine.markDoneWithCountdown('${item.id}')">
                <span class="backlog-custom-box"></span>
              </label>
            `}
          </td>

          <!-- Col 2: Objective Name (Inline Editable on Active Page) -->
          <td class="col-objective">
            <div class="objective-cell">
              <span class="objective-text ${item.completed ? 'completed-text' : ''}" 
                    contenteditable="${!isCompleted && !isPending && !isDeleting}"
                    spellcheck="false"
                    onblur="BacklogEngine.updateField('${item.id}', 'objective', this.textContent.trim())"
                    onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
                ${item.objective}
              </span>
              ${isPending ? '<div class="vanish-progress-bar"></div>' : ''}
              ${isDeleting ? '<div class="vanish-progress-bar delete-progress-bar"></div>' : ''}
            </div>
          </td>

          <!-- Col 3: Group Dropdown Pill -->
          <td class="col-group">
            <div class="group-select-pill" style="--group-color: ${groupMeta ? groupMeta.color : '#3b82f6'}; --group-bg: ${groupMeta ? groupMeta.bg : 'rgba(59, 130, 246, 0.12)'};">
              <span class="group-dot"></span>
              <select class="group-dropdown" 
                      aria-label="Objective group"
                      ${isDeleting ? 'disabled' : ''}
                      onchange="BacklogEngine.updateField('${item.id}', 'group', this.value)">
                ${Object.values(BACKLOG_GROUPS).map(g => `
                  <option value="${g.key}" ${item.group === g.key ? 'selected' : ''}>${g.label}</option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="group-arrow-icon"></i>
            </div>
          </td>

          <!-- Col 4: Created / Completed Date -->
          <td class="col-created">
            <span class="date-chip created-chip" title="${isCompleted ? 'Completed date' : 'Created date'}">
              <i data-lucide="${isCompleted ? 'check-circle' : 'calendar'}" class="date-chip-icon"></i>
              ${isCompleted ? this.formatDate(item.completedAt ? item.completedAt.split('T')[0] : item.createdAt) : this.formatDate(item.createdAt)}
            </span>
          </td>

          <!-- Col 4: Severity Dropdown (Works on mobile touch & desktop) -->
          <td class="col-severity">
            <div class="severity-select-pill sev-${sev.key}" style="--sev-color: ${sev.color}; --sev-bg: ${sev.bg}; --sev-border: ${sev.border};">
              <span class="sev-dot"></span>
              <select class="severity-dropdown" 
                      aria-label="Severity level"
                      ${isDeleting ? 'disabled' : ''}
                      onchange="BacklogEngine.updateField('${item.id}', 'severity', this.value)">
                <option value="low" ${item.severity === 'low' ? 'selected' : ''}>Low</option>
                <option value="moderate" ${item.severity === 'moderate' ? 'selected' : ''}>Moderate</option>
                <option value="high" ${item.severity === 'high' ? 'selected' : ''}>High</option>
              </select>
              <i data-lucide="chevron-down" class="sev-arrow-icon"></i>
            </div>
          </td>

          <!-- Col 5: Estimated End Date -->
          <td class="col-due">
            <div class="due-cell ${isOverdue ? 'is-overdue' : ''}">
              <input type="date" 
                     class="due-date-input" 
                     value="${item.dueDate || ''}" 
                     ${isCompleted || isDeleting ? 'disabled' : ''}
                     onchange="BacklogEngine.updateField('${item.id}', 'dueDate', this.value)">
              ${isOverdue ? '<span class="overdue-tag" title="Past due date">Overdue</span>' : ''}
            </div>
          </td>

          <!-- Col 6: Actions (Retrieve during delete countdown, Undo during vanish countdown, Restore, Delete) -->
          <td class="col-actions">
            ${isDeleting ? `
              <button class="btn-retrieve-undo" onclick="BacklogEngine.cancelDelete('${item.id}')" title="Retrieve deleted objective">
                <i data-lucide="rotate-ccw"></i>
                <span>Retrieve (5s)</span>
              </button>
            ` : isPending ? `
              <button class="btn-vanish-undo" onclick="BacklogEngine.cancelVanish('${item.id}')" title="Undo completion">
                <i data-lucide="rotate-ccw"></i>
                <span>Undo (5s)</span>
              </button>
            ` : isCompleted ? `
              <div class="completed-actions-row">
                <button class="btn-restore-item" onclick="BacklogEngine.restoreItem('${item.id}')" title="Restore to active backlogs">
                  <i data-lucide="rotate-ccw"></i>
                  <span>Restore</span>
                </button>
                <button class="backlog-delete-btn" onclick="BacklogEngine.deleteItem('${item.id}')" title="Delete permanently (5s undo)">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            ` : `
              <button class="backlog-delete-btn" onclick="BacklogEngine.deleteItem('${item.id}')" title="Delete objective (5s undo)">
                <i data-lucide="trash-2"></i>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');

    // Inline Creation Row (Active Page only)
    if (this.showInlineForm && !isCompleted) {
      const today = new Date().toISOString().split('T')[0];
      const defaultGroupKey = this.activeGroup !== 'all' ? this.activeGroup : 'work';
      const defaultGroupMeta = BACKLOG_GROUPS[defaultGroupKey] || BACKLOG_GROUPS.work;

      html += `
        <tr class="backlog-inline-add-row" id="inline-add-row">
          <td class="col-select">
            <span class="inline-add-badge">+</span>
          </td>
          <td class="col-objective">
            <input type="text" 
                   id="inline-add-objective" 
                   class="inline-input-text" 
                   placeholder="Enter objective name and press Enter..." 
                   autocomplete="off"
                   onkeydown="if(event.key==='Enter') BacklogEngine.submitInlineAdd(); if(event.key==='Escape') BacklogEngine.toggleInlineForm(false);">
          </td>
          <td class="col-group">
            <div class="group-select-pill" id="inline-group-pill" style="--group-color: ${defaultGroupMeta.color}; --group-bg: ${defaultGroupMeta.bg};">
              <span class="group-dot"></span>
              <select id="inline-add-group" class="group-dropdown" aria-label="Select objective group" onchange="BacklogEngine.updateInlineGroupPill(this.value)">
                ${Object.values(BACKLOG_GROUPS).map(g => `
                  <option value="${g.key}" ${defaultGroupKey === g.key ? 'selected' : ''}>
                    ${g.label}
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="group-arrow-icon"></i>
            </div>
          </td>
          <td class="col-created">
            <span class="date-chip created-chip">
              <i data-lucide="calendar" class="date-chip-icon"></i>
              ${this.formatDate(today)}
            </span>
          </td>
          <td class="col-severity">
            <div class="severity-select-pill sev-low" style="--sev-color: #10b981; --sev-bg: rgba(16, 185, 129, 0.14); --sev-border: rgba(16, 185, 129, 0.28);">
              <span class="sev-dot"></span>
              <select id="inline-add-severity" class="severity-dropdown" aria-label="Severity level">
                <option value="low" selected>Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
              <i data-lucide="chevron-down" class="sev-arrow-icon"></i>
            </div>
          </td>
          <td class="col-due">
            <input type="date" id="inline-add-due" class="due-date-input">
          </td>
          <td class="col-actions">
            <div class="inline-actions-btns">
              <button class="btn-inline-submit" onclick="BacklogEngine.submitInlineAdd()" title="Save Objective">
                <i data-lucide="check"></i>
              </button>
              <button class="btn-inline-cancel" onclick="BacklogEngine.toggleInlineForm(false)" title="Cancel">
                <i data-lucide="x"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = html;
    this.updateHeaderSortIndicators();
    this.renderSortBadge();
    this.updateTableScrollIndicator();
  },

  submitInlineAdd() {
    const input = document.getElementById('inline-add-objective');
    const groupSelect = document.getElementById('inline-add-group');
    const sevSelect = document.getElementById('inline-add-severity');
    const dueInput = document.getElementById('inline-add-due');

    if (!input || !input.value.trim()) {
      if (typeof showToast === 'function') showToast('Please enter an objective title', 'error');
      if (input) input.focus();
      return;
    }

    const assignedGroup = groupSelect && groupSelect.value ? groupSelect.value : (this.activeGroup !== 'all' ? this.activeGroup : 'work');

    const newItem = this.addItem({
      objective: input.value,
      group: assignedGroup,
      severity: sevSelect ? sevSelect.value : 'low',
      dueDate: dueInput && dueInput.value ? dueInput.value : null
    });

    if (newItem) {
      // Automatically land on the assigned group's page as requested
      this.setGroupFilter(assignedGroup);
    }
  }
};

// Expose globally on window
if (typeof window !== 'undefined') {
  window.BacklogEngine = BacklogEngine;
  window.BACKLOG_GROUPS = BACKLOG_GROUPS;
  window.BACKLOG_SEVERITIES = BACKLOG_SEVERITIES;
}

// Auto-initialize when DOM ready
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    BacklogEngine.init();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BacklogEngine, BACKLOG_GROUPS, BACKLOG_SEVERITIES };
}

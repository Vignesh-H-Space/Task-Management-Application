/**
 * Tesseract Event & Routine Tracker Engine
 * Multi-date rolling cadence tracker for periodic tasks, hygiene, maintenance & habits.
 */

const TrackerEngine = (() => {
  const STORAGE_KEY = 'tesseract_trackers';

  const DEFAULT_CATEGORIES = [
    { id: 'grooming', label: 'Grooming', icon: 'scissors', color: '#ec4899' },
    { id: 'home', label: 'Home & Living', icon: 'home', color: '#3b82f6' },
    { id: 'vehicle', label: 'Vehicle & Gear', icon: 'wrench', color: '#f59e0b' },
    { id: 'health', label: 'Health & Wellness', icon: 'heart-pulse', color: '#10b981' },
    { id: 'tech', label: 'Tech & Admin', icon: 'laptop', color: '#8b5cf6' },
    { id: 'other', label: 'Other', icon: 'bookmark', color: '#64748b' }
  ];

  const SEED_DATA = [
    {
      id: 'trk-1',
      title: 'Nail cut - hands',
      category: 'grooming',
      targetDays: 7,
      history: ['2026-10-07', '2026-10-01', '2026-09-25'],
      notes: 'Trim and shape finger nails.',
      createdAt: '2026-09-25T10:00:00Z',
      updatedAt: '2026-10-07T12:00:00Z'
    },
    {
      id: 'trk-2',
      title: 'Nail cut - feet',
      category: 'grooming',
      targetDays: 14,
      history: ['2026-10-03', '2026-09-18', '2026-09-04'],
      notes: 'Toenail maintenance and hygiene.',
      createdAt: '2026-09-04T10:00:00Z',
      updatedAt: '2026-10-03T12:00:00Z'
    },
    {
      id: 'trk-3',
      title: 'Haircut & Styling',
      category: 'grooming',
      targetDays: 28,
      history: ['2026-09-20', '2026-08-22', '2026-07-25'],
      notes: 'Fade cut and beard grooming.',
      createdAt: '2026-07-25T10:00:00Z',
      updatedAt: '2026-09-20T12:00:00Z'
    },
    {
      id: 'trk-4',
      title: 'Bedsheets & Pillow Covers Wash',
      category: 'home',
      targetDays: 10,
      history: ['2026-10-05', '2026-09-25', '2026-09-15'],
      notes: 'Hot wash cycle and sun dry.',
      createdAt: '2026-09-15T10:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z'
    },
    {
      id: 'trk-5',
      title: 'AC Air Filter Cleaning',
      category: 'home',
      targetDays: 30,
      history: ['2026-09-28', '2026-08-29', '2026-07-30'],
      notes: 'Rinse mesh filters and dry before refitting.',
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-09-28T12:00:00Z'
    },
    {
      id: 'trk-6',
      title: 'Car Oil & Fluid Inspection',
      category: 'vehicle',
      targetDays: 90,
      history: ['2026-08-15', '2026-05-18', '2026-02-20'],
      notes: 'Check engine oil dipstick, coolant level, and brake fluid.',
      createdAt: '2026-02-20T10:00:00Z',
      updatedAt: '2026-08-15T12:00:00Z'
    },
    {
      id: 'trk-7',
      title: 'Water Purifier Filter Flush',
      category: 'home',
      targetDays: 60,
      history: ['2026-08-01', '2026-06-02', '2026-04-05'],
      notes: 'RO pre-filter candle sediment flush.',
      createdAt: '2026-04-05T10:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z'
    }
  ];

  // Internal state
  let trackers = [];
  let filterCategory = 'all';
  let filterStatus = 'all';
  let searchQuery = '';
  let sortBy = 'overdue'; // 'overdue' | 'recent' | 'name' | 'cadence'
  let activeHistoryTrackerId = null;

  /* ----------------- Storage Helpers ----------------- */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        trackers = JSON.parse(JSON.stringify(SEED_DATA));
        saveData(false);
      } else {
        trackers = JSON.parse(raw);
        if (!Array.isArray(trackers) || trackers.length === 0) {
          trackers = JSON.parse(JSON.stringify(SEED_DATA));
          saveData(false);
        }
      }
    } catch (e) {
      console.error('TrackerEngine: Failed to load data', e);
      trackers = JSON.parse(JSON.stringify(SEED_DATA));
    }
  }

  function saveData(notifySync = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackers));
      if (notifySync && typeof SyncEngine !== 'undefined' && SyncEngine.pushLocalChange) {
        SyncEngine.pushLocalChange();
      }
    } catch (e) {
      console.error('TrackerEngine: Failed to save data', e);
    }
  }

  /* ----------------- Date & Math Helpers ----------------- */
  function getTodayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '—';
    const d = parseDate(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  function formatDisplayDDMMYYYY(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  function daysBetween(earlyStr, lateStr) {
    const d1 = parseDate(earlyStr);
    const d2 = parseDate(lateStr);
    if (!d1 || !d2) return null;
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function daysSince(dateStr) {
    const today = getTodayStr();
    return daysBetween(dateStr, today);
  }

  function calculateCadenceMetrics(tracker) {
    const history = (tracker.history || []).filter(Boolean);
    const recent = history[0] || null;
    const prev = history[1] || null;
    const prior = history[2] || null;

    const daysAgo = recent ? daysSince(recent) : null;

    // Calculate intervals
    const interval1 = (recent && prev) ? daysBetween(prev, recent) : null;
    const interval2 = (prev && prior) ? daysBetween(prior, prev) : null;

    // Average interval
    const validIntervals = [interval1, interval2].filter(v => typeof v === 'number' && v > 0);
    const avgInterval = validIntervals.length > 0
      ? Math.round(validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length)
      : (tracker.targetDays || null);

    // Target frequency
    const target = tracker.targetDays || avgInterval;

    // Determine status
    let status = 'ontrack'; // 'ontrack' | 'duesoon' | 'overdue' | 'nodata'
    let statusLabel = 'On Track';
    let statusClass = 'status-ontrack';

    if (!recent) {
      status = 'nodata';
      statusLabel = 'No Dates';
      statusClass = 'status-nodata';
    } else if (target) {
      if (daysAgo > target) {
        status = 'overdue';
        const diff = daysAgo - target;
        statusLabel = diff === 1 ? '1 day overdue' : `${diff} days overdue`;
        statusClass = 'status-overdue';
      } else if (daysAgo >= Math.max(1, target - 2)) {
        status = 'duesoon';
        const remaining = target - daysAgo;
        statusLabel = remaining === 0 ? 'Due Today' : `Due in ${remaining}d`;
        statusClass = 'status-duesoon';
      } else {
        status = 'ontrack';
        statusLabel = `On Track (${daysAgo}d ago)`;
        statusClass = 'status-ontrack';
      }
    } else {
      status = 'ontrack';
      statusLabel = `${daysAgo}d ago`;
      statusClass = 'status-ontrack';
    }

    return {
      recent,
      prev,
      prior,
      daysAgo,
      interval1,
      interval2,
      avgInterval,
      target,
      status,
      statusLabel,
      statusClass
    };
  }

  /* ----------------- Core Operations ----------------- */
  function getTrackers() {
    return trackers;
  }

  function addTracker(item) {
    const newItem = {
      id: 'trk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title: (item.title || 'Untitled Routine').trim(),
      category: item.category || 'other',
      targetDays: item.targetDays ? parseInt(item.targetDays, 10) : null,
      history: Array.isArray(item.history) ? cleanAndSortHistory(item.history) : [],
      notes: (item.notes || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    trackers.unshift(newItem);
    saveData();
    render();
    showToast(`Added routine "${newItem.title}"`);
    return newItem;
  }

  function updateTracker(id, updates) {
    const index = trackers.findIndex(t => t.id === id);
    if (index === -1) return null;

    if (updates.history) {
      updates.history = cleanAndSortHistory(updates.history);
    }
    updates.updatedAt = new Date().toISOString();

    trackers[index] = { ...trackers[index], ...updates };
    saveData();
    render();
    showToast('Routine updated');
    return trackers[index];
  }

  function deleteTracker(id) {
    const item = trackers.find(t => t.id === id);
    if (!item) return;
    if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
      trackers = trackers.filter(t => t.id !== id);
      saveData();
      render();
      showToast(`Deleted "${item.title}"`);
    }
  }

  function cleanAndSortHistory(dates) {
    return Array.from(new Set(dates.filter(Boolean)))
      .sort((a, b) => b.localeCompare(a));
  }

  /**
   * Log completion for today
   */
  function logToday(id) {
    const item = trackers.find(t => t.id === id);
    if (!item) return;

    const today = getTodayStr();
    let history = Array.isArray(item.history) ? [...item.history] : [];

    if (history[0] === today) {
      showToast(`"${item.title}" is already logged for today!`, 'info');
      return;
    }

    // Add today to the start of history
    history = cleanAndSortHistory([today, ...history]);
    item.history = history;
    item.updatedAt = new Date().toISOString();

    saveData();
    render();

    // Trigger celebratory confetti
    if (typeof confetti === 'function') {
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {}
    }

    showToast(`⚡ Logged "${item.title}" for today! Dates shifted forward.`);
  }

  let lastShiftedId = null;

  /**
   * Update a specific date cell in history (Col 2 = idx 0, Col 3 = idx 1, Col 4 = idx 2)
   * When index === 0 (Recent Date) and !isDirectEdit:
   * Dynamic Shift:
   *   Col 2 (Recent) moves to Col 3 (Previous)
   *   Col 3 (Previous) moves to Col 4 (Prior)
   *   Col 4 (Prior) vanishes from view into background history
   */
  function updateDateCell(id, index, newDateStr, isDirectEdit = false) {
    const item = trackers.find(t => t.id === id);
    if (!item) return;

    let history = Array.isArray(item.history) ? [...item.history] : [];

    if (!newDateStr) {
      // Remove date if emptied
      if (index < history.length) {
        history.splice(index, 1);
      }
      item.history = cleanAndSortHistory(history);
      item.updatedAt = new Date().toISOString();
      saveData();
      render();
      showToast(`Cleared date for "${item.title}"`);
      return;
    }

    if (index === 0 && !isDirectEdit) {
      // Dynamic shift when Recent Date (Col 2) is updated:
      const oldRecent = history[0] || null;
      if (newDateStr === oldRecent) return; // No change

      const oldPrev = history[1] || null;
      const oldPrior = history[2] || null;

      // Filter out newDateStr if already present in history
      history = history.filter(d => d !== newDateStr);

      // Prepend new completion date to front:
      // index 0 -> newDateStr (Col 2)
      // index 1 -> oldRecent (Col 3, shifted right!)
      // index 2 -> oldPrev (Col 4, shifted right!)
      // index 3 -> oldPrior (vanishes from the 3 visible columns into background history!)
      history.unshift(newDateStr);

      item.history = history;
      item.updatedAt = new Date().toISOString();
      lastShiftedId = id;
      saveData();
      render();

      if (typeof confetti === 'function') {
        try {
          confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
        } catch(e) {}
      }

      const oldRecFmt = oldRecent ? formatDisplayDDMMYYYY(oldRecent) : 'None';
      const newRecFmt = formatDisplayDDMMYYYY(newDateStr);
      const oldPriorFmt = oldPrior ? ` (${formatDisplayDDMMYYYY(oldPrior)} moved to history)` : '';

      showToast(`⚡ Dynamic Shift Applied: Recent is ${newRecFmt} ➔ ${oldRecFmt} moved to Previous Date${oldPriorFmt}.`);

      setTimeout(() => {
        if (lastShiftedId === id) {
          lastShiftedId = null;
          const row = document.querySelector(`.tracker-table-row[data-id="${id}"]`);
          if (row) row.classList.remove('row-just-shifted');
        }
      }, 2500);
      return;
    }

    // Direct edit for Col 3, Col 4, or manual correction
    while (history.length <= index) {
      history.push('');
    }
    history[index] = newDateStr;
    item.history = history;
    item.updatedAt = new Date().toISOString();
    lastShiftedId = id;
    saveData();
    render();
    showToast(`Updated date for "${item.title}"`);
  }

  /* ----------------- Category & Styling Lookups ----------------- */
  function getCategoryMeta(catId) {
    return DEFAULT_CATEGORIES.find(c => c.id === catId) || {
      id: 'other',
      label: 'Other',
      icon: 'bookmark',
      color: '#64748b'
    };
  }

  /* ----------------- Stats Calculation ----------------- */
  function computeStats() {
    const total = trackers.length;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let doneThisWeekCount = 0;

    trackers.forEach(t => {
      const metrics = calculateCadenceMetrics(t);
      if (metrics.status === 'overdue') overdueCount++;
      if (metrics.status === 'duesoon') dueSoonCount++;
      if (metrics.daysAgo !== null && metrics.daysAgo <= 7) doneThisWeekCount++;
    });

    return { total, overdueCount, dueSoonCount, doneThisWeekCount };
  }

  /* ----------------- Rendering ----------------- */
  function renderStatsStrip() {
    const mount = document.getElementById('tracker-stats-strip');
    if (!mount) return;

    const stats = computeStats();

    mount.innerHTML = `
      <div class="tracker-stat-card">
        <div class="tracker-stat-icon-wrap" style="background: rgba(59, 130, 246, 0.12); color: var(--accent-primary);">
          <i data-lucide="layers"></i>
        </div>
        <div class="tracker-stat-info">
          <span class="tracker-stat-value">${stats.total}</span>
          <span class="tracker-stat-label">Total Routines</span>
        </div>
      </div>

      <div class="tracker-stat-card">
        <div class="tracker-stat-icon-wrap" style="background: rgba(239, 68, 68, 0.12); color: #ef4444;">
          <i data-lucide="alert-circle"></i>
        </div>
        <div class="tracker-stat-info">
          <span class="tracker-stat-value" style="color: ${stats.overdueCount > 0 ? '#ef4444' : 'inherit'};">${stats.overdueCount}</span>
          <span class="tracker-stat-label">Overdue</span>
        </div>
      </div>

      <div class="tracker-stat-card">
        <div class="tracker-stat-icon-wrap" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b;">
          <i data-lucide="clock"></i>
        </div>
        <div class="tracker-stat-info">
          <span class="tracker-stat-value">${stats.dueSoonCount}</span>
          <span class="tracker-stat-label">Due Soon</span>
        </div>
      </div>

      <div class="tracker-stat-card">
        <div class="tracker-stat-icon-wrap" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">
          <i data-lucide="check-check"></i>
        </div>
        <div class="tracker-stat-info">
          <span class="tracker-stat-value">${stats.doneThisWeekCount}</span>
          <span class="tracker-stat-label">Done This Week</span>
        </div>
      </div>
    `;
  }

  function getFilteredAndSortedTrackers() {
    let result = [...trackers];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter(t => t.category === filterCategory);
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(t => {
        const m = calculateCadenceMetrics(t);
        return m.status === filterStatus;
      });
    }

    // Sorting
    result.sort((a, b) => {
      const mA = calculateCadenceMetrics(a);
      const mB = calculateCadenceMetrics(b);

      if (sortBy === 'overdue') {
        const prio = { overdue: 3, duesoon: 2, ontrack: 1, nodata: 0 };
        const diffPrio = (prio[mB.status] || 0) - (prio[mA.status] || 0);
        if (diffPrio !== 0) return diffPrio;
        return (mB.daysAgo || 0) - (mA.daysAgo || 0);
      } else if (sortBy === 'recent') {
        return (mA.daysAgo || 999) - (mB.daysAgo || 999);
      } else if (sortBy === 'name') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'target') {
        return (a.targetDays || 999) - (b.targetDays || 999);
      }
      return 0;
    });

    return result;
  }

  function renderTable() {
    const mount = document.getElementById('tracker-table-mount');
    if (!mount) return;

    const list = getFilteredAndSortedTrackers();
    const todayStr = getTodayStr();

    if (list.length === 0) {
      mount.innerHTML = `
        <div class="tracker-empty-state">
          <div class="tracker-empty-icon">
            <i data-lucide="calendar-off"></i>
          </div>
          <h3>No matching routines found</h3>
          <p>Try clearing filters or click "+ Add Routine" to create a new routine tracker.</p>
          <button class="btn-create-tracker" onclick="TrackerEngine.openAddModal()">
            <i data-lucide="plus"></i> Add Routine
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    let rowsHTML = '';
    list.forEach(t => {
      const m = calculateCadenceMetrics(t);
      const cat = getCategoryMeta(t.category);
      const isDoneToday = m.recent === todayStr;

      // Col 2: Most Recent
      const recentVal = m.recent || '';
      const recentText = m.recent ? formatDisplayDDMMYYYY(m.recent) : 'Set Date';
      const recentRel = m.recent
        ? (m.daysAgo === 0 ? 'Today' : m.daysAgo === 1 ? 'Yesterday' : `${m.daysAgo}d ago`)
        : 'Not set';

      // Col 3: Previous Date
      const prevVal = m.prev || '';
      const prevText = m.prev ? formatDisplayDDMMYYYY(m.prev) : 'Set Date';
      const prevGap = m.interval1 !== null ? `+${m.interval1}d gap` : '—';

      // Col 4: Prior Date
      const priorVal = m.prior || '';
      const priorText = m.prior ? formatDisplayDDMMYYYY(m.prior) : 'Set Date';
      const priorGap = m.interval2 !== null ? `+${m.interval2}d gap` : '—';

      // Cadence summary
      const cadenceText = t.targetDays
        ? `Target: Every ${t.targetDays}d`
        : (m.avgInterval ? `Avg: ~${m.avgInterval}d` : 'No cadence');

      rowsHTML += `
        <tr class="tracker-table-row ${t.id === lastShiftedId ? 'row-just-shifted' : ''}" data-id="${t.id}">
          <!-- Col 1: Event / Routine -->
          <td class="col-event">
            <div class="tracker-event-cell">
              <div class="tracker-event-main">
                <span class="tracker-event-title" title="${t.title}">${escapeHTML(t.title)}</span>
                <div class="tracker-event-badges">
                  <span class="tracker-cat-pill" style="--cat-color: ${cat.color};">
                    <i data-lucide="${cat.icon}" class="tracker-cat-icon"></i>
                    ${cat.label}
                  </span>
                  ${t.targetDays ? `<span class="tracker-target-pill"><i data-lucide="repeat"></i> ${t.targetDays}d cycle</span>` : ''}
                </div>
              </div>
              ${t.notes ? `<div class="tracker-event-notes" title="${escapeHTML(t.notes)}">${escapeHTML(t.notes)}</div>` : ''}
            </div>
          </td>

          <!-- Col 2: Most Recent (Calendar Selectable & Dynamic Auto-Shift) -->
          <td class="col-date col-recent">
            <div class="tracker-date-widget col-recent-widget ${m.recent ? 'has-date' : 'empty-date'}" title="Pick new date to dynamically shift: Col 2 ➔ Col 3 ➔ Col 4">
              <label class="tracker-date-btn">
                <i data-lucide="calendar" class="tracker-cal-icon"></i>
                <div class="tracker-date-text-wrap">
                  <div class="tracker-date-val-row">
                    <span class="tracker-date-val">${recentText}</span>
                    <span class="tracker-shift-arrow-tag" title="Auto-shifts right on change">➔</span>
                  </div>
                  <span class="tracker-date-sub recent-sub">${recentRel}</span>
                </div>
                <input type="date" 
                       class="tracker-native-date-input" 
                       value="${recentVal}" 
                       max="${todayStr}"
                       onchange="TrackerEngine.handleDateCellChange('${t.id}', 0, this.value)">
              </label>
            </div>
          </td>

          <!-- Col 3: Previous Date (Calendar Selectable) -->
          <td class="col-date col-prev">
            <div class="tracker-date-widget ${m.prev ? 'has-date' : 'empty-date'}" title="Click to choose or change 2nd last date">
              <label class="tracker-date-btn">
                <i data-lucide="calendar" class="tracker-cal-icon"></i>
                <div class="tracker-date-text-wrap">
                  <span class="tracker-date-val">${prevText}</span>
                  <span class="tracker-date-sub">${prevGap}</span>
                </div>
                <input type="date" 
                       class="tracker-native-date-input" 
                       value="${prevVal}" 
                       onchange="TrackerEngine.handleDateCellChange('${t.id}', 1, this.value)">
              </label>
            </div>
          </td>

          <!-- Col 4: Prior Date (Calendar Selectable) -->
          <td class="col-date col-prior">
            <div class="tracker-date-widget ${m.prior ? 'has-date' : 'empty-date'}" title="Click to choose or change 3rd last date">
              <label class="tracker-date-btn">
                <i data-lucide="calendar" class="tracker-cal-icon"></i>
                <div class="tracker-date-text-wrap">
                  <span class="tracker-date-val">${priorText}</span>
                  <span class="tracker-date-sub">${priorGap}</span>
                </div>
                <input type="date" 
                       class="tracker-native-date-input" 
                       value="${priorVal}" 
                       onchange="TrackerEngine.handleDateCellChange('${t.id}', 2, this.value)">
              </label>
            </div>
          </td>

          <!-- Col 5: Cadence & Status -->
          <td class="col-status">
            <div class="tracker-status-cell">
              <span class="tracker-status-badge ${m.statusClass}">
                <span class="status-dot"></span>
                ${m.statusLabel}
              </span>
              <span class="tracker-cadence-sub">${cadenceText}</span>
            </div>
          </td>

          <!-- Col 6: Actions -->
          <td class="col-actions">
            <div class="tracker-actions-cell">
              <button class="btn-log-today ${isDoneToday ? 'done-today' : ''}" 
                      onclick="TrackerEngine.logToday('${t.id}')"
                      title="${isDoneToday ? 'Completed today!' : 'Record as completed today (shifts older dates)'}">
                <i data-lucide="${isDoneToday ? 'check' : 'zap'}"></i>
                <span>${isDoneToday ? 'Today ✓' : 'Done Today'}</span>
              </button>
              
              <div class="tracker-menu-actions">
                <button class="btn-action-icon btn-action-dynamic" onclick="TrackerEngine.openDynamicUpdaterModal('${t.id}')" title="Dynamic Rolling Updater (Live Preview)">
                  <i data-lucide="zap"></i>
                </button>
                <button class="btn-action-icon" onclick="TrackerEngine.openHistoryModal('${t.id}')" title="Full History Log">
                  <i data-lucide="history"></i>
                </button>
                <button class="btn-action-icon" onclick="TrackerEngine.openEditModal('${t.id}')" title="Edit Routine">
                  <i data-lucide="edit-2"></i>
                </button>
                <button class="btn-action-icon btn-action-delete" onclick="TrackerEngine.deleteTracker('${t.id}')" title="Delete">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    });

    mount.innerHTML = `
      <div class="tracker-table-container">
        <table class="tracker-table">
          <thead>
            <tr>
              <th class="th-event">Event / Task</th>
              <th class="th-date">
                <div class="th-date-content">
                  <span>Most Recent</span>
                  <span class="th-sub">Col 2 • Auto-Shifts ➔</span>
                </div>
              </th>
              <th class="th-date">
                <div class="th-date-content">
                  <span>Previous Date</span>
                  <span class="th-sub">Col 3 • Shifted from Col 2</span>
                </div>
              </th>
              <th class="th-date">
                <div class="th-date-content">
                  <span>Prior Date</span>
                  <span class="th-sub">Col 4 • Shifted from Col 3</span>
                </div>
              </th>
              <th class="th-status">Cadence & Status</th>
              <th class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>

      <!-- Mobile Responsive View (Cards) -->
      <div class="tracker-mobile-cards">
        ${renderMobileCardsHTML(list, todayStr)}
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderMobileCardsHTML(list, todayStr) {
    return list.map(t => {
      const m = calculateCadenceMetrics(t);
      const cat = getCategoryMeta(t.category);
      const isDoneToday = m.recent === todayStr;

      const recentText = m.recent ? formatDisplayDDMMYYYY(m.recent) : 'Set Date';
      const prevText = m.prev ? formatDisplayDDMMYYYY(m.prev) : 'Set Date';
      const priorText = m.prior ? formatDisplayDDMMYYYY(m.prior) : 'Set Date';

      return `
        <div class="tracker-mobile-card" data-id="${t.id}">
          <div class="tracker-m-header">
            <div>
              <div class="tracker-m-title">${escapeHTML(t.title)}</div>
              <div class="tracker-m-badges">
                <span class="tracker-cat-pill" style="--cat-color: ${cat.color};">
                  <i data-lucide="${cat.icon}" class="tracker-cat-icon"></i>
                  ${cat.label}
                </span>
                <span class="tracker-status-badge ${m.statusClass}">
                  <span class="status-dot"></span> ${m.statusLabel}
                </span>
              </div>
            </div>
            <button class="btn-log-today ${isDoneToday ? 'done-today' : ''}" 
                    onclick="TrackerEngine.logToday('${t.id}')">
              <i data-lucide="${isDoneToday ? 'check' : 'zap'}"></i>
              <span>${isDoneToday ? 'Today ✓' : 'Done'}</span>
            </button>
          </div>

          <div class="tracker-m-dates-row">
            <!-- Col 2: Most Recent -->
            <label class="tracker-m-date-item">
              <span class="m-date-lbl">Most Recent <span class="m-shift-tag">➔ Shifts</span></span>
              <span class="m-date-val">${recentText}</span>
              <span class="m-date-sub">${m.recent ? (m.daysAgo === 0 ? 'Today' : `${m.daysAgo}d ago`) : '—'}</span>
              <input type="date" 
                     class="tracker-native-date-input" 
                     value="${m.recent || ''}" 
                     max="${todayStr}"
                     onchange="TrackerEngine.handleDateCellChange('${t.id}', 0, this.value)">
            </label>

            <!-- Col 3: Previous -->
            <label class="tracker-m-date-item">
              <span class="m-date-lbl">Previous</span>
              <span class="m-date-val">${prevText}</span>
              <span class="m-date-sub">${m.interval1 !== null ? `+${m.interval1}d gap` : '—'}</span>
              <input type="date" 
                     class="tracker-native-date-input" 
                     value="${m.prev || ''}" 
                     onchange="TrackerEngine.handleDateCellChange('${t.id}', 1, this.value)">
            </label>

            <!-- Col 4: Prior -->
            <label class="tracker-m-date-item">
              <span class="m-date-lbl">Prior</span>
              <span class="m-date-val">${priorText}</span>
              <span class="m-date-sub">${m.interval2 !== null ? `+${m.interval2}d gap` : '—'}</span>
              <input type="date" 
                     class="tracker-native-date-input" 
                     value="${m.prior || ''}" 
                     onchange="TrackerEngine.handleDateCellChange('${t.id}', 2, this.value)">
            </label>
          </div>

          <div class="tracker-m-footer">
            <span class="tracker-m-cadence">
              <i data-lucide="repeat"></i> ${t.targetDays ? `Target: ${t.targetDays}d` : (m.avgInterval ? `Avg: ~${m.avgInterval}d` : 'No target')}
            </span>
            <div class="tracker-m-actions">
              <button class="btn-action-icon btn-action-dynamic" onclick="TrackerEngine.openDynamicUpdaterModal('${t.id}')" title="Dynamic Rolling Updater">
                <i data-lucide="zap"></i>
              </button>
              <button class="btn-action-icon" onclick="TrackerEngine.openHistoryModal('${t.id}')">
                <i data-lucide="history"></i>
              </button>
              <button class="btn-action-icon" onclick="TrackerEngine.openEditModal('${t.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-action-icon btn-action-delete" onclick="TrackerEngine.deleteTracker('${t.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function handleDateCellChange(id, colIndex, newDate) {
    updateDateCell(id, colIndex, newDate);
  }

  function renderCategoryPills() {
    const mount = document.getElementById('tracker-category-filters');
    if (!mount) return;

    let html = `
      <button class="tracker-filter-chip ${filterCategory === 'all' ? 'active' : ''}" 
              onclick="TrackerEngine.setCategoryFilter('all')">
        <span>All</span>
      </button>
    `;

    DEFAULT_CATEGORIES.forEach(c => {
      html += `
        <button class="tracker-filter-chip ${filterCategory === c.id ? 'active' : ''}" 
                onclick="TrackerEngine.setCategoryFilter('${c.id}')"
                style="--chip-color: ${c.color}">
          <i data-lucide="${c.icon}"></i>
          <span>${c.label}</span>
        </button>
      `;
    });

    mount.innerHTML = html;
  }

  function render() {
    renderStatsStrip();
    renderCategoryPills();
    renderTable();
  }

  /* ----------------- Filter Handlers ----------------- */
  function setCategoryFilter(cat) {
    filterCategory = cat;
    render();
  }

  function setStatusFilter(status) {
    filterStatus = status;
    const btns = document.querySelectorAll('.tracker-status-btn');
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.status === status);
    });
    renderTable();
  }

  function setSearch(query) {
    searchQuery = query || '';
    renderTable();
  }

  function setSort(sortByValue) {
    sortBy = sortByValue;
    renderTable();
  }

  /* ----------------- Modals Management ----------------- */
  function openAddModal() {
    const modal = document.getElementById('tracker-modal');
    if (!modal) return;

    document.getElementById('tracker-modal-title').textContent = 'Add Routine Tracker';
    document.getElementById('tracker-form-id').value = '';
    document.getElementById('tracker-form-title').value = '';
    document.getElementById('tracker-form-category').value = 'grooming';
    document.getElementById('tracker-form-target').value = '7';
    document.getElementById('tracker-form-notes').value = '';
    document.getElementById('tracker-form-recent-date').value = getTodayStr();
    document.getElementById('tracker-form-prev-date').value = '';
    document.getElementById('tracker-form-prior-date').value = '';

    modal.style.display = 'flex';
    document.getElementById('tracker-form-title').focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function openEditModal(id) {
    const item = trackers.find(t => t.id === id);
    if (!item) return;

    const modal = document.getElementById('tracker-modal');
    if (!modal) return;

    document.getElementById('tracker-modal-title').textContent = 'Edit Routine Tracker';
    document.getElementById('tracker-form-id').value = item.id;
    document.getElementById('tracker-form-title').value = item.title || '';
    document.getElementById('tracker-form-category').value = item.category || 'other';
    document.getElementById('tracker-form-target').value = item.targetDays || '';
    document.getElementById('tracker-form-notes').value = item.notes || '';

    const history = item.history || [];
    document.getElementById('tracker-form-recent-date').value = history[0] || '';
    document.getElementById('tracker-form-prev-date').value = history[1] || '';
    document.getElementById('tracker-form-prior-date').value = history[2] || '';

    modal.style.display = 'flex';
    document.getElementById('tracker-form-title').focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closeModal() {
    const modal = document.getElementById('tracker-modal');
    if (modal) modal.style.display = 'none';
  }

  function saveModalForm() {
    const id = document.getElementById('tracker-form-id').value;
    const title = document.getElementById('tracker-form-title').value.trim();
    const category = document.getElementById('tracker-form-category').value;
    const targetDays = document.getElementById('tracker-form-target').value;
    const notes = document.getElementById('tracker-form-notes').value.trim();

    const d1 = document.getElementById('tracker-form-recent-date').value;
    const d2 = document.getElementById('tracker-form-prev-date').value;
    const d3 = document.getElementById('tracker-form-prior-date').value;

    if (!title) {
      alert('Please enter a routine title (e.g., "Nail cut - hands").');
      return;
    }

    const history = cleanAndSortHistory([d1, d2, d3]);

    if (id) {
      // If editing, preserve any extra historical dates beyond the first 3
      const existing = trackers.find(t => t.id === id);
      let fullHistory = history;
      if (existing && existing.history && existing.history.length > 3) {
        const extraHistory = existing.history.slice(3);
        fullHistory = cleanAndSortHistory([...history, ...extraHistory]);
      }

      updateTracker(id, {
        title,
        category,
        targetDays: targetDays ? parseInt(targetDays, 10) : null,
        notes,
        history: fullHistory
      });
    } else {
      addTracker({
        title,
        category,
        targetDays: targetDays ? parseInt(targetDays, 10) : null,
        notes,
        history
      });
    }

    closeModal();
  }

  /* ----------------- Full History Modal ----------------- */
  function openHistoryModal(id) {
    const item = trackers.find(t => t.id === id);
    if (!item) return;

    activeHistoryTrackerId = id;
    const modal = document.getElementById('tracker-history-modal');
    if (!modal) return;

    document.getElementById('history-modal-title').textContent = `${item.title} — Full History`;
    renderHistoryModalList();
    modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closeHistoryModal() {
    const modal = document.getElementById('tracker-history-modal');
    if (modal) modal.style.display = 'none';
    activeHistoryTrackerId = null;
  }

  function renderHistoryModalList() {
    const item = trackers.find(t => t.id === activeHistoryTrackerId);
    if (!item) return;

    const mount = document.getElementById('history-modal-list');
    if (!mount) return;

    const history = item.history || [];

    if (history.length === 0) {
      mount.innerHTML = `
        <div class="history-empty">
          <p>No completion dates recorded yet.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="history-timeline">';
    history.forEach((dateStr, idx) => {
      const prevDateStr = history[idx + 1] || null;
      const gap = prevDateStr ? daysBetween(prevDateStr, dateStr) : null;
      const days = daysSince(dateStr);

      html += `
        <div class="history-timeline-item">
          <div class="history-badge-num">#${idx + 1}</div>
          <div class="history-item-content">
            <div class="history-date-main">${formatDisplayDDMMYYYY(dateStr)} (${formatDisplayDate(dateStr)})</div>
            <div class="history-item-sub">
              ${days === 0 ? 'Today' : `${days} days ago`}
              ${gap !== null ? ` • Interval: +${gap} days from previous` : ''}
              ${idx === 0 ? ' <span class="tag-latest">Most Recent (Col 2)</span>' : ''}
              ${idx === 1 ? ' <span class="tag-prev">Previous (Col 3)</span>' : ''}
              ${idx === 2 ? ' <span class="tag-prior">Prior (Col 4)</span>' : ''}
            </div>
          </div>
          <button class="btn-history-remove" onclick="TrackerEngine.removeHistoryIndex(${idx})" title="Remove date">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
    });
    html += '</div>';

    mount.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function addHistoryDateManual() {
    const dateInput = document.getElementById('history-manual-date-input');
    if (!dateInput || !dateInput.value) return;

    const item = trackers.find(t => t.id === activeHistoryTrackerId);
    if (!item) return;

    const dateVal = dateInput.value;
    let history = Array.isArray(item.history) ? [...item.history] : [];
    history = cleanAndSortHistory([dateVal, ...history]);

    item.history = history;
    item.updatedAt = new Date().toISOString();
    saveData();
    dateInput.value = '';
    renderHistoryModalList();
    render();
    showToast(`Added ${dateVal} to history`);
  }

  function removeHistoryIndex(idx) {
    const item = trackers.find(t => t.id === activeHistoryTrackerId);
    if (!item || !item.history) return;

    if (confirm(`Remove date ${item.history[idx]} from history?`)) {
      item.history.splice(idx, 1);
      item.updatedAt = new Date().toISOString();
      saveData();
      renderHistoryModalList();
      render();
      showToast('Date removed');
    }
  }

  /* ----------------- Dynamic Rolling Updater Modal ----------------- */
  let dynamicSelectedId = null;

  function openDynamicUpdaterModal(routineId = null) {
    const modal = document.getElementById('tracker-dynamic-modal');
    if (!modal) return;

    const select = document.getElementById('dynamic-select-routine');
    if (select) {
      select.innerHTML = trackers.map(t => `
        <option value="${t.id}" ${t.id === routineId ? 'selected' : ''}>
          ${escapeHTML(t.title)} (${getCategoryMeta(t.category).label})
        </option>
      `).join('');
    }

    dynamicSelectedId = routineId || (trackers[0] ? trackers[0].id : null);
    if (select && dynamicSelectedId) {
      select.value = dynamicSelectedId;
    }

    const dateInput = document.getElementById('dynamic-input-date');
    if (dateInput) {
      dateInput.value = getTodayStr();
    }

    updateDynamicPreview();
    modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closeDynamicModal() {
    const modal = document.getElementById('tracker-dynamic-modal');
    if (modal) modal.style.display = 'none';
    dynamicSelectedId = null;
  }

  function setDynamicDateToday() {
    const dateInput = document.getElementById('dynamic-input-date');
    if (dateInput) {
      dateInput.value = getTodayStr();
      updateDynamicPreview();
    }
  }

  function setDynamicDateYesterday() {
    const dateInput = document.getElementById('dynamic-input-date');
    if (dateInput) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}`;
      updateDynamicPreview();
    }
  }

  function updateDynamicPreview() {
    const select = document.getElementById('dynamic-select-routine');
    const dateInput = document.getElementById('dynamic-input-date');
    const previewMount = document.getElementById('dynamic-shift-preview');
    if (!select || !previewMount) return;

    const targetId = select.value;
    dynamicSelectedId = targetId;
    const item = trackers.find(t => t.id === targetId);
    if (!item) {
      previewMount.innerHTML = '<p class="tracker-hint">Select a routine to preview shift.</p>';
      return;
    }

    const inputDate = dateInput ? dateInput.value : getTodayStr();
    const history = item.history || [];
    const curRecent = history[0] || '—';
    const curPrev = history[1] || '—';
    const curPrior = history[2] || '—';

    // Projected after shift
    const nextRecent = inputDate || 'Pick Date';
    const nextPrev = curRecent !== '—' ? curRecent : '—';
    const nextPrior = curPrev !== '—' ? curPrev : '—';
    const vanishing = curPrior !== '—' ? curPrior : null;

    previewMount.innerHTML = `
      <div class="dynamic-preview-box">
        <div class="dynamic-preview-section-title">
          <i data-lucide="sparkles"></i> Live Dynamic Shift Simulation
        </div>

        <div class="dynamic-comparison-grid">
          <!-- BEFORE ROW -->
          <div class="dynamic-comp-col">
            <span class="comp-label">CURRENT VISIBLE DATES</span>
            <div class="comp-chips-row">
              <div class="comp-chip current-chip">
                <span class="chip-col-tag">Col 2 (Recent)</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(curRecent)}</span>
              </div>
              <span class="comp-arrow-sep">➔</span>
              <div class="comp-chip current-chip">
                <span class="chip-col-tag">Col 3 (Previous)</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(curPrev)}</span>
              </div>
              <span class="comp-arrow-sep">➔</span>
              <div class="comp-chip current-chip">
                <span class="chip-col-tag">Col 4 (Prior)</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(curPrior)}</span>
              </div>
            </div>
          </div>

          <div class="dynamic-shift-divider">
            <span class="shift-divider-badge"><i data-lucide="arrow-down"></i> DYNAMIC ROLLING SHIFT (RIGHTWARD) <i data-lucide="arrow-down"></i></span>
          </div>

          <!-- AFTER ROW -->
          <div class="dynamic-comp-col shifted-col">
            <span class="comp-label">AFTER SHIFT APPLIED</span>
            <div class="comp-chips-row">
              <div class="comp-chip shifted-new-chip">
                <span class="chip-col-tag new-tag">✨ Col 2 (NEW Recent)</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(nextRecent)}</span>
              </div>
              <span class="comp-arrow-sep active">➔</span>
              <div class="comp-chip shifted-mid-chip">
                <span class="chip-col-tag">Col 3 (Shifted from Col 2)</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(nextPrev)}</span>
              </div>
              <span class="comp-arrow-sep active">➔</span>
              <div class="comp-chip shifted-mid-chip">
                <span class="chip-col-tag">Col 4 (Shifted from Col 3)</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(nextPrior)}</span>
              </div>
              ${vanishing ? `
              <span class="comp-arrow-sep vanishing-arrow">➔</span>
              <div class="comp-chip vanishing-chip" title="Archived into full history log">
                <span class="chip-col-tag vanish-tag">📦 Vanishes from View</span>
                <span class="chip-date-val">${formatDisplayDDMMYYYY(vanishing)}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function applyDynamicShift() {
    const select = document.getElementById('dynamic-select-routine');
    const dateInput = document.getElementById('dynamic-input-date');
    if (!select || !dateInput) return;

    const id = select.value;
    const dateVal = dateInput.value;
    if (!dateVal) {
      alert('Please choose a completion date.');
      return;
    }

    updateDateCell(id, 0, dateVal, false); // isDirectEdit = false -> SHIFTS RIGHT!
    closeDynamicModal();
  }

  function applyDynamicEditOnly() {
    const select = document.getElementById('dynamic-select-routine');
    const dateInput = document.getElementById('dynamic-input-date');
    if (!select || !dateInput) return;

    const id = select.value;
    const dateVal = dateInput.value;
    if (!dateVal) {
      alert('Please choose a completion date.');
      return;
    }

    updateDateCell(id, 0, dateVal, true); // isDirectEdit = true -> REPLACES WITHOUT SHIFTING!
    closeDynamicModal();
  }

  /* ----------------- Utilities ----------------- */
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function showToast(message, type = 'success') {
    if (typeof Components !== 'undefined' && Components.showToast) {
      Components.showToast(message, type);
    } else {
      console.log(`[Toast] ${message}`);
    }
  }

  /* ----------------- Initialization ----------------- */
  let isInitialized = false;
  function init() {
    if (isInitialized) {
      render();
      return;
    }
    isInitialized = true;
    loadData();
    render();

    // Setup search listener
    const searchInput = document.getElementById('tracker-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        setSearch(e.target.value);
      });
    }

    // Setup sort selector
    const sortSelect = document.getElementById('tracker-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        setSort(e.target.value);
      });
    }

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeHistoryModal();
        closeDynamicModal();
      }
    });
  }

  // Auto-init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    getTrackers,
    addTracker,
    updateTracker,
    deleteTracker,
    logToday,
    updateDateCell,
    handleDateCellChange,
    setCategoryFilter,
    setStatusFilter,
    setSearch,
    setSort,
    openAddModal,
    openEditModal,
    closeModal,
    saveModalForm,
    openHistoryModal,
    closeHistoryModal,
    addHistoryDateManual,
    removeHistoryIndex,
    openDynamicUpdaterModal,
    closeDynamicModal,
    setDynamicDateToday,
    setDynamicDateYesterday,
    updateDynamicPreview,
    applyDynamicShift,
    applyDynamicEditOnly,
    render
  };
})();

// Export globally
if (typeof window !== 'undefined') {
  window.TrackerEngine = TrackerEngine;
}


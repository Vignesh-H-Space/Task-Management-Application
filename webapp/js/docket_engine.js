/**
 * Tesseract Docket Engine
 * Today's Docket — Date-Grouped Daily Execution Board
 * Pinned at the top of the Backlogs page (above Executive Backlogs matrix).
 * Features inline quick-capture, 5-second vanishing completion countdown,
 * 5-second retrieval countdown on deletion (no popup), and yesterday rollover handling.
 */

const DOCKET_STORAGE_KEY = 'tesseract_docket_data';
const DOCKET_COLLAPSED_KEY = 'tesseract_docket_collapsed';

const DOCKET_SEVERITIES = {
  low: { key: 'low', label: 'Low', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.28)' },
  moderate: { key: 'moderate', label: 'Moderate', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.28)' },
  high: { key: 'high', label: 'High', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.28)' }
};

const DocketEngine = {
  items: [],
  isCollapsed: false,
  pendingVanishes: {}, // { [id]: { timer, interval, startTime } }
  pendingDeletions: {}, // { [id]: { timer, interval, startTime } }

  getTodayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatHeadingDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const todayStr = this.getTodayStr();
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      const formatted = d.toLocaleDateString('en-US', options);
      if (dateStr === todayStr) {
        return `Today · ${formatted}`;
      }
      return formatted;
    } catch (e) {
      return dateStr;
    }
  },

  init() {
    this.load();
    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
    if (page === 'backlogs') {
      this.render();
    }
    // Check for uncompleted items from previous days
    this.checkRollover();
  },

  load() {
    try {
      const saved = localStorage.getItem(DOCKET_STORAGE_KEY);
      if (saved) {
        this.items = JSON.parse(saved);
      } else {
        // Initial sample docket tasks for today
        const todayStr = this.getTodayStr();
        this.items = [
          {
            id: 'dkt_init_1',
            task: 'Review quarterly OKR execution velocity and milestones',
            date: todayStr,
            severity: 'moderate',
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          },
          {
            id: 'dkt_init_2',
            task: 'Verify real-time E2EE cloud sync with staging device',
            date: todayStr,
            severity: 'high',
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          },
          {
            id: 'dkt_init_3',
            task: 'Clear petty errands and check urgent communications',
            date: todayStr,
            severity: 'low',
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          }
        ];
        this.save();
      }
    } catch (e) {
      console.error('Failed to load docket data', e);
      this.items = [];
    }

    try {
      this.isCollapsed = localStorage.getItem(DOCKET_COLLAPSED_KEY) === 'true';
    } catch (e) {
      this.isCollapsed = false;
    }
  },

  save() {
    try {
      localStorage.setItem(DOCKET_STORAGE_KEY, JSON.stringify(this.items));
      if (typeof SyncEngine !== 'undefined') {
        SyncEngine.queuePush();
      }
    } catch (e) {
      console.error('Failed to save docket data', e);
    }
  },

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    try {
      localStorage.setItem(DOCKET_COLLAPSED_KEY, this.isCollapsed ? 'true' : 'false');
    } catch (e) {}
    this.render();
  },

  getTodayItems() {
    const today = this.getTodayStr();
    return this.items.filter(item => item.date === today);
  },

  getStaleItems() {
    const today = this.getTodayStr();
    return this.items.filter(item => item.date < today && !item.completed);
  },

  addItem(taskText, severity = 'low') {
    if (!taskText || !taskText.trim()) {
      if (typeof showToast === 'function') showToast('Please enter a task description', 'error');
      return null;
    }

    const todayStr = this.getTodayStr();
    const assignedSev = severity && DOCKET_SEVERITIES[severity] ? severity : 'low';

    const newItem = {
      id: 'dkt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      task: taskText.trim(),
      date: todayStr,
      severity: assignedSev,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };

    this.items.unshift(newItem);
    this.save();
    this.render();

    if (typeof showToast === 'function') {
      showToast('Added to Today\'s Docket: ' + newItem.task, 'success');
    }
    return newItem;
  },

  submitQuickAdd(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const input = document.getElementById('docket-quick-input');
    const sevSelect = document.getElementById('docket-quick-severity');

    if (!input || !input.value.trim()) {
      if (typeof showToast === 'function') showToast('Please enter a docket task', 'error');
      if (input) input.focus();
      return;
    }

    const taskText = input.value;
    const severity = sevSelect ? sevSelect.value : 'low';
    this.addItem(taskText, severity);
    input.value = '';
    input.focus();
  },

  // ════════════════════════════════════════════════════════════
  // ⚡ 5-SECOND VANISHING COMPLETION FLOW
  // ════════════════════════════════════════════════════════════

  markDoneWithCountdown(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    // If currently deleting, cancel deletion first
    if (this.pendingDeletions[id]) {
      this.cancelDelete(id);
    }

    // If currently vanishing, clicking again cancels / undoes it
    if (this.pendingVanishes[id]) {
      this.cancelVanish(id);
      return;
    }

    // Set 5-second countdown timer with live per-second label updates
    let remaining = 5;
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
      } else {
        const undoBtnText = typeof document !== 'undefined' ? document.querySelector(`.docket-task-row[data-id="${id}"] .btn-vanish-undo span`) : null;
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
    const row = typeof document !== 'undefined' ? document.querySelector(`.docket-task-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-completing');
      const actionCell = row.querySelector('.docket-row-actions');
      if (actionCell) {
        actionCell.innerHTML = `
          <button class="btn-vanish-undo" onclick="DocketEngine.cancelVanish('${id}')" title="Undo completion">
            <i data-lucide="rotate-ccw"></i>
            <span>Undo (5s)</span>
          </button>
        `;
      }
      const textCell = row.querySelector('.docket-task-text-wrap');
      if (textCell) {
        const existingBar = textCell.querySelector('.vanish-progress-bar');
        if (!existingBar) {
          const progressBar = document.createElement('div');
          progressBar.className = 'vanish-progress-bar';
          textCell.appendChild(progressBar);
        }
      }
    }

    if (typeof showToast === 'function') {
      showToast('Task complete! Vanishing in 5s... Tap Undo to cancel.', 'info');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  cancelVanish(id) {
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
    this.render();
    if (typeof showToast === 'function') {
      showToast('Restored task to today\'s docket', 'info');
    }
  },

  finalizeVanish(id) {
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

    // Award XP if XPEngine is loaded
    if (typeof XPEngine !== 'undefined' && typeof XPEngine.addXP === 'function') {
      XPEngine.addXP(15, 'Cleared Docket Task');
    }

    const row = typeof document !== 'undefined' ? document.querySelector(`.docket-task-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-vanished');
      setTimeout(() => {
        this.render();
      }, 350);
    } else {
      this.render();
    }
  },

  // ════════════════════════════════════════════════════════════
  // 🗑️ 5-SECOND DELETION RETRIEVAL FLOW (NO POPUP)
  // ════════════════════════════════════════════════════════════

  deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    // If currently deleting, clicking again retrieves it
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
        const retrieveBtnText = typeof document !== 'undefined' ? document.querySelector(`.docket-task-row[data-id="${id}"] .btn-retrieve-undo span`) : null;
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
    const row = typeof document !== 'undefined' ? document.querySelector(`.docket-task-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-deleting');
      const actionCell = row.querySelector('.docket-row-actions');
      if (actionCell) {
        actionCell.innerHTML = `
          <button class="btn-retrieve-undo" onclick="DocketEngine.cancelDelete('${id}')" title="Retrieve deleted task">
            <i data-lucide="rotate-ccw"></i>
            <span>Retrieve (5s)</span>
          </button>
        `;
      }
      const textCell = row.querySelector('.docket-task-text-wrap');
      if (textCell) {
        const existingBar = textCell.querySelector('.delete-progress-bar');
        if (!existingBar) {
          const progressBar = document.createElement('div');
          progressBar.className = 'vanish-progress-bar delete-progress-bar';
          textCell.appendChild(progressBar);
        }
      }
    }

    if (typeof showToast === 'function') {
      showToast('Deleting task in 5s... Tap Retrieve to cancel.', 'warning');
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
    this.render();
    if (typeof showToast === 'function' && item) {
      showToast('Retrieved task: ' + item.task, 'success');
    }
  },

  finalizeDelete(id) {
    if (this.pendingDeletions[id]) {
      clearTimeout(this.pendingDeletions[id].timer);
      if (this.pendingDeletions[id].interval) {
        clearInterval(this.pendingDeletions[id].interval);
      }
      delete this.pendingDeletions[id];
    }

    const row = typeof document !== 'undefined' ? document.querySelector(`.docket-task-row[data-id="${id}"]`) : null;
    if (row) {
      row.classList.add('row-vanished');
      setTimeout(() => {
        this.items = this.items.filter(i => i.id !== id);
        this.save();
        this.render();
        if (typeof showToast === 'function') {
          showToast('Task permanently deleted', 'info');
        }
      }, 350);
    } else {
      this.items = this.items.filter(i => i.id !== id);
      this.save();
      this.render();
      if (typeof showToast === 'function') {
        showToast('Task permanently deleted', 'info');
      }
    }
  },

  cycleSeverity(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    const sequence = ['low', 'moderate', 'high'];
    const currentIdx = sequence.indexOf(item.severity);
    const nextIdx = (currentIdx + 1) % sequence.length;
    item.severity = sequence[nextIdx];
    this.save();
    this.render();

    if (typeof showToast === 'function') {
      const sevMeta = DOCKET_SEVERITIES[item.severity];
      showToast(`Docket task severity set to ${sevMeta.label}`, 'info');
    }
  },

  updateTaskText(id, newText) {
    if (!newText || !newText.trim()) return;
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.task = newText.trim();
      this.save();
    }
  },

  // ════════════════════════════════════════════════════════════
  // 🔄 YESTERDAY'S ROLLOVER WORKFLOW
  // ════════════════════════════════════════════════════════════

  checkRollover() {
    const stale = this.getStaleItems();
    if (stale.length > 0) {
      // Show rollover bottom sheet or banner
      setTimeout(() => {
        this.openRolloverModal();
      }, 600);
    }
  },

  openRolloverModal() {
    const modal = typeof document !== 'undefined' ? document.getElementById('docket-rollover-modal') : null;
    if (!modal) return;

    const stale = this.getStaleItems();
    if (stale.length === 0) {
      this.closeRolloverModal();
      return;
    }

    const countEl = document.getElementById('rollover-count-badge');
    if (countEl) countEl.textContent = stale.length.toString();

    const subtitleEl = document.getElementById('rollover-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `${stale.length} uncompleted task${stale.length > 1 ? 's' : ''} from previous days need your review.`;
    }

    const listEl = document.getElementById('rollover-tasks-list');
    if (listEl) {
      listEl.innerHTML = stale.map(item => {
        const sevMeta = DOCKET_SEVERITIES[item.severity] || DOCKET_SEVERITIES.low;
        const dateFormatted = this.formatHeadingDate(item.date);
        return `
          <div class="rollover-item-row" data-id="${item.id}">
            <div class="rollover-item-info">
              <span class="rollover-date-badge">${dateFormatted}</span>
              <span class="rollover-task-name">${this.escapeHTML(item.task)}</span>
              <span class="docket-sev-badge sev-${item.severity}" style="color:${sevMeta.color}; background:${sevMeta.bg}; border:1px solid ${sevMeta.border};">
                ${sevMeta.label}
              </span>
            </div>
            <div class="rollover-item-actions">
              <button class="btn btn-sm btn-rollover-move" onclick="DocketEngine.rollItemToToday('${item.id}')" title="Move to Today's Agenda">
                <i data-lucide="calendar-plus"></i>
                <span>Roll to Today</span>
              </button>
              <button class="btn btn-sm btn-rollover-done" onclick="DocketEngine.markStaleDone('${item.id}')" title="Mark complete in place">
                <i data-lucide="check"></i>
                <span>Done</span>
              </button>
              <button class="btn btn-sm btn-rollover-discard" onclick="DocketEngine.discardItem('${item.id}')" title="Discard this task">
                <i data-lucide="trash-2"></i>
                <span>Discard</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeRolloverModal() {
    const modal = typeof document !== 'undefined' ? document.getElementById('docket-rollover-modal') : null;
    if (modal) modal.style.display = 'none';
  },

  rollItemToToday(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.date = this.getTodayStr();
    this.save();
    this.render();

    const stale = this.getStaleItems();
    if (stale.length === 0) {
      this.closeRolloverModal();
      if (typeof showToast === 'function') {
        showToast('All stale items rolled to Today\'s Docket! 🚀', 'success');
      }
    } else {
      this.openRolloverModal();
      if (typeof showToast === 'function') {
        showToast(`Moved "${item.task}" to Today's Docket`, 'info');
      }
    }
  },

  markStaleDone(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.completed = true;
    item.completedAt = new Date().toISOString();
    this.save();
    this.render();

    const stale = this.getStaleItems();
    if (stale.length === 0) {
      this.closeRolloverModal();
      if (typeof showToast === 'function') {
        showToast('Marked done! Rollover complete.', 'success');
      }
    } else {
      this.openRolloverModal();
      if (typeof showToast === 'function') {
        showToast(`Marked "${item.task}" done`, 'success');
      }
    }
  },

  discardItem(id) {
    const item = this.items.find(i => i.id === id);
    this.items = this.items.filter(i => i.id !== id);
    this.save();
    this.render();

    const stale = this.getStaleItems();
    if (stale.length === 0) {
      this.closeRolloverModal();
      if (typeof showToast === 'function') {
        showToast('Stale task discarded.', 'info');
      }
    } else {
      this.openRolloverModal();
      if (typeof showToast === 'function' && item) {
        showToast(`Discarded "${item.task}"`, 'info');
      }
    }
  },

  rollAllStaleToToday() {
    const stale = this.getStaleItems();
    const todayStr = this.getTodayStr();
    stale.forEach(item => {
      item.date = todayStr;
    });
    this.save();
    this.render();
    this.closeRolloverModal();

    if (typeof showToast === 'function') {
      showToast(`Rolled ${stale.length} tasks to Today's Docket! 🌅`, 'success');
    }
  },

  markAllStaleDone() {
    const stale = this.getStaleItems();
    const now = new Date().toISOString();
    stale.forEach(item => {
      item.completed = true;
      item.completedAt = now;
    });
    this.save();
    this.render();
    this.closeRolloverModal();

    if (typeof showToast === 'function') {
      showToast(`Marked ${stale.length} tasks completed! 🎉`, 'success');
    }
  },

  dismissRollover() {
    this.closeRolloverModal();
    if (typeof showToast === 'function') {
      showToast('Rollover review dismissed for now.', 'info');
    }
  },

  // ════════════════════════════════════════════════════════════
  // 🖥️ RENDER DOCKET CARD
  // ════════════════════════════════════════════════════════════

  render() {
    if (typeof document === 'undefined') return;

    const container = document.getElementById('docket-section');
    if (!container) return;

    const todayItems = this.getTodayItems();
    const totalCount = todayItems.length;
    const doneCount = todayItems.filter(i => i.completed).length;
    const activeCount = totalCount - doneCount;
    const staleCount = this.getStaleItems().length;
    const headingDate = this.formatHeadingDate(this.getTodayStr());

    let html = `
      <div class="docket-card ${this.isCollapsed ? 'docket-collapsed' : ''}" id="docket-card-inner">
        <!-- Docket Header -->
        <div class="docket-header">
          <div class="docket-title-wrap">
            <div class="docket-badge-glow">
              <i data-lucide="clipboard-list"></i>
            </div>
            <div>
              <div class="docket-title-row">
                <h3 class="docket-title">Today's Docket</h3>
                <span class="docket-date-tag">${headingDate}</span>
                ${staleCount > 0 ? `
                  <button class="docket-stale-alert-btn" onclick="DocketEngine.openRolloverModal()" title="Review ${staleCount} uncompleted items from previous days">
                    <i data-lucide="history"></i>
                    <span>${staleCount} Rollover Pending</span>
                  </button>
                ` : ''}
              </div>
              <p class="docket-subtitle">Immediate daily execution agenda — zero ceremony, single-day deadline.</p>
            </div>
          </div>

          <div class="docket-header-actions">
            <button class="docket-collapse-btn" onclick="DocketEngine.toggleCollapse()" title="${this.isCollapsed ? 'Expand Today\'s Docket' : 'Minimize Today\'s Docket'}" aria-label="Toggle Docket">
              <i data-lucide="${this.isCollapsed ? 'chevron-down' : 'chevron-up'}"></i>
              <span>${this.isCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          </div>
        </div>

        <!-- Collapsible Content Body -->
        <div class="docket-body" style="${this.isCollapsed ? 'display: none;' : ''}">
          <!-- Quick Capture Row -->
          <form class="docket-quick-add" onsubmit="DocketEngine.submitQuickAdd(event);">
            <div class="docket-input-wrap">
              <i data-lucide="plus" class="docket-input-icon"></i>
              <input type="text" id="docket-quick-input" class="docket-input" placeholder="Quick capture today's task... (Press Enter ⏎)" autocomplete="off">
            </div>
            <div class="docket-quick-controls">
              <select id="docket-quick-severity" class="docket-severity-select" title="Priority Severity">
                <option value="low">🟢 Low Severity</option>
                <option value="moderate" selected>🟡 Moderate Severity</option>
                <option value="high">🔴 High Severity</option>
              </select>
              <button type="submit" class="btn btn-primary docket-add-btn" id="docket-submit-btn">
                <i data-lucide="plus"></i>
                <span>Add Task</span>
              </button>
            </div>
          </form>

          <!-- Tasks List -->
          <div class="docket-tasks-list" id="docket-tasks-list">
    `;

    if (todayItems.length === 0) {
      html += `
        <div class="docket-empty-state">
          <div class="docket-empty-icon">
            <i data-lucide="sparkles"></i>
          </div>
          <div class="docket-empty-text">
            <strong>Today's docket is clear</strong>
            <p>Capture your high-leverage agenda items above. Tasks vanish upon completion.</p>
          </div>
        </div>
      `;
    } else {
      todayItems.forEach(item => {
        const isCompleting = !!this.pendingVanishes[item.id];
        const isDeleting = !!this.pendingDeletions[item.id];
        const sevMeta = DOCKET_SEVERITIES[item.severity] || DOCKET_SEVERITIES.low;

        html += `
          <div class="docket-task-row ${item.completed ? 'docket-task-completed' : ''} ${isCompleting ? 'row-completing' : ''} ${isDeleting ? 'row-deleting' : ''}" data-id="${item.id}">
            <!-- Checkbox Done Column -->
            <label class="docket-check-wrap" title="Mark Done (vanishes in 5s)">
              <input type="checkbox" class="docket-checkbox" ${item.completed ? 'checked disabled' : ''} onchange="DocketEngine.markDoneWithCountdown('${item.id}')">
              <span class="docket-custom-check">
                <i data-lucide="check"></i>
              </span>
            </label>

            <!-- Task Name / Editable Content -->
            <div class="docket-task-text-wrap">
              <span class="docket-task-title ${item.completed ? 'completed-strikethrough' : ''}" contenteditable="true" spellcheck="false" onblur="DocketEngine.updateTaskText('${item.id}', this.innerText)" title="Click to edit inline">
                ${this.escapeHTML(item.task)}
              </span>
              ${isCompleting ? '<div class="vanish-progress-bar"></div>' : ''}
              ${isDeleting ? '<div class="vanish-progress-bar delete-progress-bar"></div>' : ''}
            </div>

            <!-- Severity Badge (clickable cycle) -->
            <div class="docket-sev-wrap">
              <button type="button" class="docket-sev-pill sev-${item.severity}" onclick="DocketEngine.cycleSeverity('${item.id}')" title="Click to cycle severity (Low &rarr; Moderate &rarr; High)" style="color:${sevMeta.color}; background:${sevMeta.bg}; border-color:${sevMeta.border};">
                <span class="sev-dot" style="background:${sevMeta.color};"></span>
                <span class="sev-label">${sevMeta.label}</span>
              </button>
            </div>

            <!-- Row Actions (Delete / Undo) -->
            <div class="docket-row-actions">
              ${isCompleting ? `
                <button class="btn-vanish-undo" onclick="DocketEngine.cancelVanish('${item.id}')" title="Undo completion">
                  <i data-lucide="rotate-ccw"></i>
                  <span>Undo (5s)</span>
                </button>
              ` : isDeleting ? `
                <button class="btn-retrieve-undo" onclick="DocketEngine.cancelDelete('${item.id}')" title="Retrieve task">
                  <i data-lucide="rotate-ccw"></i>
                  <span>Retrieve (5s)</span>
                </button>
              ` : `
                <button class="docket-delete-btn" onclick="DocketEngine.deleteItem('${item.id}')" title="Delete task (5s retrieval safety)">
                  <i data-lucide="trash-2"></i>
                </button>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `
          </div>

          <!-- Progress Footer -->
          <div class="docket-footer">
            <div class="docket-stats-strip">
              <span class="docket-stat-chip">
                <i data-lucide="check-circle-2"></i>
                <b>${doneCount}</b> completed
              </span>
              <span class="docket-stat-chip">
                <i data-lucide="circle-dot"></i>
                <b>${activeCount}</b> remaining
              </span>
              <span class="docket-stat-chip text-muted">
                <b>${totalCount}</b> total today
              </span>
            </div>
            <div class="docket-tip">
              <i data-lucide="info"></i>
              <span>Completed tasks vanish in 5s. Unfinished tasks prompt rollover tomorrow.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
};

// Global window exposure
if (typeof window !== 'undefined') {
  window.DocketEngine = DocketEngine;
  window.DOCKET_SEVERITIES = DOCKET_SEVERITIES;
}

// Auto-initialize when DOM ready
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    DocketEngine.init();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DocketEngine, DOCKET_SEVERITIES };
}

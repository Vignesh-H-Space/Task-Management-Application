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

const BACKLOG_INITIAL_DATA = [
  {
    id: 'bkl_01',
    objective: 'Refactor Core Architecture & Clean Codebase',
    group: 'work',
    severity: 'high',
    createdAt: '2026-03-01',
    dueDate: '2026-04-15',
    completed: false,
    completedAt: null
  },
  {
    id: 'bkl_02',
    objective: 'Upgrade Home Network & Server Backup Strategy',
    group: 'household',
    severity: 'moderate',
    createdAt: '2026-03-05',
    dueDate: '2026-04-30',
    completed: false,
    completedAt: null
  },
  {
    id: 'bkl_03',
    objective: 'Full Mobility & Functional Strength Assessment Routine',
    group: 'physical',
    severity: 'low',
    createdAt: '2026-03-10',
    dueDate: '2026-05-01',
    completed: false,
    completedAt: null
  },
  {
    id: 'bkl_04',
    objective: 'Tesseract Native Push Engine & Real-Time Sync Pipeline',
    group: 'tesseract',
    severity: 'high',
    createdAt: '2026-03-12',
    dueDate: '2026-04-10',
    completed: false,
    completedAt: null
  },
  {
    id: 'bkl_05',
    objective: 'Tax & Annual Corporate Document Organization',
    group: 'other',
    severity: 'moderate',
    createdAt: '2026-03-15',
    dueDate: '2026-05-15',
    completed: false,
    completedAt: null
  },
  {
    id: 'bkl_06',
    objective: 'Drop Off Dry Cleaning & Pick Up Courier Package',
    group: 'petty',
    severity: 'low',
    createdAt: '2026-03-18',
    dueDate: '2026-03-22',
    completed: false,
    completedAt: null
  }
];

const BacklogEngine = {
  items: [],
  activeGroup: 'all',
  searchQuery: '',
  showInlineForm: false,
  selectedIds: new Set(),
  pendingVanishes: {}, // { [itemId]: { timer, remaining } }

  init() {
    this.load();
    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
    if (page === 'backlogs' || page === 'completed_backlogs') {
      this.render();
      this.bindEvents();
    }
  },

  load() {
    const saved = localStorage.getItem(BACKLOG_STORAGE_KEY);
    if (saved) {
      try {
        this.items = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse backlog data from localStorage', e);
        this.items = [...BACKLOG_INITIAL_DATA];
      }
    } else {
      this.items = [...BACKLOG_INITIAL_DATA];
      this.save();
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

  setGroupFilter(groupKey) {
    this.activeGroup = groupKey;
    this.selectedIds.clear();
    this.render();
  },

  // ════════════════════════════════════════════════════════════
  // ⚡ 5-SECOND VANISHING COMPLETION FLOW
  // ════════════════════════════════════════════════════════════

  markDoneWithCountdown(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

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

    if (typeof showToast === 'function') {
      showToast('Done! Moving to Completed Backlogs in 5s... Tap Undo to cancel.', 'info');
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
    this.renderTable();
    if (typeof showToast === 'function') {
      showToast('Restored objective to active backlogs', 'info');
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

    const todayStr = new Date().toISOString().split('T')[0];
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

    if (typeof showToast === 'function') {
      showToast('Added to backlogs: ' + newItem.objective, 'success');
    }
    return newItem;
  },

  deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    if (confirm(`Permanently remove backlog objective "${item.objective}"?`)) {
      if (this.pendingVanishes[id]) {
        clearTimeout(this.pendingVanishes[id].timer);
        delete this.pendingVanishes[id];
      }
      this.items = this.items.filter(i => i.id !== id);
      this.save();
      this.render();
      if (typeof showToast === 'function') {
        showToast('Objective permanently removed', 'info');
      }
    }
  },

  updateField(id, field, value) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item[field] = value;
    this.save();
    this.render();
    if (field === 'severity' && typeof showToast === 'function') {
      const sevMeta = BACKLOG_SEVERITIES[value] || BACKLOG_SEVERITIES.low;
      showToast(`Severity updated to ${sevMeta.label}`, 'info');
    }
  },

  toggleInlineForm(force) {
    this.showInlineForm = typeof force === 'boolean' ? force : !this.showInlineForm;
    this.renderTable();
    if (this.showInlineForm) {
      setTimeout(() => {
        const input = document.getElementById('inline-add-objective');
        if (input) input.focus();
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
  },

  renderTable() {
    const tbody = document.getElementById('backlog-table-body');
    const emptyState = document.getElementById('backlog-empty-state');
    if (!tbody) return;

    const items = this.getFilteredItems();
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
      const isOverdue = !item.completed && item.dueDate && item.dueDate < today;
      const isPending = !!this.pendingVanishes[item.id];

      return `
        <tr class="backlog-row ${item.completed ? 'row-completed' : ''} ${isPending ? 'row-completing' : ''}" data-id="${item.id}">
          <!-- Col 1: Done Checkbox (Starts 5s Vanish) or Restore Checkbox on Completed page -->
          <td class="col-select">
            ${isCompleted ? `
              <label class="backlog-checkbox-wrap" title="Click to restore to active backlogs">
                <input type="checkbox" 
                       class="backlog-done-checkbox" 
                       checked 
                       onchange="BacklogEngine.restoreItem('${item.id}')">
                <span class="backlog-custom-box checked"></span>
              </label>
            ` : `
              <label class="backlog-checkbox-wrap" title="Mark Done (Moves to Completed Backlogs in 5s)">
                <input type="checkbox" 
                       class="backlog-done-checkbox" 
                       ${isPending ? 'checked' : ''} 
                       onchange="BacklogEngine.markDoneWithCountdown('${item.id}')">
                <span class="backlog-custom-box"></span>
              </label>
            `}
          </td>

          <!-- Col 2: Objective Name (Inline Editable on Active Page) -->
          <td class="col-objective">
            <div class="objective-cell">
              <span class="objective-text ${item.completed ? 'completed-text' : ''}" 
                    contenteditable="${!isCompleted}"
                    spellcheck="false"
                    onblur="BacklogEngine.updateField('${item.id}', 'objective', this.textContent.trim())"
                    onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
                ${item.objective}
              </span>
              ${isPending ? '<div class="vanish-progress-bar"></div>' : ''}
            </div>
          </td>

          <!-- Col 3: Created / Completed Date -->
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
                     ${isCompleted ? 'disabled' : ''}
                     onchange="BacklogEngine.updateField('${item.id}', 'dueDate', this.value)">
              ${isOverdue ? '<span class="overdue-tag" title="Past due date">Overdue</span>' : ''}
            </div>
          </td>

          <!-- Col 6: Actions (Undo during countdown, Restore on archive, Delete permanently) -->
          <td class="col-actions">
            ${isPending ? `
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
                <button class="backlog-delete-btn" onclick="BacklogEngine.deleteItem('${item.id}')" title="Delete permanently">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            ` : `
              <button class="backlog-delete-btn" onclick="BacklogEngine.deleteItem('${item.id}')" title="Delete objective">
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
          <td class="col-created">
            <span class="date-chip created-chip">
              <i data-lucide="calendar" class="date-chip-icon"></i>
              ${this.formatDate(today)}
            </span>
          </td>
          <td class="col-severity">
            <select id="inline-add-severity" class="inline-select-sev">
              <option value="low" selected>🟢 Low</option>
              <option value="moderate">🟡 Moderate</option>
              <option value="high">🔴 High</option>
            </select>
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
  },

  submitInlineAdd() {
    const input = document.getElementById('inline-add-objective');
    const sevSelect = document.getElementById('inline-add-severity');
    const dueInput = document.getElementById('inline-add-due');

    if (!input || !input.value.trim()) {
      if (typeof showToast === 'function') showToast('Please enter an objective title', 'error');
      if (input) input.focus();
      return;
    }

    const assignedGroup = this.activeGroup !== 'all' ? this.activeGroup : 'work';

    this.addItem({
      objective: input.value,
      group: assignedGroup,
      severity: sevSelect ? sevSelect.value : 'low',
      dueDate: dueInput && dueInput.value ? dueInput.value : null
    });
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

/**
 * Tesseract Kanban Board View
 * Multi-column workflow management (Backlog, To Do, In Progress, Done)
 * Features:
 * - 24-hour smart auto-archive for Done column
 * - Instant 10-second Revive/Undo buffer on task deletion
 * - Drag-and-drop column transitions
 * - Dedicated drop target zones and interactive quick move dropdowns
 */

const KANBAN_COLUMNS = [
  { id: 'backlog',     label: 'BACKLOG',       emoji: '📥', color: '#64748b', bg: 'rgba(100, 116, 139, 0.06)', border: 'rgba(100, 116, 139, 0.25)' },
  { id: 'todo',        label: 'TO DO',         emoji: '📋', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.06)',  border: 'rgba(245, 158, 11, 0.25)' },
  { id: 'in_progress', label: 'IN PROGRESS',   emoji: '🔥', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)', border: 'rgba(59, 130, 246, 0.30)' },
  { id: 'done',        label: 'DONE',          emoji: '✅', color: '#10b981', bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.30)' }
];

function getKanbanStatus(task) {
  if (task.completed) return 'done';
  if (task.kanbanStatus) return task.kanbanStatus;
  // Executive Backlogs and General horizon items cleanly default to the 'backlog' column
  if (task.backlogId || task.isBacklog || task.tier === 'general') return 'backlog';
  // Auto-classify based on existing data
  if (task.priority === 'low' && !task.dueDate) return 'backlog';
  return 'todo';
}

window._recentlyDeletedTasks = window._recentlyDeletedTasks || {};

function moveTaskToKanban(taskId, columnId, event) {
  if (event) event.stopPropagation();
  if (typeof state === 'undefined' || !state.tasks) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (columnId === 'done') {
    task.completed = true;
    task.kanbanStatus = 'done';
    task.completedAt = task.completedAt || new Date().toISOString();
    // Award XP
    if (typeof XPEngine !== 'undefined') {
      XPEngine.awardXP(task);
    }
  } else {
    task.completed = false;
    task.completedAt = null;
    task.kanbanStatus = columnId;
  }

  // Bi-directional sync back to Executive Backlogs if linked
  if (task.backlogId && typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.syncHorizonTaskToBacklog === 'function') {
    HorizonBridge.syncHorizonTaskToBacklog(task);
  }

  if (typeof saveData === 'function') saveData();
  renderKanbanBoard();
  const col = KANBAN_COLUMNS.find(c => c.id === columnId);

  if (columnId === 'done') {
    // Show 10s revive toast option on moving to Done
    if (typeof showActionToast === 'function') {
      showActionToast(`✅ Completed "${task.title.substring(0, 24)}..."`, 'Delete Now 🗑️', () => {
        deleteTaskWithRevive(task.id, 10);
      }, 10000);
    } else if (typeof showToast === 'function') {
      showToast(`✅ Moved to Done`, 'success');
    }
  } else if (typeof showToast === 'function' && col) {
    showToast(`${col.emoji} Moved to ${col.label}`, 'info');
  }
}

function deleteTaskWithRevive(taskId, seconds = 10, event = null) {
  if (event) event.stopPropagation();
  if (typeof state === 'undefined' || !state.tasks) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Stash in recently deleted
  const backupTask = JSON.parse(JSON.stringify(task));
  window._recentlyDeletedTasks[taskId] = {
    task: backupTask,
    timeoutId: setTimeout(() => {
      delete window._recentlyDeletedTasks[taskId];
    }, seconds * 1000)
  };

  // Remove from state
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  if (typeof saveData === 'function') saveData();

  // If linked to backlog, sync
  if (task.backlogId && typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.onHorizonTaskDeleted === 'function') {
    HorizonBridge.onHorizonTaskDeleted(task.backlogId);
  }

  if (typeof renderAll === 'function') renderAll();

  if (typeof showActionToast === 'function') {
    showActionToast(`🗑️ Deleted "${task.title.substring(0, 28)}..."`, 'Revive', () => {
      restoreRevivedTask(taskId);
    }, seconds * 1000);
  } else if (typeof showToast === 'function') {
    showToast(`🗑️ Task deleted`, 'info');
  }
}

function restoreRevivedTask(taskId) {
  const item = window._recentlyDeletedTasks[taskId];
  if (!item) return;

  clearTimeout(item.timeoutId);
  const task = item.task;
  if (typeof state !== 'undefined' && state.tasks) {
    state.tasks.push(task);
  }
  if (typeof saveData === 'function') saveData();

  if (task.backlogId && typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.syncHorizonTaskToBacklog === 'function') {
    HorizonBridge.syncHorizonTaskToBacklog(task);
  }

  delete window._recentlyDeletedTasks[taskId];
  if (typeof renderAll === 'function') renderAll();
  if (typeof showToast === 'function') {
    showToast(`✨ Restored "${task.title.substring(0, 28)}..."`, 'success');
  }
}

function clearDoneColumnWithRevive(seconds = 10) {
  if (typeof state === 'undefined' || !state.tasks) return;
  const doneTasks = state.tasks.filter(t => t.completed || t.kanbanStatus === 'done');
  if (doneTasks.length === 0) {
    if (typeof showToast === 'function') showToast('Done column is already empty.', 'info');
    return;
  }

  const backupList = JSON.parse(JSON.stringify(doneTasks));
  const batchId = 'batch_' + Date.now();
  window._recentlyDeletedTasks[batchId] = {
    tasks: backupList,
    timeoutId: setTimeout(() => {
      delete window._recentlyDeletedTasks[batchId];
    }, seconds * 1000)
  };

  const doneIds = new Set(doneTasks.map(t => t.id));
  state.tasks = state.tasks.filter(t => !doneIds.has(t.id));
  if (typeof saveData === 'function') saveData();
  if (typeof renderAll === 'function') renderAll();

  if (typeof showActionToast === 'function') {
    showActionToast(`🧹 Cleared ${doneTasks.length} Done tasks.`, 'Revive All', () => {
      const b = window._recentlyDeletedTasks[batchId];
      if (b) {
        clearTimeout(b.timeoutId);
        state.tasks = [...state.tasks, ...b.tasks];
        delete window._recentlyDeletedTasks[batchId];
        if (typeof saveData === 'function') saveData();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showToast === 'function') showToast(`✨ Revived ${b.tasks.length} tasks!`, 'success');
      }
    }, seconds * 1000);
  }
}

function setKanbanColumnFilter(colId) {
  if (typeof state !== 'undefined') state.kanbanColumnFilter = colId;
  renderKanbanBoard();
}

function toggleArchivedDone() {
  if (typeof state !== 'undefined') state.showArchivedDone = !state.showArchivedDone;
  renderKanbanBoard();
}

function renderKanbanBoard() {
  const container = document.getElementById('kanban-board-container');
  if (!container) return;

  // Auto-sync Backlog items into state before rendering Kanban
  if (typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.syncAll === 'function') {
    HorizonBridge.syncAll();
  }

  const allTasks = (typeof state !== 'undefined' && state.tasks) ? state.tasks : [];

  // Get tasks based on current horizon filter
  let tasks = allTasks.filter(task => {
    if (state.activeHorizon === 'general') {
      return ['daily', 'weekly', 'monthly', 'general'].includes(task.tier) || !!task.backlogId;
    } else if (state.activeHorizon !== 'all') {
      return task.tier === state.activeHorizon || (state.activeHorizon === 'general' && !!task.backlogId);
    }
    return true;
  });

  // Apply search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t => {
      return (t.title || '').toLowerCase().includes(q) ||
             (t.description || '').toLowerCase().includes(q) ||
             (t.category || '').toLowerCase().includes(q) ||
             (t.group || '').toLowerCase().includes(q) ||
             (t.tags || []).some(tg => tg.toLowerCase().includes(q));
    });
  }

  // Group tasks by kanban status
  const columns = { backlog: [], todo: [], in_progress: [], done: [] };
  tasks.forEach(t => {
    const status = getKanbanStatus(t);
    if (columns[status]) {
      columns[status].push(t);
    } else {
      columns.todo.push(t);
    }
  });

  // 24-Hour Auto-Archive for Done Column:
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const activeDoneTasks = [];
  const archivedDoneTasks = [];

  columns.done.forEach(t => {
    const compTime = t.completedAt ? new Date(t.completedAt).getTime() : 0;
    if (compTime && (now - compTime) >= TWENTY_FOUR_HOURS) {
      archivedDoneTasks.push(t);
    } else {
      activeDoneTasks.push(t);
    }
  });

  const displayDoneTasks = state.showArchivedDone
    ? [...activeDoneTasks, ...archivedDoneTasks]
    : activeDoneTasks;

  const totalVisibleCount = columns.backlog.length + columns.todo.length + columns.in_progress.length + activeDoneTasks.length;
  const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => s);
  const tiersList = typeof TIERS !== 'undefined' ? TIERS : [];

  // Render Column Tabs Bar above columns:
  const tabsHTML = `
    <div class="kb-tabs-wrapper">
      <div class="kb-column-tabs">
        <button type="button" class="kb-tab-pill ${state.kanbanColumnFilter === 'all' ? 'active' : ''}" onclick="setKanbanColumnFilter('all')">
          <i data-lucide="layout-grid" style="width:13px;height:13px;"></i>
          <span>All Columns</span>
          <span class="kb-tab-badge">${totalVisibleCount}</span>
        </button>
        ${KANBAN_COLUMNS.map(col => {
          const count = col.id === 'done' ? activeDoneTasks.length : (columns[col.id] || []).length;
          const isSelected = state.kanbanColumnFilter === col.id;
          return `
            <button type="button" class="kb-tab-pill ${isSelected ? 'active' : ''}" onclick="setKanbanColumnFilter('${col.id}')" style="--col-color: ${col.color};">
              <span>${col.emoji} ${col.label}</span>
              <span class="kb-tab-badge">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Filter columns if tab selected:
  const visibleColumns = state.kanbanColumnFilter === 'all'
    ? KANBAN_COLUMNS
    : KANBAN_COLUMNS.filter(c => c.id === state.kanbanColumnFilter);

  const columnsGridHTML = `
    <div class="kanban-grid-wrapper ${state.kanbanColumnFilter !== 'all' ? 'single-column-view' : ''}">
      <div class="kanban-board" id="kanbanBoard">
        ${visibleColumns.map(col => {
          const colTasks = col.id === 'done' ? displayDoneTasks : (columns[col.id] || []);
          const otherCols = KANBAN_COLUMNS.filter(c => c.id !== col.id);

          return `
            <div class="kb-column" data-column="${col.id}">
              <div class="kb-column-header" style="border-bottom-color: ${col.border};">
                <div class="kb-column-title-row">
                  <span class="kb-column-emoji">${col.emoji}</span>
                  <span class="kb-column-label" style="color: ${col.color};">${col.label}</span>
                  <span class="kb-column-count" style="background: ${col.bg}; color: ${col.color}; border-color: ${col.border};">${colTasks.length}</span>
                  ${col.id === 'done' && activeDoneTasks.length > 0 ? `
                    <button type="button" class="kb-clear-done-btn" onclick="clearDoneColumnWithRevive(10)" title="Delete done tasks with 10s Revive">
                      <i data-lucide="trash-2" style="width:11px;height:11px;"></i> Clear All
                    </button>
                  ` : ''}
                </div>
                ${col.id === 'done' && archivedDoneTasks.length > 0 ? `
                  <div class="kb-archived-notice-row">
                    <span class="kb-archived-text">Auto-archived ${archivedDoneTasks.length} tasks (>24h)</span>
                    <button type="button" class="kb-archived-toggle-btn" onclick="toggleArchivedDone()">
                      ${state.showArchivedDone ? 'Hide' : 'Show'} (${archivedDoneTasks.length})
                    </button>
                  </div>
                ` : ''}
              </div>
              <div class="kb-column-body" id="kb-body-${col.id}" data-column="${col.id}">
                ${colTasks.length === 0 ? `<div class="kb-empty">No tasks in this column</div>` :
                  colTasks.map(t => {
                    const isBkl = !!t.backlogId || !!t.isBacklog;
                    const tierObj = tiersList.find(ti => ti.id === t.tier) || { emoji: isBkl ? '📥' : '📌', name: isBkl ? 'Backlog' : 'Task', color: '#64748b' };
                    const subtasks = t.subtasks || [];
                    const doneSubs = subtasks.filter(s => s.completed).length;
                    const totalSubs = subtasks.length;
                    const subPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : -1;
                    const isOldArchived = col.id === 'done' && t.completedAt && (now - new Date(t.completedAt).getTime()) >= TWENTY_FOUR_HOURS;

                    return `
                      <div class="kb-card ${isBkl ? 'kb-card-backlog' : ''} ${isOldArchived ? 'kb-card-archived' : ''}" data-id="${t.id}" data-column="${col.id}" draggable="true">
                        <div class="kb-card-top">
                          <div class="kb-card-title">${esc(t.title)}</div>
                          <div class="kb-card-move-dropdown">
                            <button type="button" class="kb-move-btn" title="Move to column">
                              <i data-lucide="more-horizontal"></i>
                            </button>
                            <div class="kb-move-menu">
                              ${otherCols.map(oc => `
                                <button type="button" class="kb-move-option" onclick="moveTaskToKanban('${t.id}', '${oc.id}', event)" style="color: ${oc.color};">
                                  ${oc.emoji} ${oc.label}
                                </button>
                              `).join('')}
                              <hr style="border-color: rgba(255,255,255,0.06); margin: 4px 0;">
                              <button type="button" class="kb-move-option" onclick="openEditModal('${t.id}')" style="color: var(--text-secondary);">
                                ✏️ Edit Task
                              </button>
                              <button type="button" class="kb-move-option" onclick="deleteTaskWithRevive('${t.id}', 10, event)" style="color: #ef4444;">
                                🗑️ Delete (10s Revive)
                              </button>
                            </div>
                          </div>
                        </div>
                        ${t.description ? `<div class="kb-card-desc">${esc(t.description.substring(0, 80))}${t.description.length > 80 ? '...' : ''}</div>` : ''}
                        <div class="kb-card-meta">
                          ${isBkl ? `
                            <span class="kb-backlog-badge" title="Executive Backlog Objective">
                              <i data-lucide="layers" style="width:10px;height:10px;"></i> Backlog
                            </span>
                          ` : `
                            <span class="kb-tier-pill" style="color: ${tierObj.color || '#888'}">${tierObj.emoji} ${tierObj.name}</span>
                          `}
                          <span class="kb-prio-pill kb-prio-${t.priority}">${t.priority}</span>
                          ${t.dueDate ? `<span class="kb-due-pill"><i data-lucide="calendar" style="width:10px;height:10px;"></i> ${t.dueDate}</span>` : ''}
                          ${isOldArchived ? `<span class="kb-archived-pill" title="Completed >24h ago">⏳ >24h</span>` : ''}
                        </div>
                        ${subPct >= 0 ? `
                          <div class="kb-card-progress">
                            <div class="kb-progress-track">
                              <div class="kb-progress-fill" style="width: ${subPct}%; background: ${col.color};"></div>
                            </div>
                            <span class="kb-progress-label">${doneSubs}/${totalSubs}</span>
                          </div>
                        ` : ''}
                        <div class="kb-card-footer">
                          <span class="kb-category-tag">#${t.group ? (t.group.charAt(0).toUpperCase() + t.group.slice(1)) : (t.category || 'General')}</span>
                          <div class="kb-card-footer-actions">
                            ${col.id === 'done' ? `
                              <button type="button" class="kb-card-revive-btn" onclick="deleteTaskWithRevive('${t.id}', 10, event)" title="Delete with 10s Revive option">
                                <i data-lucide="trash-2"></i>
                              </button>
                            ` : `
                              <button type="button" class="kb-focus-btn" onclick="if(typeof FocusEngine!=='undefined') FocusEngine.open('${t.id}')" title="Focus Mode">
                                <i data-lucide="zap"></i>
                              </button>
                            `}
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')
                }
                <!-- Dedicated Drop Target Zone at Bottom -->
                <div class="kb-drop-target-zone" data-column="${col.id}">
                  <i data-lucide="arrow-down-circle" style="width:13px;height:13px;"></i>
                  <span>Drop into ${col.label}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = tabsHTML + columnsGridHTML;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  bindKanbanDragDrop();
}

function bindKanbanDragDrop() {
  const cards = document.querySelectorAll('.kb-card');
  const columns = document.querySelectorAll('.kb-column');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      if (e.target.closest('button, .kb-move-dropdown, .kb-card-move-dropdown')) {
        e.preventDefault();
        return;
      }
      card.classList.add('kb-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('kb-dragging');
      document.querySelectorAll('.kb-column-body, .kb-column, .kb-drop-target-zone').forEach(c => {
        c.classList.remove('kb-drag-over', 'drag-hover');
      });
    });
  });

  columns.forEach(col => {
    const colBody = col.querySelector('.kb-column-body');
    const colId = col.getAttribute('data-column');

    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (colBody) colBody.classList.add('kb-drag-over');
    });

    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        if (colBody) colBody.classList.remove('kb-drag-over');
      }
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      if (colBody) colBody.classList.remove('kb-drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId && colId) {
        moveTaskToKanban(taskId, colId);
      }
    });
  });
}

// Global exports
window.KANBAN_COLUMNS = KANBAN_COLUMNS;
window.getKanbanStatus = getKanbanStatus;
window.moveTaskToKanban = moveTaskToKanban;
window.deleteTaskWithRevive = deleteTaskWithRevive;
window.restoreRevivedTask = restoreRevivedTask;
window.clearDoneColumnWithRevive = clearDoneColumnWithRevive;
window.setKanbanColumnFilter = setKanbanColumnFilter;
window.toggleArchivedDone = toggleArchivedDone;
window.renderKanbanBoard = renderKanbanBoard;
window.bindKanbanDragDrop = bindKanbanDragDrop;

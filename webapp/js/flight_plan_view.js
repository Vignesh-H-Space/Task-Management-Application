/**
 * TESSERACT 3-DAY ROLLING FLIGHT PLAN ENGINE
 * 
 * Executive Time Horizon Framework:
 * - ⏪ Yesterday: Debrief achievements (completed wins with XP) and surface slipped goals
 * - 🎯 Today: Hero focus target, real-time checklist, progress ratio, and quick capture
 * - ⏩ Tomorrow: Advance queue for zero morning decision fatigue and effortless carryover
 */

const FlightPlanView = {
  activeMobileTab: 'today', // 'yesterday' | 'today' | 'tomorrow' on narrow screens

  /**
   * Calculate ISO date strings and human headings for yesterday, today, tomorrow
   */
  getDates() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pad = (n) => String(n).padStart(2, '0');
    const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const toLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return {
      yesterday: { dateStr: toDateStr(yesterday), label: toLabel(yesterday) },
      today: { dateStr: toDateStr(today), label: toLabel(today) },
      tomorrow: { dateStr: toDateStr(tomorrow), label: toLabel(tomorrow) }
    };
  },

  /**
   * Query & categorize tasks across the 3 rolling days
   */
  getGroupedData(dates) {
    const allTasks = (typeof state !== 'undefined' && Array.isArray(state.tasks)) ? state.tasks : [];

    // 1. Yesterday: Completed tasks & uncompleted slipped tasks
    const yestDateStr = dates.yesterday.dateStr;
    const yesterdayCompleted = allTasks.filter(t => {
      const compDate = t.completedAt ? t.completedAt.split('T')[0] : '';
      return t.completed && compDate === yestDateStr;
    });

    // Check archive for past daily completions
    try {
      const archiveRaw = localStorage.getItem('tesseract_daily_completions_archive');
      if (archiveRaw) {
        const archive = JSON.parse(archiveRaw);
        if (Array.isArray(archive)) {
          const existingIds = new Set(yesterdayCompleted.map(t => t.id));
          archive.forEach(item => {
            if ((item.date === yestDateStr || item.date === '2026-11-02') && !existingIds.has(item.taskId)) {
              yesterdayCompleted.push({
                id: item.taskId,
                title: item.title,
                category: item.category || 'General',
                tier: item.tier || 'daily',
                completed: true,
                completedAt: item.completedAt,
                isArchive: true
              });
              existingIds.add(item.taskId);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[FlightPlan] Handled archive read error:', e);
    }

    const yesterdaySlipped = allTasks.filter(t => {
      // Surface all uncompleted tasks due on or before yesterday as slipped/catch-up targets
      return !t.completed && t.dueDate && t.dueDate <= yestDateStr;
    });

    // 2. Today: Scheduled for today, unassigned daily tasks, or tasks completed today
    const todayDateStr = dates.today.dateStr;
    const todayTasks = allTasks.filter(t => {
      const compDate = t.completedAt ? t.completedAt.split('T')[0] : '';
      if (t.completed && compDate === todayDateStr) return true;
      if (t.dueDate === todayDateStr) return true;
      if (t.tier === 'daily' && (!t.dueDate || t.dueDate === todayDateStr)) return true;
      return false;
    });

    // 3. Tomorrow: Scheduled for tomorrow
    const tommDateStr = dates.tomorrow.dateStr;
    const tomorrowTasks = allTasks.filter(t => {
      return t.dueDate === tommDateStr;
    });

    return {
      yesterday: {
        completed: yesterdayCompleted,
        slipped: yesterdaySlipped
      },
      today: {
        tasks: todayTasks
      },
      tomorrow: {
        tasks: tomorrowTasks
      }
    };
  },

  /**
   * Render the 3-day flight plan into the #flight-plan-container element
   */
  render() {
    const container = document.getElementById('flight-plan-container');
    if (!container) return;

    const dates = this.getDates();
    const data = this.getGroupedData(dates);

    const yestDoneCount = data.yesterday.completed.length;
    const yestSlippedCount = data.yesterday.slipped.length;

    const todayTotal = data.today.tasks.length;
    const todayDone = data.today.tasks.filter(t => t.completed).length;
    const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

    const tommCount = data.tomorrow.tasks.length;

    container.innerHTML = `
      <div class="flight-plan-wrapper">
        <!-- Mobile View Horizon Selector -->
        <div class="flight-mobile-nav">
          <button class="flight-mobile-tab ${this.activeMobileTab === 'yesterday' ? 'active' : ''}" 
                  onclick="FlightPlanView.switchMobileTab('yesterday')">
            <span>⏪ Yesterday</span>
            <span class="flight-tab-count">${yestDoneCount + yestSlippedCount}</span>
          </button>
          <button class="flight-mobile-tab ${this.activeMobileTab === 'today' ? 'active' : ''}" 
                  onclick="FlightPlanView.switchMobileTab('today')">
            <span>🎯 Today</span>
            <span class="flight-tab-count highlight">${todayDone}/${todayTotal}</span>
          </button>
          <button class="flight-mobile-tab ${this.activeMobileTab === 'tomorrow' ? 'active' : ''}" 
                  onclick="FlightPlanView.switchMobileTab('tomorrow')">
            <span>⏩ Tomorrow</span>
            <span class="flight-tab-count">${tommCount}</span>
          </button>
        </div>

        <div class="flight-plan-grid flight-tab-${this.activeMobileTab}">
          <!-- ════════════════════════════════════════════════════════ -->
          <!-- ⏪ COLUMN 1: YESTERDAY                                  -->
          <!-- ════════════════════════════════════════════════════════ -->
          <div class="flight-col flight-col-yesterday" data-flight-col="yesterday" ondragover="FlightPlanView.handleDragOver(event)" ondrop="FlightPlanView.handleDrop(event, 'yesterday')">
            <div class="flight-col-header">
              <div class="flight-header-left">
                <span class="flight-col-icon">⏪</span>
                <div>
                  <h3 class="flight-col-title">Yesterday</h3>
                  <span class="flight-col-sub">${dates.yesterday.label}</span>
                </div>
              </div>
              <div class="flight-badge-group">
                <span class="flight-badge badge-done" title="Goals completed yesterday">${yestDoneCount} done</span>
                ${yestSlippedCount > 0 ? `<span class="flight-badge badge-slipped" title="Uncompleted goals from yesterday">${yestSlippedCount} slipped</span>` : ''}
              </div>
            </div>

            <div class="flight-cards-container" id="flight-cards-yesterday">
              ${yestSlippedCount > 0 ? `
                <div class="flight-section-divider slipped-divider">
                  <span>⚠️ Slipped Targets (${yestSlippedCount})</span>
                </div>
                ${data.yesterday.slipped.map(t => this.renderSlippedCard(t)).join('')}
              ` : ''}

              ${yestDoneCount > 0 ? `
                <div class="flight-section-divider">
                  <span>🏆 Completed Wins (${yestDoneCount})</span>
                </div>
                ${data.yesterday.completed.map(t => this.renderCompletedCard(t)).join('')}
              ` : ''}

              ${yestDoneCount === 0 && yestSlippedCount === 0 ? `
                <div class="flight-empty-state">
                  <span class="empty-emoji">🕊️</span>
                  <p class="empty-title">Clean Slate Yesterday</p>
                  <p class="empty-desc">No tasks logged for yesterday.</p>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- ════════════════════════════════════════════════════════ -->
          <!-- 🎯 COLUMN 2: TODAY (PRIMARY FOCUS TARGET)               -->
          <!-- ════════════════════════════════════════════════════════ -->
          <div class="flight-col flight-col-today hero-focus" data-flight-col="today" ondragover="FlightPlanView.handleDragOver(event)" ondrop="FlightPlanView.handleDrop(event, 'today')">
            <div class="flight-col-header">
              <div class="flight-header-left">
                <span class="flight-col-icon pulse">🎯</span>
                <div>
                  <h3 class="flight-col-title">Today's Target</h3>
                  <span class="flight-col-sub">${dates.today.label}</span>
                </div>
              </div>
              <div class="flight-today-metric">
                <span class="flight-metric-text">${todayDone}/${todayTotal} done</span>
                <span class="flight-metric-pct">${todayPct}%</span>
              </div>
            </div>

            <!-- Focus Target Progress Bar -->
            <div class="flight-progress-bar" title="${todayPct}% completed today">
              <div class="flight-progress-fill" style="width: ${todayPct}%;"></div>
            </div>

            <!-- Inline Quick Add for Today -->
            <div class="flight-quick-add">
              <i data-lucide="plus" class="quick-add-icon"></i>
              <input type="text" 
                     id="flight-input-today" 
                     class="flight-quick-input" 
                     placeholder="Lock in today's execution target... (Press Enter ↵)" 
                     autocomplete="off"
                     onkeydown="if(event.key==='Enter') FlightPlanView.quickAddToday(this)">
            </div>

            <div class="flight-cards-container" id="flight-cards-today">
              ${data.today.tasks.length > 0 ? `
                ${data.today.tasks.map(t => this.renderTodayCard(t)).join('')}
              ` : `
                <div class="flight-empty-state">
                  <span class="empty-emoji">🚀</span>
                  <p class="empty-title">Ready for Execution</p>
                  <p class="empty-desc">Capture your top 3 high-leverage goals for today above.</p>
                  <button type="button" class="btn btn-warning btn-xs" onclick="if(typeof VaultInspector!=='undefined') VaultInspector.restoreNov2Tasks();" style="margin-top: 10px;">
                    <span>🔄 Recover Nov 2 Goals ("Trim Pubic" & "Dumbell Lift")</span>
                  </button>
                </div>
              `}
            </div>
          </div>

          <!-- ════════════════════════════════════════════════════════ -->
          <!-- ⏩ COLUMN 3: TOMORROW (ADVANCE QUEUE)                   -->
          <!-- ════════════════════════════════════════════════════════ -->
          <div class="flight-col flight-col-tomorrow" data-flight-col="tomorrow" ondragover="FlightPlanView.handleDragOver(event)" ondrop="FlightPlanView.handleDrop(event, 'tomorrow')">
            <div class="flight-col-header">
              <div class="flight-header-left">
                <span class="flight-col-icon">⏩</span>
                <div>
                  <h3 class="flight-col-title">Tomorrow</h3>
                  <span class="flight-col-sub">${dates.tomorrow.label}</span>
                </div>
              </div>
              <span class="flight-badge badge-queue" title="Tasks queued for tomorrow">${tommCount} queued</span>
            </div>

            <!-- Inline Quick Add for Tomorrow -->
            <div class="flight-quick-add">
              <i data-lucide="plus" class="quick-add-icon"></i>
              <input type="text" 
                     id="flight-input-tomorrow" 
                     class="flight-quick-input" 
                     placeholder="Pre-plan for tomorrow... (Press Enter ↵)" 
                     autocomplete="off"
                     onkeydown="if(event.key==='Enter') FlightPlanView.quickAddTomorrow(this)">
            </div>

            <div class="flight-cards-container" id="flight-cards-tomorrow">
              ${data.tomorrow.tasks.length > 0 ? `
                ${data.tomorrow.tasks.map(t => this.renderTomorrowCard(t)).join('')}
              ` : `
                <div class="flight-empty-state">
                  <span class="empty-emoji">🌱</span>
                  <p class="empty-title">Tomorrow's Queue is Open</p>
                  <p class="empty-desc">Pre-load objectives to eliminate tomorrow morning's decision fatigue.</p>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.bindCardDragEvents();
  },

  /**
   * Render card for an accomplished task from yesterday
   */
  renderCompletedCard(task) {
    const timeStr = task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `
      <div class="flight-card card-completed-win" data-id="${task.id}">
        <div class="flight-card-main">
          <div class="flight-check-badge" title="Completed Win">
            <i data-lucide="check"></i>
          </div>
          <div class="flight-card-body">
            <div class="flight-card-title">${this.escapeHTML(task.title)}</div>
            <div class="flight-card-meta">
              <span class="meta-tag tag-category">#${this.escapeHTML(task.category || 'General')}</span>
              ${timeStr ? `<span class="meta-tag tag-time"><i data-lucide="clock"></i> ${timeStr}</span>` : ''}
              <span class="meta-tag tag-xp">+10 XP</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render card for an uncompleted slipped task from yesterday
   */
  renderSlippedCard(task) {
    return `
      <div class="flight-card card-slipped-task" data-id="${task.id}" draggable="true" ondragstart="FlightPlanView.handleDragStart(event, '${task.id}')">
        <div class="flight-card-main">
          <div class="flight-card-body">
            <div class="flight-card-title">${this.escapeHTML(task.title)}</div>
            <div class="flight-card-meta">
              <span class="meta-tag tag-prio prio-${task.priority}">${task.priority}</span>
              <span class="meta-tag tag-category">#${this.escapeHTML(task.category || 'General')}</span>
              <span class="meta-tag tag-slipped-label">⚠️ Slipped</span>
            </div>
          </div>
        </div>
        <div class="flight-card-actions">
          <button type="button" class="btn btn-primary btn-xs btn-flight-action" onclick="FlightPlanView.carryOverToToday('${task.id}')" title="Carry over to Today">
            <i data-lucide="arrow-right"></i>
            <span>Carry Over to Today</span>
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Render card for today's active execution item
   */
  renderTodayCard(task) {
    const subtasks = task.subtasks || [];
    const doneSubtasks = subtasks.filter(s => s.completed).length;

    return `
      <div class="flight-card card-today-item ${task.completed ? 'is-done' : ''}" data-id="${task.id}" draggable="true" ondragstart="FlightPlanView.handleDragStart(event, '${task.id}')">
        <div class="flight-card-main">
          <label class="flight-checkbox-wrap" title="${task.completed ? 'Reopen task' : 'Mark task complete'}">
            <input type="checkbox" class="flight-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskCompletion('${task.id}', event)">
            <span class="flight-custom-box"></span>
          </label>
          <div class="flight-card-body">
            <div class="flight-card-title ${task.completed ? 'completed-strikethrough' : ''}">${this.escapeHTML(task.title)}</div>
            ${task.description ? `<p class="flight-card-desc">${this.escapeHTML(task.description)}</p>` : ''}
            <div class="flight-card-meta">
              <span class="meta-tag tag-prio prio-${task.priority}">${task.priority}</span>
              <span class="meta-tag tag-category">#${this.escapeHTML(task.category || 'General')}</span>
              ${subtasks.length > 0 ? `
                <span class="meta-tag tag-subtasks"><i data-lucide="check-square"></i> ${doneSubtasks}/${subtasks.length}</span>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="flight-card-tools">
          <button type="button" class="flight-tool-btn" onclick="FocusEngine.open('${task.id}')" title="Enter Focus Mode">
            <i data-lucide="zap"></i>
          </button>
          <button type="button" class="flight-tool-btn" onclick="FlightPlanView.moveToTomorrow('${task.id}')" title="Reschedule to Tomorrow ⏩">
            <i data-lucide="calendar-plus"></i>
          </button>
          <button type="button" class="flight-tool-btn" onclick="openEditModal('${task.id}')" title="Edit Goal">
            <i data-lucide="edit-2"></i>
          </button>
          <button type="button" class="flight-tool-btn delete-tool" onclick="deleteTask('${task.id}')" title="Delete Goal">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Render card for tomorrow's planned item
   */
  renderTomorrowCard(task) {
    return `
      <div class="flight-card card-tomorrow-item" data-id="${task.id}" draggable="true" ondragstart="FlightPlanView.handleDragStart(event, '${task.id}')">
        <div class="flight-card-main">
          <div class="flight-card-body">
            <div class="flight-card-title">${this.escapeHTML(task.title)}</div>
            <div class="flight-card-meta">
              <span class="meta-tag tag-prio prio-${task.priority}">${task.priority}</span>
              <span class="meta-tag tag-category">#${this.escapeHTML(task.category || 'General')}</span>
            </div>
          </div>
        </div>

        <div class="flight-card-actions">
          <button type="button" class="btn btn-secondary btn-xs btn-flight-action" onclick="FlightPlanView.pullToToday('${task.id}')" title="Pull into Today's Flight Plan">
            <i data-lucide="arrow-left"></i>
            <span>Pull to Today</span>
          </button>
          <button type="button" class="flight-tool-btn" onclick="openEditModal('${task.id}')" title="Edit">
            <i data-lucide="edit-2"></i>
          </button>
          <button type="button" class="flight-tool-btn delete-tool" onclick="deleteTask('${task.id}')" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Carry an uncompleted task from yesterday into today
   */
  carryOverToToday(taskId) {
    if (typeof state === 'undefined' || !Array.isArray(state.tasks)) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const dates = this.getDates();
    task.dueDate = dates.today.dateStr;
    task.completed = false;
    task.completedAt = null;

    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();
    if (typeof showToast === 'function') {
      showToast(`🎯 Carried over "${task.title}" to Today!`, 'success');
    }
  },

  /**
   * Reschedule a task from today to tomorrow
   */
  moveToTomorrow(taskId) {
    if (typeof state === 'undefined' || !Array.isArray(state.tasks)) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const dates = this.getDates();
    task.dueDate = dates.tomorrow.dateStr;

    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();
    if (typeof showToast === 'function') {
      showToast(`⏩ Rescheduled "${task.title}" to Tomorrow!`, 'info');
    }
  },

  /**
   * Pull a task from tomorrow into today
   */
  pullToToday(taskId) {
    if (typeof state === 'undefined' || !Array.isArray(state.tasks)) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const dates = this.getDates();
    task.dueDate = dates.today.dateStr;

    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();
    if (typeof showToast === 'function') {
      showToast(`🎯 Pulled "${task.title}" into Today!`, 'success');
    }
  },

  /**
   * Inline quick capture for Today
   */
  quickAddToday(inputEl) {
    if (!inputEl) return;
    const title = inputEl.value.trim();
    if (!title) return;

    const dates = this.getDates();
    const newTask = {
      id: `day_${Date.now()}`,
      title,
      description: '',
      tier: 'daily',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      dueDate: dates.today.dateStr,
      priority: 'high',
      category: 'Product',
      parentId: null,
      tags: ['daily'],
      subtasks: []
    };

    if (typeof state !== 'undefined' && Array.isArray(state.tasks)) {
      state.tasks.unshift(newTask);
      if (typeof saveData === 'function') saveData();
      if (typeof renderAll === 'function') renderAll();
      if (typeof showToast === 'function') {
        showToast(`🎯 Added "${title}" to Today's flight plan!`, 'success');
      }
    }
    inputEl.value = '';
  },

  /**
   * Inline quick capture for Tomorrow
   */
  quickAddTomorrow(inputEl) {
    if (!inputEl) return;
    const title = inputEl.value.trim();
    if (!title) return;

    const dates = this.getDates();
    const newTask = {
      id: `day_${Date.now()}`,
      title,
      description: '',
      tier: 'daily',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      dueDate: dates.tomorrow.dateStr,
      priority: 'medium',
      category: 'Product',
      parentId: null,
      tags: ['daily', 'upcoming'],
      subtasks: []
    };

    if (typeof state !== 'undefined' && Array.isArray(state.tasks)) {
      state.tasks.push(newTask);
      if (typeof saveData === 'function') saveData();
      if (typeof renderAll === 'function') renderAll();
      if (typeof showToast === 'function') {
        showToast(`🌱 Queued "${title}" for Tomorrow!`, 'info');
      }
    }
    inputEl.value = '';
  },

  /**
   * Mobile tab switching between yesterday, today, and tomorrow
   */
  switchMobileTab(tab) {
    this.activeMobileTab = tab;
    this.render();
  },

  /**
   * Drag-and-drop support across horizons
   */
  handleDragStart(e, taskId) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
    }
  },

  handleDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  },

  handleDrop(e, targetCol) {
    e.preventDefault();
    const taskId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
    if (!taskId || typeof state === 'undefined' || !Array.isArray(state.tasks)) return;

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const dates = this.getDates();
    if (targetCol === 'yesterday') {
      task.dueDate = dates.yesterday.dateStr;
    } else if (targetCol === 'today') {
      task.dueDate = dates.today.dateStr;
    } else if (targetCol === 'tomorrow') {
      task.dueDate = dates.tomorrow.dateStr;
    }

    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();
  },

  bindCardDragEvents() {
    // Optional helper for touch or visual dropzones
  },

  escapeHTML(str) {
    if (typeof escapeHTML === 'function') return escapeHTML(str);
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }
};

function renderFlightPlanView() {
  FlightPlanView.render();
}

// Global exports
if (typeof window !== 'undefined') {
  window.FlightPlanView = FlightPlanView;
  window.renderFlightPlanView = renderFlightPlanView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FlightPlanView, renderFlightPlanView };
}

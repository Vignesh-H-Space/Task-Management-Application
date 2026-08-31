/**
 * Tesseract Executive Ritual Engine
 * Morning Priming (The Rule of 3) & Evening Shutdown Protocol (Mind Sweep, Journal & Rollover).
 */

const RITUALS_STORAGE_KEY = 'tesseract_rituals_data';

const RitualsEngine = {
  data: {
    morningDate: null,
    top3Ids: [],
    eveningDate: null,
    reflections: []
  },

  init() {
    this.load();
    this.renderMorningBanner();
  },

  load() {
    const saved = localStorage.getItem(RITUALS_STORAGE_KEY);
    if (saved) {
      try {
        this.data = Object.assign(this.data, JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse rituals data', e);
      }
    }
  },

  save() {
    localStorage.setItem(RITUALS_STORAGE_KEY, JSON.stringify(this.data));
  },

  getToday() {
    return new Date().toISOString().split('T')[0];
  },

  getTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  },

  /**
   * 🌅 Morning Priming (The Rule of 3)
   */
  openMorningModal() {
    const modal = document.getElementById('morning-priming-modal');
    const list = document.getElementById('morning-tasks-picker-list');
    if (!modal || !list || typeof state === 'undefined') return;

    const dailyTasks = state.tasks.filter(t => t.tier === 'daily');
    const today = this.getToday();
    const currentTop3 = (this.data.morningDate === today) ? (this.data.top3Ids || []) : [];

    if (dailyTasks.length === 0) {
      list.innerHTML = `
        <div class="ritual-empty-note">
          No daily tasks found. Create some daily tasks first or click below to add a quick win!
        </div>
      `;
    } else {
      list.innerHTML = dailyTasks.map(task => {
        const isChecked = currentTop3.includes(task.id);
        return `
          <label class="ritual-task-select-item ${isChecked ? 'selected' : ''}">
            <input type="checkbox" value="${task.id}" class="morning-task-checkbox" ${isChecked ? 'checked' : ''}>
            <div class="ritual-task-text">
              <span class="ritual-task-title">${escapeHTML(task.title)}</span>
              <span class="ritual-task-cat">#${task.category} ${task.priority === 'urgent' ? '• 🔴 Urgent' : ''}</span>
            </div>
          </label>
        `;
      }).join('');
    }

    // Limit to maximum 3 selections
    const checkboxes = list.querySelectorAll('.morning-task-checkbox');
    checkboxes.forEach(chk => {
      chk.addEventListener('change', () => {
        const selected = list.querySelectorAll('.morning-task-checkbox:checked');
        if (selected.length > 3) {
          chk.checked = false;
          if (typeof showToast === 'function') {
            showToast('The Rule of 3: Focus on max 3 non-negotiable wins.', 'warning');
          }
        }
        chk.closest('.ritual-task-select-item').classList.toggle('selected', chk.checked);
      });
    });

    modal.style.display = 'flex';
  },

  saveMorningWins() {
    const list = document.getElementById('morning-tasks-picker-list');
    if (!list) return;

    const selectedCheckboxes = list.querySelectorAll('.morning-task-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(c => c.value);

    if (selectedIds.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Please select at least 1 focus goal for today.', 'warning');
      }
      return;
    }

    const today = this.getToday();
    const isFirstTimeToday = this.data.morningDate !== today;

    this.data.morningDate = today;
    this.data.top3Ids = selectedIds;
    this.save();

    this.closeModals();
    this.renderMorningBanner();

    if (isFirstTimeToday && typeof XPEngine !== 'undefined') {
      XPEngine.award(20, '🌅 Morning Priming Completed (Top 3 Wins Locked)');
    }

    if (typeof showToast === 'function') {
      showToast(`🎯 Top ${selectedIds.length} Wins locked in for today! Execute with intensity.`, 'success');
    }
  },

  /**
   * Render Top 3 Priority Focus Banner on Home Dashboard
   */
  renderMorningBanner() {
    const container = document.getElementById('morning-priority-banner');
    if (!container || typeof state === 'undefined') return;

    const today = this.getToday();
    if (this.data.morningDate !== today || !this.data.top3Ids || this.data.top3Ids.length === 0) {
      container.innerHTML = `
        <div class="morning-prompt-card">
          <div class="morning-prompt-left">
            <span class="morning-prompt-icon">🌅</span>
            <div>
              <div class="morning-prompt-title">Morning Priming: The Rule of 3</div>
              <div class="morning-prompt-sub">Lock in your top 3 non-negotiable wins for today and earn +20 XP.</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="RitualsEngine.openMorningModal();">
            <i data-lucide="crosshair"></i>
            <span>Set Today's Top 3 Wins</span>
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    // Get Top 3 tasks
    const topTasks = state.tasks.filter(t => this.data.top3Ids.includes(t.id));
    const completedCount = topTasks.filter(t => t.completed).length;
    const allDone = topTasks.length > 0 && completedCount === topTasks.length;

    container.innerHTML = `
      <div class="top3-banner-card ${allDone ? 'all-crushed' : ''}">
        <div class="top3-banner-header">
          <div class="top3-banner-title">
            <i data-lucide="flame"></i>
            <span>TODAY'S TOP 3 NON-NEGOTIABLE WINS</span>
            <span class="top3-progress-tag">${completedCount}/${topTasks.length} Completed</span>
          </div>
          <div class="top3-banner-actions">
            <button class="top3-edit-btn" onclick="RitualsEngine.openMorningModal();" title="Edit Top 3 Wins">
              <i data-lucide="edit-3"></i>
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div class="top3-tasks-grid">
          ${topTasks.map((t, idx) => `
            <div class="top3-task-chip ${t.completed ? 'completed' : ''}" onclick="toggleTaskCompletion('${t.id}', event)">
              <div class="top3-num">${idx + 1}</div>
              <span class="top3-task-check">${t.completed ? '✓' : ''}</span>
              <span class="top3-task-name" title="${escapeHTML(t.title)}">${escapeHTML(t.title)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * 🌙 Evening Shutdown Protocol
   */
  openEveningModal() {
    const modal = document.getElementById('evening-shutdown-modal');
    if (!modal || typeof state === 'undefined') return;

    // Gather today's completed items
    const today = this.getToday();
    const completedTodayTasks = state.tasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(today));
    const uncompletedDaily = state.tasks.filter(t => t.tier === 'daily' && !t.completed);

    // Deep work hours
    const focusHours = (typeof FocusEngine !== 'undefined') ? FocusEngine.getTotalHours() : 0;

    // Populate Recap Metrics
    const metricTasks = document.getElementById('evening-metric-tasks');
    const metricFocus = document.getElementById('evening-metric-focus');
    const metricXP = document.getElementById('evening-metric-xp');
    if (metricTasks) metricTasks.textContent = `${completedTodayTasks.length} Done`;
    if (metricFocus) metricFocus.textContent = `${focusHours}h Logged`;
    if (metricXP && typeof XPEngine !== 'undefined') metricXP.textContent = `${XPEngine.data.totalXP} XP`;

    // Populate uncompleted tasks for rollover
    const rolloverContainer = document.getElementById('evening-rollover-list');
    if (rolloverContainer) {
      if (uncompletedDaily.length === 0) {
        rolloverContainer.innerHTML = `
          <div class="ritual-empty-note">
            🎉 All daily tasks completed! Zero tasks to roll over. Outstanding execution!
          </div>
        `;
      } else {
        rolloverContainer.innerHTML = `
          <div class="rollover-header-note">Select uncompleted tasks to roll over to tomorrow (zero guilt):</div>
          ${uncompletedDaily.map(t => `
            <label class="rollover-task-item">
              <input type="checkbox" value="${t.id}" class="evening-rollover-checkbox" checked>
              <div class="rollover-task-info">
                <span class="rollover-task-title">${escapeHTML(t.title)}</span>
                <span class="rollover-task-due">Due: Today → Tomorrow (${this.getTomorrow()})</span>
              </div>
            </label>
          `).join('')}
        `;
      }
    }

    const reflectionInput = document.getElementById('evening-reflection-text');
    if (reflectionInput) reflectionInput.value = '';

    modal.style.display = 'flex';
  },

  completeEveningShutdown() {
    const reflectionInput = document.getElementById('evening-reflection-text');
    const reflectionText = reflectionInput ? reflectionInput.value.trim() : '';

    const checkboxes = document.querySelectorAll('.evening-rollover-checkbox:checked');
    const rolloverIds = Array.from(checkboxes).map(c => c.value);

    // Roll over tasks to tomorrow
    const tomorrow = this.getTomorrow();
    let rolloverCount = 0;
    if (typeof state !== 'undefined') {
      rolloverIds.forEach(id => {
        const task = state.tasks.find(t => t.id === id);
        if (task) {
          task.dueDate = tomorrow;
          rolloverCount++;
        }
      });
      if (rolloverCount > 0 && typeof saveData === 'function') {
        saveData();
      }
    }

    const today = this.getToday();
    this.data.eveningDate = today;

    // Save reflection
    if (reflectionText) {
      this.data.reflections.unshift({
        date: today,
        text: reflectionText,
        timestamp: new Date().toISOString()
      });
      if (this.data.reflections.length > 30) this.data.reflections.pop();
    }

    this.save();
    this.closeModals();

    // Award +50 XP Shutdown Reward
    if (typeof XPEngine !== 'undefined') {
      XPEngine.award(50, '🌙 Evening Shutdown Protocol Completed');
    }

    if (typeof triggerConfetti === 'function') {
      triggerConfetti();
    }

    if (typeof showToast === 'function') {
      showToast(`🌙 Daily Shutdown Complete! ${rolloverCount} tasks rolled over. Outstanding work today.`, 'success');
    }

    if (typeof renderAll === 'function') renderAll();
  },

  closeModals() {
    const m1 = document.getElementById('morning-priming-modal');
    const m2 = document.getElementById('evening-shutdown-modal');
    if (m1) m1.style.display = 'none';
    if (m2) m2.style.display = 'none';
  }
};

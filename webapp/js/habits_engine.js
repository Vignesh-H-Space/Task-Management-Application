/**
 * Tesseract Recurring Habits & Cadence Engine
 * Automatic midnight resetting habits, 7-day consistency dot matrix grid & XP integration.
 */

const HABITS_STORAGE_KEY = 'tesseract_habits_data';

const INITIAL_HABITS = [
  {
    id: 'habit_01',
    title: 'Morning Workout & Endurance Training',
    icon: '🏃',
    category: 'Health',
    targetDaysPerWeek: 7,
    history: {},
    createdAt: new Date().toISOString()
  },
  {
    id: 'habit_02',
    title: 'Read 20 Pages of Systems & Architecture',
    icon: '📚',
    category: 'Career',
    targetDaysPerWeek: 7,
    history: {},
    createdAt: new Date().toISOString()
  },
  {
    id: 'habit_03',
    title: 'Review Weekly Metrics & Budget Allocation',
    icon: '📈',
    category: 'Finance',
    targetDaysPerWeek: 7,
    history: {},
    createdAt: new Date().toISOString()
  }
];

const HabitsEngine = {
  habits: [],

  init() {
    this.load();
    this.seedDefaultHistoryIfNeeded();
    this.renderWidget();
  },

  load() {
    const saved = localStorage.getItem(HABITS_STORAGE_KEY);
    if (saved) {
      try {
        this.habits = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse habits data', e);
        this.habits = [...INITIAL_HABITS];
      }
    } else {
      this.habits = JSON.parse(JSON.stringify(INITIAL_HABITS));
      this.save();
    }
  },

  save() {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(this.habits));
  },

  seedDefaultHistoryIfNeeded() {
    // Seed some sample completions for past 3 days so the matrix looks active on initial load
    const today = new Date();
    let updated = false;

    this.habits.forEach(h => {
      if (!h.history || Object.keys(h.history).length === 0) {
        h.history = h.history || {};
        for (let i = 1; i <= 3; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          if (i !== 2) { // Simulate completing 2 of 3 past days
            h.history[dateStr] = true;
          }
        }
        updated = true;
      }
    });

    if (updated) this.save();
  },

  /**
   * Compute 7 days (Mon-Sun) of current week with formatting
   */
  getWeekDays() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayStr = now.toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      days.push({
        name: dayNames[i],
        dateStr,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
        isFuture: dateStr > todayStr
      });
    }

    return days;
  },

  /**
   * Calculate consecutive day streak for a habit
   */
  calculateStreak(habit) {
    if (!habit || !habit.history) return 0;

    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);

    // Check today first
    let dateStr = checkDate.toISOString().split('T')[0];
    if (habit.history[dateStr]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If not completed today yet, check yesterday to keep unbroken streak counting
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Count backwards
    while (true) {
      dateStr = checkDate.toISOString().split('T')[0];
      if (habit.history[dateStr]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  },

  /**
   * Toggle completion for a specific habit & date
   */
  toggleHabit(habitId, dateStr, clickEvent = null) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habit.history) habit.history = {};

    const currentlyDone = !!habit.history[dateStr];
    habit.history[dateStr] = !currentlyDone;

    this.save();

    if (!currentlyDone) {
      // Award +15 XP for completing a habit
      if (typeof XPEngine !== 'undefined') {
        const sourceEl = clickEvent ? clickEvent.target : null;
        XPEngine.award(15, `Habit Completed: ${habit.title}`, sourceEl);
        XPEngine.updateQuestProgress('subtasks', 1); // Also counts toward daily routine execution
      }

      if (typeof triggerConfetti === 'function') {
        triggerConfetti();
      }

      if (typeof showToast === 'function') {
        showToast(`Habit Completed: "${habit.title}" 🔥`, 'success');
      }

      if (typeof checkAndUpdateStreak === 'function') {
        checkAndUpdateStreak();
      }
    }

    this.renderWidget();
    if (typeof renderAll === 'function') renderAll();
  },

  addHabit(title, icon = '⚡', category = 'Personal', targetDays = 7) {
    if (!title || !title.trim()) return;

    const newHabit = {
      id: `habit_${Date.now()}`,
      title: title.trim(),
      icon: icon || '⚡',
      category: category || 'Personal',
      targetDaysPerWeek: parseInt(targetDays, 10) || 7,
      history: {},
      createdAt: new Date().toISOString()
    };

    this.habits.unshift(newHabit);
    this.save();
    this.renderWidget();

    if (typeof showToast === 'function') {
      showToast('New habit added to Cadence Matrix!', 'success');
    }
  },

  deleteHabit(habitId) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    if (confirm(`Remove habit "${habit.title}"?`)) {
      this.habits = this.habits.filter(h => h.id !== habitId);
      this.save();
      this.renderWidget();
      if (typeof showToast === 'function') {
        showToast('Habit removed.', 'info');
      }
    }
  },

  /**
   * Render 7-Day Consistency Dot Matrix Grid Widget on Home Landing Page
   */
  renderWidget() {
    const container = document.getElementById('habits-widget-container');
    if (!container) return;

    const weekDays = this.getWeekDays();
    const todayStr = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="habits-widget-card">
        <div class="habits-widget-header">
          <div class="habits-title-group">
            <span class="habits-header-icon">🔁</span>
            <div>
              <h3 class="habits-widget-title">Habits & Cadence Engine</h3>
              <p class="habits-widget-desc">Automatic daily routines & 7-day consistency dot matrix grid.</p>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-open-add-habit" title="Add New Habit">
            <i data-lucide="plus"></i>
            <span>Add Habit</span>
          </button>
        </div>

        <div class="habits-matrix-wrapper">
          <!-- Week Header Row -->
          <div class="habits-matrix-header-row">
            <div class="habit-col-title">Habit / Routine</div>
            <div class="habit-col-days">
              ${weekDays.map(d => `
                <div class="habit-day-header ${d.isToday ? 'today' : ''}">
                  <span class="day-name">${d.name}</span>
                  <span class="day-num">${parseInt(d.dateStr.split('-')[2], 10)}</span>
                </div>
              `).join('')}
            </div>
            <div class="habit-col-streak">Streak</div>
          </div>

          <!-- Habit Items Rows -->
          <div class="habits-matrix-rows">
            ${this.habits.map(habit => {
              const streak = this.calculateStreak(habit);
              const isTodayDone = !!(habit.history && habit.history[todayStr]);

              return `
                <div class="habit-matrix-row ${isTodayDone ? 'today-done' : ''}">
                  <div class="habit-info-cell">
                    <span class="habit-emoji">${habit.icon || '⚡'}</span>
                    <div class="habit-text">
                      <span class="habit-name">${escapeHTML(habit.title)}</span>
                      <span class="habit-meta">#${habit.category || 'Personal'}</span>
                    </div>
                    <button class="habit-delete-btn" onclick="HabitsEngine.deleteHabit('${habit.id}')" title="Delete habit">&times;</button>
                  </div>

                  <div class="habit-dots-cell">
                    ${weekDays.map(d => {
                      const done = !!(habit.history && habit.history[d.dateStr]);
                      let dotClass = 'habit-dot';
                      if (done) dotClass += ' completed';
                      if (d.isToday) dotClass += ' today';
                      if (d.isFuture) dotClass += ' future';

                      const dateFormatted = new Date(d.dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const titleAttr = done
                        ? `Done on ${dateFormatted}`
                        : d.isFuture
                        ? `Future (${dateFormatted})`
                        : `Click to mark completed for ${dateFormatted}`;

                      return `
                        <button class="${dotClass}" 
                                onclick="HabitsEngine.toggleHabit('${habit.id}', '${d.dateStr}', event)" 
                                title="${titleAttr}">
                          ${done ? '✓' : ''}
                        </button>
                      `;
                    }).join('')}
                  </div>

                  <div class="habit-streak-cell">
                    <span class="streak-pill ${streak > 0 ? 'active' : ''}">
                      ${streak} 🔥
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Bind Add Habit modal trigger
    const btnAddHabit = document.getElementById('btn-open-add-habit');
    if (btnAddHabit) {
      btnAddHabit.addEventListener('click', () => this.promptAddHabit());
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  promptAddHabit() {
    const title = prompt("Enter new daily habit / routine title:\n(e.g., Morning Workout, Read 20 Pages, Meditate 10m)");
    if (title && title.trim()) {
      const category = prompt("Category (Product, Engineering, Career, Finance, Health, Personal):", "Health") || "Personal";
      this.addHabit(title.trim(), "⚡", category, 7);
    }
  }
};

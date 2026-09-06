/**
 * Tesseract Executive Command Palette (Ctrl + K / Cmd + K)
 * Universal spotlight search, instant navigation, and power action hub.
 */

const CommandPalette = {
  isOpen: false,
  selectedIndex: 0,
  currentResults: [],

  init() {
    this.bindKeyboardShortcut();
  },

  bindKeyboardShortcut() {
    window.addEventListener('keydown', (e) => {
      // Ctrl + K or Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      }
      // Escape closes palette
      else if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    });
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    let modal = document.getElementById('command-palette-modal');
    if (!modal) return;

    this.isOpen = true;
    this.selectedIndex = 0;
    modal.style.display = 'flex';

    const input = document.getElementById('palette-search-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }

    this.renderInitialActions();
  },

  close() {
    const modal = document.getElementById('command-palette-modal');
    if (modal) modal.style.display = 'none';
    this.isOpen = false;
  },

  getNavigationItems() {
    return [
      {
        id: 'nav-home',
        category: 'NAVIGATION',
        title: 'Home Command Center',
        desc: 'Main multi-horizon execution dashboard',
        icon: 'layout-dashboard',
        action: () => { window.location.href = 'index.html'; }
      },
      {
        id: 'nav-cascade',
        category: 'NAVIGATION',
        title: 'Goal Cascade Tree',
        desc: 'Visual trace from daily tasks up to annual pillars',
        icon: 'git-merge',
        action: () => { window.location.href = 'cascade.html'; }
      },
      {
        id: 'nav-roadmap',
        category: 'NAVIGATION',
        title: '12-Month Gantt Roadmap',
        desc: 'Strategic timeline of annual & quarterly objectives',
        icon: 'calendar',
        action: () => { window.location.href = 'roadmap.html'; }
      },
      {
        id: 'nav-analytics',
        category: 'NAVIGATION',
        title: 'Productivity Analytics',
        desc: 'Horizon completion rates, XP history, velocity metrics',
        icon: 'bar-chart-2',
        action: () => { window.location.href = 'analytics.html'; }
      },
      {
        id: 'nav-bucketlist',
        category: 'NAVIGATION',
        title: "Life's Bucket List",
        desc: 'Lifetime summit ambitions & milestone dreams',
        icon: 'sparkles',
        action: () => { window.location.href = 'bucketlist.html'; }
      },
      {
        id: 'nav-profile',
        category: 'NAVIGATION',
        title: 'Executive Profile & North Star Creed',
        desc: 'XP level, badges, mission creed, and data vault',
        icon: 'user',
        action: () => { window.location.href = 'profile.html'; }
      }
    ];
  },

  getQuickActions() {
    const actions = [
      {
        id: 'act-focus-25',
        category: 'POWER ACTIONS',
        title: 'Start 25m Deep Work Sprint',
        desc: 'Launch distraction-free timer with ambient soundscapes',
        icon: 'zap',
        badge: '25 MIN',
        action: () => {
          this.close();
          if (typeof FocusEngine !== 'undefined') {
            FocusEngine.open(null, 25);
          } else {
            window.location.href = 'index.html';
          }
        }
      },
      {
        id: 'act-focus-50',
        category: 'POWER ACTIONS',
        title: 'Start 50m Deep Work Block',
        desc: 'Deep focus sprint for high-leverage strategic work',
        icon: 'flame',
        badge: '50 MIN',
        action: () => {
          this.close();
          if (typeof FocusEngine !== 'undefined') {
            FocusEngine.open(null, 50);
          } else {
            window.location.href = 'index.html';
          }
        }
      },
      {
        id: 'act-new-task',
        category: 'POWER ACTIONS',
        title: 'Create New Task / Goal',
        desc: 'Open goal creator across any of the 5 horizons',
        icon: 'plus-circle',
        badge: 'NEW',
        action: () => {
          this.close();
          if (typeof openModal === 'function') {
            openModal();
          } else {
            window.location.href = 'index.html';
          }
        }
      },
      {
        id: 'act-weekly-report',
        category: 'POWER ACTIONS',
        title: 'Generate Executive Weekly Report',
        desc: '1-click debrief of weekly XP, focus hours, habits & wins',
        icon: 'file-text',
        badge: 'DEBRIEF',
        action: () => {
          this.close();
          if (typeof WeeklyReportEngine !== 'undefined') {
            WeeklyReportEngine.open();
          }
        }
      },
      {
        id: 'act-shuffle-principle',
        category: 'POWER ACTIONS',
        title: 'Shuffle Executive Mindset Principle',
        desc: 'Rotate daily mental model quote on dashboard',
        icon: 'refresh-cw',
        badge: 'MENTAL MODEL',
        action: () => {
          this.close();
          if (typeof rotateMindsetPrinciple === 'function') {
            rotateMindsetPrinciple(true);
          } else {
            window.location.href = 'index.html';
          }
        }
      },
      {
        id: 'act-morning-priming',
        category: 'POWER ACTIONS',
        title: 'Launch Morning Priming Ritual',
        desc: 'Set 3 non-negotiable wins and daily executive intention',
        icon: 'sun',
        badge: 'RITUAL',
        action: () => {
          this.close();
          if (typeof RitualsEngine !== 'undefined') {
            RitualsEngine.openMorning();
          }
        }
      },
      {
        id: 'act-evening-shutdown',
        category: 'POWER ACTIONS',
        title: 'Launch Evening Shutdown Ritual',
        desc: 'Reflect on wins, log lessons, clear work headspace',
        icon: 'moon',
        badge: 'RITUAL',
        action: () => {
          this.close();
          if (typeof RitualsEngine !== 'undefined') {
            RitualsEngine.openEvening();
          }
        }
      },
      {
        id: 'act-toggle-theme',
        category: 'POWER ACTIONS',
        title: 'Toggle Dark / Light Theme',
        desc: 'Switch between Gold & Onyx dark and warm light mode',
        icon: 'sun-medium',
        badge: 'THEME',
        action: () => {
          this.close();
          if (typeof toggleTheme === 'function') {
            toggleTheme();
          }
        }
      },
      {
        id: 'act-export-backup',
        category: 'POWER ACTIONS',
        title: 'Download Full JSON Database Backup',
        desc: 'Instant 1-click snapshot of your entire matrix & XP',
        icon: 'download',
        badge: 'BACKUP',
        action: () => {
          this.close();
          if (typeof exportDataJSON === 'function') {
            exportDataJSON();
          } else if (typeof exportJSON === 'function') {
            exportJSON();
          }
        }
      }
    ];

    // Add view toggle actions if on index.html
    if (document.getElementById('eisenhower-matrix-container')) {
      actions.unshift({
        id: 'act-view-kanban',
        category: 'POWER ACTIONS',
        title: 'Switch to Kanban Board View',
        desc: 'Visual drag-and-drop columns: Backlog → To Do → In Progress → Done',
        icon: 'columns',
        badge: 'KANBAN',
        action: () => {
          this.close();
          if (typeof switchView === 'function') switchView('kanban');
        }
      });
      actions.unshift({
        id: 'act-view-matrix',
        category: 'POWER ACTIONS',
        title: 'Switch to Eisenhower 2×2 Matrix',
        desc: 'Classify tasks by urgency and importance quadrants',
        icon: 'grid',
        badge: 'MATRIX',
        action: () => {
          this.close();
          if (typeof switchView === 'function') switchView('eisenhower');
        }
      });
      actions.unshift({
        id: 'act-view-list',
        category: 'POWER ACTIONS',
        title: 'Switch to Standard List View',
        desc: 'Traditional task list grouped by horizon tier',
        icon: 'list',
        badge: 'LIST',
        action: () => {
          this.close();
          if (typeof switchView === 'function') switchView('list');
        }
      });
    }

    return actions;
  },

  renderInitialActions() {
    const quickActions = this.getQuickActions();
    const navItems = this.getNavigationItems();

    this.currentResults = [...quickActions, ...navItems];
    this.selectedIndex = 0;
    this.renderResults(this.currentResults);
  },

  handleSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.renderInitialActions();
      return;
    }

    const matched = [];

    // 1. Search Power Actions
    this.getQuickActions().forEach(act => {
      if (act.title.toLowerCase().includes(q) || act.desc.toLowerCase().includes(q) || act.category.toLowerCase().includes(q)) {
        matched.push(act);
      }
    });

    // 2. Search Navigation
    this.getNavigationItems().forEach(nav => {
      if (nav.title.toLowerCase().includes(q) || nav.desc.toLowerCase().includes(q)) {
        matched.push(nav);
      }
    });

    // 3. Search Tasks from state or localStorage
    let allTasks = [];
    if (typeof state !== 'undefined' && state.tasks) {
      allTasks = state.tasks;
    } else {
      try {
        allTasks = JSON.parse(localStorage.getItem('tesseract_goals_tasks_data') || '[]');
      } catch (e) {
        allTasks = [];
      }
    }

    const tierLabels = {
      daily: '🌅 Daily Task',
      weekly: '📅 Weekly Milestone',
      monthly: '🗓️ Monthly Goal',
      quarterly: '🎯 Quarterly OKR',
      annual: '🏆 Annual Vision'
    };

    allTasks.forEach(task => {
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchCat = (task.category || '').toLowerCase().includes(q);

      if (matchTitle || matchDesc || matchCat) {
        matched.push({
          id: `task-${task.id}`,
          category: 'TASKS & GOALS',
          title: task.title,
          desc: `${tierLabels[task.tier] || task.tier} • #${task.category || 'General'}${task.completed ? ' (✓ Completed)' : ''}`,
          icon: task.completed ? 'check-circle' : 'circle',
          badge: (task.priority || 'medium').toUpperCase(),
          badgeClass: `priority-${task.priority || 'medium'}`,
          action: () => {
            this.close();
            if (typeof FocusEngine !== 'undefined') {
              FocusEngine.open(task.id);
            } else {
              window.location.href = 'index.html';
            }
          }
        });
      }
    });

    // 4. Search Habits
    let habitsList = [];
    try {
      habitsList = JSON.parse(localStorage.getItem('tesseract_habits_data') || '[]');
    } catch (e) {}

    habitsList.forEach(habit => {
      if ((habit.name || '').toLowerCase().includes(q) || (habit.category || '').toLowerCase().includes(q)) {
        matched.push({
          id: `habit-${habit.id}`,
          category: 'HABITS',
          title: `${habit.icon || '🔁'} ${habit.name}`,
          desc: `Daily Habit • Streak: ${habit.streak || 0} days 🔥`,
          icon: 'repeat',
          badge: 'HABIT',
          action: () => {
            this.close();
            window.location.href = 'index.html';
          }
        });
      }
    });

    // 5. Search Bucket List
    let bucketList = [];
    try {
      bucketList = JSON.parse(localStorage.getItem('tesseract_bucketlist_data') || '[]');
    } catch (e) {}

    bucketList.forEach(item => {
      if ((item.title || '').toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q)) {
        matched.push({
          id: `bucket-${item.id}`,
          category: 'BUCKET LIST',
          title: `🌟 ${item.title}`,
          desc: `Lifetime Dream • Category: #${item.category || 'Adventure'}`,
          icon: 'sparkles',
          badge: 'SUMMIT',
          action: () => {
            this.close();
            window.location.href = 'bucketlist.html';
          }
        });
      }
    });

    this.currentResults = matched;
    this.selectedIndex = 0;
    this.renderResults(matched);
  },

  renderResults(results) {
    const listEl = document.getElementById('palette-results-list');
    if (!listEl) return;

    if (results.length === 0) {
      listEl.innerHTML = `
        <div class="palette-empty-state">
          <i data-lucide="search-x"></i>
          <p>No matching commands or tasks found.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    let html = '';
    let currentCategory = '';

    results.forEach((item, idx) => {
      if (item.category !== currentCategory) {
        currentCategory = item.category;
        html += `<div class="palette-group-header">${escapePaletteHTML(currentCategory)}</div>`;
      }

      const isSelected = idx === this.selectedIndex;
      html += `
        <div class="palette-item ${isSelected ? 'active' : ''}" data-index="${idx}" onclick="CommandPalette.selectIndex(${idx});">
          <div class="palette-item-icon">
            <i data-lucide="${item.icon || 'zap'}"></i>
          </div>
          <div class="palette-item-info">
            <div class="palette-item-title">${escapePaletteHTML(item.title)}</div>
            ${item.desc ? `<div class="palette-item-desc">${escapePaletteHTML(item.desc)}</div>` : ''}
          </div>
          ${item.badge ? `<span class="palette-item-badge ${item.badgeClass || ''}">${escapePaletteHTML(item.badge)}</span>` : ''}
        </div>
      `;
    });

    listEl.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Scroll active item into view
    const activeEl = listEl.querySelector('.palette-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  },

  selectIndex(index) {
    if (index >= 0 && index < this.currentResults.length) {
      const item = this.currentResults[index];
      if (item && typeof item.action === 'function') {
        item.action();
      }
    }
  },

  handleKeyDown(e) {
    if (!this.isOpen || this.currentResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.currentResults.length;
      this.renderResults(this.currentResults);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % this.currentResults.length;
      this.renderResults(this.currentResults);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.selectIndex(this.selectedIndex);
    }
  }
};

function escapePaletteHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    CommandPalette.init();
  });
}

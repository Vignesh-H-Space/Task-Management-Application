/**
 * Tesseract Goal & Task Management Matrix
 * Multi-dimensional reactive state manager with goal cascade & cosmic feedback
 */

const STORAGE_KEY = 'tesseract_goals_tasks_data';
const THEME_KEY = 'tesseract_goals_theme';
const STREAK_KEY = 'tesseract_streak_data';
const PROFILE_KEY = 'tesseract_profile_data';

// Streak milestone badges
const STREAK_BADGES = [
  { days: 7,   emoji: '🏅', name: '1 Week' },
  { days: 14,  emoji: '⚡', name: '2 Weeks' },
  { days: 30,  emoji: '🌟', name: '30 Days' },
  { days: 50,  emoji: '💎', name: '50 Days' },
  { days: 75,  emoji: '🔥', name: '75 Days' },
  { days: 100, emoji: '👑', name: '100 Days' },
  { days: 150, emoji: '🚀', name: '150 Days' },
  { days: 200, emoji: '🏆', name: '200 Days' },
  { days: 250, emoji: '💫', name: '250 Days' },
  { days: 300, emoji: '🌈', name: '300 Days' },
  { days: 365, emoji: '🎯', name: '1 Year' }
];

const TIERS = [
  { id: 'daily', name: 'Daily Tasks', emoji: '🌅', color: '#f59e0b', desc: "Today's high-leverage execution items" },
  { id: 'weekly', name: 'Weekly Milestones', emoji: '📅', color: '#8b5cf6', desc: 'Tactical milestones for this week' },
  { id: 'monthly', name: 'Monthly Goals', emoji: '🗓️', color: '#10b981', desc: 'Deliverables and focus areas for this month' },
  { id: 'quarterly', name: 'Quarterly Goals', emoji: '🎯', color: '#06b6d4', desc: '90-day objectives & key strategic results' },
  { id: 'annual', name: 'Annual Vision', emoji: '🏆', color: '#f43f5e', desc: 'North star pillars & yearly ambitions' }
];

let state = {
  tasks: [],
  activeHorizon: 'general', // 'general' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'all'
  statusFilter: 'all', // 'all' | 'active' | 'completed'
  categoryFilter: 'all',
  priorityFilter: 'all',
  searchQuery: '',
  editingTaskId: null,
  viewMode: 'list', // 'list' | 'eisenhower'
  profile: {
    name: 'Tesseract User',
    image: null
  },
  streak: {
    count: 0,
    lastDate: null
  }
};

// Initialization
function init() {
  loadTheme();
  loadData();
  loadStreak();
  loadProfile();

  // Read URL parameters on index.html (e.g. ?horizon=daily)
  const urlParams = new URLSearchParams(window.location.search);
  const horizonParam = urlParams.get('horizon');
  if (horizonParam && ['general', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'all'].includes(horizonParam)) {
    state.activeHorizon = horizonParam;
  }

  // Inject shared layout components
  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (typeof Components !== 'undefined') {
    Components.renderSidebar(state.activeHorizon);
    
    let headerConfig = { title: 'Executive Command Center', subtitle: 'Unified multi-horizon cockpit & execution launchpad.', showSearch: true };
    if (page === 'cascade') {
      headerConfig = { title: 'Strategic Goal Cascade', subtitle: 'Multi-horizon vertical alignment linking daily actions to annual vision.', showSearch: false };
    } else if (page === 'analytics') {
      headerConfig = { title: 'Productivity & Goal Analytics', subtitle: 'Comprehensive metric tracking and horizon performance.', showSearch: false };
    } else if (page === 'roadmap') {
      headerConfig = { title: '12-Month Horizon Timeline', subtitle: 'Interactive Gantt roadmap connecting annual & quarterly goals to deadlines.', showSearch: false };
    } else if (page === 'bucketlist') {
      headerConfig = { title: "Life's Bucket List", subtitle: 'Lifetime dreams, epic adventures, and summit ambitions.', showSearch: false };
    } else if (page === 'profile') {
      headerConfig = { title: 'Your Profile', subtitle: 'Stats, badges, and activity history.', showSearch: false };
    }
    Components.renderHeader(headerConfig);
    Components.renderModalAndToasts();
  }

  bindEvents();
  FocusEngine.init();
  if (typeof XPEngine !== 'undefined') XPEngine.init();
  if (typeof HabitsEngine !== 'undefined') HabitsEngine.init();
  if (typeof RoadmapEngine !== 'undefined') RoadmapEngine.init();
  if (typeof RitualsEngine !== 'undefined') RitualsEngine.init();
  if (typeof BucketListEngine !== 'undefined') BucketListEngine.init();
  renderAll();
  renderStreakUI();
  lucide.createIcons();
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state.tasks = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse localStorage data', e);
      state.tasks = typeof INITIAL_TASKS !== 'undefined' ? [...INITIAL_TASKS] : [];
    }
  } else if (typeof INITIAL_TASKS !== 'undefined') {
    state.tasks = [...INITIAL_TASKS];
    saveData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadProfile() {
  const saved = localStorage.getItem(PROFILE_KEY);
  if (saved) {
    try {
      state.profile = JSON.parse(saved);
    } catch (e) {
      // Keep default
    }
  }
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
}

// ── Streak Engine ──────────────────────────────────────────
function getToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 999;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);
  const diffTime = date2.getTime() - date1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function loadStreak() {
  if (typeof XPEngine !== 'undefined' && XPEngine.data) {
    state.streak = {
      count: XPEngine.data.streak || 1,
      lastDate: XPEngine.data.lastActiveDate || getToday()
    };
    return;
  }

  const saved = localStorage.getItem(STREAK_KEY);
  if (saved) {
    try {
      state.streak = JSON.parse(saved);
    } catch (e) {
      state.streak = { count: 1, lastDate: getToday() };
    }
  } else {
    state.streak = { count: 1, lastDate: getToday() };
    saveStreak();
  }
}

function saveStreak() {
  localStorage.setItem(STREAK_KEY, JSON.stringify(state.streak));
  if (typeof XPEngine !== 'undefined' && XPEngine.data) {
    XPEngine.data.streak = state.streak.count;
    XPEngine.data.lastActiveDate = state.streak.lastDate;
    XPEngine.save();
  }
}

function checkAndUpdateStreak() {
  const today = getToday();
  if (!state.streak) state.streak = { count: 1, lastDate: null };

  const lastDate = state.streak.lastDate;
  const diffDays = getDaysBetween(lastDate, today);

  if (diffDays === 0) {
    // Already logged for today, streak is active
    return;
  }

  if (diffDays === 1) {
    // Consecutive day execution!
    state.streak.count = (state.streak.count || 0) + 1;
    state.streak.lastDate = today;
    saveStreak();
    triggerConfetti();
    showToast(`🔥 Daily Streak Advanced! You're on a ${state.streak.count}-day streak!`, 'success');
    renderStreakUI();
  } else if (diffDays > 1) {
    // Missed day(s)
    if (typeof XPEngine !== 'undefined' && XPEngine.data && XPEngine.data.streakShields > 0) {
      XPEngine.data.streakShields -= 1;
      state.streak.lastDate = today;
      saveStreak();
      showToast(`🛡️ Streak Shield Saved Your ${state.streak.count}-Day Streak! (${XPEngine.data.streakShields} shield left)`, 'warning');
    } else {
      state.streak.count = 1;
      state.streak.lastDate = today;
      saveStreak();
      showToast(`🔥 Day 1 of your new execution streak! Rebuild your momentum.`, 'info');
    }
    renderStreakUI();
  }
}

function promptEditStreak() {
  const current = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : (state.streak ? state.streak.count : 1);
  const input = prompt('🔥 Set your current Execution Streak (Days):', current);
  if (input !== null) {
    const num = parseInt(input.trim(), 10);
    if (!isNaN(num) && num >= 0) {
      if (typeof XPEngine !== 'undefined' && typeof XPEngine.setManualStreak === 'function') {
        XPEngine.setManualStreak(num);
      } else {
        state.streak = { count: num, lastDate: getToday() };
        saveStreak();
        renderStreakUI();
        if (typeof renderAll === 'function') renderAll();
        showToast(`🔥 Streak updated to ${num} Days!`, 'success');
      }
    }
  }
}

function renderStreakUI() {
  const count = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : (state.streak ? state.streak.count : 1);
  const counterEl = document.getElementById('streak-counter');
  const fillEl = document.getElementById('streak-fill');
  const labelEl = document.getElementById('streak-badge-label');
  const badgeContainer = document.getElementById('streak-badges');

  if (counterEl) {
    counterEl.textContent = `${count} Day${count !== 1 ? 's' : ''}`;
    counterEl.title = 'Click to customize/adjust your streak';
    counterEl.style.cursor = 'pointer';
    counterEl.onclick = promptEditStreak;
  }

  const pstatStreak = document.getElementById('pstat-streak') || document.getElementById('pstat-streak-days');
  if (pstatStreak) {
    pstatStreak.textContent = `${count} 🔥`;
    pstatStreak.style.cursor = 'pointer';
    pstatStreak.title = 'Click to customize/adjust your streak';
    pstatStreak.onclick = promptEditStreak;
  }

  let nextBadge = STREAK_BADGES.find(b => b.days > count) || STREAK_BADGES[STREAK_BADGES.length - 1];
  let prevDays = 0;
  const currBadgeIndex = STREAK_BADGES.findIndex(b => b.days > count);
  if (currBadgeIndex > 0) {
    prevDays = STREAK_BADGES[currBadgeIndex - 1].days;
  }

  const progressRange = nextBadge.days - prevDays;
  const progressCurrent = count - prevDays;
  const pct = Math.min(100, Math.max(0, Math.round((progressCurrent / progressRange) * 100)));

  if (fillEl) fillEl.style.width = `${pct}%`;
  if (labelEl) {
    if (count >= 365) {
      labelEl.textContent = '🏆 Grandmaster (1 Year Achieved!)';
    } else {
      const daysLeft = nextBadge.days - count;
      labelEl.textContent = `Next: ${nextBadge.emoji} ${nextBadge.name} (${daysLeft}d left)`;
    }
  }

  if (badgeContainer) {
    badgeContainer.innerHTML = '';
    STREAK_BADGES.forEach((badge, idx) => {
      const earned = count >= badge.days;
      const isNext = !earned && (idx === 0 || count >= STREAK_BADGES[idx - 1].days);
      const span = document.createElement('span');
      span.className = `streak-badge-pill ${earned ? 'earned' : isNext ? 'next' : 'locked'}`;
      span.textContent = badge.emoji;
      span.title = earned
        ? `Unlocked: ${badge.name} (${badge.days} days streak)`
        : isNext
        ? `Next up: ${badge.name} (${badge.days - count} days to go!)`
        : `Locked: ${badge.name} (${badge.days} days streak)`;
      badgeContainer.appendChild(span);
    });
  }
}

// ── Theme Switcher ──────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
}

// Horizon Navigation
function setHorizonFilter(horizon) {
  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (page !== 'index') {
    window.location.href = `index.html?horizon=${horizon}`;
    return;
  }

  state.activeHorizon = horizon;

  // Sync sidebar
  document.querySelectorAll('.nav-menu button[data-horizon]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-horizon') === horizon);
  });

  // Sync dropdown
  const horizonSelectFilter = document.getElementById('horizon-select-filter');
  if (horizonSelectFilter) {
    horizonSelectFilter.value = horizon;
  }

  renderAll();
}

// Event Bindings
function bindEvents() {
  // Horizon Sidebar Tabs
  document.querySelectorAll('.nav-menu button[data-horizon]').forEach(btn => {
    btn.addEventListener('click', () => {
      setHorizonFilter(btn.getAttribute('data-horizon'));
    });
  });

  // Horizon Dropdown Select Filter
  const horizonSelectFilter = document.getElementById('horizon-select-filter');
  if (horizonSelectFilter) {
    horizonSelectFilter.addEventListener('change', (e) => {
      setHorizonFilter(e.target.value);
    });
  }

  // Horizon Card click
  document.querySelectorAll('.horizon-card').forEach(card => {
    card.addEventListener('click', () => {
      const horizon = card.getAttribute('data-horizon');
      setHorizonFilter(horizon);
    });
  });

  // Status Segment Filter
  document.querySelectorAll('#status-filter .segment').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#status-filter .segment').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.statusFilter = btn.getAttribute('data-status');
      renderTaskList();
    });
  });

  // Dropdown Filters
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      state.categoryFilter = e.target.value;
      renderTaskList();
    });
  }

  const priorityFilter = document.getElementById('priority-filter');
  if (priorityFilter) {
    priorityFilter.addEventListener('change', (e) => {
      state.priorityFilter = e.target.value;
      renderTaskList();
    });
  }

  // Omni-Search Autocomplete & Global Search Controller
  initSearchController();

  // Global Keyboard Shortcuts ('/' to search & 'N' for new task)
  window.addEventListener('keydown', (e) => {
    const searchInput = document.getElementById('search-input');
    const taskModal = document.getElementById('task-modal');
    if (e.key === '/' && searchInput && document.activeElement !== searchInput && (!taskModal || taskModal.style.display === 'none')) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if ((e.key === 'n' || e.key === 'N') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && (!taskModal || taskModal.style.display === 'none')) {
      e.preventDefault();
      openAddModal();
    }
    if (e.key === 'Escape') {
      const panel = document.getElementById('search-suggestions');
      if (panel) panel.style.display = 'none';
      if (taskModal && taskModal.style.display !== 'none') {
        closeModal();
      }
    }
  });

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const btnOpenAddModal = document.getElementById('btn-open-add-modal');
  if (btnOpenAddModal) btnOpenAddModal.addEventListener('click', () => openAddModal());

  const modalCloseBtn = document.getElementById('modal-close-btn');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

  const btnResetData = document.getElementById('btn-reset-data');
  if (btnResetData) btnResetData.addEventListener('click', resetToSampleData);

  const btnExportJson = document.getElementById('btn-export-json');
  if (btnExportJson) btnExportJson.addEventListener('click', exportJSON);

  const btnExportMd = document.getElementById('btn-export-markdown');
  if (btnExportMd) btnExportMd.addEventListener('click', exportMarkdown);

  // Profile Edit
  const profileAvatarBtn = document.getElementById('profile-avatar-large');
  const profileImageInput = document.getElementById('profile-image-input');
  if (profileAvatarBtn && profileImageInput) {
    profileAvatarBtn.addEventListener('click', () => {
      profileImageInput.click();
    });
    profileImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          state.profile.image = event.target.result;
          saveProfile();
          renderProfileView();
          updateHeaderAvatar();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const btnEditName = document.getElementById('btn-edit-name');
  if (btnEditName) {
    btnEditName.addEventListener('click', () => {
      const newName = prompt("Enter your new profile name:", state.profile.name);
      if (newName && newName.trim() !== '') {
        state.profile.name = newName.trim();
        saveProfile();
        renderProfileView();
      }
    });
  }

  const importTrigger = document.getElementById('btn-import-trigger');
  const importInput = document.getElementById('import-file-input');
  if (importTrigger && importInput) {
    importTrigger.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', handleImportJSON);
  }

  // Form Submit
  const taskForm = document.getElementById('task-form');
  if (taskForm) taskForm.addEventListener('submit', handleFormSubmit);

  // Modal Sub-tasks Add Button & Enter key
  const btnAddSubtask = document.getElementById('btn-add-modal-subtask');
  const modalSubtaskInput = document.getElementById('modal-subtask-input');
  if (btnAddSubtask && modalSubtaskInput) {
    const handleAdd = () => {
      const val = modalSubtaskInput.value.trim();
      if (val) {
        addModalSubtaskRow(val, false);
        modalSubtaskInput.value = '';
        modalSubtaskInput.focus();
      }
    };
    btnAddSubtask.addEventListener('click', handleAdd);
    modalSubtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    });
  }
}

// ── Omni-Search Autocomplete Controller ────────────────────────
function initSearchController() {
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const suggestionsPanel = document.getElementById('search-suggestions');
  if (!searchInput) return;

  let activeIndex = -1;

  function highlightMatch(text, query) {
    if (!text) return '';
    if (!query) return escapeHTML(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapeHTML(text).replace(regex, '<mark>$1</mark>');
  }

  function getSuggestions(query) {
    if (!query) return { tasks: [], dreams: [] };
    const q = query.toLowerCase();

    // 1. Task matches across active state
    const taskMatches = (state.tasks || []).filter(t => {
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchTier = (t.tier || '').toLowerCase().includes(q);
      const matchTags = (t.tags || []).some(tg => tg.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCat || matchTier || matchTags;
    }).slice(0, 6);

    // 2. Bucket list dreams matches
    let dreamMatches = [];
    try {
      const rawDreams = localStorage.getItem('tesseract_bucketlist_data');
      if (rawDreams) {
        const dreams = JSON.parse(rawDreams);
        dreamMatches = (dreams || []).filter(d => {
          const matchTitle = (d.title || '').toLowerCase().includes(q);
          const matchDesc = (d.description || '').toLowerCase().includes(q);
          const matchCat = (d.category || '').toLowerCase().includes(q);
          return matchTitle || matchDesc || matchCat;
        }).slice(0, 3);
      }
    } catch (e) {}

    return { tasks: taskMatches, dreams: dreamMatches };
  }

  function renderSuggestions(query) {
    if (!suggestionsPanel) return;
    activeIndex = -1;

    if (!query || query.length === 0) {
      suggestionsPanel.style.display = 'none';
      suggestionsPanel.innerHTML = '';
      return;
    }

    const { tasks, dreams } = getSuggestions(query);
    const totalCount = tasks.length + dreams.length;

    if (totalCount === 0) {
      suggestionsPanel.innerHTML = `
        <div class="search-suggestion-empty">
          No matches found for "<strong>${escapeHTML(query)}</strong>"
        </div>
      `;
      suggestionsPanel.style.display = 'block';
      return;
    }

    let html = '';

    if (tasks.length > 0) {
      html += `<div class="search-suggestion-header">Tasks & Goals (${tasks.length})</div>`;
      tasks.forEach((t, idx) => {
        const tierObj = TIERS.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task', color: '#6366f1' };
        html += `
          <div class="search-suggestion-item" data-type="task" data-id="${t.id}" data-index="${idx}" onclick="selectSearchTask('${t.id}')">
            <div class="search-suggestion-left">
              <span class="search-suggestion-emoji">${tierObj.emoji}</span>
              <div class="search-suggestion-title-box">
                <div class="search-suggestion-title">${highlightMatch(t.title, query)}</div>
                <div class="search-suggestion-sub">
                  <span style="color:${tierObj.color}">${tierObj.name}</span>
                  ${t.category ? ` • #${escapeHTML(t.category)}` : ''}
                  ${t.completed ? ' • <span style="color:#10b981;">✓ Completed</span>' : ''}
                </div>
              </div>
            </div>
            <div class="search-suggestion-right">
              <span class="search-suggestion-pill em-prio-${t.priority}">${t.priority}</span>
            </div>
          </div>
        `;
      });
    }

    if (dreams.length > 0) {
      html += `<div class="search-suggestion-header" style="margin-top:4px;">Bucket List Dreams (${dreams.length})</div>`;
      dreams.forEach((d, idx) => {
        const totalIdx = tasks.length + idx;
        html += `
          <div class="search-suggestion-item" data-type="dream" data-id="${d.id}" data-index="${totalIdx}" onclick="selectSearchDream('${d.id}')">
            <div class="search-suggestion-left">
              <span class="search-suggestion-emoji">${d.emoji || '🪣'}</span>
              <div class="search-suggestion-title-box">
                <div class="search-suggestion-title">${highlightMatch(d.title, query)}</div>
                <div class="search-suggestion-sub">
                  <span style="color:#f43f5e;">Life's Bucket List</span>
                  ${d.category ? ` • ${escapeHTML(d.category)}` : ''}
                </div>
              </div>
            </div>
            <div class="search-suggestion-right">
              <span class="search-suggestion-pill" style="background:rgba(244,63,94,0.15); color:#f43f5e;">${d.status || 'DREAM'}</span>
            </div>
          </div>
        `;
      });
    }

    suggestionsPanel.innerHTML = html;
    suggestionsPanel.style.display = 'block';
  }

  // Real-time input handler
  searchInput.addEventListener('input', (e) => {
    const rawVal = e.target.value;
    state.searchQuery = rawVal.trim().toLowerCase();
    if (clearSearchBtn) clearSearchBtn.style.display = rawVal ? 'flex' : 'none';

    renderSuggestions(state.searchQuery);

    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
    if (page === 'index') {
      if (state.viewMode === 'eisenhower') {
        renderEisenhowerMatrix();
      } else {
        renderTaskList();
      }
    }
  });

  // Focus event to reopen suggestions if query exists
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      renderSuggestions(searchInput.value.trim().toLowerCase());
    }
  });

  // Keyboard navigation within suggestions
  searchInput.addEventListener('keydown', (e) => {
    if (!suggestionsPanel || suggestionsPanel.style.display === 'none') return;
    const items = suggestionsPanel.querySelectorAll('.search-suggestion-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      } else {
        suggestionsPanel.style.display = 'none';
      }
    }
  });

  function updateActiveItem(items) {
    items.forEach((it, idx) => {
      it.classList.toggle('active', idx === activeIndex);
      if (idx === activeIndex) {
        it.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      if (suggestionsPanel) {
        suggestionsPanel.style.display = 'none';
        suggestionsPanel.innerHTML = '';
      }
      const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
      if (page === 'index') {
        if (state.viewMode === 'eisenhower') {
          renderEisenhowerMatrix();
        } else {
          renderTaskList();
        }
      }
      searchInput.focus();
    });
  }

  // Click outside to dismiss
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('search-box-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      if (suggestionsPanel) suggestionsPanel.style.display = 'none';
    }
  });
}

function selectSearchTask(taskId) {
  const panel = document.getElementById('search-suggestions');
  if (panel) panel.style.display = 'none';

  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (page === 'index') {
    openEditModal(taskId);
  } else {
    window.location.href = `index.html`;
  }
}

function selectSearchDream(dreamId) {
  const panel = document.getElementById('search-suggestions');
  if (panel) panel.style.display = 'none';

  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (page === 'bucketlist') {
    if (typeof BucketListEngine !== 'undefined') BucketListEngine.openAddModal(dreamId);
  } else {
    window.location.href = `bucketlist.html`;
  }
}

// Toggle Task Completion
function toggleTaskCompletion(taskId, clickEvent = null) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  saveData();

  if (task.completed) {
    triggerConfetti();
    
    // Gamified XP Awarding
    if (typeof XPEngine !== 'undefined') {
      const xpMap = {
        daily: XP_VALUES.DAILY_TASK,
        weekly: XP_VALUES.WEEKLY_TASK,
        monthly: XP_VALUES.MONTHLY_TASK,
        quarterly: XP_VALUES.QUARTERLY_TASK,
        annual: XP_VALUES.ANNUAL_VISION
      };
      const xp = xpMap[task.tier] || 10;
      const tierObj = TIERS.find(t => t.id === task.tier) || { name: 'Task' };
      const sourceEl = clickEvent ? clickEvent.target : null;
      
      XPEngine.award(xp, `${tierObj.name} Completed`, sourceEl);

      // Quest updates
      if (task.tier === 'daily') {
        XPEngine.updateQuestProgress('daily_tasks', 1);
      } else {
        XPEngine.updateQuestProgress('higher_tier', 1);
      }

      // Check for Perfect Day bonus (100% daily tasks done)
      const dailyTasks = state.tasks.filter(t => t.tier === 'daily');
      if (dailyTasks.length > 0 && dailyTasks.every(t => t.completed)) {
        XPEngine.award(XP_VALUES.PERFECT_DAY_BONUS, '🎯 Perfect Execution Bonus (All Daily Goals Done)');
      }
    }

    showToast(`Completed: "${task.title}" 🎉`, 'success');
    checkAndUpdateStreak();
  } else {
    showToast(`Reopened: "${task.title}"`, 'info');
  }

  renderAll();
}

// Delete Task
function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    state.tasks.forEach(t => {
      if (t.parentId === taskId) t.parentId = null;
    });
    saveData();
    showToast('Task removed.', 'info');
    renderAll();
  }
}

// Confetti Celebration
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.75 },
      colors: ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b']
    });
  }
}

// Header Profile Avatar Update
function updateHeaderAvatar() {
  const headerImg = document.getElementById('header-avatar-img');
  const headerFallback = document.getElementById('header-avatar-fallback');
  if (headerImg && headerFallback) {
    if (state.profile && state.profile.image) {
      headerImg.src = state.profile.image;
      headerImg.style.display = 'block';
      headerFallback.style.display = 'none';
    } else {
      headerImg.style.display = 'none';
      headerFallback.style.display = 'block';
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// 💡 Executive Mental Models & Daily Principles Database (30+ Curated Models)
// ══════════════════════════════════════════════════════════════════
const EXECUTIVE_PRINCIPLES = [
  {
    category: "SYSTEMS THINKING",
    emoji: "⚙️",
    quote: "You do not rise to the level of your goals. You fall to the level of your systems. Focus on daily trajectory over fleeting motivation.",
    author: "James Clear"
  },
  {
    category: "HIGH-LEVERAGE EXECUTION",
    emoji: "⚡",
    quote: "Focus on high-leverage execution. 20% of your priorities will produce 80% of your breakthrough outcomes. Ruthlessly protect that 20%.",
    author: "Vilfredo Pareto"
  },
  {
    category: "DEEP WORK ESSENTIAL",
    emoji: "🧠",
    quote: "High-quality work produced = (Time Spent) × (Intensity of Focus). Eliminate shallow context switching to dominate your craft.",
    author: "Cal Newport"
  },
  {
    category: "SPEED OF IMPLEMENTATION",
    emoji: "🚀",
    quote: "Speed of implementation is the ultimate competitive advantage. Turn high-conviction decisions into immediate tangible momentum.",
    author: "Peter Drucker"
  },
  {
    category: "ESSENTIALISM",
    emoji: "🎯",
    quote: "If you don't prioritize your life, someone else will. Say no to the trivial many so you can execute the vital few.",
    author: "Greg McKeown"
  },
  {
    category: "STOIC MASTERY",
    emoji: "🏛️",
    quote: "The impediment to action advances action. What stands in the way becomes the way. Embrace friction as fuel for greatness.",
    author: "Marcus Aurelius"
  },
  {
    category: "RADICAL CLARITY",
    emoji: "💎",
    quote: "Deciding what NOT to do is as important as deciding what to do. Simplicity and relentless focus compound into excellence.",
    author: "Steve Jobs"
  },
  {
    category: "COMPOUND MOMENTUM",
    emoji: "📈",
    quote: "The big returns are not in the single action, but in the relentless daily compounding. Consistency is the true multiplier.",
    author: "Charlie Munger"
  },
  {
    category: "BIAS FOR ACTION",
    emoji: "🔥",
    quote: "Action cures fear, hesitation, and over-analysis. Take the next highest-leverage step right now with full conviction.",
    author: "David Schwartz"
  },
  {
    category: "ENERGY OVER TIME",
    emoji: "🔋",
    quote: "Manage your energy, not just your time. Execute your most demanding strategic sprint when your cognitive focus is at its peak.",
    author: "Tony Schwartz"
  },
  {
    category: "THE ONE THING",
    emoji: "📌",
    quote: "What's the ONE Thing you can execute today such that by doing it everything else will become easier or unnecessary?",
    author: "Gary Keller"
  },
  {
    category: "TACTICAL PATIENCE",
    emoji: "⏳",
    quote: "Most people overestimate what they can do in a day, and underestimate what they can achieve in a year of unbroken execution.",
    author: "Bill Gates"
  },
  {
    category: "INVERSION PRINCIPLE",
    emoji: "🔄",
    quote: "Invert, always invert. Figure out what guarantees failure, then systematically engineer it out of your daily operating rhythm.",
    author: "Carl Jacobi"
  },
  {
    category: "FIRST PRINCIPLES",
    emoji: "🔬",
    quote: "Boil things down to their fundamental truths and reason up from there, rather than operating by shallow analogy.",
    author: "Elon Musk"
  },
  {
    category: "UNRELENTING DISCIPLINE",
    emoji: "🛡️",
    quote: "Discipline is choosing between what you want right now and what you want most. Hold the line on your non-negotiables.",
    author: "Abraham Lincoln"
  },
  {
    category: "EXECUTION OVER IDEAS",
    emoji: "💡",
    quote: "Ideas without execution are hallucinations. The marketplace rewards finished deliverables, not unacted intentions.",
    author: "Sam Altman"
  },
  {
    category: "FLOW STATE ARCHITECTURE",
    emoji: "🌊",
    quote: "Protect uninterrupted cognitive flow with your life. Multitasking is merely the illusion of productivity masking shallow work.",
    author: "Mihaly Csikszentmihalyi"
  },
  {
    category: "MARGIN OF SAFETY",
    emoji: "🧱",
    quote: "Build buffers into your roadmap. True executive mastery is performing with composure when reality deviates from plan.",
    author: "Nassim Nicholas Taleb"
  },
  {
    category: "THE TWO-MINUTE CADENCE",
    emoji: "⏱️",
    quote: "Never leave the site of a strategic decision without taking an immediate micro-action toward its execution.",
    author: "Tony Robbins"
  },
  {
    category: "NORTH STAR ALIGNMENT",
    emoji: "🧭",
    quote: "If a daily action doesn't bridge toward your Annual Vision or Quarterly summit, question why it exists on your agenda.",
    author: "Tesseract Operating Creed"
  },
  {
    category: "RELENTLESS SIMPLIFICATION",
    emoji: "✂️",
    quote: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
    author: "Antoine de Saint-Exupéry"
  }
];

let currentMindsetIndex = -1;

function rotateMindsetPrinciple(isManual = false) {
  const quoteEl = document.getElementById('mindset-quote');
  const catEl = document.getElementById('mindset-category');
  const authorEl = document.getElementById('mindset-author');
  const emojiEl = document.getElementById('mindset-emoji');
  const ribbon = document.getElementById('mindset-ribbon');

  if (!quoteEl || !catEl) return;

  if (isManual) {
    let nextIdx;
    do {
      nextIdx = Math.floor(Math.random() * EXECUTIVE_PRINCIPLES.length);
    } while (nextIdx === currentMindsetIndex && EXECUTIVE_PRINCIPLES.length > 1);
    currentMindsetIndex = nextIdx;
  } else {
    // Deterministic daily rotation based on Date string hash
    const todayStr = new Date().toISOString().split('T')[0];
    let hash = 0;
    for (let i = 0; i < todayStr.length; i++) {
      hash = ((hash << 5) - hash) + todayStr.charCodeAt(i);
      hash |= 0;
    }
    currentMindsetIndex = Math.abs(hash) % EXECUTIVE_PRINCIPLES.length;
  }

  const p = EXECUTIVE_PRINCIPLES[currentMindsetIndex];
  if (!p) return;

  // Add subtle animation trigger
  if (ribbon) {
    ribbon.classList.remove('principle-changed');
    void ribbon.offsetWidth; // trigger reflow
    ribbon.classList.add('principle-changed');
  }

  quoteEl.textContent = `"${p.quote}"`;
  catEl.textContent = p.category;
  if (authorEl) authorEl.textContent = `— ${p.author}`;
  if (emojiEl) emojiEl.textContent = p.emoji;

  if (isManual && typeof showToast === 'function') {
    showToast(`💡 New Principle: ${p.category}`, 'info');
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function copyMindsetPrinciple() {
  const p = EXECUTIVE_PRINCIPLES[currentMindsetIndex] || EXECUTIVE_PRINCIPLES[0];
  if (!p) return;
  const text = `"${p.quote}" — ${p.author} [${p.category}]`;
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showToast === 'function') {
      showToast('📋 Daily Principle copied to clipboard!', 'success');
    }
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Failed to copy.', 'error');
  });
}

// Main Render Function
function renderAll() {
  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';

  updateHeaderAvatar();
  updateSidebarBadges();
  renderStreakUI();

  if (page === 'index') {
    renderHomeCommandHero();
    syncHorizonUI();
    updateHeaderTitle();
    updateProgressCards();
    renderTaskList();
    if (typeof HabitsEngine !== 'undefined') HabitsEngine.renderWidget();
    if (typeof RitualsEngine !== 'undefined') RitualsEngine.renderMorningBanner();
  } else if (page === 'cascade') {
    renderCascadeView();
  } else if (page === 'analytics') {
    updateProgressCards();
    renderAnalyticsView();
  } else if (page === 'roadmap') {
    if (typeof RoadmapEngine !== 'undefined') RoadmapEngine.render();
  } else if (page === 'bucketlist') {
    if (typeof BucketListEngine !== 'undefined') BucketListEngine.render();
  } else if (page === 'profile') {
    renderProfileView();
  }

  if (typeof XPEngine !== 'undefined') {
    XPEngine.updateUI();
  }

  if (typeof AlignmentEngine !== 'undefined') {
    AlignmentEngine.renderAlignmentUI();
  }

  lucide.createIcons();
}

// Render Executive Command Hero on Home
function renderHomeCommandHero() {
  const hero = document.getElementById('command-hero');
  if (!hero) return;

  // If filtered to a single sub-horizon (like quarterly or annual only), hide hero to keep focus
  if (state.activeHorizon !== 'general' && state.activeHorizon !== 'all') {
    hero.style.display = 'none';
    const ribbon = document.getElementById('mindset-ribbon');
    if (ribbon) ribbon.style.display = 'none';
    return;
  }
  hero.style.display = 'block';
  const ribbon = document.getElementById('mindset-ribbon');
  if (ribbon) ribbon.style.display = 'flex';

  // Live Date
  const dateEl = document.getElementById('live-date-text');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // Greeting
  const userName = (state.profile && state.profile.name) ? state.profile.name : 'Achiever';
  const greetingTitle = document.getElementById('home-greeting-title');
  if (greetingTitle) {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    greetingTitle.textContent = `${timeOfDay}, ${userName} 👋`;
  }

  // Quick Metrics
  const dailyTasks = state.tasks.filter(t => t.tier === 'daily');
  const dailyCompleted = dailyTasks.filter(t => t.completed).length;
  const urgentCount = state.tasks.filter(t => t.priority === 'urgent' && !t.completed).length;
  const streakCount = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : (state.streak ? state.streak.count : 1);

  const metricDaily = document.getElementById('metric-daily-ratio');
  const metricStreak = document.getElementById('metric-streak-count');
  const metricUrgent = document.getElementById('metric-urgent-count');

  if (metricDaily) metricDaily.textContent = `${dailyCompleted}/${dailyTasks.length}`;
  if (metricStreak) metricStreak.textContent = `${streakCount} 🔥`;
  if (metricUrgent) metricUrgent.textContent = urgentCount;

  // Spotlight Priority Task
  const spotlightInner = document.getElementById('spotlight-inner');
  if (spotlightInner) {
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    let topTask = incompleteTasks.find(t => t.tier === 'daily' && t.priority === 'urgent')
      || incompleteTasks.find(t => t.tier === 'daily' && t.priority === 'high')
      || incompleteTasks.find(t => t.tier === 'daily')
      || incompleteTasks.find(t => t.priority === 'urgent')
      || incompleteTasks.find(t => t.priority === 'high')
      || incompleteTasks[0];

    if (topTask) {
      const tierObj = TIERS.find(t => t.id === topTask.tier) || { emoji: '📌', name: 'Task' };
      spotlightInner.innerHTML = `
        <div class="spotlight-task-title">
          <span>${tierObj.emoji}</span>
          <span>${escapeHTML(topTask.title)}</span>
        </div>
        <div class="spotlight-task-meta">
          <span class="meta-pill prio-pill prio-${topTask.priority}">${topTask.priority}</span>
          <span class="meta-pill category-pill">#${escapeHTML(topTask.category || 'General')}</span>
          <button class="btn btn-secondary btn-sm" onclick="FocusEngine.open('${topTask.id}')" title="Start Deep Work Focus">
            <i data-lucide="zap"></i> <span>Focus</span>
          </button>
          <button class="spotlight-action-btn" onclick="toggleTaskCompletion('${topTask.id}')">
            <i data-lucide="check"></i> <span>Complete</span>
          </button>
        </div>
      `;
    } else {
      spotlightInner.innerHTML = `
        <div class="spotlight-task-title" style="color:#10b981;">
          <span>🎉</span>
          <span>All high-priority goals crushed for now! Take a breath or set a new milestone.</span>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="FocusEngine.open()">
            <i data-lucide="zap"></i> <span>Deep Work Sprint</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="openAddModal('daily')">
            <i data-lucide="plus"></i> <span>Add New Goal</span>
          </button>
        </div>
      `;
    }
  }

  // Populate / Rotate mindset principle
  rotateMindsetPrinciple(false);
}

// Keep sidebar tabs and filter dropdown in sync
function syncHorizonUI() {
  const h = state.activeHorizon;

  // Sidebar active tab
  document.querySelectorAll('.nav-menu button[data-horizon]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-horizon') === h);
  });

  // Filter bar dropdown
  const dropdown = document.getElementById('horizon-select-filter');
  if (dropdown && dropdown.value !== h) {
    dropdown.value = h;
  }
}

function updateHeaderTitle() {
  const heading = document.getElementById('current-view-heading');
  const desc = document.getElementById('current-view-desc');
  if (!heading || !desc) return;

  if (state.activeHorizon === 'general') {
    heading.textContent = 'Executive Command Center';
    desc.textContent = 'Unified multi-horizon cockpit & execution launchpad.';
  } else if (state.activeHorizon === 'all') {
    heading.textContent = '🌐 All 5 Strategic Horizons';
    desc.textContent = 'Holistic overview across all 5 strategic time horizons (Daily to Annual).';
  } else {
    const tierObj = TIERS.find(t => t.id === state.activeHorizon);
    if (tierObj) {
      heading.textContent = `${tierObj.emoji} ${tierObj.name}`;
      desc.textContent = tierObj.desc;
    }
  }
}

function updateSidebarBadges() {
  const generalCount = state.tasks.filter(task => ['daily', 'weekly', 'monthly'].includes(task.tier)).length;
  const badgeGeneral = document.getElementById('badge-general');
  if (badgeGeneral) badgeGeneral.textContent = generalCount;

  const badgeAll = document.getElementById('badge-all');
  if (badgeAll) badgeAll.textContent = state.tasks.length;

  TIERS.forEach(t => {
    const count = state.tasks.filter(task => task.tier === t.id).length;
    const badge = document.getElementById(`badge-${t.id}`);
    if (badge) badge.textContent = count;
  });
}

function updateProgressCards() {
  TIERS.forEach(t => {
    const cardEl = document.querySelector(`.horizon-card[data-horizon="${t.id}"]`);
    const tierTasks = state.tasks.filter(task => task.tier === t.id);
    const total = tierTasks.length;
    const completed = tierTasks.filter(task => task.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const ratioEl = document.getElementById(`stat-ratio-${t.id}`);
    const pctEl = document.getElementById(`stat-pct-${t.id}`);
    const barEl = document.getElementById(`stat-bar-${t.id}`);

    if (ratioEl) ratioEl.textContent = `${completed}/${total}`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;

    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
    if (cardEl) {
      if (page === 'analytics') {
        cardEl.style.display = 'block';
      } else if (state.activeHorizon === 'general') {
        cardEl.style.display = ['daily', 'weekly', 'monthly'].includes(t.id) ? 'block' : 'none';
      } else if (state.activeHorizon === 'all') {
        cardEl.style.display = 'block';
      } else {
        cardEl.style.display = state.activeHorizon === t.id ? 'block' : 'none';
      }
    }
  });
}

// Render Task List View
function renderTaskList() {
  const tasksContainer = document.getElementById('tasks-container');
  if (!tasksContainer) return;
  tasksContainer.innerHTML = '';

  const hasSearch = Boolean(state.searchQuery);

  let filtered = state.tasks.filter(task => {
    // When searching, search across ALL tiers so user finds matching tasks regardless of activeHorizon filter
    if (!hasSearch) {
      // Horizon filter
      if (state.activeHorizon === 'general') {
        if (!['daily', 'weekly', 'monthly'].includes(task.tier)) return false;
      } else if (state.activeHorizon !== 'all') {
        if (task.tier !== state.activeHorizon) return false;
      }

      // Status filter
      if (state.statusFilter === 'active' && task.completed) return false;
      if (state.statusFilter === 'completed' && !task.completed) return false;

      // Category filter
      if (state.categoryFilter !== 'all' && task.category !== state.categoryFilter) return false;

      // Priority filter
      if (state.priorityFilter !== 'all' && task.priority !== state.priorityFilter) return false;
    } else {
      // Search matching across title, desc, category, tier, tags
      const q = state.searchQuery.toLowerCase();
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchCat = (task.category || '').toLowerCase().includes(q);
      const matchTier = (task.tier || '').toLowerCase().includes(q);
      const matchTags = (task.tags || []).some(tg => tg.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchCat && !matchTags && !matchTier) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tasksContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <div class="empty-title">${hasSearch ? `No goals match "${escapeHTML(state.searchQuery)}"` : 'No goals or tasks match your filter'}</div>
        <div class="empty-sub">${hasSearch ? 'Try different keywords or check spelling.' : 'Try adjusting search parameters or click "Add Goal / Task" to create one.'}</div>
      </div>
    `;
    return;
  }

  // If searching or "general"/"all" selected, group by visible tiers
  if (hasSearch || state.activeHorizon === 'general' || state.activeHorizon === 'all') {
    const visibleTiers = (hasSearch || state.activeHorizon === 'all')
      ? TIERS
      : TIERS.filter(t => ['daily', 'weekly', 'monthly'].includes(t.id));

    visibleTiers.forEach(tierObj => {
      const tierItems = filtered.filter(t => t.tier === tierObj.id);
      if (tierItems.length > 0) {
        const groupEl = document.createElement('div');
        groupEl.className = 'task-tier-group';
        groupEl.innerHTML = `
          <div class="tier-group-header">
            <div class="tier-group-title">
              <span>${tierObj.emoji}</span>
              <span>${tierObj.name}</span>
              <span class="tier-group-count">${tierItems.length}</span>
            </div>
          </div>
          <div class="tasks-grid" id="grid-${tierObj.id}"></div>
        `;
        tasksContainer.appendChild(groupEl);
        const grid = groupEl.querySelector(`#grid-${tierObj.id}`);
        tierItems.forEach(task => grid.appendChild(createTaskCardElement(task)));
      }
    });
  } else {
    const grid = document.createElement('div');
    grid.className = 'tasks-grid';
    filtered.forEach(task => grid.appendChild(createTaskCardElement(task)));
    tasksContainer.appendChild(grid);
  }

  lucide.createIcons();
}

// ── Eisenhower Matrix View ──────────────────────────────────────
const EISENHOWER_QUADRANTS = [
  { id: 'q1', label: 'DO FIRST', subtitle: 'Urgent & Important', emoji: '🔴', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)', border: 'rgba(239, 68, 68, 0.30)' },
  { id: 'q2', label: 'SCHEDULE', subtitle: 'Not Urgent & Important', emoji: '🔵', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)', border: 'rgba(59, 130, 246, 0.30)' },
  { id: 'q3', label: 'DELEGATE', subtitle: 'Urgent & Not Important', emoji: '🟡', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.30)' },
  { id: 'q4', label: 'ELIMINATE', subtitle: 'Not Urgent & Not Important', emoji: '⚪', color: '#64748b', bg: 'rgba(100, 116, 139, 0.06)', border: 'rgba(100, 116, 139, 0.25)' }
];

function classifyTaskQuadrant(task) {
  // Important = urgent or high priority, or quarterly/annual tier
  const isImportant = ['urgent', 'high'].includes(task.priority) || ['quarterly', 'annual'].includes(task.tier);
  // Urgent = urgent priority, or daily tier, or has due date within 3 days
  let isUrgent = task.priority === 'urgent' || task.tier === 'daily';
  if (!isUrgent && task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) isUrgent = true;
  }

  if (isUrgent && isImportant) return 'q1'; // Do First
  if (!isUrgent && isImportant) return 'q2'; // Schedule
  if (isUrgent && !isImportant) return 'q3'; // Delegate
  return 'q4'; // Eliminate
}

function toggleViewMode() {
  state.viewMode = state.viewMode === 'list' ? 'eisenhower' : 'list';
  const listBtn = document.getElementById('view-mode-list');
  const matrixBtn = document.getElementById('view-mode-matrix');
  const filterBar = document.querySelector('.filter-bar');
  const matrixContainer = document.getElementById('eisenhower-matrix-container');
  const tasksContainer = document.getElementById('tasks-container');

  if (listBtn) listBtn.classList.toggle('active', state.viewMode === 'list');
  if (matrixBtn) matrixBtn.classList.toggle('active', state.viewMode === 'eisenhower');

  if (state.viewMode === 'eisenhower') {
    if (filterBar) filterBar.style.display = 'none';
    if (tasksContainer) tasksContainer.style.display = 'none';
    if (matrixContainer) matrixContainer.style.display = 'grid';
    renderEisenhowerMatrix();
  } else {
    if (filterBar) filterBar.style.display = '';
    if (tasksContainer) tasksContainer.style.display = '';
    if (matrixContainer) matrixContainer.style.display = 'none';
    renderTaskList();
  }
  lucide.createIcons();
}

function renderEisenhowerMatrix() {
  const container = document.getElementById('eisenhower-matrix-container');
  if (!container) return;

  let activeTasks = state.tasks.filter(t => !t.completed);
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    activeTasks = activeTasks.filter(t => {
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchTags = (t.tags || []).some(tg => tg.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCat || matchTags;
    });
  }

  const quadrantTasks = { q1: [], q2: [], q3: [], q4: [] };
  activeTasks.forEach(t => {
    const q = classifyTaskQuadrant(t);
    quadrantTasks[q].push(t);
  });

  container.innerHTML = EISENHOWER_QUADRANTS.map(q => {
    const tasks = quadrantTasks[q.id];
    const otherQuadrants = EISENHOWER_QUADRANTS.filter(oq => oq.id !== q.id);
    return `
      <div class="em-quadrant" data-quadrant="${q.id}" style="background: ${q.bg}; border-color: ${q.border};">
        <div class="em-quadrant-header" style="border-bottom-color: ${q.border};">
          <div class="em-quadrant-title">
            <span class="em-quadrant-emoji">${q.emoji}</span>
            <div>
              <span class="em-quadrant-label" style="color: ${q.color};">${q.label}</span>
              <span class="em-quadrant-sub">${q.subtitle}</span>
            </div>
          </div>
          <span class="em-quadrant-count" style="color: ${q.color};">${tasks.length}</span>
        </div>
        <div class="em-quadrant-body" id="em-body-${q.id}">
          ${tasks.length === 0 ? `<div class="em-empty">No tasks in this quadrant</div>` :
            tasks.map(t => {
              const tierObj = TIERS.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task' };
              return `
                <div class="em-task-card" data-id="${t.id}">
                  <div class="em-task-top">
                    <input type="checkbox" class="custom-checkbox em-chk" id="em-chk-${t.id}" onclick="toggleTaskCompletion('${t.id}')" aria-label="Complete">
                    <div class="em-task-info">
                      <div class="em-task-title">${escapeHTML(t.title)}</div>
                      <div class="em-task-meta">
                        <span class="em-tier-pill" style="color: ${tierObj.color || 'var(--text-muted)'}">${tierObj.emoji} ${tierObj.name}</span>
                        <span class="em-prio-pill em-prio-${t.priority}">${t.priority}</span>
                      </div>
                    </div>
                  </div>
                  <div class="em-task-actions">
                    <div class="em-move-dropdown">
                      <button class="em-move-btn" title="Move to quadrant">
                        <i data-lucide="move"></i>
                      </button>
                      <div class="em-move-menu">
                        ${otherQuadrants.map(oq => `
                          <button class="em-move-option" onclick="moveTaskToQuadrant('${t.id}', '${oq.id}', event)" style="color: ${oq.color};">
                            ${oq.emoji} ${oq.label}
                          </button>
                        `).join('')}
                      </div>
                    </div>
                    <button class="em-edit-btn" onclick="openEditModal('${t.id}')" title="Edit">
                      <i data-lucide="edit-3"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function moveTaskToQuadrant(taskId, quadrantId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Adjust priority and tier to match target quadrant classification
  switch (quadrantId) {
    case 'q1': // Urgent & Important — set urgent priority, daily tier
      task.priority = 'urgent';
      if (!['daily', 'weekly'].includes(task.tier)) task.tier = 'daily';
      break;
    case 'q2': // Not Urgent & Important — high priority, keep or move to monthly+
      task.priority = 'high';
      if (['daily'].includes(task.tier)) task.tier = 'weekly';
      break;
    case 'q3': // Urgent & Not Important — medium priority, daily tier
      task.priority = 'medium';
      if (!['daily'].includes(task.tier)) task.tier = 'daily';
      break;
    case 'q4': // Not Urgent & Not Important — low priority
      task.priority = 'low';
      if (['daily'].includes(task.tier)) task.tier = 'weekly';
      break;
  }

  saveData();
  renderEisenhowerMatrix();
  if (typeof showToast === 'function') {
    const qLabel = EISENHOWER_QUADRANTS.find(q => q.id === quadrantId);
    showToast(`${qLabel.emoji} Moved "${task.title.substring(0, 25)}..." to ${qLabel.label}`, 'success');
  }
}

function createTaskCardElement(task) {
  const card = document.createElement('div');
  card.className = `task-card ${task.completed ? 'completed' : ''}`;
  card.setAttribute('data-tier', task.tier);
  card.setAttribute('data-id', task.id);

  const parentTask = task.parentId ? state.tasks.find(p => p.id === task.parentId) : null;
  const isOrphan = task.tier !== 'annual' && !parentTask && !task.completed;
  
  let parentBadge = '';
  if (parentTask) {
    parentBadge = `<span class="meta-pill cascade-pill" title="Cascades up to: ${escapeHTML(parentTask.title)}" onclick="if(typeof AlignmentEngine!=='undefined') AlignmentEngine.openLinkModal('${task.id}', event);"><i data-lucide="arrow-up-right"></i> ${escapeHTML(parentTask.title.substring(0, 24))}...</span>`;
  }

  let orphanAlertHTML = '';
  if (isOrphan) {
    orphanAlertHTML = `
      <div class="orphan-task-alert">
        <div class="orphan-alert-text">
          <i data-lucide="alert-triangle"></i>
          <span>Tactical Busywork Alert: Unlinked to any higher horizon</span>
        </div>
        <button class="btn-link-parent" onclick="if(typeof AlignmentEngine!=='undefined') AlignmentEngine.openLinkModal('${task.id}', event);" title="Connect to an Annual Vision or Quarterly Objective">
          <i data-lucide="link"></i>
          <span>Link Parent Goal</span>
        </button>
      </div>
    `;
  }

  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const doneSubtasks = subtasks.filter(s => s.completed).length;
  const subtasksPct = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

  let subtasksHTML = '';
  if (totalSubtasks > 0) {
    subtasksHTML = `
      <div class="task-subtasks-section">
        <div class="subtasks-header">
          <span>Milestones (${doneSubtasks}/${totalSubtasks})</span>
          <span>${subtasksPct}%</span>
        </div>
        <div class="subtasks-progress-mini">
          <div class="subtasks-progress-fill" style="width: ${subtasksPct}%;"></div>
        </div>
        <div class="subtask-list">
          ${subtasks.map(st => `
            <div class="subtask-item ${st.completed ? 'completed' : ''}" data-subtask-id="${st.id}">
              <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} data-task-id="${task.id}" data-subtask-id="${st.id}" aria-label="Toggle subtask">
              <span class="subtask-title">${escapeHTML(st.title)}</span>
              <button type="button" class="subtask-delete-btn" title="Delete step" data-task-id="${task.id}" data-subtask-id="${st.id}">&times;</button>
            </div>
          `).join('')}
        </div>
        <div class="subtask-inline-add-row">
          <input type="text" class="subtask-inline-input" placeholder="+ Add step and press Enter..." data-task-id="${task.id}">
        </div>
      </div>
    `;
  } else {
    subtasksHTML = `
      <div class="task-subtasks-section" style="border-top:none; padding-top:2px; margin-top:4px;">
        <div class="subtask-inline-add-row" style="margin-top:0;">
          <input type="text" class="subtask-inline-input" placeholder="+ Add milestone checklist step..." data-task-id="${task.id}">
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="checkbox-wrapper">
      <input type="checkbox" class="custom-checkbox" id="chk-${task.id}" ${task.completed ? 'checked' : ''} aria-label="Mark ${task.title} complete" />
    </div>

    <div class="task-content">
      <div class="task-header-row">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-actions">
          <button class="action-btn focus-btn" title="Focus Mode" data-id="${task.id}"><i data-lucide="zap"></i></button>
          <button class="action-btn edit-btn" title="Edit Task" data-id="${task.id}"><i data-lucide="edit-2"></i></button>
          <button class="action-btn delete-btn" title="Delete Task" data-id="${task.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>

      ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}

      <div class="task-meta-row">
        <span class="meta-pill prio-pill prio-${task.priority}">${task.priority}</span>
        <span class="meta-pill category-pill">#${task.category || 'General'}</span>
        ${task.dueDate ? `<span class="meta-pill due-pill"><i data-lucide="calendar"></i> ${task.dueDate}</span>` : ''}
        ${parentBadge}
        ${(task.tags || []).map(tg => `<span class="tag-pill">#${escapeHTML(tg)}</span>`).join(' ')}
      </div>

      ${orphanAlertHTML}

      ${subtasksHTML}
    </div>
  `;

  // Checkbox event
  const chk = card.querySelector(`#chk-${task.id}`);
  chk.addEventListener('change', () => toggleTaskCompletion(task.id));

  // Focus / Edit / Delete events
  card.querySelector('.focus-btn').addEventListener('click', () => FocusEngine.open(task.id));
  card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task.id));
  card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

  // Subtask Checkboxes
  card.querySelectorAll('.subtask-checkbox').forEach(stChk => {
    stChk.addEventListener('change', (e) => {
      e.stopPropagation();
      const sId = stChk.getAttribute('data-subtask-id');
      toggleSubtask(task.id, sId);
    });
  });

  // Subtask Delete buttons
  card.querySelectorAll('.subtask-delete-btn').forEach(delBtn => {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sId = delBtn.getAttribute('data-subtask-id');
      deleteSubtaskInline(task.id, sId);
    });
  });

  // Subtask Inline Input
  const inlineInput = card.querySelector('.subtask-inline-input');
  if (inlineInput) {
    inlineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = inlineInput.value.trim();
        if (val) {
          addSubtaskInline(task.id, val);
        }
      }
    });
  }

  return card;
}

// Goal Cascade Tree View
function renderCascadeView() {
  const container = document.getElementById('tree-content');
  if (!container) return;
  container.innerHTML = '';

  const annualGoals = state.tasks.filter(t => t.tier === 'annual');

  if (annualGoals.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">No Annual Goals Set</div><div class="empty-sub">Create Annual goals and link quarterly/monthly/weekly/daily milestones to them.</div></div>`;
    return;
  }

  annualGoals.forEach(ann => {
    const node = document.createElement('div');
    node.className = 'tree-node';

    // Find children in quarterly
    const quarterlyChildren = state.tasks.filter(t => t.parentId === ann.id);

    node.innerHTML = `
      <div class="tree-node-header">
        <input type="checkbox" class="custom-checkbox" ${ann.completed ? 'checked' : ''} data-id="${ann.id}">
        <span class="horizon-badge tier-annual">🏆 Annual</span>
        <strong>${escapeHTML(ann.title)}</strong>
        <span class="meta-pill category-pill" style="margin-left:auto;">#${ann.category}</span>
      </div>
      <div class="tree-subgoals">
        ${quarterlyChildren.length > 0 ? quarterlyChildren.map(qrt => renderCascadeSubgoal(qrt)).join('') : '<div style="color:var(--text-muted); font-size:0.8rem;">No quarterly milestones linked.</div>'}
      </div>
    `;

    // Bind checkboxes in tree
    node.querySelectorAll('.custom-checkbox').forEach(c => {
      c.addEventListener('change', (e) => toggleTaskCompletion(e.target.getAttribute('data-id')));
    });

    container.appendChild(node);
  });
}

function renderCascadeSubgoal(goal) {
  const children = state.tasks.filter(t => t.parentId === goal.id);
  const tierEmoji = TIERS.find(t => t.id === goal.tier)?.emoji || '🎯';

  return `
    <div style="background:var(--bg-input); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:6px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <input type="checkbox" class="custom-checkbox" ${goal.completed ? 'checked' : ''} data-id="${goal.id}">
        <span>${tierEmoji} <strong>${escapeHTML(goal.title)}</strong></span>
        <span class="meta-pill prio-pill prio-${goal.priority}" style="margin-left:auto;">${goal.priority}</span>
      </div>
      ${children.length > 0 ? `
        <div style="margin-left:22px; padding-left:12px; border-left:1px dashed var(--border-color); margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${children.map(ch => renderCascadeSubgoal(ch)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Analytics View
function renderAnalyticsView() {
  const overallPctEl = document.getElementById('analytic-overall-pct');
  if (!overallPctEl) return;

  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  overallPctEl.textContent = `${overallPct}%`;
  document.getElementById('analytic-overall-count').textContent = `${completed} of ${total} goals done`;

  const dailyTasks = state.tasks.filter(t => t.tier === 'daily');
  const dailyDone = dailyTasks.filter(t => t.completed).length;
  const dailyRate = dailyTasks.length > 0 ? Math.round((dailyDone / dailyTasks.length) * 100) : 0;
  document.getElementById('analytic-daily-rate').textContent = `${dailyRate}%`;

  // Deep work stats
  const focusHoursEl = document.getElementById('analytic-focus-hours');
  const focusSessionsEl = document.getElementById('analytic-focus-sessions');
  if (focusHoursEl && typeof FocusEngine !== 'undefined') {
    const hours = FocusEngine.getTotalHours();
    const sessions = FocusEngine.getSessions();
    focusHoursEl.textContent = `${hours}h`;
    if (focusSessionsEl) {
      focusSessionsEl.textContent = `${sessions.length} focus session${sessions.length === 1 ? '' : 's'} completed`;
    }
  }

  const linkedCount = state.tasks.filter(t => t.parentId !== null || t.tier === 'annual').length;
  const alignmentScore = total > 0 ? Math.round((linkedCount / total) * 100) : 0;
  document.getElementById('analytic-alignment-score').textContent = `${alignmentScore}%`;

  const urgentOpen = state.tasks.filter(t => t.priority === 'urgent' && !t.completed).length;
  document.getElementById('analytic-urgent-open').textContent = urgentOpen;

  // Category breakdown
  const catContainer = document.getElementById('category-breakdown-container');
  if (!catContainer) return;
  catContainer.innerHTML = '';
  const categories = ['Product', 'Engineering', 'Career', 'Finance', 'Health', 'Personal'];

  categories.forEach(cat => {
    const catTasks = state.tasks.filter(t => t.category === cat);
    if (catTasks.length > 0) {
      const catDone = catTasks.filter(t => t.completed).length;
      const catPct = Math.round((catDone / catTasks.length) * 100);

      const row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML = `
        <div class="cat-info">
          <span>#${cat}</span>
          <span>${catDone}/${catTasks.length} (${catPct}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill fill-daily" style="width:${catPct}%"></div>
        </div>
      `;
      catContainer.appendChild(row);
    }
  });
}

// Modal Form handling
// Modal Form handling
function openAddModal(defaultTier = null) {
  const taskModal = document.getElementById('task-modal');
  const taskForm = document.getElementById('task-form');
  const modalTitleText = document.getElementById('modal-title-text');
  if (!taskModal || !taskForm) return;

  state.editingTaskId = null;
  if (modalTitleText) modalTitleText.textContent = 'Create Goal / Task';
  taskForm.reset();
  document.getElementById('task-id-input').value = '';
  if (defaultTier) document.getElementById('form-tier').value = defaultTier;
  else if (state.activeHorizon !== 'all' && state.activeHorizon !== 'general') document.getElementById('form-tier').value = state.activeHorizon;

  const subtasksList = document.getElementById('modal-subtasks-list');
  if (subtasksList) subtasksList.innerHTML = '';

  populateParentGoalDropdown();
  taskModal.style.display = 'flex';
  document.getElementById('form-title').focus();
}

function openEditModal(taskId) {
  const taskModal = document.getElementById('task-modal');
  const modalTitleText = document.getElementById('modal-title-text');
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !taskModal) return;

  state.editingTaskId = taskId;
  if (modalTitleText) modalTitleText.textContent = 'Edit Goal / Task';
  document.getElementById('task-id-input').value = task.id;
  document.getElementById('form-tier').value = task.tier;
  document.getElementById('form-title').value = task.title;
  document.getElementById('form-desc').value = task.description || '';
  document.getElementById('form-priority').value = task.priority || 'medium';
  document.getElementById('form-category').value = task.category || 'Product';
  document.getElementById('form-due').value = task.dueDate || '';
  document.getElementById('form-tags').value = (task.tags || []).join(', ');

  const subtasksList = document.getElementById('modal-subtasks-list');
  if (subtasksList) {
    subtasksList.innerHTML = '';
    (task.subtasks || []).forEach(st => addModalSubtaskRow(st.title, st.completed, st.id));
  }

  populateParentGoalDropdown(task.parentId, task.id);
  taskModal.style.display = 'flex';
}

function addModalSubtaskRow(title = '', completed = false, id = null) {
  const list = document.getElementById('modal-subtasks-list');
  if (!list) return;
  const subtaskId = id || `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const row = document.createElement('div');
  row.className = 'modal-subtask-row';
  row.setAttribute('data-subtask-id', subtaskId);
  row.innerHTML = `
    <input type="checkbox" ${completed ? 'checked' : ''} class="modal-subtask-chk" title="Mark step done">
    <input type="text" class="modal-subtask-text" value="${escapeHTML(title)}" placeholder="Milestone step...">
    <button type="button" class="modal-subtask-del-btn" title="Remove step">&times;</button>
  `;
  row.querySelector('.modal-subtask-del-btn').addEventListener('click', () => row.remove());
  list.appendChild(row);
  const textInput = row.querySelector('.modal-subtask-text');
  if (!title && textInput) textInput.focus();
}

function closeModal() {
  const taskModal = document.getElementById('task-modal');
  if (taskModal) taskModal.style.display = 'none';
  state.editingTaskId = null;
}

function populateParentGoalDropdown(selectedParentId = null, currentTaskId = null) {
  const formParentSelect = document.getElementById('form-parent');
  if (!formParentSelect) return;
  formParentSelect.innerHTML = '<option value="">None (Independent Goal)</option>';
  const potentialParents = state.tasks.filter(t => t.id !== currentTaskId && (t.tier === 'annual' || t.tier === 'quarterly' || t.tier === 'monthly' || t.tier === 'weekly'));

  potentialParents.forEach(p => {
    const tierEmoji = TIERS.find(t => t.id === p.tier)?.emoji || '📌';
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `[${tierEmoji} ${p.tier.toUpperCase()}] ${p.title}`;
    if (selectedParentId && selectedParentId === p.id) opt.selected = true;
    formParentSelect.appendChild(opt);
  });
}

function handleFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('form-title').value.trim();
  const tier = document.getElementById('form-tier').value;
  const desc = document.getElementById('form-desc').value.trim();
  const priority = document.getElementById('form-priority').value;
  const category = document.getElementById('form-category').value;
  const due = document.getElementById('form-due').value;
  const parentId = document.getElementById('form-parent').value || null;
  const rawTags = document.getElementById('form-tags').value;
  const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [tier, category.toLowerCase()];

  if (!title) return;

  // Gather subtasks from modal builder
  const subtaskRows = document.querySelectorAll('#modal-subtasks-list .modal-subtask-row');
  const subtasks = Array.from(subtaskRows).map(row => {
    const textInput = row.querySelector('.modal-subtask-text');
    const chk = row.querySelector('.modal-subtask-chk');
    const id = row.getAttribute('data-subtask-id');
    return {
      id: id || `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: textInput ? textInput.value.trim() : '',
      completed: chk ? chk.checked : false
    };
  }).filter(st => st.title.length > 0);

  if (state.editingTaskId) {
    const task = state.tasks.find(t => t.id === state.editingTaskId);
    if (task) {
      task.title = title;
      task.tier = tier;
      task.description = desc;
      task.priority = priority;
      task.category = category;
      task.dueDate = due;
      task.parentId = parentId;
      task.tags = tags;
      task.subtasks = subtasks;
      showToast('Goal updated successfully.', 'success');
    }
  } else {
    const prefix = tier.substring(0, 3);
    const newId = `${prefix}_${Date.now()}`;
    const newTask = {
      id: newId,
      title,
      description: desc,
      tier,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      dueDate: due || new Date().toISOString().split('T')[0],
      priority,
      category,
      parentId,
      tags,
      subtasks
    };
    state.tasks.unshift(newTask);
    showToast('New goal added!', 'success');
  }

  saveData();
  closeModal();
  renderAll();
}

// Subtask Inline CRUD Operations
function toggleSubtask(taskId, subtaskId, clickEvent = null) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.subtasks) return;
  const subtask = task.subtasks.find(s => s.id === subtaskId);
  if (!subtask) return;
  subtask.completed = !subtask.completed;

  if (subtask.completed && typeof XPEngine !== 'undefined') {
    XPEngine.award(XP_VALUES.SUBTASK, 'Milestone Step Checked', clickEvent ? clickEvent.target : null);
    XPEngine.updateQuestProgress('subtasks', 1);
  }

  // Check if all subtasks are complete
  const allCompleted = task.subtasks.length > 0 && task.subtasks.every(s => s.completed);
  if (allCompleted && !task.completed) {
    showToast(`All milestones for "${task.title}" completed! 🎉`, 'success');
  }

  saveData();
  renderAll();

  if (typeof FocusEngine !== 'undefined' && FocusEngine.activeTaskId === taskId) {
    FocusEngine.renderFocusSubtasks(task);
  }
}

function addSubtaskInline(taskId, title) {
  if (!title || !title.trim()) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!task.subtasks) task.subtasks = [];
  const newSubtask = {
    id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    completed: false
  };
  task.subtasks.push(newSubtask);
  saveData();
  renderAll();
  showToast('Milestone step added.', 'info');

  if (typeof FocusEngine !== 'undefined' && FocusEngine.activeTaskId === taskId) {
    FocusEngine.renderFocusSubtasks(task);
  }
}

function deleteSubtaskInline(taskId, subtaskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.subtasks) return;
  task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
  saveData();
  renderAll();

  if (typeof FocusEngine !== 'undefined' && FocusEngine.activeTaskId === taskId) {
    FocusEngine.renderFocusSubtasks(task);
  }
}

// Data Export & Import
function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tasks, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tesseract_matrix_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Exported JSON data file.', 'info');
}

function handleImportJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        state.tasks = imported;
        saveData();
        renderAll();
        showToast(`Imported ${imported.length} tasks successfully!`, 'success');
      } else {
        alert('Invalid JSON structure: Expected an array of task objects.');
      }
    } catch (err) {
      alert('Error parsing JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function exportMarkdown() {
  let md = `# TESSERACT GOALS & TASKS MATRIX\nGenerated: ${new Date().toLocaleDateString()}\n\n`;
  TIERS.forEach(tierObj => {
    const tierTasks = state.tasks.filter(t => t.tier === tierObj.id);
    md += `## ${tierObj.emoji} ${tierObj.name} (${tierTasks.filter(t => t.completed).length}/${tierTasks.length})\n`;
    tierTasks.forEach(t => {
      const mark = t.completed ? '[x]' : '[ ]';
      md += `- ${mark} **[${t.priority.toUpperCase()}]** ${t.title} *(Due: ${t.dueDate || 'N/A'}, #${t.category})*\n`;
      if (t.description) md += `  - ${t.description}\n`;
    });
    md += '\n';
  });

  navigator.clipboard.writeText(md).then(() => {
    showToast('Markdown summary copied to clipboard! 📋', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard.', 'error');
  });
}

// ── Profile View ──────────────────────────────────────────
function renderProfileView() {
  const profileContainer = document.getElementById('profile-container');
  if (!profileContainer) return;

  const tasks = state.tasks;
  const streakCount = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : (state.streak ? state.streak.count : 1);
  const streak = { count: streakCount, lastDate: (state.streak ? state.streak.lastDate : null) };
  const profile = state.profile || { name: 'Tesseract User', image: null };
  const completed = tasks.filter(t => t.completed);
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Best streak tracking
  const BEST_STREAK_KEY = 'tesseract_best_streak';
  let bestStreak = parseInt(localStorage.getItem(BEST_STREAK_KEY) || '0');
  if (streak.count > bestStreak) {
    bestStreak = streak.count;
    localStorage.setItem(BEST_STREAK_KEY, bestStreak.toString());
  }

  // Tagline based on stats (one word motivation)
  let tagline = 'Starter';
  if (streak.count >= 100) tagline = 'Legendary';
  else if (streak.count >= 50) tagline = 'Relentless';
  else if (streak.count >= 30) tagline = 'Disciplined';
  else if (streak.count >= 7) tagline = 'Consistent';
  else if (completed.length > 0) tagline = 'Initiator';

  // Populate hero
  const profileNameEl = document.getElementById('profile-name');
  const profileTaglineEl = document.getElementById('profile-tagline');
  if (profileNameEl) profileNameEl.textContent = profile.name;
  if (profileTaglineEl) {
    profileTaglineEl.textContent = (typeof XPEngine !== 'undefined') ? XPEngine.data.rankTitle : tagline;
  }
  
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarFallback = document.getElementById('profile-avatar-fallback');
  if (avatarImg && avatarFallback) {
    if (profile.image) {
      avatarImg.src = profile.image;
      avatarImg.style.display = 'block';
      avatarFallback.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarFallback.style.display = 'block';
    }
  }

  // Member since (earliest createdAt)
  const dates = tasks.map(t => t.createdAt).filter(Boolean).sort();
  const joinedDateEl = document.getElementById('profile-joined-date');
  if (dates.length > 0 && joinedDateEl) {
    const d = new Date(dates[0]);
    joinedDateEl.textContent = `Member since ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }

  // Executive Level & XP Card
  if (typeof XPEngine !== 'undefined') {
    const prog = XPEngine.getLevelProgress();
    const lvlBadge = document.getElementById('profile-level-badge');
    const rankTitle = document.getElementById('profile-rank-title');
    const rankDesc = document.getElementById('profile-rank-desc');
    const totalXP = document.getElementById('profile-total-xp');
    const multPill = document.getElementById('profile-multiplier-pill');
    const xpInLevel = document.getElementById('profile-xp-in-level');
    const nextRank = document.getElementById('profile-next-rank-preview');
    const xpFill = document.getElementById('profile-xp-fill');

    if (lvlBadge) lvlBadge.textContent = `Lvl ${prog.level}`;
    if (rankTitle) rankTitle.textContent = prog.title;
    const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === prog.level);
    if (rankDesc && currentThreshold) rankDesc.textContent = currentThreshold.tierName;
    if (totalXP) totalXP.textContent = `${XPEngine.data.totalXP} XP`;
    if (multPill) {
      const mult = XPEngine.getStreakMultiplier();
      multPill.textContent = `${mult}x Multiplier`;
      multPill.className = `profile-multiplier-badge ${mult > 1 ? 'active' : ''}`;
    }
    if (xpInLevel) xpInLevel.textContent = `${prog.currentXPInLevel} / ${prog.xpForNextLevel} XP`;
    if (nextRank) nextRank.textContent = `Next: Level ${prog.level + 1} (${prog.remainingXP} XP left)`;
    if (xpFill) xpFill.style.width = `${prog.pct}%`;
  }

  // Update stat cards
  const elTotal = document.getElementById('pstat-total-tasks') || document.getElementById('pstat-total-goals');
  const elCompleted = document.getElementById('pstat-completed') || document.getElementById('pstat-completed-goals');
  const elRate = document.getElementById('pstat-completion-rate');
  const elStreak = document.getElementById('pstat-streak') || document.getElementById('pstat-streak-days');
  const elShields = document.getElementById('pstat-shields') || document.getElementById('pstat-streak-shields');

  if (elTotal) elTotal.textContent = total;
  if (elCompleted) elCompleted.textContent = completed.length;
  if (elRate) elRate.textContent = `${rate}%`;
  if (elStreak) {
    elStreak.textContent = `${streak.count} 🔥`;
    elStreak.style.cursor = 'pointer';
    elStreak.title = 'Click to customize/adjust your streak';
    elStreak.onclick = promptEditStreak;
  }
  if (elShields) elShields.textContent = `${(typeof XPEngine !== 'undefined') ? (XPEngine.data.streakShields || 0) : 0} 🛡️`;

  const elDeepWork = document.getElementById('pstat-deep-work');
  if (elDeepWork && typeof FocusEngine !== 'undefined') {
    elDeepWork.textContent = `${FocusEngine.getTotalHours()}h`;
  }

  // Lifetime Badge Showcase
  const badgeContainer = document.getElementById('profile-badge-showcase');
  const badgeCountEl = document.getElementById('profile-badge-count');
  if (badgeContainer && typeof XPEngine !== 'undefined') {
    badgeContainer.innerHTML = '';
    const earnedBadges = XPEngine.data.badges || [];
    if (badgeCountEl) badgeCountEl.textContent = `${earnedBadges.length} / ${BADGE_DEFINITIONS.length} Unlocked`;

    BADGE_DEFINITIONS.forEach(badge => {
      const isEarned = earnedBadges.includes(badge.id);
      const el = document.createElement('div');
      el.className = `profile-badge-item ${isEarned ? 'earned' : 'locked'}`;
      el.innerHTML = `
        <span class="badge-emoji">${badge.icon}</span>
        <span class="badge-name">${escapeHTML(badge.name)}</span>
        <span class="badge-days">${escapeHTML(badge.desc)}</span>
        <span class="badge-status ${isEarned ? 'earned' : 'locked'}">${isEarned ? '✓ Unlocked' : '🔒 Locked'}</span>
      `;
      badgeContainer.appendChild(el);
    });
  }

  // Horizon breakdown
  const breakdownContainer = document.getElementById('profile-horizon-breakdown');
  if (breakdownContainer) {
    breakdownContainer.innerHTML = '';
    TIERS.forEach(tier => {
      const tierTasks = tasks.filter(t => t.tier === tier.id);
      const tierDone = tierTasks.filter(t => t.completed).length;
      const tierTotal = tierTasks.length;
      const pct = tierTotal > 0 ? Math.round((tierDone / tierTotal) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'profile-horizon-row';
      row.innerHTML = `
        <span class="profile-horizon-label">${tier.emoji} ${tier.name}</span>
        <div class="profile-horizon-bar-track">
          <div class="profile-horizon-bar-fill" style="width: ${pct}%; background: ${tier.color};"></div>
        </div>
        <span class="profile-horizon-pct">${tierDone}/${tierTotal} (${pct}%)</span>
      `;
      breakdownContainer.appendChild(row);
    });
  }

  // Recent XP & Activity history
  const activityContainer = document.getElementById('profile-activity-list');
  if (activityContainer) {
    activityContainer.innerHTML = '';

    const history = (typeof XPEngine !== 'undefined' && XPEngine.data.history && XPEngine.data.history.length > 0)
      ? XPEngine.data.history
      : [];

    if (history.length === 0) {
      activityContainer.innerHTML = '<div class="profile-empty-activity">No XP logged yet. Start completing goals to gain executive level!</div>';
    } else {
      history.slice(0, 15).forEach(item => {
        const when = new Date(item.timestamp);
        const timeAgo = getTimeAgo(when);

        const el = document.createElement('div');
        el.className = 'profile-activity-item';
        el.innerHTML = `
          <div class="profile-activity-icon completed">⚡</div>
          <div class="profile-activity-text">
            <span class="activity-xp-gain">+${item.amount} XP</span>
            <span class="activity-reason">${escapeHTML(item.reason)}</span>
            ${item.multiplier > 1 ? `<span class="activity-mult">${item.multiplier}x</span>` : ''}
          </div>
          <div class="profile-activity-time">${timeAgo}</div>
        `;
        activityContainer.appendChild(el);
      });
    }
  }

  // Render Personal Creed & Data Vault
  renderProfileCreed();
  renderDataVaultStats();
}

// ── Personal North Star Creed Management ───────────────────
const DEFAULT_CREED = {
  mission: 'Architect scalable systems, execute with ruthless consistency, and compound value across all life dimensions.',
  motto: 'Discipline is freedom. Compound daily.',
  values: ['Ruthless Prioritization', 'Deep Work Intensity', 'Unwavering Follow-Through']
};

function getProfileCreed() {
  if (!state.profile) state.profile = { name: 'Tesseract User', image: null };
  if (!state.profile.creed) {
    state.profile.creed = { ...DEFAULT_CREED };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
  }
  return state.profile.creed;
}

function renderProfileCreed() {
  const creed = getProfileCreed();
  const elMission = document.getElementById('creed-display-mission');
  const elMotto = document.getElementById('creed-display-motto');
  const elValues = document.getElementById('creed-display-values');

  if (elMission) elMission.textContent = creed.mission || DEFAULT_CREED.mission;
  if (elMotto) elMotto.textContent = creed.motto || DEFAULT_CREED.motto;
  if (elValues) {
    elValues.innerHTML = '';
    const icons = ['shield-check', 'zap', 'target'];
    const valuesList = (creed.values && creed.values.length > 0) ? creed.values : DEFAULT_CREED.values;
    valuesList.forEach((val, idx) => {
      const tag = document.createElement('span');
      tag.className = 'creed-value-tag';
      tag.innerHTML = `<i data-lucide="${icons[idx % icons.length]}"></i> <span>${escapeHTML(val)}</span>`;
      elValues.appendChild(tag);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function openCreedModal() {
  const creed = getProfileCreed();
  const modal = document.getElementById('creed-editor-modal');
  if (!modal) return;

  const inMission = document.getElementById('creed-input-mission');
  const inMotto = document.getElementById('creed-input-motto');
  const inV1 = document.getElementById('creed-input-v1');
  const inV2 = document.getElementById('creed-input-v2');
  const inV3 = document.getElementById('creed-input-v3');

  if (inMission) inMission.value = creed.mission || '';
  if (inMotto) inMotto.value = creed.motto || '';
  if (inV1) inV1.value = (creed.values && creed.values[0]) || '';
  if (inV2) inV2.value = (creed.values && creed.values[1]) || '';
  if (inV3) inV3.value = (creed.values && creed.values[2]) || '';

  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCreedModal() {
  const modal = document.getElementById('creed-editor-modal');
  if (modal) modal.style.display = 'none';
}

function handleSaveCreed(event) {
  event.preventDefault();
  const inMission = document.getElementById('creed-input-mission');
  const inMotto = document.getElementById('creed-input-motto');
  const inV1 = document.getElementById('creed-input-v1');
  const inV2 = document.getElementById('creed-input-v2');
  const inV3 = document.getElementById('creed-input-v3');

  const newCreed = {
    mission: inMission ? inMission.value.trim() : DEFAULT_CREED.mission,
    motto: inMotto ? inMotto.value.trim() : DEFAULT_CREED.motto,
    values: [
      inV1 && inV1.value.trim() ? inV1.value.trim() : DEFAULT_CREED.values[0],
      inV2 && inV2.value.trim() ? inV2.value.trim() : DEFAULT_CREED.values[1],
      inV3 && inV3.value.trim() ? inV3.value.trim() : DEFAULT_CREED.values[2]
    ]
  };

  if (!state.profile) state.profile = { name: 'Tesseract User', image: null };
  state.profile.creed = newCreed;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));

  closeCreedModal();
  renderProfileCreed();
  showToast('Personal North Star Creed saved! 🏛️', 'success');
}

// ── Executive Data Vault & Backup Control Center ───────────
function renderDataVaultStats() {
  const elTasks = document.getElementById('vstat-tasks');
  const elHabits = document.getElementById('vstat-habits');
  const elBucket = document.getElementById('vstat-bucket');
  const elFocus = document.getElementById('vstat-focus');
  const elStorageSize = document.getElementById('vault-storage-size');

  const taskCount = (state.tasks || []).length;
  const habitCount = (typeof HabitsEngine !== 'undefined' && HabitsEngine.habits) ? HabitsEngine.habits.length : 0;
  const bucketCount = (typeof BucketListEngine !== 'undefined' && BucketListEngine.dreams) ? BucketListEngine.dreams.length : 0;
  const focusCount = (typeof FocusEngine !== 'undefined') ? FocusEngine.getSessions().length : 0;

  if (elTasks) elTasks.textContent = taskCount;
  if (elHabits) elHabits.textContent = habitCount;
  if (elBucket) elBucket.textContent = bucketCount;
  if (elFocus) elFocus.textContent = focusCount;

  if (elStorageSize) {
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += (localStorage[key].length + key.length) * 2;
      }
    }
    const kb = (totalBytes / 1024).toFixed(1);
    const pct = ((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(1);
    elStorageSize.textContent = `${kb} KB used (${pct}% of 5 MB limit)`;
  }
}

function exportDataJSON() {
  const fullBackup = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    profile: state.profile,
    streak: state.streak,
    xpData: (typeof XPEngine !== 'undefined') ? XPEngine.data : null,
    habits: (typeof HabitsEngine !== 'undefined') ? HabitsEngine.habits : null,
    bucketList: (typeof BucketListEngine !== 'undefined') ? BucketListEngine.dreams : null,
    focusSessions: (typeof FocusEngine !== 'undefined') ? FocusEngine.getSessions() : null
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tesseract_executive_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Executive database backup downloaded! 💾', 'success');
}

function triggerImportJSON() {
  const input = document.getElementById('vault-import-input');
  if (input) input.click();
}

function handleVaultImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && data.version && data.tasks) {
        // Full Executive Backup
        state.tasks = data.tasks;
        saveData();
        if (data.profile) {
          state.profile = data.profile;
          localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
        }
        if (data.streak) {
          state.streak = data.streak;
          localStorage.setItem(STREAK_KEY, JSON.stringify(state.streak));
        }
        if (data.xpData && typeof XPEngine !== 'undefined') {
          XPEngine.data = data.xpData;
          XPEngine.save();
        }
        if (data.habits && typeof HabitsEngine !== 'undefined') {
          HabitsEngine.habits = data.habits;
          HabitsEngine.save();
        }
        if (data.bucketList && typeof BucketListEngine !== 'undefined') {
          BucketListEngine.dreams = data.bucketList;
          BucketListEngine.save();
        }
        if (data.focusSessions && typeof FocusEngine !== 'undefined') {
          localStorage.setItem('tesseract_focus_sessions', JSON.stringify(data.focusSessions));
        }
        showToast('Complete Executive Database restored successfully! 🎉', 'success');
      } else if (Array.isArray(data)) {
        // Legacy Task Array
        state.tasks = data;
        saveData();
        showToast(`Imported ${data.length} tasks successfully!`, 'success');
      } else {
        alert('Unrecognized JSON format. Please use a valid Tesseract export file.');
        return;
      }
      renderAll();
      if (document.getElementById('profile-container')) renderProfileView();
    } catch (err) {
      alert('Error parsing JSON backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function archiveCompletedTasks() {
  const completedDailyAndWeekly = (state.tasks || []).filter(t => (t.tier === 'daily' || t.tier === 'weekly') && t.completed);
  if (completedDailyAndWeekly.length === 0) {
    showToast('No completed daily or weekly tasks to archive.', 'info');
    return;
  }

  if (confirm(`Archive ${completedDailyAndWeekly.length} completed daily/weekly tasks? They will be cleared from active matrix while preserving all your XP and stats.`)) {
    state.tasks = state.tasks.filter(t => !((t.tier === 'daily' || t.tier === 'weekly') && t.completed));
    saveData();
    renderAll();
    if (document.getElementById('profile-container')) renderProfileView();
    showToast(`Archived ${completedDailyAndWeekly.length} tasks! Matrix optimized. 🧹`, 'success');
  }
}

function confirmResetData() {
  resetToSampleData();
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function resetToSampleData() {
  if (confirm('Reset all tasks to original sample data? Custom additions will be overwritten.')) {
    state.tasks = typeof INITIAL_TASKS !== 'undefined' ? [...INITIAL_TASKS] : [];
    saveData();
    renderAll();
    if (document.getElementById('profile-container')) renderProfileView();
    showToast('Restored sample data.', 'info');
  }
}

// Helper utilities
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? 'check-circle' : 'info';
  toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${escapeHTML(message)}</span>`;
  toastContainer.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function escapeHTML(str) {
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

// ── Focus Mode & Deep Work Engine ──────────────────────────
const FOCUS_STORAGE_KEY = 'tesseract_focus_sessions';

const FocusEngine = {
  activeTaskId: null,
  durationMinutes: 25,
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  timerInterval: null,
  isRunning: false,
  audioContext: null,
  soundNodes: null,
  currentSound: 'rain',
  volume: 0.5,

  init() {
    // Preset buttons
    document.querySelectorAll('.focus-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (this.isRunning) this.pause();
        const mins = parseInt(chip.getAttribute('data-minutes'), 10);
        this.setDuration(mins);
      });
    });

    // Control buttons
    const btnToggle = document.getElementById('focus-btn-toggle');
    if (btnToggle) btnToggle.addEventListener('click', () => this.toggle());

    const btnReset = document.getElementById('focus-btn-reset');
    if (btnReset) btnReset.addEventListener('click', () => this.reset());

    const btnMinus5 = document.getElementById('focus-btn-minus5');
    if (btnMinus5) btnMinus5.addEventListener('click', () => this.subtractFiveMinutes());

    const btnPlus5 = document.getElementById('focus-btn-plus5');
    if (btnPlus5) btnPlus5.addEventListener('click', () => this.addFiveMinutes());

    const btnCustom = document.getElementById('focus-btn-custom-duration');
    if (btnCustom) btnCustom.addEventListener('click', () => this.promptCustomDuration());

    const digitsDisplay = document.getElementById('focus-time-digits');
    if (digitsDisplay) {
      digitsDisplay.title = 'Click to set custom focus duration';
      digitsDisplay.addEventListener('click', () => this.promptCustomDuration());
    }

    const btnExit = document.getElementById('focus-exit-btn');
    if (btnExit) btnExit.addEventListener('click', () => this.close());

    const btnHeaderFocus = document.getElementById('btn-header-focus');
    if (btnHeaderFocus) {
      btnHeaderFocus.addEventListener('click', () => {
        this.open();
      });
    }

    const taskSelect = document.getElementById('focus-task-select');
    if (taskSelect) {
      taskSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.setTask(val || null);
      });
    }

    const btnComplete = document.getElementById('focus-btn-complete-task');
    if (btnComplete) btnComplete.addEventListener('click', () => this.markTaskComplete());

    // Soundscape controls (Moved Downwards)
    const soundSelect = document.getElementById('focus-sound-select');
    if (soundSelect) {
      soundSelect.addEventListener('change', (e) => {
        this.currentSound = e.target.value;
        if (this.isRunning) {
          this.stopAudio();
          this.playAudio(this.currentSound);
        }
      });
    }

    const volSlider = document.getElementById('focus-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        this.volume = parseFloat(e.target.value);
        if (this.soundNodes && this.soundNodes.masterGain && this.audioContext) {
          this.soundNodes.masterGain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        }
      });
    }

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('focus-mode-overlay');
      if (overlay && overlay.style.display !== 'none') {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        } else if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          this.toggle();
        } else if ((e.key === 'r' || e.key === 'R') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          this.reset();
        }
      }
    });
  },

  open(taskId = null) {
    const overlay = document.getElementById('focus-mode-overlay');
    if (!overlay) return;

    // If no taskId passed, smartly pick top incomplete Daily, Weekly, Monthly, Quarterly, Annual
    if (!taskId) {
      const incomplete = state.tasks.filter(t => !t.completed);
      const top = incomplete.find(t => t.tier === 'daily' && t.priority === 'urgent')
        || incomplete.find(t => t.tier === 'daily')
        || incomplete.find(t => t.tier === 'weekly')
        || incomplete.find(t => t.tier === 'monthly')
        || incomplete.find(t => t.tier === 'quarterly')
        || incomplete.find(t => t.tier === 'annual')
        || (incomplete.length > 0 ? incomplete[0] : null);
      taskId = top ? top.id : null;
    }

    // Populate Task Dropdown Switcher
    this.populateTaskPicker(taskId);

    this.setTask(taskId);
    this.reset();
    overlay.style.display = 'flex';
    lucide.createIcons();
  },

  populateTaskPicker(selectedTaskId = null) {
    const select = document.getElementById('focus-task-select');
    if (!select) return;
    select.innerHTML = '<option value="">⚡ Free Flow Sprint</option>';

    TIERS.forEach(tier => {
      const tierTasks = state.tasks.filter(t => t.tier === tier.id && !t.completed);
      if (tierTasks.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${tier.emoji} ${tier.name}`;
        tierTasks.forEach(task => {
          const opt = document.createElement('option');
          opt.value = task.id;
          opt.textContent = `[${tier.name.split(' ')[0]}] ${task.title.substring(0, 32)}${task.title.length > 32 ? '...' : ''}`;
          if (selectedTaskId === task.id) opt.selected = true;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      }
    });
  },

  setTask(taskId) {
    this.activeTaskId = taskId;
    const task = taskId ? state.tasks.find(t => t.id === taskId) : null;
    const taskTierEl = document.getElementById('focus-task-tier');
    const taskTitleEl = document.getElementById('focus-task-title');
    const taskDescEl = document.getElementById('focus-task-desc');
    const completeBtn = document.getElementById('focus-btn-complete-task');
    const select = document.getElementById('focus-task-select');

    if (select) select.value = taskId || '';

    if (task) {
      const tierObj = TIERS.find(t => t.id === task.tier) || { emoji: '📌', name: 'Task' };
      if (taskTierEl) taskTierEl.textContent = `${tierObj.emoji} ${tierObj.name.toUpperCase()}`;
      if (taskTitleEl) taskTitleEl.textContent = task.title;
      if (taskDescEl) taskDescEl.textContent = task.description || 'Focus on high-leverage execution. No distractions.';
      if (completeBtn) {
        completeBtn.style.display = 'inline-flex';
        const label = completeBtn.querySelector('#focus-complete-btn-text');
        if (label) label.textContent = task.completed ? 'Goal Completed ✅' : 'Mark Goal Complete';
      }
      this.renderFocusSubtasks(task);
    } else {
      if (taskTierEl) taskTierEl.textContent = '⚡ DEEP WORK SPRINT';
      if (taskTitleEl) taskTitleEl.textContent = 'Uninterrupted Flow Session';
      if (taskDescEl) taskDescEl.textContent = 'Single-task focus mode. Eliminate all context switching.';
      if (completeBtn) completeBtn.style.display = 'none';
      const container = document.getElementById('focus-subtasks-container');
      if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    }
  },

  renderFocusSubtasks(task) {
    const container = document.getElementById('focus-subtasks-container');
    if (!container) return;
    const subtasks = (task && task.subtasks) ? task.subtasks : [];
    if (subtasks.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const done = subtasks.filter(s => s.completed).length;
    const total = subtasks.length;
    const pct = Math.round((done / total) * 100);

    container.style.display = 'block';
    container.innerHTML = `
      <div class="focus-subtasks-header">
        <span>Milestones (${done}/${total})</span>
        <span>${pct}% Done</span>
      </div>
      <div class="focus-subtasks-list">
        ${subtasks.map(st => `
          <label class="focus-subtask-item ${st.completed ? 'completed' : ''}">
            <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} data-focus-subtask="${st.id}">
            <span>${escapeHTML(st.title)}</span>
          </label>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('input[data-focus-subtask]').forEach(chk => {
      chk.addEventListener('change', () => {
        const sId = chk.getAttribute('data-focus-subtask');
        toggleSubtask(task.id, sId);
      });
    });
  },

  close() {
    this.pause();
    this.stopAudio();
    const overlay = document.getElementById('focus-mode-overlay');
    if (overlay) overlay.style.display = 'none';
    document.title = 'Tesseract | Multi-Horizon Goal & Task Matrix';
  },

  setDuration(minutes) {
    this.durationMinutes = minutes;
    this.totalSeconds = minutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.updateDisplay();
    this.updateRing();
    this.highlightActivePreset();
  },

  promptCustomDuration() {
    const currentMins = Math.round(this.totalSeconds / 60);
    const input = prompt("Set custom focus duration in minutes (1 to 360):", currentMins);
    if (input !== null) {
      const parsed = parseInt(input.trim(), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 360) {
        if (this.isRunning) this.pause();
        this.setDuration(parsed);
        showToast(`Focus timer set to ${parsed}m.`, 'info');
      } else if (input.trim() !== '') {
        showToast('Please enter a valid number of minutes between 1 and 360.', 'error');
      }
    }
  },

  highlightActivePreset() {
    const currentMins = Math.round(this.totalSeconds / 60);
    let matched = false;
    document.querySelectorAll('.focus-preset-chip[data-minutes]').forEach(c => {
      const mins = parseInt(c.getAttribute('data-minutes'), 10);
      const isMatch = mins === currentMins;
      c.classList.toggle('active', isMatch);
      if (isMatch) matched = true;
    });
    const customChip = document.getElementById('focus-btn-custom-duration');
    if (customChip) customChip.classList.toggle('active', !matched);
  },

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  },

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const statusEl = document.getElementById('focus-time-status');
    if (statusEl) statusEl.textContent = 'IN FLOW';

    const toggleText = document.getElementById('focus-toggle-text');
    if (toggleText) toggleText.textContent = 'Pause';

    const playIcon = document.getElementById('focus-play-icon');
    if (playIcon) {
      playIcon.setAttribute('data-lucide', 'pause');
      lucide.createIcons();
    }

    this.playAudio(this.currentSound);

    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      this.updateDisplay();
      this.updateRing();

      if (this.remainingSeconds <= 0) {
        this.onComplete();
      }
    }, 1000);
  },

  pause() {
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    const statusEl = document.getElementById('focus-time-status');
    if (statusEl) statusEl.textContent = 'PAUSED';

    const toggleText = document.getElementById('focus-toggle-text');
    if (toggleText) toggleText.textContent = 'Resume';

    const playIcon = document.getElementById('focus-play-icon');
    if (playIcon) {
      playIcon.setAttribute('data-lucide', 'play');
      lucide.createIcons();
    }

    this.stopAudio();
  },

  reset() {
    this.pause();
    this.remainingSeconds = this.totalSeconds;
    this.updateDisplay();
    this.updateRing();

    const statusEl = document.getElementById('focus-time-status');
    if (statusEl) statusEl.textContent = 'READY';

    const toggleText = document.getElementById('focus-toggle-text');
    if (toggleText) toggleText.textContent = 'Start Focus';
  },

  subtractFiveMinutes() {
    if (this.totalSeconds <= 300) {
      this.totalSeconds = Math.max(60, this.totalSeconds - 60);
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 60);
    } else {
      this.totalSeconds -= 300;
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 300);
    }
    this.durationMinutes = Math.round(this.totalSeconds / 60);
    this.updateDisplay();
    this.updateRing();
    this.highlightActivePreset();
  },

  addFiveMinutes() {
    this.totalSeconds += 300;
    this.remainingSeconds += 300;
    this.durationMinutes = Math.round(this.totalSeconds / 60);
    this.updateDisplay();
    this.updateRing();
    this.highlightActivePreset();
  },

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const str = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const digitsEl = document.getElementById('focus-time-digits');
    if (digitsEl) digitsEl.textContent = str;

    if (this.isRunning) {
      document.title = `(${str}) Focus Mode | Tesseract`;
    } else {
      document.title = 'Tesseract | Multi-Horizon Goal & Task Matrix';
    }
  },

  updateRing() {
    const ring = document.getElementById('focus-ring-progress');
    if (!ring) return;
    const circumference = 659.73; // 2 * pi * 105
    const progress = Math.max(0, this.remainingSeconds / this.totalSeconds);
    const offset = circumference * (1 - progress);
    ring.style.strokeDashoffset = offset;
  },

  onComplete() {
    this.pause();
    this.playChime();

    if (typeof confetti === 'function') {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    const durationMins = Math.round(this.totalSeconds / 60);
    const sessions = this.getSessions();
    const task = this.activeTaskId ? state.tasks.find(t => t.id === this.activeTaskId) : null;
    const newSession = {
      id: `fs_${Date.now()}`,
      taskId: this.activeTaskId,
      taskTitle: task ? task.title : 'General Deep Work Sprint',
      durationMinutes: durationMins,
      timestamp: new Date().toISOString()
    };
    sessions.push(newSession);
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(sessions));

    // Award Gamified XP
    if (typeof XPEngine !== 'undefined') {
      let focusXP = durationMins; // Base 1 XP per minute
      if (durationMins >= 90) focusXP = XP_VALUES.FOCUS_SESSION_90;
      else if (durationMins >= 50) focusXP = XP_VALUES.FOCUS_SESSION_50;
      else if (durationMins >= 25) focusXP = XP_VALUES.FOCUS_SESSION_25;

      XPEngine.award(focusXP, `Deep Work Flow (${durationMins}m)`);
      XPEngine.updateQuestProgress('focus_mins', durationMins);

      // Evaluate focus badges
      if (durationMins >= 90) XPEngine.awardBadge('flow_state');
      else if (durationMins >= 25) XPEngine.awardBadge('deep_work_init');
    }

    showToast('🎉 Focus session completed! Outstanding deep work.', 'success');
    this.reset();
    renderAll();
  },

  markTaskComplete() {
    if (!this.activeTaskId) return;
    toggleTaskCompletion(this.activeTaskId);
    const completeBtn = document.getElementById('focus-btn-complete-task');
    if (completeBtn) {
      const label = completeBtn.querySelector('#focus-complete-btn-text');
      if (label) label.textContent = 'Goal Completed! 🎉';
    }
    showToast('Task marked complete!', 'success');
  },

  getSessions() {
    try {
      return JSON.parse(localStorage.getItem(FOCUS_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  getTotalHours() {
    const sessions = this.getSessions();
    const totalMins = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    return (totalMins / 60).toFixed(1);
  },

  // ── Web Audio API Synthesizer (100% Offline Ambient Soundscapes) ────
  ensureAudioContext() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.audioContext = new AudioContextClass();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  },

  playAudio(type) {
    if (type === 'mute') return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    this.stopAudio();

    const ctx = this.audioContext;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    if (type === 'rain') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();

      this.soundNodes = { masterGain, source: whiteNoise };
    } else if (type === 'waves') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.08;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(0.2, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.25, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(swellGain.gain);

      noise.connect(filter);
      filter.connect(swellGain);
      swellGain.connect(masterGain);

      noise.start();
      lfo.start();

      this.soundNodes = { masterGain, source: noise, lfo };
    } else if (type === 'binaural') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.frequency.setValueAtTime(196, ctx.currentTime);
      osc2.frequency.setValueAtTime(206, ctx.currentTime);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc1.connect(toneGain);
      osc2.connect(toneGain);
      toneGain.connect(masterGain);

      osc1.start();
      osc2.start();

      this.soundNodes = { masterGain, osc1, osc2 };
    }
  },

  stopAudio() {
    if (this.soundNodes) {
      try {
        if (this.soundNodes.source) this.soundNodes.source.stop();
        if (this.soundNodes.lfo) this.soundNodes.lfo.stop();
        if (this.soundNodes.osc1) this.soundNodes.osc1.stop();
        if (this.soundNodes.osc2) this.soundNodes.osc2.stop();
      } catch (e) {}
      this.soundNodes = null;
    }
  },

  playChime() {
    this.ensureAudioContext();
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  }
};

// ══════════════════════════════════════════════════════════════════
// 📄 1-Click Executive Weekly Report Exporter Engine
// ══════════════════════════════════════════════════════════════════
const WeeklyReportEngine = {
  getReportData() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userName = (state.profile && state.profile.name) ? state.profile.name : 'Executive Leader';
    const totalXP = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.totalXP : 0;
    const level = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.level : 1;
    const rankTitle = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.rankTitle : 'Apprentice';
    const streak = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : 0;

    // Completed tasks (either in last 7 days or marked completed)
    const completedTasks = state.tasks.filter(t => {
      if (!t.completed) return false;
      if (t.completedAt) {
        return new Date(t.completedAt) >= sevenDaysAgo;
      }
      return true; // Fallback for sample completed tasks
    });

    const activeTasks = state.tasks.filter(t => !t.completed);

    // Deep Work sessions
    let sessions = [];
    if (typeof FocusEngine !== 'undefined') {
      sessions = FocusEngine.getSessions();
    }
    const weeklySessions = sessions.filter(s => {
      if (!s.timestamp) return true;
      return new Date(s.timestamp) >= sevenDaysAgo;
    });
    const focusMins = weeklySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const focusHours = (focusMins / 60).toFixed(1);
    const avgSessionMins = weeklySessions.length > 0 ? Math.round(focusMins / weeklySessions.length) : 0;
    const maxSessionMins = weeklySessions.length > 0 ? Math.max(...weeklySessions.map(s => s.durationMinutes || 0)) : 0;

    // Habits consistency
    let habitsList = [];
    if (typeof HabitsEngine !== 'undefined' && HabitsEngine.habits && HabitsEngine.habits.length > 0) {
      habitsList = HabitsEngine.habits;
    } else {
      try {
        const raw = localStorage.getItem('tesseract_habits_data');
        if (raw) habitsList = JSON.parse(raw);
      } catch (e) {}
    }

    // Calculate 7-day adherence for habits
    const last7DayKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      last7DayKeys.push(d.toISOString().split('T')[0]);
    }

    let totalHabitChecks = 0;
    let possibleHabitChecks = habitsList.length * 7;
    const habitsStats = habitsList.map(h => {
      let checks = 0;
      let dotString = '';
      last7DayKeys.forEach(k => {
        if (h.history && h.history[k]) {
          checks++;
          dotString += '●';
        } else {
          dotString += '○';
        }
      });
      totalHabitChecks += checks;
      const pct = Math.round((checks / 7) * 100);
      return {
        id: h.id,
        title: h.title,
        icon: h.icon || '🎯',
        category: h.category || 'General',
        checks,
        pct,
        dotString
      };
    });
    const overallHabitAdherence = possibleHabitChecks > 0 ? Math.round((totalHabitChecks / possibleHabitChecks) * 100) : 100;

    // Strategic Alignment Score
    const totalTactical = state.tasks.filter(t => ['daily', 'weekly'].includes(t.tier) && !t.completed).length;
    const linkedTactical = state.tasks.filter(t => ['daily', 'weekly'].includes(t.tier) && !t.completed && t.parentId).length;
    const alignmentScore = totalTactical > 0 ? Math.round((linkedTactical / totalTactical) * 100) : 100;

    const dateRangeStr = `${sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return {
      userName,
      now,
      sevenDaysAgo,
      dateRangeStr,
      totalXP,
      level,
      rankTitle,
      streak,
      alignmentScore,
      completedTasks,
      activeTasks,
      weeklySessions,
      focusMins,
      focusHours,
      avgSessionMins,
      maxSessionMins,
      habitsStats,
      overallHabitAdherence
    };
  },

  generateMarkdown() {
    const data = this.getReportData();
    let md = `# 📄 TESSERACT EXECUTIVE WEEKLY REPORT\n`;
    md += `> **Executive:** ${data.userName} | **Period:** ${data.dateRangeStr} | **Generated:** ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\n\n`;
    md += `---\n\n`;

    md += `## 📊 Executive Summary\n`;
    md += `| Key Metric | Status / Value |\n`;
    md += `|---|---|\n`;
    md += `| **Executive Rank** | Level ${data.level} — ${data.rankTitle} |\n`;
    md += `| **Total XP** | ${data.totalXP.toLocaleString()} XP |\n`;
    md += `| **Execution Streak** | ${data.streak} Days 🔥 |\n`;
    md += `| **Strategic Alignment** | ${data.alignmentScore}% ${data.alignmentScore >= 85 ? '🟢 Optimal' : data.alignmentScore >= 70 ? '🟡 Moderate' : '🔴 Action Required'} |\n`;
    md += `| **Habit Adherence** | ${data.overallHabitAdherence}% |\n`;
    md += `| **Deep Work Logged** | ${data.focusHours} Hours (${data.weeklySessions.length} sessions) |\n\n`;

    md += `## ✅ Goals & Milestones Completed (${data.completedTasks.length})\n`;
    TIERS.forEach(tierObj => {
      const tierItems = data.completedTasks.filter(t => t.tier === tierObj.id);
      if (tierItems.length > 0) {
        md += `### ${tierObj.emoji} ${tierObj.name} (${tierItems.length})\n`;
        tierItems.forEach(t => {
          md += `- [x] **[${t.priority.toUpperCase()}]** ${t.title} *(#${t.category || 'General'})*\n`;
          if (t.description) md += `  - *Notes:* ${t.description.replace(/\n/g, ' ')}\n`;
        });
        md += `\n`;
      }
    });

    if (data.completedTasks.length === 0) {
      md += `*No completed goals logged in this 7-day period.*\n\n`;
    }

    md += `## 🧠 Deep Work & Flow Velocity\n`;
    md += `| Metric | Weekly Total |\n`;
    md += `|---|---|\n`;
    md += `| **Total Focus Hours** | ${data.focusHours} hrs (${data.focusMins} mins) |\n`;
    md += `| **Completed Sprints** | ${data.weeklySessions.length} sessions |\n`;
    md += `| **Average Session** | ${data.avgSessionMins} mins |\n`;
    md += `| **Peak Sprint** | ${data.maxSessionMins} mins |\n\n`;

    md += `## 🔁 Habit Consistency Matrix (Past 7 Days)\n`;
    md += `| Habit | 7-Day Consistency | Adherence |\n`;
    md += `|---|---|---|\n`;
    data.habitsStats.forEach(h => {
      md += `| ${h.icon} ${h.title} | \`${h.dotString}\` | **${h.pct}%** |\n`;
    });
    md += `| **Overall Consistency Score** | | **${data.overallHabitAdherence}%** |\n\n`;

    md += `## 🎯 High-Leverage Priorities In Flight\n`;
    const topActive = data.activeTasks.slice(0, 8);
    if (topActive.length > 0) {
      topActive.forEach(t => {
        const tierObj = TIERS.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task' };
        md += `- [ ] **[${t.priority.toUpperCase()}]** ${t.title} — *${tierObj.emoji} ${tierObj.name}* *(#${t.category || 'General'})*\n`;
      });
      md += `\n`;
    } else {
      md += `*All active objectives cleared!*\n\n`;
    }

    md += `---\n*Generated automatically by Tesseract Multi-Horizon Executive Operating System.*`;
    return md;
  },

  generateHTMLPreview() {
    const data = this.getReportData();
    let html = `
      <div class="report-preview-container">
        <div class="report-header-banner">
          <div class="report-badge-pill">OFFICIAL EXECUTIVE DEBRIEF</div>
          <h2 class="report-doc-title">TESSERACT WEEKLY REPORT</h2>
          <div class="report-meta-sub">
            <span>👤 ${escapeHTML(data.userName)}</span>
            <span>•</span>
            <span>📅 ${data.dateRangeStr}</span>
          </div>
        </div>

        <!-- 4-Stat Summary Cards -->
        <div class="report-stats-grid">
          <div class="report-stat-card gold">
            <span class="report-stat-label">EXECUTIVE RANK</span>
            <span class="report-stat-value">Lvl ${data.level}</span>
            <span class="report-stat-sub">${data.rankTitle}</span>
          </div>
          <div class="report-stat-card">
            <span class="report-stat-label">TOTAL XP</span>
            <span class="report-stat-value">${data.totalXP.toLocaleString()}</span>
            <span class="report-stat-sub">${data.streak} Day Streak 🔥</span>
          </div>
          <div class="report-stat-card">
            <span class="report-stat-label">DEEP WORK</span>
            <span class="report-stat-value">${data.focusHours}h</span>
            <span class="report-stat-sub">${data.weeklySessions.length} Flow Sprints</span>
          </div>
          <div class="report-stat-card">
            <span class="report-stat-label">HABIT SCORE</span>
            <span class="report-stat-value">${data.overallHabitAdherence}%</span>
            <span class="report-stat-sub">7-Day Consistency</span>
          </div>
        </div>

        <!-- Section: Completed Goals -->
        <div class="report-section-box">
          <div class="report-section-title">
            <span>✅ Completed Goals & Milestones</span>
            <span class="report-count-badge">${data.completedTasks.length} Done</span>
          </div>
          <div class="report-tasks-list">
    `;

    if (data.completedTasks.length === 0) {
      html += `<div class="report-empty-note">No goals marked completed in this period.</div>`;
    } else {
      TIERS.forEach(tierObj => {
        const tierItems = data.completedTasks.filter(t => t.tier === tierObj.id);
        if (tierItems.length > 0) {
          html += `
            <div class="report-tier-group">
              <div class="report-tier-header" style="color: ${tierObj.color || 'var(--accent-primary)'}">
                ${tierObj.emoji} ${tierObj.name} (${tierItems.length})
              </div>
          `;
          tierItems.forEach(t => {
            html += `
              <div class="report-task-row">
                <span class="report-check">✓</span>
                <span class="report-task-name">${escapeHTML(t.title)}</span>
                <span class="report-prio-pill prio-${t.priority}">${t.priority}</span>
                <span class="report-cat-tag">#${escapeHTML(t.category || 'General')}</span>
              </div>
            `;
          });
          html += `</div>`;
        }
      });
    }

    html += `
          </div>
        </div>

        <!-- Section: Habit Consistency Matrix -->
        <div class="report-section-box">
          <div class="report-section-title">
            <span>🔁 Habit Cadence Matrix</span>
            <span class="report-count-badge">${data.overallHabitAdherence}% Adherence</span>
          </div>
          <div class="report-habits-table">
            <div class="report-habit-header-row">
              <span>HABIT</span>
              <span>7-DAY CONSISTENCY</span>
              <span>SCORE</span>
            </div>
    `;

    data.habitsStats.forEach(h => {
      html += `
        <div class="report-habit-data-row">
          <span class="report-habit-name">${h.icon} ${escapeHTML(h.title)}</span>
          <span class="report-habit-dots font-mono">${h.dotString}</span>
          <span class="report-habit-pct">${h.pct}%</span>
        </div>
      `;
    });

    html += `
          </div>
        </div>

        <!-- Section: Active Priorities -->
        <div class="report-section-box">
          <div class="report-section-title">
            <span>🎯 High-Leverage Objectives In Flight</span>
            <span class="report-count-badge">${data.activeTasks.length} Active</span>
          </div>
          <div class="report-tasks-list">
    `;

    const topActive = data.activeTasks.slice(0, 6);
    if (topActive.length === 0) {
      html += `<div class="report-empty-note">All strategic objectives completed!</div>`;
    } else {
      topActive.forEach(t => {
        const tierObj = TIERS.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task' };
        html += `
          <div class="report-task-row active">
            <span class="report-bullet">•</span>
            <span class="report-task-name">${escapeHTML(t.title)}</span>
            <span class="report-tier-badge">${tierObj.emoji} ${tierObj.name}</span>
            <span class="report-prio-pill prio-${t.priority}">${t.priority}</span>
          </div>
        `;
      });
    }

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  },

  open() {
    const modal = document.getElementById('weekly-report-modal');
    const body = document.getElementById('weekly-report-body');
    const dateRangeEl = document.getElementById('report-modal-daterange');
    if (!modal || !body) return;

    const data = this.getReportData();
    if (dateRangeEl) dateRangeEl.textContent = `Debrief for ${data.dateRangeStr}`;
    body.innerHTML = this.generateHTMLPreview();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  close() {
    const modal = document.getElementById('weekly-report-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  },

  copyMarkdown() {
    const md = this.generateMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 Executive Weekly Report copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard.', 'error');
    });
  },

  downloadMarkdown() {
    const md = this.generateMarkdown();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `tesseract_executive_report_${dateStr}.md`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast('📥 Downloaded executive weekly report (.md)', 'success');
  },

  printReport() {
    window.print();
  }
};

// Start application on DOM load
document.addEventListener('DOMContentLoaded', init);


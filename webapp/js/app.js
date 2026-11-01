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
  { id: 'daily', name: 'Daily Tasks', emoji: '🌅', color: '#3b82f6', desc: "Today's high-leverage execution items" },
  { id: 'weekly', name: 'Weekly Milestones', emoji: '📅', color: '#8b5cf6', desc: 'Tactical milestones for this week' },
  { id: 'monthly', name: 'Monthly Goals', emoji: '🗓️', color: '#10b981', desc: 'Deliverables and focus areas for this month' },
  { id: 'quarterly', name: 'Quarterly Goals', emoji: '🎯', color: '#06b6d4', desc: '90-day objectives & key strategic results' },
  { id: 'annual', name: 'Annual Goals', emoji: '🏆', color: '#f43f5e', desc: 'North star pillars & yearly targets' }
];

let state = {
  tasks: [],
  activeHorizon: 'general', // 'general' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'all'
  statusFilter: 'all', // 'all' | 'active' | 'completed'
  categoryFilter: 'all',
  priorityFilter: 'all',
  searchQuery: '',
  editingTaskId: null,
  viewMode: (typeof localStorage !== 'undefined' && localStorage.getItem('tesseract_view_mode')) || 'list', // 'list' | 'eisenhower' | 'kanban'
  kanbanColumnFilter: 'all', // 'all' | 'backlog' | 'todo' | 'in_progress' | 'done'
  showArchivedDone: false,
  profile: {
    name: 'Tesseract User',
    image: null
  },
  streak: {
    count: 0,
    lastDate: null
  }
};

// Global state exposure for modular engines
window.state = state;
window.TIERS = TIERS;
window.STORAGE_KEY = STORAGE_KEY;

// Initialization
function init() {
  loadTheme();
  loadData();
  loadStreak();
  loadProfile();

  // Read URL parameters on index.html (e.g. ?horizon=daily or ?action=new-task)
  const urlParams = new URLSearchParams(window.location.search);
  const horizonParam = urlParams.get('horizon');
  const actionParam = urlParams.get('action');
  if (horizonParam && ['general', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'all'].includes(horizonParam)) {
    state.activeHorizon = horizonParam;
  }

  // Inject shared layout components
  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (typeof Components !== 'undefined') {
    Components.renderSidebar(state.activeHorizon);
    
    let headerConfig = { title: 'Executive Command Center', subtitle: 'Unified multi-horizon cockpit & execution launchpad.', showSearch: true };
    if (page === 'cascade') {
      headerConfig = { title: 'Strategic Goal Cascade', subtitle: 'Multi-horizon vertical alignment linking daily actions to annual goals.', showSearch: false };
    } else if (page === 'analytics') {
      headerConfig = { title: 'Productivity & Goal Analytics', subtitle: 'Comprehensive metric tracking and horizon performance.', showSearch: false };
    } else if (page === 'roadmap') {
      headerConfig = { title: '12-Month Horizon Timeline', subtitle: 'Interactive Gantt roadmap connecting annual & quarterly goals to deadlines.', showSearch: false };
    } else if (page === 'bucketlist') {
      headerConfig = { title: "Life's Bucket List", subtitle: 'Lifetime dreams, epic adventures, and summit ambitions.', showSearch: false };
    } else if (page === 'backlogs') {
      headerConfig = { title: 'Executive Backlogs', subtitle: 'Notion-style grouped matrix for cross-functional objectives, severities, and target schedules.', showSearch: false };
    } else if (page === 'completed_backlogs') {
      headerConfig = { title: 'Completed Backlogs', subtitle: 'Executive archive of finished objectives, executed milestones, and accomplishments.', showSearch: false };
    } else if (page === 'pulse') {
      headerConfig = { title: 'Executive Pulse', subtitle: 'Ultra-fast micro-reflections, career observations, and daily life signals.', showSearch: false };
    } else if (page === 'report') {
      headerConfig = { title: 'Executive Intelligence & Reports', subtitle: 'Multi-cadence debriefs, SVG velocity charts, habit heatmaps, and strategic synthesis.', showSearch: false };
    } else if (page === 'profile') {
      headerConfig = { title: 'Your Profile', subtitle: 'Stats, badges, and activity history.', showSearch: false };
    } else if (page === 'professional') {
      headerConfig = { title: 'Professional Journal', subtitle: 'Living career timeline, dynamic resume, and professional milestone tracker.', showSearch: false };
    } else if (page === 'tracker') {
      headerConfig = { title: 'Routine & Cadence Tracker', subtitle: 'Multi-date rolling tracker for grooming, maintenance, hygiene & habits.', showSearch: false };
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
  if (typeof BacklogEngine !== 'undefined') BacklogEngine.init();
  if (typeof HorizonBridge !== 'undefined') HorizonBridge.init();
  if (typeof DocketEngine !== 'undefined') DocketEngine.init();
  if (typeof ReportEngine !== 'undefined') ReportEngine.init();
  if (typeof TouchEngine !== 'undefined') TouchEngine.init();
  if (typeof SyncEngine !== 'undefined') SyncEngine.init();
  if (typeof NotificationEngine !== 'undefined') NotificationEngine.init();
  if (typeof ProfessionalEngine !== 'undefined') ProfessionalEngine.init();
  if (typeof TrackerEngine !== 'undefined') TrackerEngine.init();

  if (page === 'index' && state.viewMode && state.viewMode !== 'list') {
    switchView(state.viewMode);
  } else {
    renderAll();
  }

  renderStreakUI();
  lucide.createIcons();
  initPwaInstallPrompt();
  updateAppBadge();

  // Handle Quick Action shortcuts from PWA manifest or launcher links
  if (actionParam) {
    handleQuickActionShortcut(actionParam, horizonParam);
  }
}

function handleQuickActionShortcut(action, horizon) {
  setTimeout(() => {
    if (action === 'new-task' || action === 'add-task' || action === 'add') {
      const targetTier = horizon && ['daily', 'weekly', 'monthly', 'quarterly', 'annual'].includes(horizon) ? horizon : 'daily';
      openAddModal(targetTier);
    } else if (action === 'morning' && typeof RitualsEngine !== 'undefined') {
      RitualsEngine.openMorningModal();
    } else if (action === 'evening' && typeof RitualsEngine !== 'undefined') {
      RitualsEngine.openEveningModal();
    } else if (action === 'task') {
      const taskId = new URLSearchParams(window.location.search).get('id');
      if (taskId && typeof openEditModal === 'function') {
        openEditModal(taskId);
      }
    }
  }, 250);
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

  // Ensure Backlog items are fresh and merged into state.tasks
  if (typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.syncAll === 'function') {
    HorizonBridge.syncAll();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  updateAppBadge();
  if (typeof SyncEngine !== 'undefined') SyncEngine.queuePush();
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
  if (typeof SyncEngine !== 'undefined') SyncEngine.queuePush();
}

// ── Streak Engine ──────────────────────────────────────────
// Modularized into js/streak_engine.js for high separation of concerns.

// ── Theme Switcher ──────────────────────────────────────────
const ACCENT_KEY = 'horizon_accent';

function loadTheme() {
  if (typeof Components !== 'undefined' && typeof Components.initTheme === 'function') {
    Components.initTheme();
  } else {
    const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem('tesseract_goals_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }
  const savedAccent = localStorage.getItem(ACCENT_KEY);
  if (savedAccent) {
    document.documentElement.setAttribute('data-accent', savedAccent);
  }
}

function toggleTheme() {
  if (typeof Components !== 'undefined' && typeof Components.toggleTheme === 'function') {
    Components.toggleTheme();
    return;
  }
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  localStorage.setItem('tesseract_goals_theme', next);
}

function setAccent(accent) {
  if (accent) {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(ACCENT_KEY, accent);
  } else {
    document.documentElement.removeAttribute('data-accent');
    localStorage.removeItem(ACCENT_KEY);
  }
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
    btnEditName.addEventListener('click', async () => {
      const newName = typeof TesseractDialog !== 'undefined'
        ? await TesseractDialog.prompt({
            title: 'Edit Profile Name',
            message: 'Enter your preferred display name:',
            defaultValue: state.profile.name,
            placeholder: 'e.g. Alex Morgan',
            confirmLabel: 'Save Name'
          })
        : prompt("Enter your new profile name:", state.profile.name);

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
// Modularized into js/search_controller.js for high separation of concerns.

// Toggle Task Completion
function toggleTaskCompletion(taskId, clickEvent = null) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  saveData();

  // Bi-directional synchronization with HorizonBridge / BacklogEngine
  if (typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.syncHorizonTaskToBacklog === 'function') {
    HorizonBridge.syncHorizonTaskToBacklog(task);
  } else if (task.backlogId || (task.id && task.id.startsWith('task_bkl_'))) {
    try {
      const bklId = task.backlogId || task.id.replace('task_bkl_', '');
      const raw = localStorage.getItem('tesseract_backlog_data');
      if (raw) {
        const bkls = JSON.parse(raw);
        const b = bkls.find(x => x.id === bklId);
        if (b) {
          b.completed = task.completed;
          b.completedAt = task.completedAt;
          b.kanbanStatus = task.completed ? 'done' : (task.kanbanStatus || 'backlog');
          localStorage.setItem('tesseract_backlog_data', JSON.stringify(bkls));
        }
      }
    } catch (e) {
      console.warn('[App] Failed to sync task completion to backlog storage:', e);
    }
  }

  // Bi-directional synchronization with Today's Docket
  if (typeof DocketEngine !== 'undefined') {
    if (Array.isArray(DocketEngine.items)) {
      const dktItem = DocketEngine.items.find(x => x.id === task.id || x.backlogId === task.backlogId || (task.backlogId && x.id === task.backlogId) || x.task === task.title);
      if (dktItem) {
        dktItem.completed = task.completed;
        dktItem.completedAt = task.completedAt;
        if (typeof DocketEngine.save === 'function') DocketEngine.save();
        if (typeof DocketEngine.render === 'function') DocketEngine.render();
      }
    }
  } else {
    try {
      const raw = localStorage.getItem('tesseract_docket_today_items');
      if (raw) {
        const dktItems = JSON.parse(raw);
        const d = dktItems.find(x => x.id === task.id || x.backlogId === task.backlogId || (task.backlogId && x.id === task.backlogId) || x.task === task.title);
        if (d) {
          d.completed = task.completed;
          d.completedAt = task.completedAt;
          localStorage.setItem('tesseract_docket_today_items', JSON.stringify(dktItems));
        }
      }
    } catch (e) {
      console.warn('[App] Failed to sync task completion to docket storage:', e);
    }
  }

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

if (typeof window !== 'undefined') {
  window.toggleTaskCompletion = toggleTaskCompletion;
}

// Delete Task
async function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const confirmed = typeof TesseractDialog !== 'undefined'
    ? await TesseractDialog.confirm({
        title: 'Delete Task',
        message: `Are you sure you want to delete "${task.title}"?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      })
    : confirm(`Are you sure you want to delete "${task.title}"?`);

  if (confirmed) {
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
    quote: "If a daily action doesn't bridge toward your Annual Goals or Quarterly summit, question why it exists on your agenda.",
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
    if (state.viewMode === 'eisenhower') {
      renderEisenhowerMatrix();
    } else if (state.viewMode === 'kanban') {
      renderKanbanBoard();
    } else {
      renderTaskList();
    }
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
  } else if (page === 'report') {
    if (typeof ReportEngine !== 'undefined') ReportEngine.render();
  } else if (page === 'professional') {
    if (typeof ProfessionalEngine !== 'undefined') ProfessionalEngine.render();
  } else if (page === 'profile') {
    renderProfileView();
  }

  if (typeof XPEngine !== 'undefined') {
    XPEngine.updateUI();
  }

  if (typeof AlignmentEngine !== 'undefined') {
    AlignmentEngine.renderAlignmentUI();
  }

  updateAppBadge();
  lucide.createIcons();
}

function switchView(mode) {
  state.viewMode = mode;
  try {
    localStorage.setItem('tesseract_view_mode', mode);
  } catch (e) {
    console.warn('[App] Failed to persist view mode preference:', e);
  }
  const listBtn = document.getElementById('view-mode-list');
  const matrixBtn = document.getElementById('view-mode-matrix');
  const kanbanBtn = document.getElementById('view-mode-kanban');
  const filterBar = document.querySelector('.filter-bar');
  const matrixContainer = document.getElementById('eisenhower-matrix-container');
  const kanbanContainer = document.getElementById('kanban-board-container');
  const tasksContainer = document.getElementById('tasks-container');

  // Reset all button states
  if (listBtn) listBtn.classList.toggle('active', mode === 'list');
  if (matrixBtn) matrixBtn.classList.toggle('active', mode === 'eisenhower');
  if (kanbanBtn) kanbanBtn.classList.toggle('active', mode === 'kanban');

  // Hide all views
  if (tasksContainer) tasksContainer.style.display = 'none';
  if (matrixContainer) matrixContainer.style.display = 'none';
  if (kanbanContainer) kanbanContainer.style.display = 'none';
  if (filterBar) filterBar.style.display = 'none';

  // Show the selected view
  if (mode === 'list') {
    if (filterBar) filterBar.style.display = '';
    if (tasksContainer) tasksContainer.style.display = '';
    renderTaskList();
  } else if (mode === 'eisenhower') {
    if (matrixContainer) matrixContainer.style.display = 'grid';
    if (typeof renderEisenhowerMatrix === 'function') renderEisenhowerMatrix();
  } else if (mode === 'kanban') {
    if (kanbanContainer) kanbanContainer.style.display = 'flex';
    if (typeof renderKanbanBoard === 'function') renderKanbanBoard();
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.switchView = switchView;

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

  // Bind drag-and-drop reordering
  if (typeof DragDropEngine !== 'undefined') {
    setTimeout(() => DragDropEngine.bindListView(), 50);
  }
}

// ── Eisenhower Matrix & Kanban Board Views ─────────────────────
// Modularized into js/matrix_view.js and js/kanban_view.js.

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
        if (typeof TesseractDialog !== 'undefined') {
          TesseractDialog.alert({
            title: 'Import Failed',
            message: 'Invalid JSON structure: Expected an array of task objects.',
            variant: 'danger'
          });
        } else {
          alert('Invalid JSON structure: Expected an array of task objects.');
        }
      }
    } catch (err) {
      if (typeof TesseractDialog !== 'undefined') {
        TesseractDialog.alert({
          title: 'Import Error',
          message: 'Error parsing JSON file: ' + err.message,
          variant: 'danger'
        });
      } else {
        alert('Error parsing JSON file: ' + err.message);
      }
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

// ── Profile View & Executive Data Vault ─────────────────────────
// Modularized into js/profile_engine.js for high separation of concerns.

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

function showActionToast(message, actionLabel, onAction, durationMs = 10000) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-with-action';
  toast.innerHTML = `
    <i data-lucide="info"></i>
    <span class="toast-text">${escapeHTML(message)}</span>
    <button class="toast-action-btn" type="button">${escapeHTML(actionLabel)}</button>
  `;
  const actionBtn = toast.querySelector('.toast-action-btn');
  let timeoutId = null;
  let remainingSec = Math.round(durationMs / 1000);

  const countdownInterval = setInterval(() => {
    remainingSec--;
    if (remainingSec > 0 && actionBtn) {
      actionBtn.textContent = `${actionLabel} (${remainingSec}s)`;
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);

  actionBtn.addEventListener('click', () => {
    clearInterval(countdownInterval);
    clearTimeout(timeoutId);
    toast.remove();
    if (typeof onAction === 'function') onAction();
  });

  toastContainer.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  timeoutId = setTimeout(() => {
    clearInterval(countdownInterval);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, durationMs);
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
// Modularized into js/focus_engine.js for high performance and separation of concerns.

// ── 📱 Mobile Application Enhancements ─────────────────────────

/**
 * App Icon Badge API (navigator.setAppBadge)
 * Sets the badge on the device home screen showing open Daily Goals
 */
function updateAppBadge() {
  if ('setAppBadge' in navigator) {
    const dailyOpen = state.tasks ? state.tasks.filter(t => t.tier === 'daily' && !t.completed).length : 0;
    if (dailyOpen > 0) {
      navigator.setAppBadge(dailyOpen).catch(() => {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
}

/**
 * Native Web Share API (navigator.share)
 * Shares executive debrief with native iOS / Android share sheet
 */
function shareExecutiveReport() {
  const dailyTasks = state.tasks ? state.tasks.filter(t => t.tier === 'daily') : [];
  const dailyDone = dailyTasks.filter(t => t.completed).length;
  const streak = state.streak ? state.streak.count : 0;
  const xp = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.xp : 0;

  const shareText = `🏛️ TESSERACT EXECUTIVE DEBRIEF\n` +
    `⚡ Execution Velocity: ${dailyDone}/${dailyTasks.length} Daily Goals Cleared\n` +
    `🔥 Current Streak: ${streak} Days\n` +
    `🏆 Executive XP: ${xp} XP\n` +
    `Unified multi-horizon alignment across Daily, Weekly & Annual horizons.`;

  if (navigator.share) {
    navigator.share({
      title: 'Tesseract Executive Debrief',
      text: shareText,
      url: window.location.href
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        copyShareFallback(shareText);
      }
    });
  } else {
    copyShareFallback(shareText);
  }
}

function copyShareFallback(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Executive Debrief copied to clipboard!', 'success');
    }).catch(() => {
      if (typeof TesseractDialog !== 'undefined') {
        TesseractDialog.prompt({
          title: 'Executive Debrief',
          message: 'Copy debrief summary below:',
          defaultValue: text,
          inputType: 'textarea',
          confirmLabel: 'Done'
        });
      } else {
        prompt('Copy Executive Debrief:', text);
      }
    });
  } else {
    if (typeof TesseractDialog !== 'undefined') {
      TesseractDialog.prompt({
        title: 'Executive Debrief',
        message: 'Copy debrief summary below:',
        defaultValue: text,
        inputType: 'textarea',
        confirmLabel: 'Done'
      });
    } else {
      prompt('Copy Executive Debrief:', text);
    }
  }
}

/**
 * PWA Smart Install Prompt Engine
 */
let deferredPwaPrompt = null;

function initPwaInstallPrompt() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return;

  const isDismissed = localStorage.getItem('tesseract_pwa_dismissed');
  const banner = document.getElementById('pwa-install-banner');
  const desc = document.getElementById('pwa-install-desc');

  // Android Chrome / Desktop beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    if (banner && !isDismissed) {
      banner.style.display = 'flex';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  // iOS Safari detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('CriOS');
  if (isIOS && isSafari && !isStandalone && !isDismissed && banner) {
    if (desc) desc.textContent = 'Tap Share ⎋ then "Add to Home Screen" ➕';
    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) installBtn.style.display = 'none';
    banner.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function triggerPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('🚀 Installing Tesseract Executive App...', 'success');
      }
      dismissPwaInstall();
      deferredPwaPrompt = null;
    });
  } else {
    showToast('Add to Home Screen from your browser menu.', 'info');
  }
}

function dismissPwaInstall() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('tesseract_pwa_dismissed', Date.now().toString());
}

// Start application on DOM load
document.addEventListener('DOMContentLoaded', init);


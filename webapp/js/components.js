/**
 * Tesseract Shared Layout Components
 * Injects sidebar, header, modal, and toast container into pages
 */

const Components = {
  /**
   * Returns current page name (e.g., 'index', 'cascade', 'analytics', 'profile')
   */
  getCurrentPage() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1).replace('.html', '').toLowerCase();
    if (!page || page === '' || page === 'index') return 'index';
    return page;
  },

  /**
   * Render Sidebar into an element with id="sidebar-mount" or prepend to .app-layout
   */
  renderSidebar(activeHorizon = 'general') {
    const page = this.getCurrentPage();
    const isHome = page === 'index';
    const isCascade = page === 'cascade';
    const isAnalytics = page === 'analytics';
    const isRoadmap = page === 'roadmap';
    const isBucketlist = page === 'bucketlist';

    const sidebarHTML = `
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="Components.closeMobileSidebar()"></div>
    <aside class="sidebar" id="app-sidebar">
      <div class="brand-container">
        <div class="brand-logo" style="cursor: pointer;" onclick="window.location.href='index.html'">
          <div class="brand-icon-mesh">
            <i data-lucide="box" class="brand-svg"></i>
          </div>
          <div>
            <h1 class="brand-title">TESSERACT</h1>
            <span class="brand-subtitle">Multi-Horizon Matrix</span>
          </div>
        </div>
        <button class="sidebar-close-btn" id="sidebar-close-btn" onclick="Components.closeMobileSidebar()" aria-label="Close Navigation">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="sidebar-section-title">TIME HORIZONS</div>
      <nav class="nav-menu">
        <button class="nav-item ${isHome && activeHorizon === 'general' ? 'active' : ''}" data-horizon="general" id="tab-general" onclick="Components.closeMobileSidebar()">
          <i data-lucide="home"></i>
          <span>Home</span>
          <span class="badge" id="badge-general">0</span>
        </button>
        <button class="nav-item ${isHome && activeHorizon === 'daily' ? 'active' : ''}" data-horizon="daily" id="tab-daily" onclick="Components.closeMobileSidebar()">
          <span class="nav-emoji">🌅</span>
          <span>Daily Tasks</span>
          <span class="badge" id="badge-daily">0</span>
        </button>
        <button class="nav-item ${isHome && activeHorizon === 'weekly' ? 'active' : ''}" data-horizon="weekly" id="tab-weekly" onclick="Components.closeMobileSidebar()">
          <span class="nav-emoji">📅</span>
          <span>Weekly Milestones</span>
          <span class="badge" id="badge-weekly">0</span>
        </button>
        <button class="nav-item ${isHome && activeHorizon === 'monthly' ? 'active' : ''}" data-horizon="monthly" id="tab-monthly" onclick="Components.closeMobileSidebar()">
          <span class="nav-emoji">🗓️</span>
          <span>Monthly Goals</span>
          <span class="badge" id="badge-monthly">0</span>
        </button>
        <button class="nav-item ${isHome && activeHorizon === 'quarterly' ? 'active' : ''}" data-horizon="quarterly" id="tab-quarterly" onclick="Components.closeMobileSidebar()">
          <span class="nav-emoji">🎯</span>
          <span>Quarterly Goals</span>
          <span class="badge" id="badge-quarterly">0</span>
        </button>
        <button class="nav-item ${isHome && activeHorizon === 'annual' ? 'active' : ''}" data-horizon="annual" id="tab-annual" onclick="Components.closeMobileSidebar()">
          <span class="nav-emoji">🏆</span>
          <span>Annual Vision</span>
          <span class="badge" id="badge-annual">0</span>
        </button>
        <button class="nav-item ${isHome && activeHorizon === 'all' ? 'active' : ''}" data-horizon="all" id="tab-all" onclick="Components.closeMobileSidebar()">
          <i data-lucide="layers"></i>
          <span>All 5 Horizons</span>
          <span class="badge" id="badge-all">0</span>
        </button>
      </nav>

      <div class="sidebar-section-title">VIEWS & TOOLS</div>
      <nav class="nav-menu secondary">
        <button class="nav-item" id="btn-sidebar-focus" onclick="Components.closeMobileSidebar(); FocusEngine.open();" title="Start Focus Mode Session">
          <i data-lucide="zap"></i>
          <span>Focus Mode</span>
        </button>
        <button class="nav-item ${isCascade ? 'active' : ''}" id="btn-view-cascade" onclick="Components.closeMobileSidebar(); if(Components.getCurrentPage()!=='cascade') window.location.href='cascade.html';">
          <i data-lucide="git-merge"></i>
          <span>Goal Cascade Tree</span>
        </button>
        <button class="nav-item ${isRoadmap ? 'active' : ''}" id="btn-view-roadmap" onclick="Components.closeMobileSidebar(); if(Components.getCurrentPage()!=='roadmap') window.location.href='roadmap.html';">
          <i data-lucide="calendar-range"></i>
          <span>Roadmap Timeline</span>
        </button>
        <button class="nav-item ${isBucketlist ? 'active' : ''}" id="btn-view-bucketlist" onclick="Components.closeMobileSidebar(); if(Components.getCurrentPage()!=='bucketlist') window.location.href='bucketlist.html';">
          <i data-lucide="sparkles"></i>
          <span>Life's Bucket List</span>
        </button>
        <button class="nav-item ${isAnalytics ? 'active' : ''}" id="btn-view-analytics" onclick="Components.closeMobileSidebar(); if(Components.getCurrentPage()!=='analytics') window.location.href='analytics.html';">
          <i data-lucide="bar-chart-3"></i>
          <span>Productivity Metrics</span>
        </button>
        <button class="nav-item" id="btn-view-report" onclick="Components.closeMobileSidebar(); if(typeof WeeklyReportEngine !== 'undefined') WeeklyReportEngine.open();" title="Generate Executive Weekly Debrief">
          <i data-lucide="file-text"></i>
          <span>Weekly Report</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="streak-card" id="streak-card">
          <div class="streak-header">
            <span class="streak-icon" id="streak-emoji">🔥</span>
            <div>
              <div class="streak-title">Daily Streak</div>
              <div class="streak-value" id="streak-counter">0 Days</div>
            </div>
          </div>
          <div class="streak-progress-bar">
            <div class="streak-fill" id="streak-fill" style="width: 0%"></div>
          </div>
          <div class="streak-badge-label" id="streak-badge-label">Next: 🏅 1 Week</div>
          <div class="streak-badges" id="streak-badges">
            <!-- Injected by JS -->
          </div>
        </div>

        <div class="user-controls">
          <button class="icon-btn" id="theme-toggle" title="Toggle Theme" aria-label="Toggle Theme">
            <i data-lucide="sun" class="sun-icon"></i>
            <i data-lucide="moon" class="moon-icon"></i>
          </button>
          <button class="icon-btn" id="btn-export-json" title="Export JSON Data" aria-label="Export Data">
            <i data-lucide="download"></i>
          </button>
          <button class="icon-btn" id="btn-import-trigger" title="Import JSON Data" aria-label="Import Data">
            <i data-lucide="upload"></i>
          </button>
          <input type="file" id="import-file-input" accept=".json" style="display:none;">
          <button class="icon-btn" id="btn-reset-data" title="Reset to Sample Data" aria-label="Reset Data">
            <i data-lucide="rotate-ccw"></i>
          </button>
        </div>
      </div>
    </aside>
    `;

    const mount = document.getElementById('sidebar-mount');
    if (mount) {
      mount.outerHTML = sidebarHTML;
    } else {
      const layout = document.querySelector('.app-layout');
      if (layout) layout.insertAdjacentHTML('afterbegin', sidebarHTML);
    }
  },

  /**
   * Toggle mobile navigation drawer
   */
  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('mobile-open');
    if (backdrop) {
      backdrop.classList.toggle('active', isOpen);
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Close mobile navigation drawer
   */
  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  },

  /**
   * Render Top Header into #header-mount or main-content
   */
  renderHeader({ title = 'All Goals & Tasks', subtitle = 'Holistic overview across all 5 strategic horizons.', showSearch = true } = {}) {
    const headerHTML = `
    <header class="top-header">
      <div class="header-left">
        <button class="mobile-menu-btn" id="mobile-menu-btn" onclick="Components.toggleMobileSidebar()" aria-label="Open Menu">
          <i data-lucide="menu"></i>
        </button>
        <div>
          <h2 class="view-title" id="current-view-heading">${title}</h2>
          <p class="view-subtitle" id="current-view-desc">${subtitle}</p>
        </div>
      </div>
      <div class="header-right">
        ${showSearch ? `
        <div class="search-box" id="search-box-wrapper">
          <i data-lucide="search" class="search-icon"></i>
          <input type="text" id="search-input" placeholder="Search tasks, tags, categories... (Press /)" autocomplete="off" />
          <button class="clear-search" id="clear-search" style="display:none;" aria-label="Clear search">&times;</button>
          <div class="search-suggestions-panel" id="search-suggestions" style="display:none;"></div>
        </div>
        ` : ''}
        
        <!-- Command Palette Trigger Button -->
        <button class="header-command-palette-btn" onclick="if(typeof CommandPalette !== 'undefined') CommandPalette.open();" title="Executive Command Palette (Ctrl+K)">
          <i data-lucide="command"></i>
          <span class="cmd-badge-text">Ctrl + K</span>
        </button>

        <!-- Live Header XP & Rank Widget -->
        <div class="header-xp-pill" id="header-xp-pill" onclick="window.location.href='profile.html'" title="View Level, Badges & XP Profile">
          <span class="header-level-tag" id="header-level-badge">Lvl 1</span>
          <span class="header-xp-number" id="header-xp-val">120 XP</span>
          <span class="header-multiplier-tag" id="header-multiplier-badge" style="display:none;">1.2x 🔥</span>
        </div>

        <button class="btn btn-secondary btn-header-focus-btn" id="btn-header-focus" title="Open Focus Mode">
          <i data-lucide="zap"></i>
          <span>Focus Mode</span>
        </button>
        <button class="btn btn-primary btn-header-add-btn" id="btn-open-add-modal">
          <i data-lucide="plus"></i>
          <span>Add Goal / Task</span>
        </button>
        <button class="profile-avatar-btn" id="btn-profile" title="Your Profile" onclick="window.location.href='profile.html'">
          <img id="header-avatar-img" src="" alt="" style="display:none; width:100%; height:100%; object-fit:cover; border-radius:50%;">
          <i data-lucide="user" class="profile-avatar-icon" id="header-avatar-fallback"></i>
        </button>
      </div>
    </header>
    `;

    const mount = document.getElementById('header-mount');
    if (mount) {
      mount.outerHTML = headerHTML;
    }
  },

  /**
   * Render Task Modal, Focus Overlay, and Toast Container at the bottom of the body
   */
  renderModalAndToasts() {
    const extraHTML = `
    <!-- Add / Edit Task Modal -->
    <div class="modal-backdrop" id="task-modal" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title-text">Create Goal / Task</h3>
          <button class="modal-close-btn" id="modal-close-btn">&times;</button>
        </div>

        <form id="task-form">
          <input type="hidden" id="task-id-input" value="">

          <div class="form-group">
            <label for="form-tier">Time Horizon / Tier <span class="req">*</span></label>
            <select id="form-tier" class="form-control" required>
              <option value="daily">🌅 Daily Task (Today's To-Do)</option>
              <option value="weekly">📅 Weekly Milestone (This Week)</option>
              <option value="monthly">🗓️ Monthly Goal (This Month)</option>
              <option value="quarterly">🎯 Quarterly Goal (90-Day Objective)</option>
              <option value="annual">🏆 Annual Vision (Yearly Goal)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="form-title">Goal / Task Title <span class="req">*</span></label>
            <input type="text" id="form-title" class="form-control" placeholder="e.g., Ship high-throughput orchestrator" required autocomplete="off">
          </div>

          <div class="form-group">
            <label for="form-desc">Description / Success Criteria</label>
            <textarea id="form-desc" class="form-control" rows="3" placeholder="Key deliverables, quantitative metrics, or notes..."></textarea>
          </div>

          <div class="form-row">
            <div class="form-group col">
              <label for="form-priority">Priority</label>
              <select id="form-priority" class="form-control">
                <option value="low">🟢 Low</option>
                <option value="medium" selected>🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>

            <div class="form-group col">
              <label for="form-category">Category</label>
              <select id="form-category" class="form-control">
                <option value="Product">Product</option>
                <option value="Engineering">Engineering</option>
                <option value="Career">Career</option>
                <option value="Finance">Finance</option>
                <option value="Health">Health</option>
                <option value="Personal">Personal</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col">
              <label for="form-due">Due Date</label>
              <input type="date" id="form-due" class="form-control">
            </div>

            <div class="form-group col">
              <label for="form-parent">Cascade Parent (Link Upward)</label>
              <select id="form-parent" class="form-control">
                <option value="">None (Independent Goal)</option>
                <!-- Injected dynamically -->
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="form-tags">Tags (Comma-separated)</label>
            <input type="text" id="form-tags" class="form-control" placeholder="e.g. backend, q3, sprint">
          </div>

          <!-- Sub-Tasks / Milestones Checklist Builder -->
          <div class="form-group modal-subtasks-group">
            <label>Sub-Tasks & Milestones Checklist</label>
            <div class="modal-subtask-add-row">
              <input type="text" id="modal-subtask-input" class="form-control" placeholder="Add milestone step and press Enter...">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-modal-subtask">
                <i data-lucide="plus"></i> <span>Add Step</span>
              </button>
            </div>
            <div class="modal-subtasks-list" id="modal-subtasks-list">
              <!-- Dynamically populated -->
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="modal-save-btn">Save Goal</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Fullscreen Focus Mode Overlay (Zero Scrollbar / Single Screen Fit) -->
    <div class="focus-overlay" id="focus-mode-overlay" style="display: none;">
      <div class="focus-container">
        <!-- Top Toolbar with Goal Switcher -->
        <div class="focus-top-bar">
          <div class="focus-brand-pill">
            <i data-lucide="zap"></i>
            <span>FOCUS MODE</span>
          </div>
          <div class="focus-goal-picker">
            <label for="focus-task-select" class="focus-picker-label">Target:</label>
            <select id="focus-task-select" class="focus-task-select">
              <!-- Dynamically populated in JS -->
            </select>
          </div>
          <button class="focus-close-btn" id="focus-exit-btn" title="Exit Focus Mode (Esc)">&times;</button>
        </div>

        <!-- Active Task Spotlight Card -->
        <div class="focus-task-card" id="focus-task-card">
          <div class="focus-task-header-line">
            <span class="focus-task-tier" id="focus-task-tier">🌅 Daily Task</span>
          </div>
          <h2 class="focus-task-title" id="focus-task-title">Select a Goal to Execute</h2>
          <p class="focus-task-desc" id="focus-task-desc">Single-task execution. Zero distractions.</p>
          <div class="focus-subtasks-container" id="focus-subtasks-container" style="display:none;">
            <!-- Subtask checklist items in focus mode -->
          </div>
        </div>

        <!-- Circular Timer Ring -->
        <div class="focus-timer-wrapper">
          <svg class="focus-timer-svg" viewBox="0 0 240 240">
            <circle class="focus-ring-bg" cx="120" cy="120" r="105"></circle>
            <circle class="focus-ring-progress" id="focus-ring-progress" cx="120" cy="120" r="105"></circle>
          </svg>
          <div class="focus-time-display">
            <span class="focus-time-digits" id="focus-time-digits">25:00</span>
            <span class="focus-time-status" id="focus-time-status">READY</span>
          </div>
        </div>

        <!-- Timer Presets & Custom Duration -->
        <div class="focus-presets">
          <button class="focus-preset-chip" data-minutes="15">15m</button>
          <button class="focus-preset-chip active" data-minutes="25">25m</button>
          <button class="focus-preset-chip" data-minutes="45">45m</button>
          <button class="focus-preset-chip" data-minutes="60">60m</button>
          <button class="focus-preset-chip" data-minutes="90">90m</button>
          <button class="focus-preset-chip focus-custom-chip" id="focus-btn-custom-duration" title="Set exact custom minutes">
            <i data-lucide="sliders-horizontal"></i>
            <span>Custom...</span>
          </button>
        </div>

        <!-- Control Actions with -5m, Reset, Play/Pause, +5m -->
        <div class="focus-controls">
          <button class="btn btn-ghost btn-sm focus-adjust-btn" id="focus-btn-minus5" title="Subtract 5 Minutes (-5m)">
            <span>-5m</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="focus-btn-reset" title="Reset (R)">
            <i data-lucide="rotate-ccw"></i>
            <span>Reset</span>
          </button>
          <button class="btn btn-primary focus-main-action" id="focus-btn-toggle" title="Space to Start/Pause">
            <i data-lucide="play" id="focus-play-icon"></i>
            <span id="focus-toggle-text">Start Focus</span>
          </button>
          <button class="btn btn-ghost btn-sm focus-adjust-btn" id="focus-btn-plus5" title="Add 5 Minutes (+5m)">
            <span>+5m</span>
          </button>
        </div>

        <!-- Ambient Sound Controls (Moved Downwards) -->
        <div class="focus-sound-bar">
          <div class="focus-sound-label-group">
            <i data-lucide="headphones"></i>
            <span>Soundscape:</span>
          </div>
          <select id="focus-sound-select" class="focus-sound-select">
            <option value="rain">🌧️ Gentle Rain</option>
            <option value="waves">🌊 Ocean Waves</option>
            <option value="binaural">🧠 Alpha Frequency (10Hz)</option>
            <option value="mute">🔕 Silence / Mute</option>
          </select>
          <div class="focus-volume-group">
            <i data-lucide="volume-2"></i>
            <input type="range" id="focus-volume-slider" min="0" max="1" step="0.05" value="0.5" class="focus-volume-slider" title="Soundscape Volume">
          </div>
        </div>

        <!-- Bottom Action: Mark Task Done & Shortcuts -->
        <div class="focus-bottom-action">
          <button class="btn btn-secondary btn-sm" id="focus-btn-complete-task">
            <i data-lucide="check-circle-2"></i>
            <span id="focus-complete-btn-text">Mark Goal Complete</span>
          </button>
          <span class="focus-shortcut-hint">Shortcuts: <b>Space</b> (play/pause) • <b>R</b> (reset) • <b>Esc</b> (exit)</span>
        </div>
      </div>
    </div>

    <!-- Rank Up Celebration Ceremony Modal -->
    <div class="modal-backdrop" id="rank-up-modal" style="display: none;">
      <div class="rank-up-card">
        <div class="rank-up-sparkle">👑</div>
        <span class="rank-up-super-label">EXECUTIVE LEVEL UP</span>
        <div class="rank-up-badge-container">
          <span class="rank-up-badge-old" id="rank-up-old-level">Lvl 1</span>
          <i data-lucide="arrow-right" class="rank-up-arrow"></i>
          <span class="rank-up-badge-new" id="rank-up-new-level">Lvl 2</span>
        </div>
        <h2 class="rank-up-title" id="rank-up-title">🎯 Operator</h2>
        <p class="rank-up-message">Your high-leverage execution velocity has unlocked an elite executive status.</p>
        <button class="btn btn-primary rank-up-btn" onclick="XPEngine.closeRankUpModal();">
          <span>Continue Execution</span>
          <i data-lucide="zap"></i>
        </button>
      </div>
    </div>

    <!-- 🌅 Morning Priming Modal (The Rule of 3) -->
    <div class="modal-backdrop" id="morning-priming-modal" style="display: none;">
      <div class="ritual-modal-card">
        <div class="ritual-modal-header">
          <div class="ritual-header-icon">🌅</div>
          <div>
            <h3 class="ritual-modal-title">Morning Priming: The Rule of 3</h3>
            <p class="ritual-modal-sub">Pick your Top 3 Non-Negotiable Wins for today to lock in your focus.</p>
          </div>
          <button class="modal-close-btn" onclick="RitualsEngine.closeModals();">&times;</button>
        </div>
        <div class="ritual-modal-body">
          <div class="ritual-tasks-picker-list" id="morning-tasks-picker-list">
            <!-- Injected by RitualsEngine.openMorningModal() -->
          </div>
        </div>
        <div class="ritual-modal-footer">
          <button type="button" class="btn btn-secondary" onclick="RitualsEngine.closeModals();">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="RitualsEngine.saveMorningWins();">
            <i data-lucide="lock"></i>
            <span>Lock in Top 3 Wins (+20 XP)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 🌙 Evening Shutdown Protocol Modal -->
    <div class="modal-backdrop" id="evening-shutdown-modal" style="display: none;">
      <div class="ritual-modal-card evening-modal">
        <div class="ritual-modal-header">
          <div class="ritual-header-icon">🌙</div>
          <div>
            <h3 class="ritual-modal-title">Evening Shutdown & Mind Sweep</h3>
            <p class="ritual-modal-sub">Debrief your day, record insights, and roll over unfinished tasks with zero guilt.</p>
          </div>
          <button class="modal-close-btn" onclick="RitualsEngine.closeModals();">&times;</button>
        </div>
        <div class="ritual-modal-body">
          <!-- Today's Execution Recap -->
          <div class="evening-recap-grid">
            <div class="recap-box">
              <span class="recap-val" id="evening-metric-tasks">0 Done</span>
              <span class="recap-lbl">Goals Cleared</span>
            </div>
            <div class="recap-box">
              <span class="recap-val" id="evening-metric-focus">0h</span>
              <span class="recap-lbl">Deep Work Hours</span>
            </div>
            <div class="recap-box accent">
              <span class="recap-val" id="evening-metric-xp">0 XP</span>
              <span class="recap-lbl">Total XP</span>
            </div>
          </div>

          <!-- 1-Sentence Executive Reflection -->
          <div class="evening-section">
            <label class="evening-label">📝 1-Sentence Executive Reflection / Key Takeaway</label>
            <textarea id="evening-reflection-text" class="form-control" rows="2" placeholder="What went well today? What is the single biggest win or learning?"></textarea>
          </div>

          <!-- Mind Sweep & Rollover -->
          <div class="evening-section">
            <label class="evening-label">🔄 Mind Sweep (Uncompleted Daily Tasks)</label>
            <div class="evening-rollover-list" id="evening-rollover-list">
              <!-- Injected by JS -->
            </div>
          </div>
        </div>
        <div class="ritual-modal-footer">
          <button type="button" class="btn btn-secondary" onclick="RitualsEngine.closeModals();">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="RitualsEngine.completeEveningShutdown();">
            <i data-lucide="check-circle"></i>
            <span>Complete Daily Shutdown (+50 XP)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 🌐 Strategic Alignment Linker Modal -->
    <div class="modal-backdrop" id="link-parent-modal" style="display: none;">
      <div class="ritual-modal-card parent-linker-card">
        <div class="ritual-modal-header">
          <div class="ritual-header-icon">🌐</div>
          <div>
            <h3 class="ritual-modal-title">Bridge to Strategic North Star</h3>
            <p class="ritual-modal-sub">Link this task to an Annual Vision, Quarterly Objective, or Milestone.</p>
          </div>
          <button class="modal-close-btn" onclick="AlignmentEngine.closeModal();">&times;</button>
        </div>
        <div class="ritual-modal-body">
          <div class="target-task-preview-box">
            <span class="target-task-tier-tag" id="link-modal-target-tier">DAILY GOAL</span>
            <h4 class="target-task-name" id="link-modal-target-title">Task Title</h4>
          </div>

          <div class="parent-picker-container" id="link-modal-parent-list">
            <!-- Injected by AlignmentEngine.openLinkModal() -->
          </div>
        </div>
        <div class="ritual-modal-footer">
          <button type="button" class="btn btn-secondary" onclick="AlignmentEngine.closeModal();">Close</button>
        </div>
      </div>
    </div>

    <!-- 📄 Executive Weekly Report Exporter Modal -->
    <div class="modal-backdrop" id="weekly-report-modal" style="display: none;">
      <div class="ritual-modal-card report-modal-card">
        <div class="ritual-modal-header">
          <div class="ritual-header-icon">📄</div>
          <div>
            <h3 class="ritual-modal-title">Executive Weekly Debrief</h3>
            <p class="ritual-modal-sub" id="report-modal-daterange">Aggregating multi-horizon performance across the past 7 days.</p>
          </div>
          <button class="modal-close-btn" onclick="WeeklyReportEngine.close();">&times;</button>
        </div>
        <div class="ritual-modal-body report-modal-body" id="weekly-report-body">
          <!-- Injected by WeeklyReportEngine.generateHTMLPreview() -->
        </div>
        <div class="ritual-modal-footer report-modal-footer">
          <button type="button" class="btn btn-secondary" onclick="WeeklyReportEngine.close();">Close</button>
          <button type="button" class="btn btn-secondary" onclick="WeeklyReportEngine.printReport();" title="Print or save as PDF">
            <i data-lucide="printer"></i>
            <span>Print Report</span>
          </button>
          <button type="button" class="btn btn-secondary" onclick="WeeklyReportEngine.downloadMarkdown();" title="Download formatted .md file">
            <i data-lucide="download"></i>
            <span>Download .md</span>
          </button>
          <button type="button" class="btn btn-primary" onclick="WeeklyReportEngine.copyMarkdown();" title="Copy Markdown to Clipboard">
            <i data-lucide="copy"></i>
            <span>Copy as Markdown</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 🏛️ Personal Creed & Values Editor Modal -->
    <div class="modal-backdrop" id="creed-editor-modal" style="display: none;">
      <div class="ritual-modal-card" style="max-width: 580px;">
        <div class="ritual-modal-header">
          <div class="ritual-header-icon">🏛️</div>
          <div>
            <h3 class="ritual-modal-title">Personal North Star Creed</h3>
            <p class="ritual-modal-sub">Define your mission, executive motto, and 3 core values.</p>
          </div>
          <button class="modal-close-btn" onclick="closeCreedModal();">&times;</button>
        </div>
        <form id="creed-editor-form" onsubmit="handleSaveCreed(event)">
          <div class="ritual-modal-body" style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="creed-input-mission">
                <i data-lucide="compass" style="width: 14px; height: 14px; display: inline-block;"></i>
                Life Mission & Execution Philosophy
              </label>
              <textarea id="creed-input-mission" class="form-textarea" rows="3" placeholder="What is your overarching purpose and life vision?" required style="width: 100%; border-radius: var(--radius-md); background: rgba(16,16,20,0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.75rem; font-family: inherit; font-size: 0.95rem; resize: vertical;"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="creed-input-motto">
                <i data-lucide="zap" style="width: 14px; height: 14px; display: inline-block;"></i>
                Executive Motto / Personal Mantra
              </label>
              <input type="text" id="creed-input-motto" class="form-input" placeholder="e.g. Discipline is freedom. Compound daily." required style="width: 100%; border-radius: var(--radius-md); background: rgba(16,16,20,0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.65rem 0.75rem; font-family: inherit; font-size: 0.95rem;">
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="shield" style="width: 14px; height: 14px; display: inline-block;"></i>
                3 Non-Negotiable Core Values
              </label>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <input type="text" id="creed-input-v1" class="form-input" placeholder="Core Value #1 (e.g. Ruthless Prioritization)" required style="width: 100%; border-radius: var(--radius-md); background: rgba(16,16,20,0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.55rem 0.75rem; font-family: inherit; font-size: 0.9rem;">
                <input type="text" id="creed-input-v2" class="form-input" placeholder="Core Value #2 (e.g. Deep Work Intensity)" required style="width: 100%; border-radius: var(--radius-md); background: rgba(16,16,20,0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.55rem 0.75rem; font-family: inherit; font-size: 0.9rem;">
                <input type="text" id="creed-input-v3" class="form-input" placeholder="Core Value #3 (e.g. Unwavering Follow-Through)" required style="width: 100%; border-radius: var(--radius-md); background: rgba(16,16,20,0.8); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.55rem 0.75rem; font-family: inherit; font-size: 0.9rem;">
              </div>
            </div>
          </div>
          <div class="ritual-modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeCreedModal();">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="check"></i>
              <span>Save Creed</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ⚡ Executive Command Palette (Ctrl + K / Cmd + K) -->
    <div class="modal-backdrop command-palette-backdrop" id="command-palette-modal" style="display: none;" onclick="if(event.target === this) CommandPalette.close();">
      <div class="command-palette-card">
        <div class="command-palette-header">
          <div class="palette-search-wrapper">
            <i data-lucide="search" class="palette-search-icon"></i>
            <input type="text" id="palette-search-input" class="palette-search-input" placeholder="Type a command, search tasks, habits, or jump to page..." autocomplete="off" oninput="CommandPalette.handleSearch(this.value);" onkeydown="CommandPalette.handleKeyDown(event);" />
            <button class="palette-esc-btn" onclick="CommandPalette.close();">ESC</button>
          </div>
        </div>
        <div class="command-palette-body" id="palette-results-list">
          <!-- Injected dynamically by CommandPalette.renderResults() -->
        </div>
        <div class="command-palette-footer">
          <div class="palette-footer-shortcuts">
            <span class="palette-shortcut-item"><kbd class="palette-kbd">↑</kbd><kbd class="palette-kbd">↓</kbd> Navigate</span>
            <span class="palette-shortcut-item"><kbd class="palette-kbd">↵</kbd> Select</span>
            <span class="palette-shortcut-item"><kbd class="palette-kbd">ESC</kbd> Close</span>
          </div>
          <span class="palette-brand-tag">TESSERACT OS</span>
        </div>
      </div>
    </div>

    <!-- Floating XP Burst Animation Container -->
    <div class="xp-burst-container" id="xp-burst-container"></div>

    <!-- Toast Notification Container -->
    <div class="toast-container" id="toast-container"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', extraHTML);
  }
};

// Register PWA Service Worker
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Tesseract PWA Service Worker Registered:', reg.scope))
      .catch((err) => console.log('Tesseract PWA Service Worker Registration Failed:', err));
  });
}


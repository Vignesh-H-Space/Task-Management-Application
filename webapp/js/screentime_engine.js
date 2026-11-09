/**
 * Tesseract Digital Wellbeing & Screen Time Engine
 * Tracks daily phone screen time, per-app usage (Chess, LinkedIn, etc.),
 * goal limits, and provides both 1-click manual logging and an automated bridge hook.
 */

const SCREENTIME_STORAGE_KEY = 'tesseract_screentime_data';

const DEFAULT_SCREENTIME_APPS = [
  { id: 'app_chess', name: 'Chess Game', icon: '♟️', minutes: 0, category: 'Focus / Mind' },
  { id: 'app_linkedin', name: 'LinkedIn', icon: '💼', minutes: 0, category: 'Career / Network' },
  { id: 'app_whatsapp', name: 'WhatsApp', icon: '💬', minutes: 0, category: 'Communication' },
  { id: 'app_youtube', name: 'YouTube', icon: '▶️', minutes: 0, category: 'Media' },
  { id: 'app_browser', name: 'Chrome / Web', icon: '🌐', minutes: 0, category: 'Research' }
];

const DEFAULT_SCREENTIME_DATA = {
  dailyGoalMinutes: 180, // 3 hours daily limit
  history: {}
};

const ScreentimeEngine = {
  data: {
    dailyGoalMinutes: 180,
    history: {}
  },

  esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  init() {
    this.load();
    this.renderWidget();
  },

  load() {
    try {
      const saved = localStorage.getItem(SCREENTIME_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = {
          dailyGoalMinutes: parsed.dailyGoalMinutes || 180,
          history: parsed.history || {}
        };
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_DATA));
      }
    } catch (e) {
      console.error('[ScreentimeEngine] Failed to load data:', e);
      this.data = JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_DATA));
    }
    this.ensureToday();
  },

  save() {
    try {
      localStorage.setItem(SCREENTIME_STORAGE_KEY, JSON.stringify(this.data));
      if (typeof SyncEngine !== 'undefined' && typeof SyncEngine.queuePush === 'function') {
        SyncEngine.queuePush();
      }
    } catch (e) {
      console.error('[ScreentimeEngine] Failed to save data:', e);
    }
  },

  getToday() {
    return new Date().toISOString().split('T')[0];
  },

  ensureToday() {
    const today = this.getToday();
    if (!this.data.history[today]) {
      this.data.history[today] = {
        totalMinutes: 0,
        apps: JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_APPS)),
        lastUpdated: new Date().toISOString()
      };
    } else if (!Array.isArray(this.data.history[today].apps)) {
      this.data.history[today].apps = JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_APPS));
    } else {
      // Ensure default apps exist
      DEFAULT_SCREENTIME_APPS.forEach(defApp => {
        if (!this.data.history[today].apps.some(a => a.id === defApp.id || a.name.toLowerCase() === defApp.name.toLowerCase())) {
          this.data.history[today].apps.push({ ...defApp });
        }
      });
    }
  },

  getTodayData() {
    this.ensureToday();
    return this.data.history[this.getToday()];
  },

  formatDuration(minutes) {
    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  recalculateTotal(todayData) {
    const sumApps = todayData.apps.reduce((sum, a) => sum + (parseInt(a.minutes, 10) || 0), 0);
    todayData.totalMinutes = Math.max(todayData.totalMinutes || 0, sumApps);
    todayData.lastUpdated = new Date().toISOString();
  },

  quickAdjustApp(appId, delta) {
    const todayData = this.getTodayData();
    const app = todayData.apps.find(a => a.id === appId);
    if (!app) return;

    app.minutes = Math.max(0, (parseInt(app.minutes, 10) || 0) + delta);
    this.recalculateTotal(todayData);
    this.save();
    this.renderWidget();

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast(`${app.name}: ${this.formatDuration(app.minutes)}`, 'info');
    }
  },

  setDailyGoal(minutes) {
    const parsed = parseInt(minutes, 10);
    if (isNaN(parsed) || parsed <= 0) return false;
    this.data.dailyGoalMinutes = parsed;
    this.save();
    this.renderWidget();
    return true;
  },

  addApp(name, icon, minutes, category) {
    if (!name || !name.trim()) return false;
    const todayData = this.getTodayData();
    const cleanName = name.trim();
    const cleanId = 'app_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const existing = todayData.apps.find(a => a.id === cleanId || a.name.toLowerCase() === cleanName.toLowerCase());

    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    if (existing) {
      existing.minutes = mins;
      if (category) existing.category = category;
      if (icon) existing.icon = icon;
    } else {
      todayData.apps.push({
        id: cleanId,
        name: cleanName,
        icon: icon || '📱',
        minutes: mins,
        category: category || 'General'
      });
    }

    this.recalculateTotal(todayData);
    this.save();
    this.renderWidget();
    return true;
  },

  removeApp(appId) {
    const todayData = this.getTodayData();
    todayData.apps = todayData.apps.filter(a => a.id !== appId);
    this.recalculateTotal(todayData);
    this.save();
    this.renderWidget();
  },

  importFromPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: expected JSON object');
    }

    const date = payload.date || this.getToday();
    if (!this.data.history[date]) {
      this.data.history[date] = {
        totalMinutes: 0,
        apps: [],
        lastUpdated: new Date().toISOString()
      };
    }

    const target = this.data.history[date];
    if (Array.isArray(payload.apps)) {
      payload.apps.forEach(incoming => {
        if (!incoming.name) return;
        const incId = incoming.id || ('app_' + incoming.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        const existing = target.apps.find(a => a.id === incId || a.name.toLowerCase() === incoming.name.toLowerCase());
        const mins = Math.max(0, parseInt(incoming.minutes, 10) || 0);

        if (existing) {
          existing.minutes = mins;
          if (incoming.category) existing.category = incoming.category;
          if (incoming.icon) existing.icon = incoming.icon;
        } else {
          target.apps.push({
            id: incId,
            name: incoming.name,
            icon: incoming.icon || '📱',
            minutes: mins,
            category: incoming.category || 'App'
          });
        }
      });
    }

    if (payload.totalMinutes != null) {
      target.totalMinutes = Math.max(0, parseInt(payload.totalMinutes, 10) || 0);
    } else {
      this.recalculateTotal(target);
    }

    if (payload.dailyGoalMinutes) {
      this.data.dailyGoalMinutes = Math.max(15, parseInt(payload.dailyGoalMinutes, 10) || 180);
    }

    target.lastUpdated = new Date().toISOString();
    this.save();
    this.renderWidget();
    return true;
  },

  renderWidget() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('screentime-widget-container');
    if (!container) return;

    const todayData = this.getTodayData();
    const totalMins = todayData.totalMinutes || 0;
    const goalMins = this.data.dailyGoalMinutes || 180;
    const isUnderLimit = totalMins <= goalMins;
    const remainingOrExceeded = Math.abs(goalMins - totalMins);

    // Calculate Focus vs Other
    let focusMins = 0;
    let socialMins = 0;
    todayData.apps.forEach(app => {
      const cat = (app.category || '').toLowerCase();
      const mins = parseInt(app.minutes, 10) || 0;
      if (cat.includes('focus') || cat.includes('mind') || cat.includes('career') || cat.includes('research') || cat.includes('work')) {
        focusMins += mins;
      } else {
        socialMins += mins;
      }
    });

    const activeApps = todayData.apps.filter(a => (a.minutes || 0) > 0);
    const hasData = totalMins > 0 || activeApps.length > 0;

    const limitPct = Math.min(100, Math.round((totalMins / (goalMins || 1)) * 100));

    let html = `
      <div class="screentime-card">
        <!-- Header -->
        <div class="screentime-header">
          <div class="screentime-title-group">
            <span class="screentime-header-icon">📱</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="screentime-title">Digital Wellbeing</h3>
                <span class="screentime-pill ${isUnderLimit ? 'pill-success' : 'pill-danger'}">
                  ${isUnderLimit ? '🟢 Under Daily Goal' : '🔴 Goal Exceeded'}
                </span>
              </div>
              <p class="screentime-desc">Today's Mobile Screen Time & App Execution Summary</p>
            </div>
          </div>
          <div class="screentime-actions">
            <button class="btn btn-secondary btn-sm" onclick="ScreentimeEngine.openLogModal()" title="Log or edit today's screen time">
              <i data-lucide="edit-3"></i>
              <span>Log Usage</span>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.openGoalModal()" title="Configure daily screen time limit">
              <i data-lucide="target"></i>
              <span>Goal: ${this.formatDuration(goalMins)}</span>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.openBridgeModal()" title="Android Tasker / MacroDroid sync setup">
              <i data-lucide="smartphone"></i>
              <span>Auto-Bridge</span>
            </button>
          </div>
        </div>

        <!-- Metric Cockpit -->
        <div class="screentime-metrics-grid">
          <div class="screentime-stat-box">
            <span class="screentime-stat-label">Total Screen Time</span>
            <div class="screentime-stat-val ${isUnderLimit ? 'text-success' : 'text-danger'}">
              ${this.formatDuration(totalMins)}
            </div>
            <span class="screentime-stat-sub">
              ${isUnderLimit ? `${this.formatDuration(remainingOrExceeded)} remaining under goal` : `${this.formatDuration(remainingOrExceeded)} over ${this.formatDuration(goalMins)} limit`}
            </span>
          </div>

          <div class="screentime-stat-box">
            <span class="screentime-stat-label">Focus & Strategy</span>
            <div class="screentime-stat-val text-accent">
              ${this.formatDuration(focusMins)}
            </div>
            <span class="screentime-stat-sub">Chess, LinkedIn & Research</span>
          </div>

          <div class="screentime-stat-box">
            <span class="screentime-stat-label">Social & Media</span>
            <div class="screentime-stat-val text-muted">
              ${this.formatDuration(socialMins)}
            </div>
            <span class="screentime-stat-sub">WhatsApp, YouTube & Casual</span>
          </div>

          <div class="screentime-stat-box">
            <span class="screentime-stat-label">Budget Pacing</span>
            <div class="screentime-stat-val">
              ${limitPct}%
            </div>
            <div class="screentime-mini-bar">
              <div class="screentime-mini-fill ${isUnderLimit ? 'bg-success' : 'bg-danger'}" style="width: ${limitPct}%;"></div>
            </div>
          </div>
        </div>
    `;

    if (!hasData) {
      html += `
        <div class="screentime-empty-state">
          <p>No phone screen time recorded yet for today.</p>
          <button class="btn btn-primary btn-sm" onclick="ScreentimeEngine.openLogModal()">
            ⚡ Record Today's Screen Time
          </button>
        </div>
      `;
    } else {
      // Stacked distribution bar
      html += `
        <div class="screentime-distribution-bar" title="App Distribution">
      `;
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
      todayData.apps.forEach((app, idx) => {
        const m = parseInt(app.minutes, 10) || 0;
        if (m <= 0) return;
        const pct = Math.max(2, Math.round((m / (totalMins || 1)) * 100));
        const color = colors[idx % colors.length];
        html += `<div class="screentime-dist-segment" style="width: ${pct}%; background: ${color};" title="${this.esc(app.name)}: ${this.formatDuration(m)} (${pct}%)"></div>`;
      });
      html += `</div>`;

      // App Cards Grid
      html += `<div class="screentime-apps-grid">`;
      todayData.apps.forEach(app => {
        const m = parseInt(app.minutes, 10) || 0;
        const pct = totalMins > 0 ? Math.round((m / totalMins) * 100) : 0;
        html += `
          <div class="screentime-app-card ${m > 0 ? 'active' : ''}">
            <div class="screentime-app-top">
              <span class="screentime-app-icon">${app.icon || '📱'}</span>
              <div class="screentime-app-info">
                <span class="screentime-app-name">${this.esc(app.name)}</span>
                <span class="screentime-app-cat">${this.esc(app.category || 'General')}</span>
              </div>
              <div class="screentime-app-time">${this.formatDuration(m)}</div>
            </div>
            <div class="screentime-app-progress">
              <div class="screentime-app-bar" style="width: ${pct}%;"></div>
            </div>
            <div class="screentime-app-actions">
              <button class="screentime-adj-btn" onclick="ScreentimeEngine.quickAdjustApp('${app.id}', -15)" title="Subtract 15 mins">-15m</button>
              <button class="screentime-adj-btn" onclick="ScreentimeEngine.quickAdjustApp('${app.id}', 15)" title="Add 15 mins">+15m</button>
              <button class="screentime-adj-btn" onclick="ScreentimeEngine.quickAdjustApp('${app.id}', 30)" title="Add 30 mins">+30m</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  openLogModal() {
    const existing = document.getElementById('screentime-log-modal');
    if (existing) existing.remove();

    const todayData = this.getTodayData();

    let appsInputsHTML = todayData.apps.map(app => {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-subtle); margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <span style="font-size: 1.2rem;">${app.icon || '📱'}</span>
            <div>
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${this.esc(app.name)}</div>
              <div style="font-size: 0.72rem; color: var(--text-secondary);">${this.esc(app.category || 'General')}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="number" min="0" step="5" value="${app.minutes || 0}" id="st-app-input-${app.id}" style="width: 75px; padding: 6px 8px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); text-align: right; font-weight: 600;">
            <span style="font-size: 0.75rem; color: var(--text-secondary);">mins</span>
            <button onclick="ScreentimeEngine.removeApp('${app.id}'); ScreentimeEngine.openLogModal();" title="Remove app" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    const modalHTML = `
      <div class="modal-backdrop" id="screentime-log-modal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;" onclick="if(event.target === this) ScreentimeEngine.closeModal('screentime-log-modal');">
        <div class="ritual-modal-card" style="max-width: 540px; width: 92%; max-height: 85vh; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.4rem;">📱</span>
              <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); font-family: var(--font-heading);">Log Daily Screen Time</h3>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Glance at your phone's Digital Wellbeing & adjust</span>
              </div>
            </div>
            <button onclick="ScreentimeEngine.closeModal('screentime-log-modal');" style="background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Total Phone Screen Time (Today)</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="st-total-mins-input" min="0" step="5" value="${todayData.totalMinutes || 0}" style="flex: 1; padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem; font-weight: 700;">
              <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Total Minutes</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">Leave at 0 to auto-calculate sum from apps below.</span>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px;">Apps Usage Breakdown</label>
            <div id="st-apps-inputs-list">
              ${appsInputsHTML}
            </div>
          </div>

          <!-- Add new app inline -->
          <div style="background: var(--bg-primary); border: 1px dashed var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 18px;">
            <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 8px;">+ Track Another App</span>
            <div style="display: grid; grid-template-columns: 45px 1fr 100px; gap: 8px; margin-bottom: 8px;">
              <input type="text" id="st-new-icon" placeholder="📱" maxlength="2" style="padding: 6px; text-align: center; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
              <input type="text" id="st-new-name" placeholder="App Name (e.g. Twitter/X)" style="padding: 6px 10px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
              <input type="number" id="st-new-mins" placeholder="Mins" min="0" step="5" style="padding: 6px 8px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
            </div>
            <button class="btn btn-secondary btn-xs" onclick="ScreentimeEngine.handleAddNewApp()" style="width: 100%;">Add App</button>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.closeModal('screentime-log-modal');">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="ScreentimeEngine.saveLogModal();">Save Screen Time</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  handleAddNewApp() {
    const icon = document.getElementById('st-new-icon')?.value || '📱';
    const name = document.getElementById('st-new-name')?.value;
    const mins = document.getElementById('st-new-mins')?.value;

    if (!name || !name.trim()) {
      if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
        Components.showToast('Please enter an app name', 'warning');
      }
      return;
    }

    this.addApp(name, icon, mins, 'App');
    this.openLogModal();
  },

  saveLogModal() {
    const todayData = this.getTodayData();
    const explicitTotal = parseInt(document.getElementById('st-total-mins-input')?.value, 10) || 0;

    let appsSum = 0;
    todayData.apps.forEach(app => {
      const input = document.getElementById(`st-app-input-${app.id}`);
      if (input) {
        app.minutes = Math.max(0, parseInt(input.value, 10) || 0);
        appsSum += app.minutes;
      }
    });

    todayData.totalMinutes = explicitTotal > 0 ? explicitTotal : appsSum;
    todayData.lastUpdated = new Date().toISOString();

    // Check goal achievement and award XP if under limit
    const goal = this.data.dailyGoalMinutes || 180;
    if (todayData.totalMinutes > 0 && todayData.totalMinutes <= goal) {
      if (typeof XPEngine !== 'undefined' && typeof XPEngine.awardXP === 'function') {
        XPEngine.awardXP(15, 'Digital Wellbeing Discipline (+15 XP)');
      }
    }

    this.save();
    this.renderWidget();
    this.closeModal('screentime-log-modal');

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast(`Saved today's screen time: ${this.formatDuration(todayData.totalMinutes)}`, 'success');
    }
  },

  openGoalModal() {
    const existing = document.getElementById('screentime-goal-modal');
    if (existing) existing.remove();

    const goal = this.data.dailyGoalMinutes || 180;

    const modalHTML = `
      <div class="modal-backdrop" id="screentime-goal-modal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;" onclick="if(event.target === this) ScreentimeEngine.closeModal('screentime-goal-modal');">
        <div class="ritual-modal-card" style="max-width: 420px; width: 92%; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.4rem;">🎯</span>
              <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); font-family: var(--font-heading);">Daily Screen Time Limit</h3>
            </div>
            <button onclick="ScreentimeEngine.closeModal('screentime-goal-modal');" style="background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 14px;">
            Set your target maximum phone usage per day. Staying below earns daily executive XP bonus.
          </p>

          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
            <input type="number" id="st-goal-input" min="30" step="15" value="${goal}" style="flex: 1; padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1.1rem; font-weight: 700;">
            <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Minutes</span>
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 18px;">
            <button class="btn btn-secondary btn-xs" onclick="document.getElementById('st-goal-input').value = '120';">2 Hours</button>
            <button class="btn btn-secondary btn-xs" onclick="document.getElementById('st-goal-input').value = '180';">3 Hours</button>
            <button class="btn btn-secondary btn-xs" onclick="document.getElementById('st-goal-input').value = '240';">4 Hours</button>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.closeModal('screentime-goal-modal');">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="
              const val = document.getElementById('st-goal-input').value;
              ScreentimeEngine.setDailyGoal(val);
              ScreentimeEngine.closeModal('screentime-goal-modal');
              if(typeof Components !== 'undefined') Components.showToast('Updated daily screen time goal', 'success');
            ">Save Target</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  openBridgeModal() {
    const existing = document.getElementById('screentime-bridge-modal');
    if (existing) existing.remove();

    const sampleJSON = JSON.stringify({
      date: this.getToday(),
      totalMinutes: 145,
      apps: [
        { name: "Chess Game", icon: "♟️", minutes: 45, category: "Mind" },
        { name: "LinkedIn", icon: "💼", minutes: 30, category: "Career" },
        { name: "WhatsApp", icon: "💬", minutes: 40, category: "Communication" },
        { name: "YouTube", icon: "▶️", minutes: 30, category: "Media" }
      ]
    }, null, 2);

    const modalHTML = `
      <div class="modal-backdrop" id="screentime-bridge-modal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;" onclick="if(event.target === this) ScreentimeEngine.closeModal('screentime-bridge-modal');">
        <div class="ritual-modal-card" style="max-width: 600px; width: 92%; max-height: 85vh; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.4rem;">🤖</span>
              <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); font-family: var(--font-heading);">Automated Android Bridge Setup</h3>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Direct Digital Wellbeing sync via MacroDroid or Tasker</span>
              </div>
            </div>
            <button onclick="ScreentimeEngine.closeModal('screentime-bridge-modal');" style="background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 6px;">How Plan 1 Auto-Bridge Works:</h4>
            <ol style="font-size: 0.8rem; color: var(--text-secondary); padding-left: 18px; line-height: 1.6; margin: 0;">
              <li>Install <strong>MacroDroid</strong> (free on Play Store) on your Android phone.</li>
              <li>Grant MacroDroid <strong>Usage Access</strong> in Android Settings &rarr; Privacy.</li>
              <li>Create a trigger: <em>Daily at 21:00 (or hourly)</em>.</li>
              <li>Create action: <em>HTTP Request</em> sending your Digital Wellbeing JSON into Tesseract or Firebase.</li>
            </ol>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Direct JSON Import & Test</label>
              <button class="btn btn-ghost btn-xs" onclick="document.getElementById('st-json-import-input').value = \`${sampleJSON.replace(/`/g, '\\`')}\`;">Load Sample</button>
            </div>
            <textarea id="st-json-import-input" rows="7" placeholder="Paste screen time JSON here..." style="width: 100%; font-family: monospace; font-size: 0.75rem; padding: 10px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.closeModal('screentime-bridge-modal');">Close</button>
            <button class="btn btn-primary btn-sm" onclick="ScreentimeEngine.handleImportJSON();">Import & Sync</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  handleImportJSON() {
    const raw = document.getElementById('st-json-import-input')?.value;
    if (!raw || !raw.trim()) {
      if (typeof Components !== 'undefined') Components.showToast('Please paste a JSON payload', 'warning');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.importFromPayload(parsed);
      this.closeModal('screentime-bridge-modal');
      if (typeof Components !== 'undefined') {
        Components.showToast('🎉 Successfully imported screen time data!', 'success');
      }
    } catch (e) {
      if (typeof Components !== 'undefined') {
        Components.showToast('Invalid JSON: ' + e.message, 'error');
      }
    }
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.remove();
  }
};

// Export for Node.js test suites
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreentimeEngine;
}

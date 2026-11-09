/**
 * Tesseract Digital Wellbeing & Screen Time Engine
 * Tracks daily phone screen time, per-app usage (Chess, LinkedIn, etc.),
 * historical retention (up to 120 days / 4 months), multi-range trend graphs (7d, 30d, 90d),
 * day-by-day navigation, and automated Android bridge integration.
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
  selectedRange: '7d',   // '7d' | '30d' | '90d'
  history: {}
};

const ScreentimeEngine = {
  data: {
    dailyGoalMinutes: 180,
    selectedRange: '7d',
    history: {}
  },

  selectedDate: null,

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
    if (!this.selectedDate) {
      this.selectedDate = this.getToday();
    }
    this.renderWidget();
  },

  load() {
    try {
      const saved = localStorage.getItem(SCREENTIME_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = {
          dailyGoalMinutes: parsed.dailyGoalMinutes || 180,
          selectedRange: parsed.selectedRange || '7d',
          history: parsed.history || {}
        };
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_DATA));
      }
    } catch (e) {
      console.error('[ScreentimeEngine] Failed to load data:', e);
      this.data = JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_DATA));
    }
    this.pruneOldData(120); // Retain at least 120 days (4 months)
    this.ensureDate(this.getToday());
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

  formatDateObj(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getToday() {
    return this.formatDateObj(new Date());
  },

  /**
   * Safe retention: Keep up to 120 days of data (~4 months)
   */
  pruneOldData(maxDays = 120) {
    if (!this.data.history) return;
    const today = new Date();
    const cutoffTime = today.getTime() - (maxDays * 86400000);

    Object.keys(this.data.history).forEach(dateStr => {
      const dateParts = dateStr.split('-');
      if (dateParts.length === 3) {
        const d = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        if (d.getTime() < cutoffTime) {
          delete this.data.history[dateStr];
        }
      }
    });
  },

  ensureDate(dateStr) {
    if (!this.data.history[dateStr]) {
      this.data.history[dateStr] = {
        totalMinutes: 0,
        apps: JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_APPS)),
        lastUpdated: new Date().toISOString()
      };
    } else if (!Array.isArray(this.data.history[dateStr].apps)) {
      this.data.history[dateStr].apps = JSON.parse(JSON.stringify(DEFAULT_SCREENTIME_APPS));
    } else {
      // Ensure default apps exist
      DEFAULT_SCREENTIME_APPS.forEach(defApp => {
        if (!this.data.history[dateStr].apps.some(a => a.id === defApp.id || a.name.toLowerCase() === defApp.name.toLowerCase())) {
          this.data.history[dateStr].apps.push({ ...defApp });
        }
      });
    }
  },

  ensureToday() {
    this.ensureDate(this.getToday());
  },

  getTodayData() {
    return this.getDateData(this.getToday());
  },

  getDateData(dateStr) {
    const targetDate = dateStr || this.selectedDate || this.getToday();
    this.ensureDate(targetDate);
    return this.data.history[targetDate];
  },

  getActiveData() {
    return this.getDateData(this.selectedDate || this.getToday());
  },

  setSelectedDate(dateStr) {
    if (!dateStr) return;
    this.selectedDate = dateStr;
    this.ensureDate(dateStr);
    this.renderWidget();
  },

  navigateDate(deltaDays) {
    const current = this.selectedDate || this.getToday();
    const [y, m, d] = current.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + deltaDays);

    const newDateStr = this.formatDateObj(dateObj);
    this.setSelectedDate(newDateStr);
  },

  goToToday() {
    this.setSelectedDate(this.getToday());
  },

  setChartRange(range) {
    if (['7d', '30d', '90d'].includes(range)) {
      this.data.selectedRange = range;
      this.save();
      this.renderWidget();
    }
  },

  formatDuration(minutes) {
    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const today = this.getToday();
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    // Calculate diff from today
    const [ty, tm, td] = today.split('-').map(Number);
    const todayObj = new Date(ty, tm - 1, td);
    const diffDays = Math.round((dateObj - todayObj) / 86400000);

    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = dateObj.toLocaleDateString('en-US', options);

    if (diffDays === 0) return `Today (${formatted})`;
    if (diffDays === -1) return `Yesterday (${formatted})`;
    if (diffDays === 1) return `Tomorrow (${formatted})`;
    return formatted;
  },

  recalculateTotal(dateData) {
    const sumApps = dateData.apps.reduce((sum, a) => sum + (parseInt(a.minutes, 10) || 0), 0);
    dateData.totalMinutes = Math.max(dateData.totalMinutes || 0, sumApps);
    dateData.lastUpdated = new Date().toISOString();
  },

  quickAdjustApp(appId, delta, dateStr) {
    const targetDate = dateStr || this.selectedDate || this.getToday();
    const dateData = this.getDateData(targetDate);
    const app = dateData.apps.find(a => a.id === appId);
    if (!app) return;

    app.minutes = Math.max(0, (parseInt(app.minutes, 10) || 0) + delta);
    this.recalculateTotal(dateData);
    this.save();
    this.renderWidget();

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast(`${app.name}: ${this.formatDuration(app.minutes)} (${this.formatDisplayDate(targetDate)})`, 'info');
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

  addApp(name, icon, minutes, category, dateStr) {
    if (!name || !name.trim()) return false;
    const targetDate = dateStr || this.selectedDate || this.getToday();
    const dateData = this.getDateData(targetDate);
    const cleanName = name.trim();
    const cleanId = 'app_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const existing = dateData.apps.find(a => a.id === cleanId || a.name.toLowerCase() === cleanName.toLowerCase());

    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    if (existing) {
      existing.minutes = mins;
      if (category) existing.category = category;
      if (icon) existing.icon = icon;
    } else {
      dateData.apps.push({
        id: cleanId,
        name: cleanName,
        icon: icon || '📱',
        minutes: mins,
        category: category || 'General'
      });
    }

    this.recalculateTotal(dateData);
    this.save();
    this.renderWidget();
    return true;
  },

  removeApp(appId, dateStr) {
    const targetDate = dateStr || this.selectedDate || this.getToday();
    const dateData = this.getDateData(targetDate);
    dateData.apps = dateData.apps.filter(a => a.id !== appId);
    this.recalculateTotal(dateData);
    this.save();
    this.renderWidget();
  },

  importFromPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: expected JSON object');
    }

    // Support bulk history payload
    if (payload.history && typeof payload.history === 'object') {
      Object.entries(payload.history).forEach(([dt, rec]) => {
        if (!rec) return;
        this.ensureDate(dt);
        const target = this.data.history[dt];
        if (rec.totalMinutes != null) target.totalMinutes = Math.max(0, parseInt(rec.totalMinutes, 10) || 0);
        if (Array.isArray(rec.apps)) target.apps = rec.apps;
        target.lastUpdated = new Date().toISOString();
      });
    }

    const date = payload.date || this.getToday();
    this.ensureDate(date);
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

  /**
   * Get series of dates for the active chart range
   */
  getRangeDates(range = '7d') {
    const daysCount = range === '90d' ? 90 : (range === '30d' ? 30 : 7);
    const today = this.getToday();
    const [ty, tm, td] = today.split('-').map(Number);
    const dates = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(ty, tm - 1, td);
      d.setDate(d.getDate() - i);
      dates.push(this.formatDateObj(d));
    }
    return dates;
  },

  /**
   * Render Responsive Interactive SVG Chart
   */
  renderTrendChartSVG(range = '7d') {
    const dates = this.getRangeDates(range);
    const goalMins = this.data.dailyGoalMinutes || 180;
    const history = this.data.history || {};

    let maxMins = goalMins * 1.25;
    const dayDataList = dates.map(dt => {
      const rec = history[dt] || { totalMinutes: 0, apps: [] };
      const mins = rec.totalMinutes || 0;
      if (mins > maxMins) maxMins = mins * 1.1;
      return {
        date: dt,
        totalMinutes: mins,
        apps: rec.apps || [],
        isUnderGoal: mins <= goalMins
      };
    });

    const width = 800;
    const height = 180;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const n = dayDataList.length;
    const slotWidth = chartWidth / n;
    const barWidth = Math.max(3, Math.min(slotWidth * 0.72, range === '90d' ? 6 : (range === '30d' ? 16 : 56)));

    // Goal threshold Y position
    const goalY = paddingTop + chartHeight - (goalMins / maxMins) * chartHeight;

    // Grid lines
    let gridHTML = `
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="var(--border-subtle)" stroke-width="1" />
      <line x1="${paddingLeft}" y1="${goalY}" x2="${width - paddingRight}" y2="${goalY}" stroke="#f59e0b" stroke-dasharray="4,4" stroke-width="1.5" opacity="0.8" />
      <text x="${width - paddingRight - 4}" y="${goalY - 6}" fill="#f59e0b" font-size="10" font-weight="700" text-anchor="end">Goal (${this.formatDuration(goalMins)})</text>
    `;

    // Bars
    let barsHTML = '';
    dayDataList.forEach((item, idx) => {
      const xCenter = paddingLeft + (idx + 0.5) * slotWidth;
      const xBar = xCenter - barWidth / 2;
      const barH = item.totalMinutes > 0 ? Math.max(4, (item.totalMinutes / maxMins) * chartHeight) : 2;
      const yBar = paddingTop + chartHeight - barH;

      const isSelected = item.date === (this.selectedDate || this.getToday());
      const isToday = item.date === this.getToday();

      let fill = 'var(--bg-input)';
      if (item.totalMinutes > 0) {
        fill = item.isUnderGoal ? '#10b981' : '#ef4444';
      }

      // Find top app for tooltip
      let topAppInfo = '';
      if (item.apps && item.apps.length > 0) {
        const sorted = [...item.apps].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
        if (sorted[0] && sorted[0].minutes > 0) {
          topAppInfo = `\nTop App: ${sorted[0].name} (${this.formatDuration(sorted[0].minutes)})`;
        }
      }

      const tooltip = `${item.date} (${this.formatDisplayDate(item.date)})\nTotal: ${this.formatDuration(item.totalMinutes)}\nStatus: ${item.isUnderGoal ? 'Under Goal 🟢' : 'Over Limit 🔴'}${topAppInfo}\nClick to view day`;

      barsHTML += `
        <g class="screentime-chart-bar-group" onclick="ScreentimeEngine.setSelectedDate('${item.date}')" style="cursor: pointer;">
          <title>${this.esc(tooltip)}</title>
          <rect x="${xBar.toFixed(1)}" y="${yBar.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" rx="3"
                fill="${fill}"
                opacity="${item.totalMinutes === 0 ? '0.35' : (isSelected ? '1' : '0.85')}"
                stroke="${isSelected ? '#a855f7' : (isToday ? '#6366f1' : 'none')}"
                stroke-width="${isSelected ? '2.5' : (isToday ? '1.5' : '0')}" />
          ${isSelected ? `<circle cx="${xCenter.toFixed(1)}" cy="${(yBar - 6).toFixed(1)}" r="3" fill="#a855f7" />` : ''}
        </g>
      `;

      // X-Axis Labels
      let showLabel = false;
      let labelText = '';
      const [yy, mm, dd] = item.date.split('-');

      if (range === '7d') {
        const dObj = new Date(Number(yy), Number(mm) - 1, Number(dd));
        const dayInitial = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dObj.getDay()];
        labelText = `${dayInitial} ${dd}`;
        showLabel = true;
      } else if (range === '30d') {
        if (idx % 5 === 0 || idx === n - 1) {
          labelText = `${dd}/${mm}`;
          showLabel = true;
        }
      } else if (range === '90d') {
        if (dd === '01' || dd === '15' || idx === n - 1) {
          labelText = `${dd}/${mm}`;
          showLabel = true;
        }
      }

      if (showLabel) {
        barsHTML += `
          <text x="${xCenter.toFixed(1)}" y="${height - 10}" fill="var(--text-secondary)" font-size="9" font-weight="${isSelected ? '800' : '500'}" text-anchor="middle">
            ${labelText}
          </text>
        `;
      }
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" class="screentime-svg-chart" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="stGreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="stRedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="100%" stop-color="#b91c1c" />
          </linearGradient>
        </defs>
        ${gridHTML}
        ${barsHTML}
      </svg>
    `;
  },

  renderWidget() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('screentime-widget-container');
    if (!container) return;

    const todayStr = this.getToday();
    const activeDate = this.selectedDate || todayStr;
    const isToday = activeDate === todayStr;

    const activeData = this.getActiveData();
    const totalMins = activeData.totalMinutes || 0;
    const goalMins = this.data.dailyGoalMinutes || 180;
    const isUnderLimit = totalMins <= goalMins;
    const remainingOrExceeded = Math.abs(goalMins - totalMins);

    // Calculate Focus vs Other for activeDate
    let focusMins = 0;
    let socialMins = 0;
    activeData.apps.forEach(app => {
      const cat = (app.category || '').toLowerCase();
      const mins = parseInt(app.minutes, 10) || 0;
      if (cat.includes('focus') || cat.includes('mind') || cat.includes('career') || cat.includes('research') || cat.includes('work')) {
        focusMins += mins;
      } else {
        socialMins += mins;
      }
    });

    const activeApps = activeData.apps.filter(a => (a.minutes || 0) > 0);
    const hasData = totalMins > 0 || activeApps.length > 0;
    const limitPct = Math.min(100, Math.round((totalMins / (goalMins || 1)) * 100));

    // Calculate Trend Metrics for active range
    const activeRange = this.data.selectedRange || '7d';
    const rangeDates = this.getRangeDates(activeRange);
    let rangeTotalMins = 0;
    let daysWithData = 0;
    let daysUnderGoal = 0;
    const appAggregate = {};

    rangeDates.forEach(dt => {
      const rec = this.data.history[dt];
      if (rec && rec.totalMinutes > 0) {
        rangeTotalMins += rec.totalMinutes;
        daysWithData++;
        if (rec.totalMinutes <= goalMins) daysUnderGoal++;

        (rec.apps || []).forEach(a => {
          if (!appAggregate[a.name]) appAggregate[a.name] = { minutes: 0, icon: a.icon || '📱' };
          appAggregate[a.name].minutes += (a.minutes || 0);
        });
      }
    });

    const avgDailyMins = daysWithData > 0 ? Math.round(rangeTotalMins / daysWithData) : 0;
    const complianceRate = daysWithData > 0 ? Math.round((daysUnderGoal / daysWithData) * 100) : 100;

    let topAppOverall = 'None';
    let topAppMinutes = 0;
    Object.entries(appAggregate).forEach(([name, info]) => {
      if (info.minutes > topAppMinutes) {
        topAppMinutes = info.minutes;
        topAppOverall = `${info.icon} ${name}`;
      }
    });

    let html = `
      <div class="screentime-card">
        <!-- Header -->
        <div class="screentime-header">
          <div class="screentime-title-group">
            <span class="screentime-header-icon">📱</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 class="screentime-title">Digital Wellbeing</h3>
                <span class="screentime-pill ${isUnderLimit ? 'pill-success' : 'pill-danger'}">
                  ${isUnderLimit ? '🟢 Under Daily Goal' : '🔴 Goal Exceeded'}
                </span>
                ${!isToday ? `<span class="screentime-viewing-tag">Viewing Past Day</span>` : ''}
              </div>
              <p class="screentime-desc">Mobile Screen Time & Multi-Month App Intelligence Engine</p>
            </div>
          </div>

          <div class="screentime-actions">
            <button class="btn btn-secondary btn-sm" onclick="ScreentimeEngine.openLogModal('${activeDate}')" title="Log or edit screen time for this day">
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

        <!-- Date Navigation Bar -->
        <div class="screentime-date-nav">
          <div class="screentime-date-stepper">
            <button class="screentime-nav-btn" onclick="ScreentimeEngine.navigateDate(-1)" title="Previous Day">
              <i data-lucide="chevron-left"></i>
              <span>Prev</span>
            </button>
            <div class="screentime-date-display">
              <i data-lucide="calendar"></i>
              <span class="screentime-date-text">${this.formatDisplayDate(activeDate)}</span>
              <input type="date" class="screentime-date-picker" value="${activeDate}" onchange="ScreentimeEngine.setSelectedDate(this.value)" title="Pick any date">
            </div>
            <button class="screentime-nav-btn" onclick="ScreentimeEngine.navigateDate(1)" title="Next Day">
              <span>Next</span>
              <i data-lucide="chevron-right"></i>
            </button>
          </div>

          <div class="screentime-date-quick-actions">
            ${!isToday ? `<button class="btn btn-secondary btn-xs" onclick="ScreentimeEngine.goToToday()"><i data-lucide="rotate-ccw"></i> Jump to Today</button>` : ''}
          </div>
        </div>

        <!-- Metric Cockpit (For activeDate) -->
        <div class="screentime-metrics-grid">
          <div class="screentime-stat-box">
            <span class="screentime-stat-label">Day Total (${this.formatDisplayDate(activeDate)})</span>
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

        <!-- 📊 Historical Trend Graph Section (Week • Month • 3 Months) -->
        <div class="screentime-chart-section">
          <div class="screentime-chart-header">
            <div>
              <h4 class="screentime-chart-title">
                <i data-lucide="bar-chart-2"></i> Screen Time Trends & Habit Consistency
              </h4>
              <span class="screentime-chart-subtitle">Retained across multi-month horizon • Click any bar to inspect and log that day</span>
            </div>

            <!-- Segmented Range Switcher -->
            <div class="segmented-control screentime-range-switcher">
              <button class="segment ${activeRange === '7d' ? 'active' : ''}" onclick="ScreentimeEngine.setChartRange('7d')">
                This Week (7d)
              </button>
              <button class="segment ${activeRange === '30d' ? 'active' : ''}" onclick="ScreentimeEngine.setChartRange('30d')">
                1 Month (30d)
              </button>
              <button class="segment ${activeRange === '90d' ? 'active' : ''}" onclick="ScreentimeEngine.setChartRange('90d')">
                3 Months (90d)
              </button>
            </div>
          </div>

          <!-- Trend Quick Stats Row -->
          <div class="screentime-trend-stats-row">
            <div class="screentime-trend-stat">
              <span class="trend-stat-val">${this.formatDuration(rangeTotalMins)}</span>
              <span class="trend-stat-lbl">Period Total</span>
            </div>
            <div class="screentime-trend-stat">
              <span class="trend-stat-val">${this.formatDuration(avgDailyMins)}</span>
              <span class="trend-stat-lbl">Daily Average</span>
            </div>
            <div class="screentime-trend-stat">
              <span class="trend-stat-val text-success">${complianceRate}%</span>
              <span class="trend-stat-lbl">Under Goal (${daysUnderGoal}/${daysWithData || 1}d)</span>
            </div>
            <div class="screentime-trend-stat">
              <span class="trend-stat-val text-accent" style="font-size: 0.95rem;">${topAppOverall}</span>
              <span class="trend-stat-lbl">Top App (${this.formatDuration(topAppMinutes)})</span>
            </div>
          </div>

          <!-- SVG Visual Chart -->
          <div class="screentime-chart-canvas">
            ${this.renderTrendChartSVG(activeRange)}
          </div>
        </div>
    `;

    if (!hasData) {
      html += `
        <div class="screentime-empty-state">
          <p>No screen time recorded for <strong>${this.formatDisplayDate(activeDate)}</strong>.</p>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" onclick="ScreentimeEngine.openLogModal('${activeDate}')">
              ⚡ Record ${isToday ? 'Today\'s' : 'This Day\'s'} Screen Time
            </button>
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.seedDemoHistory()" title="Generate sample trend for review">
              Sample Data Demo
            </button>
          </div>
        </div>
      `;
    } else {
      // Stacked distribution bar for activeDate
      html += `
        <div class="screentime-distribution-bar" title="App Distribution for ${this.formatDisplayDate(activeDate)}">
      `;
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
      activeData.apps.forEach((app, idx) => {
        const m = parseInt(app.minutes, 10) || 0;
        if (m <= 0) return;
        const pct = Math.max(2, Math.round((m / (totalMins || 1)) * 100));
        const color = colors[idx % colors.length];
        html += `<div class="screentime-dist-segment" style="width: ${pct}%; background: ${color};" title="${this.esc(app.name)}: ${this.formatDuration(m)} (${pct}%)"></div>`;
      });
      html += `</div>`;

      // App Cards Grid for activeDate
      html += `<div class="screentime-apps-grid">`;
      activeData.apps.forEach(app => {
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
              <button class="screentime-adj-btn" onclick="ScreentimeEngine.quickAdjustApp('${app.id}', -15, '${activeDate}')" title="Subtract 15 mins">-15m</button>
              <button class="screentime-adj-btn" onclick="ScreentimeEngine.quickAdjustApp('${app.id}', 15, '${activeDate}')" title="Add 15 mins">+15m</button>
              <button class="screentime-adj-btn" onclick="ScreentimeEngine.quickAdjustApp('${app.id}', 30, '${activeDate}')" title="Add 30 mins">+30m</button>
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

  /**
   * Helper to seed demo data across the last 14 days so user can preview trend chart
   */
  seedDemoHistory() {
    const today = this.getToday();
    const [ty, tm, td] = today.split('-').map(Number);

    for (let i = 0; i < 14; i++) {
      const d = new Date(ty, tm - 1, td);
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDateObj(d);

      if (!this.data.history[dateStr] || this.data.history[dateStr].totalMinutes === 0) {
        const chessMins = Math.floor(20 + Math.random() * 40);
        const linkedinMins = Math.floor(15 + Math.random() * 30);
        const whatsappMins = Math.floor(25 + Math.random() * 45);
        const ytMins = Math.floor(20 + Math.random() * 50);

        this.data.history[dateStr] = {
          totalMinutes: chessMins + linkedinMins + whatsappMins + ytMins,
          apps: [
            { id: 'app_chess', name: 'Chess Game', icon: '♟️', minutes: chessMins, category: 'Focus / Mind' },
            { id: 'app_linkedin', name: 'LinkedIn', icon: '💼', minutes: linkedinMins, category: 'Career / Network' },
            { id: 'app_whatsapp', name: 'WhatsApp', icon: '💬', minutes: whatsappMins, category: 'Communication' },
            { id: 'app_youtube', name: 'YouTube', icon: '▶️', minutes: ytMins, category: 'Media' },
            { id: 'app_browser', name: 'Chrome / Web', icon: '🌐', minutes: 20, category: 'Research' }
          ],
          lastUpdated: new Date().toISOString()
        };
      }
    }

    this.save();
    this.renderWidget();
    if (typeof Components !== 'undefined') {
      Components.showToast('📈 Generated sample 14-day history for review', 'info');
    }
  },

  openLogModal(dateStr) {
    const existing = document.getElementById('screentime-log-modal');
    if (existing) existing.remove();

    const targetDate = dateStr || this.selectedDate || this.getToday();
    const dateData = this.getDateData(targetDate);

    let appsInputsHTML = dateData.apps.map(app => {
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
            <button onclick="ScreentimeEngine.removeApp('${app.id}', '${targetDate}'); ScreentimeEngine.openLogModal('${targetDate}');" title="Remove app" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;">&times;</button>
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
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Recording for: <strong>${this.formatDisplayDate(targetDate)}</strong></span>
              </div>
            </div>
            <button onclick="ScreentimeEngine.closeModal('screentime-log-modal');" style="background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Target Date</label>
            <input type="date" id="st-modal-date" value="${targetDate}" onchange="ScreentimeEngine.openLogModal(this.value)" style="width: 100%; padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary);">
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Total Screen Time</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="st-total-mins-input" min="0" step="5" value="${dateData.totalMinutes || 0}" style="flex: 1; padding: 8px 12px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem; font-weight: 700;">
              <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Total Minutes</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">Leave at 0 to auto-calculate sum from individual apps below.</span>
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
            <button class="btn btn-secondary btn-xs" onclick="ScreentimeEngine.handleAddNewApp('${targetDate}')" style="width: 100%;">Add App</button>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-ghost btn-sm" onclick="ScreentimeEngine.closeModal('screentime-log-modal');">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="ScreentimeEngine.saveLogModal('${targetDate}');">Save Screen Time</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  handleAddNewApp(dateStr) {
    const icon = document.getElementById('st-new-icon')?.value || '📱';
    const name = document.getElementById('st-new-name')?.value;
    const mins = document.getElementById('st-new-mins')?.value;

    if (!name || !name.trim()) {
      if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
        Components.showToast('Please enter an app name', 'warning');
      }
      return;
    }

    this.addApp(name, icon, mins, 'App', dateStr);
    this.openLogModal(dateStr);
  },

  saveLogModal(dateStr) {
    const targetDate = dateStr || this.selectedDate || this.getToday();
    const dateData = this.getDateData(targetDate);
    const explicitTotal = parseInt(document.getElementById('st-total-mins-input')?.value, 10) || 0;

    let appsSum = 0;
    dateData.apps.forEach(app => {
      const input = document.getElementById(`st-app-input-${app.id}`);
      if (input) {
        app.minutes = Math.max(0, parseInt(input.value, 10) || 0);
        appsSum += app.minutes;
      }
    });

    dateData.totalMinutes = explicitTotal > 0 ? explicitTotal : appsSum;
    dateData.lastUpdated = new Date().toISOString();

    // Check goal achievement and award XP if under limit
    const goal = this.data.dailyGoalMinutes || 180;
    if (dateData.totalMinutes > 0 && dateData.totalMinutes <= goal) {
      if (typeof XPEngine !== 'undefined' && typeof XPEngine.awardXP === 'function') {
        XPEngine.awardXP(15, `Digital Wellbeing Discipline for ${this.formatDisplayDate(targetDate)} (+15 XP)`);
      }
    }

    this.save();
    this.renderWidget();
    this.closeModal('screentime-log-modal');

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast(`Saved screen time for ${this.formatDisplayDate(targetDate)}: ${this.formatDuration(dateData.totalMinutes)}`, 'success');
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

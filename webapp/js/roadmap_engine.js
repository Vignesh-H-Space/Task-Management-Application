/**
 * Tesseract Horizon Timeline & Interactive Multi-Zoom Roadmap Engine
 * Features:
 * - Multi-zoom spans: Day (7-day tactical), Week (4-week sprint), Month (calendar days), Quarter (90-day), Year (12-month)
 * - Bidirectional period navigation (Prev / Next / Today) with keyboard shortcuts (ArrowLeft / ArrowRight)
 * - Advanced multi-filtering: Horizon Tier, Category, Priority, Status
 * - Dynamic date range calculation, clipping indicators, today marker line, and task modal integration
 */

const RoadmapEngine = {
  zoomLevel: 'year', // 'day' | 'week' | 'month' | 'quarter' | 'year'
  viewAnchor: new Date(),
  tierFilter: 'all',
  categoryFilter: 'all',
  priorityFilter: 'all',
  statusFilter: 'all',
  _eventsBound: false,

  init() {
    this.bindEvents();
    this.render();
  },

  escape(str) {
    if (typeof escapeHTML === 'function') return escapeHTML(str);
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Zoom Span Buttons
    const zoomContainer = document.getElementById('roadmap-zoom-group');
    if (zoomContainer) {
      zoomContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.roadmap-zoom-btn');
        if (!btn) return;
        zoomContainer.querySelectorAll('.roadmap-zoom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.zoomLevel = btn.getAttribute('data-zoom') || 'year';
        this.render();
      });
    }

    // Navigation Buttons
    const prevBtn = document.getElementById('roadmap-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.navigatePrev());

    const nextBtn = document.getElementById('roadmap-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => this.navigateNext());

    const todayBtn = document.getElementById('roadmap-today-btn');
    if (todayBtn) todayBtn.addEventListener('click', () => this.navigateToday());

    // Filter Selectors
    const tierSelect = document.getElementById('roadmap-tier-select');
    if (tierSelect) {
      tierSelect.addEventListener('change', (e) => {
        this.tierFilter = e.target.value;
        this.render();
      });
    }

    const categorySelect = document.getElementById('roadmap-category-select');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.categoryFilter = e.target.value;
        this.render();
      });
    }

    const prioritySelect = document.getElementById('roadmap-priority-select');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        this.priorityFilter = e.target.value;
        this.render();
      });
    }

    const statusSelect = document.getElementById('roadmap-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render();
      });
    }

    // Reset Filters Button
    const resetBtn = document.getElementById('roadmap-reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetFilters());
    }

    // Keyboard Navigation (Left / Right arrows when not typing in an input)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      
      const isRoadmapPage = (typeof Components !== 'undefined' && Components.getCurrentPage)
        ? Components.getCurrentPage() === 'roadmap'
        : window.location.pathname.includes('roadmap.html');

      if (!isRoadmapPage) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigatePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateNext();
      }
    });
  },

  navigatePrev() {
    const anchor = new Date(this.viewAnchor);
    if (this.zoomLevel === 'day') {
      anchor.setDate(anchor.getDate() - 7);
    } else if (this.zoomLevel === 'week') {
      anchor.setDate(anchor.getDate() - 28);
    } else if (this.zoomLevel === 'month') {
      anchor.setMonth(anchor.getMonth() - 1);
    } else if (this.zoomLevel === 'quarter') {
      anchor.setMonth(anchor.getMonth() - 3);
    } else {
      anchor.setFullYear(anchor.getFullYear() - 1);
    }
    this.viewAnchor = anchor;
    this.render();
  },

  navigateNext() {
    const anchor = new Date(this.viewAnchor);
    if (this.zoomLevel === 'day') {
      anchor.setDate(anchor.getDate() + 7);
    } else if (this.zoomLevel === 'week') {
      anchor.setDate(anchor.getDate() + 28);
    } else if (this.zoomLevel === 'month') {
      anchor.setMonth(anchor.getMonth() + 1);
    } else if (this.zoomLevel === 'quarter') {
      anchor.setMonth(anchor.getMonth() + 3);
    } else {
      anchor.setFullYear(anchor.getFullYear() + 1);
    }
    this.viewAnchor = anchor;
    this.render();
  },

  navigateToday() {
    this.viewAnchor = new Date();
    this.render();
  },

  resetFilters() {
    this.tierFilter = 'all';
    this.categoryFilter = 'all';
    this.priorityFilter = 'all';
    this.statusFilter = 'all';

    const tSelect = document.getElementById('roadmap-tier-select');
    if (tSelect) tSelect.value = 'all';
    const cSelect = document.getElementById('roadmap-category-select');
    if (cSelect) cSelect.value = 'all';
    const pSelect = document.getElementById('roadmap-priority-select');
    if (pSelect) pSelect.value = 'all';
    const sSelect = document.getElementById('roadmap-status-select');
    if (sSelect) sSelect.value = 'all';

    this.render();
  },

  getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(date.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    return mon;
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  getTimelineRange() {
    const anchor = this.viewAnchor;
    const year = anchor.getFullYear();
    const now = new Date();

    if (this.zoomLevel === 'day') {
      // 7-day week (Mon - Sun)
      const start = this.getMonday(anchor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const bottomBand = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + i);
        const isWeekend = i === 5 || i === 6;
        const isToday = this.isSameDay(cur, now);
        bottomBand.push({
          label: `${dayNames[i]} ${cur.getDate()}`,
          sublabel: cur.toLocaleDateString('en-US', { month: 'short' }),
          isWeekend,
          isToday,
          span: 1
        });
      }

      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const monthDisplay = (startMonth === endMonth) ? `${startMonth} ${year}` : `${startMonth} – ${endMonth} ${year}`;
      const periodLabel = `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${year}`;

      return {
        start,
        end,
        periodLabel,
        topBand: [{ name: `Tactical 7-Day Sprint (${monthDisplay})`, span: 7 }],
        bottomBand
      };
    }

    if (this.zoomLevel === 'week') {
      // 4-week window (28 days) starting on Monday of anchor week
      const start = this.getMonday(anchor);
      const end = new Date(start);
      end.setDate(start.getDate() + 27);
      end.setHours(23, 59, 59, 999);

      const bottomBand = [];
      for (let w = 0; w < 4; w++) {
        const wStart = new Date(start);
        wStart.setDate(start.getDate() + w * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wStart.getDate() + 6);
        const isCurrentWeek = now >= wStart && now <= new Date(wEnd.getTime() + 86400000);

        bottomBand.push({
          label: `Week ${w + 1}`,
          sublabel: `${wStart.getDate()} ${wStart.toLocaleDateString('en-US', { month: 'short' })} – ${wEnd.getDate()} ${wEnd.toLocaleDateString('en-US', { month: 'short' })}`,
          isWeekend: false,
          isToday: isCurrentWeek,
          span: 1
        });
      }

      const periodLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (4 Weeks)`;
      return {
        start,
        end,
        periodLabel,
        topBand: [{ name: `4-Week Milestone Horizon (${year})`, span: 4 }],
        bottomBand
      };
    }

    if (this.zoomLevel === 'month') {
      // Single calendar month
      const month = anchor.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const totalDays = end.getDate();

      const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const bottomBand = [];
      for (let d = 1; d <= totalDays; d++) {
        const cur = new Date(year, month, d);
        const dayOfWeek = cur.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = this.isSameDay(cur, now);
        bottomBand.push({
          label: `${d}`,
          sublabel: dayLetters[dayOfWeek],
          isWeekend,
          isToday,
          span: 1
        });
      }

      const monthName = start.toLocaleDateString('en-US', { month: 'long' });
      const periodLabel = `${monthName} ${year}`;
      return {
        start,
        end,
        periodLabel,
        topBand: [{ name: `${monthName} ${year} Focus (${totalDays} Days)`, span: totalDays }],
        bottomBand
      };
    }

    if (this.zoomLevel === 'quarter') {
      // 3-Month Quarter
      const qIdx = Math.floor(anchor.getMonth() / 3);
      const start = new Date(year, qIdx * 3, 1, 0, 0, 0, 0);
      const end = new Date(year, (qIdx + 1) * 3, 0, 23, 59, 59, 999);

      const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const qMonths = [allMonths[qIdx * 3], allMonths[qIdx * 3 + 1], allMonths[qIdx * 3 + 2]];

      const bottomBand = qMonths.map((mName, idx) => {
        const mIdx = qIdx * 3 + idx;
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() === mIdx;
        return {
          label: mName,
          sublabel: '',
          isWeekend: false,
          isToday: isCurrentMonth,
          span: 1
        };
      });

      const periodLabel = `Q${qIdx + 1} ${year} (${qMonths[0].substring(0, 3)} – ${qMonths[2].substring(0, 3)})`;
      return {
        start,
        end,
        periodLabel,
        topBand: [{ name: `Q${qIdx + 1} Strategic Quarter (${year})`, span: 3 }],
        bottomBand
      };
    }

    // Default: 'year' (Full 12 Months)
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const bottomBand = months.map((m, idx) => {
      const isCurrentMonth = now.getFullYear() === year && now.getMonth() === idx;
      return {
        label: m,
        sublabel: '',
        isWeekend: false,
        isToday: isCurrentMonth,
        span: 1
      };
    });

    return {
      start,
      end,
      periodLabel: `${year} Flight Plan`,
      topBand: [
        { name: 'Q1', span: 3 },
        { name: 'Q2', span: 3 },
        { name: 'Q3', span: 3 },
        { name: 'Q4', span: 3 }
      ],
      bottomBand
    };
  },

  getTaskDates(task, viewYear) {
    let startDate = null;
    let endDate = null;

    if (task.createdAt) {
      const parsed = new Date(task.createdAt);
      if (!isNaN(parsed.getTime())) startDate = parsed;
    }

    if (task.dueDate) {
      const dueStr = task.dueDate.includes('T') ? task.dueDate : `${task.dueDate}T23:59:59`;
      const parsed = new Date(dueStr);
      if (!isNaN(parsed.getTime())) endDate = parsed;
    }

    const yr = viewYear || new Date().getFullYear();

    if (!startDate && !endDate) {
      if (task.tier === 'annual') {
        startDate = new Date(yr, 0, 1, 0, 0, 0);
        endDate = new Date(yr, 11, 31, 23, 59, 59);
      } else if (task.tier === 'quarterly') {
        startDate = new Date(yr, 6, 1, 0, 0, 0);
        endDate = new Date(yr, 8, 30, 23, 59, 59);
      } else if (task.tier === 'monthly') {
        startDate = new Date(yr, 7, 1, 0, 0, 0);
        endDate = new Date(yr, 7, 31, 23, 59, 59);
      } else if (task.tier === 'weekly') {
        startDate = new Date(yr, 7, 17, 0, 0, 0);
        endDate = new Date(yr, 7, 23, 23, 59, 59);
      } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59);
      }
    } else if (!startDate && endDate) {
      startDate = new Date(endDate);
      if (task.tier === 'annual') startDate.setMonth(0, 1);
      else if (task.tier === 'quarterly') startDate.setMonth(startDate.getMonth() - 2, 1);
      else if (task.tier === 'monthly') startDate.setDate(1);
      else if (task.tier === 'weekly') startDate.setDate(startDate.getDate() - 6);
      else startDate.setHours(0, 0, 0, 0);
    } else if (startDate && !endDate) {
      endDate = new Date(startDate);
      if (task.tier === 'annual') endDate.setMonth(11, 31);
      else if (task.tier === 'quarterly') endDate.setMonth(endDate.getMonth() + 3, 0);
      else if (task.tier === 'monthly') endDate.setMonth(endDate.getMonth() + 1, 0);
      else if (task.tier === 'weekly') endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59);
    }

    if (startDate.getTime() > endDate.getTime()) {
      endDate = new Date(startDate.getTime() + 86400000);
    }

    return {
      taskStart: startDate.getTime(),
      taskEnd: endDate.getTime(),
      startDate,
      endDate
    };
  },

  render() {
    const canvas = document.getElementById('gantt-canvas');
    if (!canvas || typeof state === 'undefined') return;

    const range = this.getTimelineRange();
    const startTime = range.start.getTime();
    const endTime = range.end.getTime();
    const totalDuration = Math.max(1, endTime - startTime);

    // Update Period Badge
    const periodBadge = document.getElementById('roadmap-period-badge');
    if (periodBadge) {
      periodBadge.textContent = range.periodLabel;
    }

    // Calculate Today Marker Position
    const now = new Date();
    const nowTime = now.getTime();
    const isTodayInView = nowTime >= startTime && nowTime <= endTime;
    const todayPct = isTodayInView ? ((nowTime - startTime) / totalDuration) * 100 : null;

    // Filter Pipeline
    let tasks = Array.isArray(state.tasks) ? state.tasks : [];

    // 1. Horizon Tier filter
    if (this.tierFilter !== 'all') {
      tasks = tasks.filter(t => t.tier === this.tierFilter);
    } else {
      // By default in Year & Quarter view, keep higher altitude tiers unless user explicitly picks daily
      if (['year', 'quarter'].includes(this.zoomLevel)) {
        tasks = tasks.filter(t => ['annual', 'quarterly', 'monthly', 'weekly'].includes(t.tier));
      }
    }

    // 2. Category filter
    if (this.categoryFilter !== 'all') {
      tasks = tasks.filter(t => t.category === this.categoryFilter);
    }

    // 3. Priority filter
    if (this.priorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === this.priorityFilter);
    }

    // 4. Status filter
    if (this.statusFilter === 'active') {
      tasks = tasks.filter(t => !t.completed);
    } else if (this.statusFilter === 'completed') {
      tasks = tasks.filter(t => t.completed);
    }

    // 5. Date Overlap with timeline range
    const viewYear = this.viewAnchor.getFullYear();
    tasks = tasks.filter(t => {
      const { taskStart, taskEnd } = this.getTaskDates(t, viewYear);
      return taskEnd >= startTime && taskStart <= endTime;
    });

    // Update Task Count Badge
    const countBadge = document.getElementById('roadmap-task-count');
    if (countBadge) {
      countBadge.textContent = `${tasks.length} item${tasks.length === 1 ? '' : 's'}`;
    }

    // Group tasks by horizon tier
    const annualTasks = tasks.filter(t => t.tier === 'annual');
    const quarterlyTasks = tasks.filter(t => t.tier === 'quarterly');
    const monthlyTasks = tasks.filter(t => t.tier === 'monthly');
    const weeklyTasks = tasks.filter(t => t.tier === 'weekly');
    const dailyTasks = tasks.filter(t => t.tier === 'daily');

    // Build Header HTML
    const topBandHTML = range.topBand.map(item => `
      <div class="gantt-quarter-cell" style="flex: ${item.span};">${this.escape(item.name)}</div>
    `).join('');

    const bottomBandHTML = range.bottomBand.map(item => `
      <div class="gantt-month-cell ${item.isWeekend ? 'weekend' : ''} ${item.isToday ? 'is-today' : ''}" style="flex: ${item.span || 1};">
        <span class="gantt-cell-label">${this.escape(item.label)}</span>
        ${item.sublabel ? `<span class="gantt-cell-sublabel">${this.escape(item.sublabel)}</span>` : ''}
      </div>
    `).join('');

    // Empty state if no tasks
    const hasAnyTasks = tasks.length > 0;
    const emptyStateHTML = `
      <div class="gantt-empty-state">
        <i data-lucide="filter-x"></i>
        <h4>No Items in this Horizon Span</h4>
        <p>No goals or tasks match your current filters within ${this.escape(range.periodLabel)}.</p>
        <div class="gantt-empty-actions">
          <button class="btn-roadmap-nav btn-roadmap-today" onclick="RoadmapEngine.resetFilters()">
            <i data-lucide="rotate-ccw"></i>
            <span>Reset All Filters</span>
          </button>
        </div>
      </div>
    `;

    canvas.innerHTML = `
      <!-- Gantt Header (Dynamic Top & Bottom Bands) -->
      <div class="gantt-header-row">
        <div class="gantt-label-col">Horizon Tier / Objective</div>
        <div class="gantt-timeline-col">
          <!-- Top Band (Quarters / Sprint / Month) -->
          <div class="gantt-quarters-band">
            ${topBandHTML}
          </div>
          <!-- Bottom Band (Months / Weeks / Days) -->
          <div class="gantt-months-band">
            ${bottomBandHTML}
          </div>
        </div>
      </div>

      <!-- Today Marker Line -->
      ${todayPct !== null ? `
        <div class="gantt-today-line" style="left: calc(240px + (100% - 240px) * ${todayPct / 100});" title="Today (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})">
          <span class="gantt-today-pill">TODAY</span>
        </div>
      ` : ''}

      <!-- Tier Sections or Empty State -->
      ${hasAnyTasks ? `
        <!-- Tier Section 1: Annual Vision -->
        ${this.renderTierSection('🏆 Annual Vision Pillars', 'annual', annualTasks, startTime, totalDuration, viewYear)}

        <!-- Tier Section 2: Quarterly Objectives -->
        ${this.renderTierSection('🎯 Quarterly Objectives', 'quarterly', quarterlyTasks, startTime, totalDuration, viewYear)}

        <!-- Tier Section 3: Monthly Deliverables -->
        ${this.renderTierSection('🗓️ Monthly Focus Areas', 'monthly', monthlyTasks, startTime, totalDuration, viewYear)}

        <!-- Tier Section 4: Weekly Milestones -->
        ${this.renderTierSection('📅 Tactical Weekly Milestones', 'weekly', weeklyTasks, startTime, totalDuration, viewYear)}

        <!-- Tier Section 5: Daily Tasks -->
        ${this.renderTierSection('🌅 Daily Execution Items', 'daily', dailyTasks, startTime, totalDuration, viewYear)}
      ` : emptyStateHTML}
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  },

  renderTierSection(title, tierKey, tasks, startTime, totalDuration, viewYear) {
    if (!tasks || tasks.length === 0) return '';

    return `
      <div class="gantt-section-header">
        <span>${title} (${tasks.length})</span>
      </div>
      <div class="gantt-rows-group">
        ${tasks.map(task => this.renderTaskRow(task, startTime, totalDuration, viewYear)).join('')}
      </div>
    `;
  },

  renderTaskRow(task, rangeStart, rangeDuration, viewYear) {
    const { taskStart, taskEnd, endDate } = this.getTaskDates(task, viewYear);

    // Calculate percentages relative to timeline view
    let leftPct = ((taskStart - rangeStart) / rangeDuration) * 100;
    let rightPct = ((taskEnd - rangeStart) / rangeDuration) * 100;

    const isClippedLeft = leftPct < 0;
    const isClippedRight = rightPct > 100;

    // Clamp for visual display inside the timeline bar
    leftPct = Math.max(0, Math.min(97, leftPct));
    rightPct = Math.max(leftPct + 2.5, Math.min(100, rightPct));
    const widthPct = Math.max(2.8, rightPct - leftPct);

    // Completion percentage
    let pct = 0;
    if (task.subtasks && task.subtasks.length > 0) {
      const done = task.subtasks.filter(s => s.completed).length;
      pct = Math.round((done / task.subtasks.length) * 100);
    } else if (task.completed) {
      pct = 100;
    }

    // Visual Tier Color
    const tierObj = (typeof TIERS !== 'undefined')
      ? (TIERS.find(t => t.id === task.tier) || { color: '#6366f1' })
      : { color: '#6366f1' };
    const barColor = task.completed ? '#10b981' : tierObj.color;
    const isUrgent = task.priority === 'urgent' && !task.completed;

    const formattedDue = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const subtaskInfo = task.subtasks && task.subtasks.length > 0
      ? `${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length} steps`
      : (task.completed ? '100% Done' : 'In Progress');

    const clippedClasses = [
      isClippedLeft ? 'clipped-left' : '',
      isClippedRight ? 'clipped-right' : '',
      isUrgent ? 'urgent' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="gantt-row ${task.completed ? 'completed' : ''}" onclick="if(typeof openEditModal==='function') openEditModal('${task.id}')">
        <!-- Label Column -->
        <div class="gantt-label-cell">
          <div class="gantt-task-meta-line">
            <span class="gantt-task-tier-pill" style="color: ${tierObj.color}; border-color: ${tierObj.color}40; background: ${tierObj.color}15;">
              ${task.tier ? task.tier.toUpperCase() : 'TASK'}
            </span>
            <span class="gantt-task-category">#${this.escape(task.category || 'General')}</span>
            ${task.priority === 'urgent' ? '<span class="gantt-urgent-dot" title="Urgent Priority"></span>' : ''}
          </div>
          <span class="gantt-task-title" title="${this.escape(task.title)}">${this.escape(task.title)}</span>
        </div>

        <!-- Bar Timeline Column -->
        <div class="gantt-bar-cell">
          <div class="gantt-bar-wrapper ${clippedClasses}" 
               style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;">
            <div class="gantt-bar" style="border-color: ${barColor};">
              <div class="gantt-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
              <div class="gantt-bar-content">
                <span class="gantt-bar-text">${this.escape(task.title)}</span>
                <span class="gantt-bar-pct">${pct}%</span>
              </div>
            </div>

            <!-- Hover Spotlight Tooltip -->
            <div class="gantt-tooltip">
              <div class="gantt-tooltip-title">${this.escape(task.title)}</div>
              <div class="gantt-tooltip-meta">
                <span>Horizon: <b style="color:${tierObj.color}">${task.tier.toUpperCase()}</b></span>
                <span>Category: <b>${this.escape(task.category)}</b></span>
                <span>Priority: <b class="priority-${task.priority}">${(task.priority || 'medium').toUpperCase()}</b></span>
                <span>Due: <b>${formattedDue}</b></span>
                <span>Status: <b>${task.completed ? 'Completed' : 'Active'}</b></span>
                <span>Progress: <b>${subtaskInfo}</b></span>
              </div>
              ${task.description ? `<div class="gantt-tooltip-desc">${this.escape(task.description)}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

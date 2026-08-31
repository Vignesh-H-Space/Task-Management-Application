/**
 * Tesseract 12-Month Horizon Timeline & Interactive Roadmap Engine
 * Renders executive Gantt grid, quarterly zoom bands, progress fills, and goal bars.
 */

const RoadmapEngine = {
  quarterFilter: 'all',
  categoryFilter: 'all',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    document.querySelectorAll('.roadmap-zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.roadmap-zoom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.quarterFilter = btn.getAttribute('data-quarter');
        this.render();
      });
    });

    const categorySelect = document.getElementById('roadmap-category-select');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.categoryFilter = e.target.value;
        this.render();
      });
    }
  },

  getTimelineRange() {
    const year = 2026;
    if (this.quarterFilter === 'q1') {
      return { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59), months: ['Jan', 'Feb', 'Mar'], quarters: [{ name: 'Q1 2026', span: 3 }] };
    }
    if (this.quarterFilter === 'q2') {
      return { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59), months: ['Apr', 'May', 'Jun'], quarters: [{ name: 'Q2 2026', span: 3 }] };
    }
    if (this.quarterFilter === 'q3') {
      return { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59), months: ['Jul', 'Aug', 'Sep'], quarters: [{ name: 'Q3 2026', span: 3 }] };
    }
    if (this.quarterFilter === 'q4') {
      return { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59), months: ['Oct', 'Nov', 'Dec'], quarters: [{ name: 'Q4 2026', span: 3 }] };
    }
    
    // Default Full Year 12 Months
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      quarters: [
        { name: 'Q1', span: 3 },
        { name: 'Q2', span: 3 },
        { name: 'Q3', span: 3 },
        { name: 'Q4', span: 3 }
      ]
    };
  },

  render() {
    const canvas = document.getElementById('gantt-canvas');
    if (!canvas || typeof state === 'undefined') return;

    const range = this.getTimelineRange();
    const startTime = range.start.getTime();
    const endTime = range.end.getTime();
    const totalDuration = endTime - startTime;

    const now = new Date();
    const nowTime = now.getTime();
    const isTodayInView = nowTime >= startTime && nowTime <= endTime;
    const todayPct = isTodayInView ? ((nowTime - startTime) / totalDuration) * 100 : null;

    // Filter tasks
    let tasks = state.tasks.filter(t => ['annual', 'quarterly', 'monthly', 'weekly'].includes(t.tier));
    if (this.categoryFilter !== 'all') {
      tasks = tasks.filter(t => t.category === this.categoryFilter);
    }

    // Group tasks by horizon tier
    const annualTasks = tasks.filter(t => t.tier === 'annual');
    const quarterlyTasks = tasks.filter(t => t.tier === 'quarterly');
    const monthlyTasks = tasks.filter(t => t.tier === 'monthly' || t.tier === 'weekly');

    canvas.innerHTML = `
      <!-- Gantt Header (Quarters & Months) -->
      <div class="gantt-header-row">
        <div class="gantt-label-col">Horizon Tier / Objective</div>
        <div class="gantt-timeline-col">
          <!-- Quarters Band -->
          <div class="gantt-quarters-band">
            ${range.quarters.map(q => `
              <div class="gantt-quarter-cell" style="flex: ${q.span};">${q.name}</div>
            `).join('')}
          </div>
          <!-- Months Band -->
          <div class="gantt-months-band">
            ${range.months.map((m, idx) => `
              <div class="gantt-month-cell">${m}</div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Today Marker Line -->
      ${todayPct !== null ? `
        <div class="gantt-today-line" style="left: calc(240px + (100% - 240px) * ${todayPct / 100});" title="Today (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})">
          <span class="gantt-today-pill">TODAY</span>
        </div>
      ` : ''}

      <!-- Tier Section 1: Annual Vision -->
      ${this.renderTierSection('🏆 Annual Vision Pillars', 'annual', annualTasks, range, startTime, totalDuration)}

      <!-- Tier Section 2: Quarterly Objectives -->
      ${this.renderTierSection('🎯 Quarterly Objectives', 'quarterly', quarterlyTasks, range, startTime, totalDuration)}

      <!-- Tier Section 3: Monthly & Weekly Deliverables -->
      ${this.renderTierSection('🗓️ Monthly Deliverables', 'monthly', monthlyTasks, range, startTime, totalDuration)}
    `;

    lucide.createIcons();
  },

  renderTierSection(title, tierKey, tasks, range, startTime, totalDuration) {
    if (tasks.length === 0) return '';

    return `
      <div class="gantt-section-header">
        <span>${title} (${tasks.length})</span>
      </div>
      <div class="gantt-rows-group">
        ${tasks.map(task => this.renderTaskRow(task, startTime, totalDuration)).join('')}
      </div>
    `;
  },

  renderTaskRow(task, rangeStart, rangeDuration) {
    // Determine start & end dates
    const startDate = task.createdAt ? new Date(task.createdAt) : new Date(2026, 0, 1);
    let endDate = task.dueDate ? new Date(task.dueDate) : new Date(2026, 11, 31);
    
    // Ensure end date has end-of-day time
    endDate.setHours(23, 59, 59);

    const taskStart = startDate.getTime();
    const taskEnd = endDate.getTime();

    // Calculate left & width %
    let leftPct = ((taskStart - rangeStart) / rangeDuration) * 100;
    let rightPct = ((taskEnd - rangeStart) / rangeDuration) * 100;

    // Clamp within visible bounds
    leftPct = Math.max(0, Math.min(96, leftPct));
    rightPct = Math.max(leftPct + 3, Math.min(100, rightPct));
    const widthPct = Math.max(4, rightPct - leftPct);

    // Completion percentage
    let pct = 0;
    if (task.subtasks && task.subtasks.length > 0) {
      const done = task.subtasks.filter(s => s.completed).length;
      pct = Math.round((done / task.subtasks.length) * 100);
    } else if (task.completed) {
      pct = 100;
    }

    const tierObj = (typeof TIERS !== 'undefined') ? (TIERS.find(t => t.id === task.tier) || { color: '#6366f1' }) : { color: '#6366f1' };
    const barColor = task.completed ? '#10b981' : tierObj.color;
    const isUrgent = task.priority === 'urgent' && !task.completed;

    const formattedDue = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const subtaskInfo = task.subtasks && task.subtasks.length > 0
      ? `${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length} steps`
      : (task.completed ? '100% Done' : 'In Progress');

    return `
      <div class="gantt-row ${task.completed ? 'completed' : ''}" onclick="if(typeof openEditModal==='function') openEditModal('${task.id}')">
        <!-- Label Column -->
        <div class="gantt-label-cell">
          <span class="gantt-task-category">#${task.category || 'General'}</span>
          <span class="gantt-task-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</span>
        </div>

        <!-- Bar Timeline Column -->
        <div class="gantt-bar-cell">
          <div class="gantt-bar-wrapper ${isUrgent ? 'urgent' : ''}" 
               style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;">
            <div class="gantt-bar" style="border-color: ${barColor};">
              <div class="gantt-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
              <div class="gantt-bar-content">
                <span class="gantt-bar-text">${escapeHTML(task.title)}</span>
                <span class="gantt-bar-pct">${pct}%</span>
              </div>
            </div>

            <!-- Hover Spotlight Tooltip -->
            <div class="gantt-tooltip">
              <div class="gantt-tooltip-title">${escapeHTML(task.title)}</div>
              <div class="gantt-tooltip-meta">
                <span>Horizon: <b>${task.tier.toUpperCase()}</b></span>
                <span>Category: <b>${task.category}</b></span>
                <span>Due: <b>${formattedDue}</b></span>
                <span>Progress: <b>${subtaskInfo}</b></span>
              </div>
              ${task.description ? `<div class="gantt-tooltip-desc">${escapeHTML(task.description)}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

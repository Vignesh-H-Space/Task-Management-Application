/**
 * Tesseract Professional Engine
 * Living career journal, dynamic resume generator, and professional milestone tracker.
 * Auto-populates from completed tasks & backlogs + manual career entries.
 */

const PRO_STORAGE_KEY = 'tesseract_professional_data';

const PRO_CATEGORIES = {
  achievement:   { key: 'achievement',   label: 'Achievement',     emoji: '🏆', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  project:       { key: 'project',       label: 'Project Shipped', emoji: '🚀', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  certification: { key: 'certification', label: 'Certification',   emoji: '📜', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  promotion:     { key: 'promotion',     label: 'Promotion',       emoji: '⬆️', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  learning:      { key: 'learning',      label: 'Learning',        emoji: '📚', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  recognition:   { key: 'recognition',   label: 'Recognition',     emoji: '🌟', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
  job_change:    { key: 'job_change',     label: 'Job Change',      emoji: '💼', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  other:         { key: 'other',         label: 'Other',           emoji: '📌', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' }
};

const IMPACT_CONFIG = {
  high:   { label: 'High',   color: '#ef4444', dot: '🔴' },
  medium: { label: 'Medium', color: '#f59e0b', dot: '🟡' },
  low:    { label: 'Low',    color: '#10b981', dot: '🟢' }
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ProfessionalEngine = {
  entries: [],       // Manual entries
  activeView: 'timeline',  // 'timeline' | 'resume'
  activeYear: new Date().getFullYear(),
  editingId: null,
  _eventsBound: false,

  // ──────── Utilities ────────

  escape(str) {
    if (typeof escapeHTML === 'function') return escapeHTML(str);
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  generateId() {
    return 'pro_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // ──────── Data Layer ────────

  load() {
    try {
      const raw = localStorage.getItem(PRO_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.entries = Array.isArray(data.entries) ? data.entries : [];
      }
    } catch (e) {
      console.warn('[ProfessionalEngine] Load error:', e);
      this.entries = [];
    }
  },

  save() {
    try {
      localStorage.setItem(PRO_STORAGE_KEY, JSON.stringify({ entries: this.entries }));
    } catch (e) {
      console.warn('[ProfessionalEngine] Save error:', e);
    }
  },

  addEntry(entry) {
    const newEntry = {
      id: this.generateId(),
      type: 'manual',
      category: entry.category || 'other',
      title: (entry.title || '').trim(),
      description: (entry.description || '').trim(),
      date: entry.date || new Date().toISOString().slice(0, 10),
      tags: Array.isArray(entry.tags) ? entry.tags : (entry.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      impact: entry.impact || 'medium',
      createdAt: new Date().toISOString()
    };
    this.entries.push(newEntry);
    this.save();
    return newEntry;
  },

  updateEntry(id, updates) {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    Object.assign(this.entries[idx], updates);
    this.save();
    return this.entries[idx];
  },

  deleteEntry(id) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.save();
  },

  // ──────── Auto Entries (computed on the fly) ────────

  getAutoEntries() {
    const auto = [];

    // 1. From state.tasks (completed ones with career-relevant categories)
    if (typeof state !== 'undefined' && Array.isArray(state.tasks)) {
      state.tasks.forEach(task => {
        if (!task.completed || !task.completedAt) return;
        const d = new Date(task.completedAt);
        if (isNaN(d.getTime())) return;
        const dateStr = d.toISOString().slice(0, 10);

        let autoCat = 'achievement';
        let autoLabel = '✅ Task Completed';
        if (task.tier === 'annual') {
          autoCat = 'achievement';
          autoLabel = '🏆 Annual Goal Achieved';
        } else if (task.tier === 'quarterly') {
          autoCat = 'project';
          autoLabel = '🎯 Quarterly Objective';
        } else if (task.tier === 'monthly') {
          autoCat = 'achievement';
          autoLabel = '📋 Monthly Milestone';
        } else if (task.tier === 'weekly') {
          // Only include high-priority weekly tasks
          if (task.priority !== 'urgent' && task.priority !== 'high') return;
          autoCat = 'achievement';
          autoLabel = '📅 Weekly Milestone';
        } else {
          // Skip daily tasks — too granular for professional journal
          return;
        }

        auto.push({
          id: 'auto_task_' + task.id,
          type: 'auto',
          source: 'tasks',
          sourceLabel: autoLabel,
          category: autoCat,
          title: task.title || '',
          description: task.description || '',
          date: dateStr,
          tags: Array.isArray(task.tags) ? task.tags : [],
          impact: task.priority === 'urgent' ? 'high' : task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : 'low',
          tier: task.tier,
          createdAt: task.createdAt || task.completedAt
        });
      });
    }

    // 2. From BacklogEngine.items (completed work backlogs)
    if (typeof BacklogEngine !== 'undefined' && Array.isArray(BacklogEngine.items)) {
      BacklogEngine.items.forEach(item => {
        if (!item.completed || !item.completedAt) return;
        if (item.group !== 'work' && item.group !== 'tesseract') return;
        const d = new Date(item.completedAt);
        if (isNaN(d.getTime())) return;
        const dateStr = d.toISOString().slice(0, 10);

        auto.push({
          id: 'auto_bkl_' + item.id,
          type: 'auto',
          source: 'backlogs',
          sourceLabel: '✅ Work Backlog',
          category: 'project',
          title: item.objective || '',
          description: item.notes || '',
          date: dateStr,
          tags: item.group ? [item.group] : [],
          impact: item.severity === 'high' ? 'high' : item.severity === 'moderate' ? 'medium' : 'low',
          createdAt: item.createdAt || item.completedAt
        });
      });
    }

    return auto;
  },

  // ──────── Merged & Filtered ────────

  getAllEntries() {
    const manual = this.entries.map(e => ({ ...e, type: 'manual' }));
    const auto = this.getAutoEntries();
    return [...manual, ...auto];
  },

  getEntriesForYear(year) {
    return this.getAllEntries().filter(e => {
      if (!e.date) return false;
      return new Date(e.date + 'T00:00:00').getFullYear() === year;
    });
  },

  getEntriesForMonth(year, month) {
    return this.getAllEntries().filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  // ──────── Stats ────────

  computeStats() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const allEntries = this.getAllEntries();
    const yearEntries = allEntries.filter(e => e.date && new Date(e.date + 'T00:00:00').getFullYear() === currentYear);
    const monthEntries = yearEntries.filter(e => new Date(e.date + 'T00:00:00').getMonth() === currentMonth);

    // Top category
    const catCounts = {};
    yearEntries.forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    // Impact score
    const impactScore = yearEntries.reduce((sum, e) => {
      return sum + (e.impact === 'high' ? 3 : e.impact === 'medium' ? 2 : 1);
    }, 0);

    // Active streak (consecutive months with ≥1 entry going backward)
    let streak = 0;
    let checkMonth = currentMonth;
    let checkYear = currentYear;
    while (true) {
      const hasEntry = allEntries.some(e => {
        if (!e.date) return false;
        const d = new Date(e.date + 'T00:00:00');
        return d.getFullYear() === checkYear && d.getMonth() === checkMonth;
      });
      if (!hasEntry) break;
      streak++;
      checkMonth--;
      if (checkMonth < 0) { checkMonth = 11; checkYear--; }
      if (streak > 120) break; // safety
    }

    return {
      thisYear: yearEntries.length,
      thisMonth: monthEntries.length,
      topCategory: topCat ? PRO_CATEGORIES[topCat[0]] : null,
      topCategoryCount: topCat ? topCat[1] : 0,
      impactScore,
      activeStreak: streak
    };
  },

  // ──────── Init & Events ────────

  init() {
    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
    if (page !== 'professional') return;

    this.load();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // View toggle
    const toggleGroup = document.getElementById('pro-view-toggle');
    if (toggleGroup) {
      toggleGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.pro-view-btn');
        if (!btn) return;
        toggleGroup.querySelectorAll('.pro-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeView = btn.getAttribute('data-view') || 'timeline';
        this.render();
      });
    }

    // Year navigation
    const prevBtn = document.getElementById('pro-year-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => { this.activeYear--; this.render(); });

    const nextBtn = document.getElementById('pro-year-next');
    if (nextBtn) nextBtn.addEventListener('click', () => { this.activeYear++; this.render(); });

    // Add entry
    const addBtn = document.getElementById('pro-add-entry-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openModal());

    // Modal close
    const closeBtn = document.getElementById('pro-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

    const cancelBtn = document.getElementById('pro-modal-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

    // Modal save
    const saveBtn = document.getElementById('pro-modal-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveFromModal());

    // Backdrop click
    const modal = document.getElementById('pro-entry-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    // Export
    const printBtn = document.getElementById('pro-btn-print');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const copyBtn = document.getElementById('pro-btn-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => this.copyResumeMarkdown());
  },

  // ──────── Modal ────────

  openModal(entryId = null) {
    const modal = document.getElementById('pro-entry-modal');
    if (!modal) return;

    this.editingId = entryId;
    const titleEl = document.getElementById('pro-modal-title');

    if (entryId) {
      const entry = this.entries.find(e => e.id === entryId);
      if (!entry) return;
      titleEl.textContent = 'Edit Career Entry';
      document.getElementById('pro-entry-title').value = entry.title || '';
      document.getElementById('pro-entry-desc').value = entry.description || '';
      document.getElementById('pro-entry-category').value = entry.category || 'other';
      document.getElementById('pro-entry-date').value = entry.date || '';
      document.getElementById('pro-entry-impact').value = entry.impact || 'medium';
      document.getElementById('pro-entry-tags').value = (entry.tags || []).join(', ');
    } else {
      titleEl.textContent = 'Add Career Entry';
      document.getElementById('pro-entry-title').value = '';
      document.getElementById('pro-entry-desc').value = '';
      document.getElementById('pro-entry-category').value = 'achievement';
      document.getElementById('pro-entry-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('pro-entry-impact').value = 'medium';
      document.getElementById('pro-entry-tags').value = '';
    }

    modal.style.display = 'flex';
    setTimeout(() => {
      document.getElementById('pro-entry-title').focus();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 50);
  },

  closeModal() {
    const modal = document.getElementById('pro-entry-modal');
    if (modal) modal.style.display = 'none';
    this.editingId = null;
  },

  saveFromModal() {
    const title = document.getElementById('pro-entry-title').value.trim();
    if (!title) {
      document.getElementById('pro-entry-title').style.borderColor = '#ef4444';
      setTimeout(() => document.getElementById('pro-entry-title').style.borderColor = '', 2000);
      return;
    }

    const data = {
      title,
      description: document.getElementById('pro-entry-desc').value.trim(),
      category: document.getElementById('pro-entry-category').value,
      date: document.getElementById('pro-entry-date').value,
      impact: document.getElementById('pro-entry-impact').value,
      tags: document.getElementById('pro-entry-tags').value
    };

    if (this.editingId) {
      this.updateEntry(this.editingId, data);
    } else {
      this.addEntry(data);
    }

    this.closeModal();
    this.render();

    // Toast
    if (typeof Components !== 'undefined' && Components.showToast) {
      Components.showToast(this.editingId ? 'Entry updated' : 'Career entry added', 'success');
    }
  },

  // ──────── Render Router ────────

  render() {
    this.renderStats();

    // Show/hide year nav and export based on view
    const yearNav = document.getElementById('pro-year-nav');
    const exportActions = document.getElementById('pro-export-actions');
    const addBtn = document.getElementById('pro-add-entry-btn');
    const timelineMount = document.getElementById('pro-timeline-mount');
    const resumeMount = document.getElementById('pro-resume-mount');

    if (this.activeView === 'timeline') {
      if (yearNav) yearNav.style.display = '';
      if (exportActions) exportActions.style.display = 'none';
      if (addBtn) addBtn.style.display = '';
      if (timelineMount) timelineMount.style.display = '';
      if (resumeMount) resumeMount.style.display = 'none';
      this.renderTimeline();
    } else {
      if (yearNav) yearNav.style.display = 'none';
      if (exportActions) exportActions.style.display = '';
      if (addBtn) addBtn.style.display = 'none';
      if (timelineMount) timelineMount.style.display = 'none';
      if (resumeMount) resumeMount.style.display = '';
      this.renderResume();
    }

    // Update year badge
    const badge = document.getElementById('pro-year-badge');
    if (badge) badge.textContent = this.activeYear;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ──────── Stats Strip ────────

  renderStats() {
    const mount = document.getElementById('pro-stats-strip');
    if (!mount) return;
    const s = this.computeStats();
    const topCatLabel = s.topCategory ? `${s.topCategory.emoji} ${s.topCategory.label}` : '—';

    mount.innerHTML = `
      <div class="pro-stat-card">
        <div class="pro-stat-value">${s.thisYear}</div>
        <div class="pro-stat-label">This Year</div>
      </div>
      <div class="pro-stat-card">
        <div class="pro-stat-value">${s.thisMonth}</div>
        <div class="pro-stat-label">This Month</div>
      </div>
      <div class="pro-stat-card">
        <div class="pro-stat-value">${topCatLabel}</div>
        <div class="pro-stat-label">Top Category</div>
      </div>
      <div class="pro-stat-card">
        <div class="pro-stat-value">${s.impactScore}</div>
        <div class="pro-stat-label">Impact Score</div>
      </div>
      <div class="pro-stat-card">
        <div class="pro-stat-value">${s.activeStreak} <span class="pro-stat-unit">mo</span></div>
        <div class="pro-stat-label">Active Streak</div>
      </div>
    `;
  },

  // ──────── Timeline View ────────

  renderTimeline() {
    const mount = document.getElementById('pro-timeline-mount');
    if (!mount) return;
    const year = this.activeYear;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Build months in reverse chronological order (current month first if current year)
    let startMonth = (year === currentYear) ? currentMonth : 11;
    let months = [];
    for (let m = startMonth; m >= 0; m--) {
      months.push(m);
    }

    const allYearEntries = this.getEntriesForYear(year);
    if (allYearEntries.length === 0 && year !== currentYear) {
      mount.innerHTML = `
        <div class="pro-empty-year">
          <i data-lucide="calendar-off"></i>
          <h3>No entries for ${year}</h3>
          <p>Navigate to a different year or add a career entry.</p>
        </div>
      `;
      return;
    }

    let html = '';
    months.forEach(monthIdx => {
      const entries = this.getEntriesForMonth(year, monthIdx)
        .sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));
      const monthName = MONTH_NAMES[monthIdx];
      const isCurrentMonth = (year === currentYear && monthIdx === currentMonth);
      const hasEntries = entries.length > 0;

      html += `
        <div class="pro-month-card ${isCurrentMonth ? 'pro-month-current' : ''} ${hasEntries ? '' : 'pro-month-empty'}" data-month="${monthIdx}">
          <div class="pro-month-header" onclick="ProfessionalEngine.toggleMonth(${monthIdx})">
            <div class="pro-month-header-left">
              <i data-lucide="chevron-down" class="pro-month-chevron" id="pro-chevron-${monthIdx}"></i>
              <h3 class="pro-month-title">${monthName} ${year}</h3>
              ${isCurrentMonth ? '<span class="pro-current-badge">Current</span>' : ''}
            </div>
            <span class="pro-month-count">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div class="pro-month-body ${hasEntries ? '' : 'pro-month-body-collapsed'}" id="pro-month-body-${monthIdx}">
            ${hasEntries ? entries.map(e => this.renderEntry(e)).join('') : `
              <div class="pro-empty-month">
                <span>No entries for ${monthName}</span>
              </div>
            `}
          </div>
        </div>
      `;
    });

    mount.innerHTML = html;
  },

  renderEntry(entry) {
    const cat = PRO_CATEGORIES[entry.category] || PRO_CATEGORIES.other;
    const impact = IMPACT_CONFIG[entry.impact] || IMPACT_CONFIG.medium;
    const isAuto = entry.type === 'auto';
    const dateObj = new Date(entry.date + 'T00:00:00');
    const dayStr = dateObj.getDate();
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    const tagsHtml = (entry.tags || []).map(t =>
      `<span class="pro-entry-tag">${this.escape(t)}</span>`
    ).join('');

    return `
      <div class="pro-entry ${isAuto ? 'pro-entry-auto' : 'pro-entry-manual'}" data-id="${entry.id}">
        <div class="pro-entry-date-col">
          <span class="pro-entry-day">${dayStr}</span>
          <span class="pro-entry-dayname">${dayName}</span>
        </div>
        <div class="pro-entry-line">
          <div class="pro-entry-dot" style="background:${cat.color};"></div>
        </div>
        <div class="pro-entry-content">
          <div class="pro-entry-top-row">
            <span class="pro-entry-cat-pill" style="background:${cat.bg}; color:${cat.color};">
              ${cat.emoji} ${cat.label}
            </span>
            <span class="pro-entry-impact-dot" title="${impact.label} impact">${impact.dot}</span>
            ${isAuto ? `<span class="pro-entry-source-pill">${entry.sourceLabel || 'Auto'}</span>` : ''}
          </div>
          <h4 class="pro-entry-title">${this.escape(entry.title)}</h4>
          ${entry.description ? `<p class="pro-entry-desc">${this.escape(entry.description)}</p>` : ''}
          <div class="pro-entry-footer">
            <div class="pro-entry-tags">${tagsHtml}</div>
            ${!isAuto ? `
              <div class="pro-entry-actions">
                <button class="pro-entry-action-btn" onclick="ProfessionalEngine.openModal('${entry.id}')" title="Edit">
                  <i data-lucide="pencil"></i>
                </button>
                <button class="pro-entry-action-btn pro-entry-delete-btn" onclick="ProfessionalEngine.confirmDelete('${entry.id}')" title="Delete">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  toggleMonth(monthIdx) {
    const body = document.getElementById(`pro-month-body-${monthIdx}`);
    const chevron = document.getElementById(`pro-chevron-${monthIdx}`);
    if (!body) return;
    body.classList.toggle('pro-month-body-collapsed');
    if (chevron) {
      chevron.style.transform = body.classList.contains('pro-month-body-collapsed') ? 'rotate(-90deg)' : '';
    }
  },

  confirmDelete(id) {
    if (confirm('Delete this career entry?')) {
      this.deleteEntry(id);
      this.render();
      if (typeof Components !== 'undefined' && Components.showToast) {
        Components.showToast('Entry deleted', 'success');
      }
    }
  },

  // ──────── Resume View ────────

  renderResume() {
    const mount = document.getElementById('pro-resume-mount');
    if (!mount) return;
    const allEntries = this.getAllEntries().sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));
    const now = new Date();
    const currentYear = now.getFullYear();

    // Group by year
    const byYear = {};
    allEntries.forEach(e => {
      const y = new Date(e.date + 'T00:00:00').getFullYear();
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(e);
    });
    const years = Object.keys(byYear).sort((a, b) => b - a);

    // Key achievements (high impact)
    const keyAchievements = allEntries.filter(e => e.impact === 'high').slice(0, 8);

    // Projects shipped
    const projects = allEntries.filter(e => e.category === 'project').slice(0, 10);

    // Certifications & learning
    const certsAndLearning = allEntries.filter(e => e.category === 'certification' || e.category === 'learning');

    // Career milestones (promotions, job changes)
    const milestones = allEntries.filter(e => e.category === 'promotion' || e.category === 'job_change');

    // Skills from tags (tag cloud)
    const tagMap = {};
    allEntries.forEach(e => {
      (e.tags || []).forEach(t => {
        const tag = t.toLowerCase();
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 20);

    // Current year stats
    const yearEntries = byYear[currentYear] || [];
    const completedHighImpact = yearEntries.filter(e => e.impact === 'high').length;

    let html = `
      <div class="pro-resume">
        <!-- Professional Summary -->
        <div class="pro-resume-section pro-resume-summary">
          <div class="pro-resume-section-header">
            <i data-lucide="user"></i>
            <h2>Professional Summary</h2>
          </div>
          <div class="pro-resume-summary-content">
            <p>${this.generateSummaryText(yearEntries, currentYear)}</p>
          </div>
        </div>

        <!-- Key Achievements -->
        ${keyAchievements.length > 0 ? `
        <div class="pro-resume-section">
          <div class="pro-resume-section-header">
            <i data-lucide="trophy"></i>
            <h2>Key Achievements</h2>
          </div>
          <div class="pro-resume-list">
            ${keyAchievements.map(e => `
              <div class="pro-resume-item">
                <span class="pro-resume-item-year">${new Date(e.date + 'T00:00:00').getFullYear()}</span>
                <span class="pro-resume-item-dot" style="background:${(PRO_CATEGORIES[e.category] || PRO_CATEGORIES.other).color}"></span>
                <div class="pro-resume-item-content">
                  <strong>${this.escape(e.title)}</strong>
                  ${e.description ? `<span class="pro-resume-item-desc">${this.escape(e.description)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Projects Shipped -->
        ${projects.length > 0 ? `
        <div class="pro-resume-section">
          <div class="pro-resume-section-header">
            <i data-lucide="rocket"></i>
            <h2>Projects Shipped</h2>
          </div>
          <div class="pro-resume-list">
            ${projects.map(e => `
              <div class="pro-resume-item">
                <span class="pro-resume-item-year">${new Date(e.date + 'T00:00:00').getFullYear()}</span>
                <span class="pro-resume-item-dot" style="background:${PRO_CATEGORIES.project.color}"></span>
                <div class="pro-resume-item-content">
                  <strong>${this.escape(e.title)}</strong>
                  ${e.description ? `<span class="pro-resume-item-desc">${this.escape(e.description)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Certifications & Learning -->
        ${certsAndLearning.length > 0 ? `
        <div class="pro-resume-section">
          <div class="pro-resume-section-header">
            <i data-lucide="graduation-cap"></i>
            <h2>Certifications & Learning</h2>
          </div>
          <div class="pro-resume-list">
            ${certsAndLearning.map(e => `
              <div class="pro-resume-item">
                <span class="pro-resume-item-year">${new Date(e.date + 'T00:00:00').getFullYear()}</span>
                <span class="pro-resume-item-dot" style="background:${(PRO_CATEGORIES[e.category] || PRO_CATEGORIES.other).color}"></span>
                <div class="pro-resume-item-content">
                  <strong>${this.escape(e.title)}</strong>
                  ${e.description ? `<span class="pro-resume-item-desc">${this.escape(e.description)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Career Timeline (Milestones) -->
        ${milestones.length > 0 ? `
        <div class="pro-resume-section">
          <div class="pro-resume-section-header">
            <i data-lucide="milestone"></i>
            <h2>Career Milestones</h2>
          </div>
          <div class="pro-resume-milestone-timeline">
            ${milestones.map(e => `
              <div class="pro-resume-milestone">
                <div class="pro-resume-milestone-dot" style="background:${(PRO_CATEGORIES[e.category] || PRO_CATEGORIES.other).color}"></div>
                <div class="pro-resume-milestone-content">
                  <span class="pro-resume-milestone-date">${this.formatDateShort(e.date)}</span>
                  <strong>${this.escape(e.title)}</strong>
                  ${e.description ? `<p>${this.escape(e.description)}</p>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Skills & Expertise -->
        ${topTags.length > 0 ? `
        <div class="pro-resume-section">
          <div class="pro-resume-section-header">
            <i data-lucide="tags"></i>
            <h2>Skills & Expertise</h2>
          </div>
          <div class="pro-resume-tags">
            ${topTags.map(([tag, count]) => `
              <span class="pro-resume-tag" style="--tag-weight: ${Math.min(count / 3, 1)}">
                ${this.escape(tag)}
                <span class="pro-resume-tag-count">${count}</span>
              </span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Year-by-Year Breakdown -->
        <div class="pro-resume-section">
          <div class="pro-resume-section-header">
            <i data-lucide="calendar"></i>
            <h2>Year-by-Year</h2>
          </div>
          ${years.map(y => `
            <div class="pro-resume-year-block">
              <h3 class="pro-resume-year-title">${y}</h3>
              <div class="pro-resume-year-stats">
                <span>${(byYear[y] || []).length} entries</span>
                <span>${(byYear[y] || []).filter(e => e.impact === 'high').length} high-impact</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    mount.innerHTML = html;
  },

  generateSummaryText(yearEntries, year) {
    const count = yearEntries.length;
    if (count === 0) return `No professional entries recorded for ${year} yet. Start adding career milestones to build your dynamic resume.`;

    const highImpact = yearEntries.filter(e => e.impact === 'high').length;
    const categories = [...new Set(yearEntries.map(e => (PRO_CATEGORIES[e.category] || PRO_CATEGORIES.other).label))];
    const catStr = categories.slice(0, 3).join(', ');

    return `In ${year}, recorded <strong>${count}</strong> professional entries across ${catStr}${categories.length > 3 ? ` and ${categories.length - 3} more areas` : ''}. <strong>${highImpact}</strong> high-impact ${highImpact === 1 ? 'achievement' : 'achievements'} documented.`;
  },

  formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  },

  // ──────── Resume Export ────────

  copyResumeMarkdown() {
    const allEntries = this.getAllEntries().sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));
    const now = new Date();
    const currentYear = now.getFullYear();

    let md = `# Professional Summary\n\n`;
    const yearEntries = allEntries.filter(e => new Date(e.date + 'T00:00:00').getFullYear() === currentYear);
    md += `${yearEntries.length} professional entries in ${currentYear}.\n\n`;

    // Key achievements
    const keyAch = allEntries.filter(e => e.impact === 'high');
    if (keyAch.length) {
      md += `## Key Achievements\n\n`;
      keyAch.forEach(e => {
        md += `- **${e.title}** (${new Date(e.date + 'T00:00:00').getFullYear()})${e.description ? ' — ' + e.description : ''}\n`;
      });
      md += '\n';
    }

    // Projects
    const projects = allEntries.filter(e => e.category === 'project');
    if (projects.length) {
      md += `## Projects Shipped\n\n`;
      projects.forEach(e => {
        md += `- **${e.title}** (${this.formatDateShort(e.date)})${e.description ? ' — ' + e.description : ''}\n`;
      });
      md += '\n';
    }

    // Certifications
    const certs = allEntries.filter(e => e.category === 'certification' || e.category === 'learning');
    if (certs.length) {
      md += `## Certifications & Learning\n\n`;
      certs.forEach(e => {
        md += `- **${e.title}** (${this.formatDateShort(e.date)})\n`;
      });
      md += '\n';
    }

    // Skills
    const tagMap = {};
    allEntries.forEach(e => (e.tags || []).forEach(t => { tagMap[t.toLowerCase()] = (tagMap[t.toLowerCase()] || 0) + 1; }));
    const topTags = Object.keys(tagMap).sort((a, b) => tagMap[b] - tagMap[a]).slice(0, 15);
    if (topTags.length) {
      md += `## Skills & Expertise\n\n${topTags.join(', ')}\n\n`;
    }

    md += `---\n*Generated by Tesseract on ${now.toLocaleDateString()}*\n`;

    navigator.clipboard.writeText(md).then(() => {
      if (typeof Components !== 'undefined' && Components.showToast) {
        Components.showToast('Resume copied to clipboard', 'success');
      }
    }).catch(() => {
      if (typeof Components !== 'undefined' && Components.showToast) {
        Components.showToast('Failed to copy', 'error');
      }
    });
  }
};

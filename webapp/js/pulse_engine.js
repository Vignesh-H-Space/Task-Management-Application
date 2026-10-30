/**
 * Tesseract Executive Pulse Engine
 * Ultra-fast micro-reflections & daily observations:
 * - Career & Work (Win, Lesson, Feedback, Setback, Observation)
 * - Personal & Life (Kindness, Growth, Connection, Mistake, Observation)
 * 
 * Clean timeline stream, quick-capture console, date grouping,
 * instant search, category filtering, pin/delete actions, and E2EE cloud sync.
 */

const PULSE_STORAGE_KEY = 'tesseract_pulse_data';

const PULSE_CATEGORIES = {
  career: {
    key: 'career',
    label: 'Career & Work',
    icon: 'briefcase',
    color: '#3b82f6',
    subcategories: {
      win: { key: 'win', label: 'Win', icon: 'trophy', color: '#60a5fa' },
      lesson: { key: 'lesson', label: 'Lesson', icon: 'lightbulb', color: '#fbbf24' },
      feedback: { key: 'feedback', label: 'Feedback', icon: 'message-square', color: '#a78bfa' },
      setback: { key: 'setback', label: 'Setback', icon: 'alert-triangle', color: '#f87171' },
      observation: { key: 'observation', label: 'Observation', icon: 'eye', color: '#38bdf8' }
    }
  },
  personal: {
    key: 'personal',
    label: 'Personal & Life',
    icon: 'user',
    color: '#10b981',
    subcategories: {
      kindness: { key: 'kindness', label: 'Kindness', icon: 'heart', color: '#ec4899' },
      growth: { key: 'growth', label: 'Growth', icon: 'trending-up', color: '#34d399' },
      connection: { key: 'connection', label: 'Connection', icon: 'users', color: '#818cf8' },
      mistake: { key: 'mistake', label: 'Mistake', icon: 'zap-off', color: '#fb923c' },
      observation: { key: 'observation', label: 'Observation', icon: 'eye', color: '#2dd4bf' }
    }
  }
};

const PulseEngine = {
  entries: [],
  activeFilter: 'all', // 'all' | 'career' | 'personal' | 'pinned'
  searchQuery: '',
  selectedCategory: 'career',
  selectedSubcategory: 'win',
  selectedDate: null, // null means today, or 'YYYY-MM-DD'
  editingId: null,

  /**
   * Initialize Pulse Engine
   */
  init() {
    this.load();
    this.bindEvents();
    this.render();
  },

  /**
   * Load stored pulses from localStorage
   */
  load() {
    try {
      const raw = localStorage.getItem(PULSE_STORAGE_KEY);
      this.entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.entries)) this.entries = [];
    } catch (err) {
      console.error('Error loading Pulse data:', err);
      this.entries = [];
    }
  },

  /**
   * Save pulses to localStorage and trigger cloud sync
   */
  save() {
    try {
      localStorage.setItem(PULSE_STORAGE_KEY, JSON.stringify(this.entries));
      if (typeof SyncEngine !== 'undefined' && typeof SyncEngine.queuePush === 'function') {
        SyncEngine.queuePush();
      }
    } catch (err) {
      console.error('Error saving Pulse data:', err);
    }
  },

  /**
   * Bind event listeners for capture form and filters
   */
  bindEvents() {
    const input = document.getElementById('pulse-text-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submitPulse();
        }
      });
    }

    const searchInput = document.getElementById('pulse-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTimeline();
      });
    }
  },

  /**
   * Switch the active category on the quick capture bar
   */
  setCaptureCategory(categoryKey) {
    if (!PULSE_CATEGORIES[categoryKey]) return;
    this.selectedCategory = categoryKey;
    const subKeys = Object.keys(PULSE_CATEGORIES[categoryKey].subcategories);
    this.selectedSubcategory = subKeys[0] || 'observation';
    this.renderCaptureConsole();
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  },

  /**
   * Switch the selected subcategory on the quick capture bar
   */
  setCaptureSubcategory(subKey) {
    const cat = PULSE_CATEGORIES[this.selectedCategory];
    if (cat && cat.subcategories[subKey]) {
      this.selectedSubcategory = subKey;
      const pills = document.querySelectorAll('.pulse-subcat-pill');
      if (pills && pills.length > 0) {
        pills.forEach(p => {
          p.classList.remove('active', 'career', 'personal');
          if (p.getAttribute('data-sub') === subKey || (p.getAttribute('onclick') && p.getAttribute('onclick').includes(`'${subKey}'`))) {
            p.classList.add('active', this.selectedCategory);
          }
        });
      } else {
        this.renderCaptureConsole();
      }
    }
  },

  getTodayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  setCaptureDate(mode, customVal) {
    const todayStr = this.getTodayStr();
    const yesterdayStr = this.getYesterdayStr();

    if (mode === 'today') {
      this.selectedDate = null;
    } else if (mode === 'yesterday') {
      this.selectedDate = yesterdayStr;
    } else if (mode === 'custom' && customVal) {
      this.selectedDate = customVal;
    }

    this.renderDateSelectorUI();
  },

  openCustomDatePicker() {
    const picker = document.getElementById('pulse-date-picker');
    if (picker) {
      if (typeof picker.showPicker === 'function') {
        try {
          picker.showPicker();
          return;
        } catch (e) {
      console.warn('[Pulse] Handled exception:', e);
    }
      }
      picker.focus();
      picker.click();
    }
  },

  onCustomDateChange(val) {
    if (!val) return;
    this.setCaptureDate('custom', val);
  },

  resetCaptureDate() {
    this.selectedDate = null;
    const picker = document.getElementById('pulse-date-picker');
    if (picker) picker.value = '';
    this.renderDateSelectorUI();
    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast('Reset capture date to Today', 'info');
    }
  },

  renderDateSelectorUI() {
    const todayBtn = document.getElementById('pulse-date-btn-today');
    const yestBtn = document.getElementById('pulse-date-btn-yesterday');
    const customBtn = document.getElementById('pulse-date-btn-custom');
    const customLabel = document.getElementById('pulse-custom-date-label');
    const noticeEl = document.getElementById('pulse-date-notice');
    const picker = document.getElementById('pulse-date-picker');

    const todayStr = this.getTodayStr();
    const yesterdayStr = this.getYesterdayStr();

    if (picker) {
      picker.max = todayStr; // Keep calendar for today and past dates
    }

    if (!this.selectedDate || this.selectedDate === todayStr) {
      // Today active
      if (todayBtn) todayBtn.classList.add('active');
      if (yestBtn) yestBtn.classList.remove('active');
      if (customBtn) customBtn.classList.remove('active');
      if (customLabel) customLabel.textContent = 'Older Date...';
      if (noticeEl) {
        noticeEl.style.display = 'none';
        noticeEl.innerHTML = '';
      }
    } else if (this.selectedDate === yesterdayStr) {
      // Yesterday active
      if (todayBtn) todayBtn.classList.remove('active');
      if (yestBtn) yestBtn.classList.add('active');
      if (customBtn) customBtn.classList.remove('active');
      if (customLabel) customLabel.textContent = 'Older Date...';
      if (noticeEl) {
        noticeEl.style.display = 'inline-flex';
        noticeEl.innerHTML = `
          <i data-lucide="history"></i>
          <span>Logging for <b>Yesterday</b></span>
          <button type="button" class="btn-reset-pulse-date" onclick="PulseEngine.resetCaptureDate()" title="Switch back to Today">
            <i data-lucide="x"></i> Reset
          </button>
        `;
      }
    } else {
      // Custom older date active
      if (todayBtn) todayBtn.classList.remove('active');
      if (yestBtn) yestBtn.classList.remove('active');
      if (customBtn) customBtn.classList.add('active');

      const parts = this.selectedDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      const now = new Date();
      const diffDays = Math.max(1, Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));

      if (customLabel) customLabel.textContent = formatted;
      if (picker) picker.value = this.selectedDate;

      if (noticeEl) {
        noticeEl.style.display = 'inline-flex';
        noticeEl.innerHTML = `
          <i data-lucide="calendar"></i>
          <span>Logging for <b>${formatted}</b> (${diffDays} days ago)</span>
          <button type="button" class="btn-reset-pulse-date" onclick="PulseEngine.resetCaptureDate()" title="Switch back to Today">
            <i data-lucide="x"></i> Reset
          </button>
        `;
      }
    }

    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  },

  /**
   * Submit new pulse from capture console
   */
  submitPulse() {
    const input = document.getElementById('pulse-text-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    const todayStr = this.getTodayStr();
    const dateStr = this.selectedDate || todayStr;
    const isPastDate = (dateStr !== todayStr);

    let createdAt;
    if (!isPastDate) {
      createdAt = Date.now();
    } else {
      // Set timestamp on that past date matching current time of day
      const now = new Date();
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), now.getHours(), now.getMinutes(), now.getSeconds());
      createdAt = d.getTime();
    }

    const newPulse = {
      id: 'pulse_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      text: text,
      category: this.selectedCategory,
      subcategory: this.selectedSubcategory,
      pinned: false,
      createdAt: createdAt,
      date: dateStr
    };

    this.entries.unshift(newPulse);
    this.save();

    // Clear input
    input.value = '';
    input.focus();

    // Reward XP (+10 XP)
    if (typeof XPEngine !== 'undefined' && typeof XPEngine.addXP === 'function') {
      XPEngine.addXP(10, isPastDate ? 'Retroactive Pulse Recorded' : 'Pulse Recorded');
    }

    // Trigger feedback toast
    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      const catLabel = PULSE_CATEGORIES[newPulse.category]?.label || 'Pulse';
      const subLabel = PULSE_CATEGORIES[newPulse.category]?.subcategories[newPulse.subcategory]?.label || '';
      const dateNotice = isPastDate ? ` for ${dateStr}` : '';
      Components.showToast(`✨ Pulse logged${dateNotice}: ${subLabel ? subLabel + ' • ' : ''}+10 XP`, 'success');
    }

    this.render();
  },

  /**
   * Toggle pinned state for a pulse
   */
  togglePin(id) {
    const pulse = this.entries.find(p => p.id === id);
    if (!pulse) return;
    pulse.pinned = !pulse.pinned;
    this.save();
    this.render();

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast(pulse.pinned ? '📌 Pulse pinned to top' : 'Unpinned pulse', 'info');
    }
  },

  /**
   * Delete a pulse
   */
  deletePulse(id) {
    const idx = this.entries.findIndex(p => p.id === id);
    if (idx === -1) return;

    this.entries.splice(idx, 1);
    this.save();
    this.render();

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast('🗑️ Pulse deleted', 'info');
    }
  },

  /**
   * Start editing a pulse inline
   */
  startEdit(id) {
    this.editingId = id;
    this.renderTimeline();
    setTimeout(() => {
      const editInput = document.getElementById(`pulse-edit-input-${id}`);
      if (editInput) {
        editInput.focus();
        editInput.selectionStart = editInput.selectionEnd = editInput.value.length;
      }
    }, 50);
  },

  /**
   * Cancel editing
   */
  cancelEdit() {
    this.editingId = null;
    this.renderTimeline();
  },

  /**
   * Save edited pulse
   */
  saveEdit(id) {
    const editInput = document.getElementById(`pulse-edit-input-${id}`);
    const subSelect = document.getElementById(`pulse-edit-sub-${id}`);
    const dateInput = document.getElementById(`pulse-edit-date-${id}`);
    if (!editInput) return;

    const newText = editInput.value.trim();
    if (!newText) {
      this.cancelEdit();
      return;
    }

    const pulse = this.entries.find(p => p.id === id);
    if (pulse) {
      pulse.text = newText;
      if (subSelect && subSelect.value) {
        pulse.subcategory = subSelect.value;
      }
      if (dateInput && dateInput.value) {
        const newDate = dateInput.value;
        if (newDate !== pulse.date) {
          pulse.date = newDate;
          const prevTime = new Date(pulse.createdAt || Date.now());
          const parts = newDate.split('-');
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), prevTime.getHours(), prevTime.getMinutes(), prevTime.getSeconds());
          pulse.createdAt = d.getTime();
        }
      }
      this.save();
    }

    this.editingId = null;
    this.render();

    if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
      Components.showToast('Pulse updated', 'success');
    }
  },

  /**
   * Set timeline filter
   */
  setFilter(filterKey) {
    this.activeFilter = filterKey;
    this.renderFilters();
    this.renderTimeline();
  },

  /**
   * Render entire Pulse page
   */
  render() {
    this.renderStats();
    this.renderCaptureConsole();
    this.renderDateSelectorUI();
    this.renderFilters();
    this.renderTimeline();
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Render stats counters in the hero card
   */
  renderStats() {
    const totalEl = document.getElementById('pulse-stat-total');
    const careerEl = document.getElementById('pulse-stat-career');
    const personalEl = document.getElementById('pulse-stat-personal');
    const pinnedEl = document.getElementById('pulse-stat-pinned');

    const total = this.entries.length;
    const careerCount = this.entries.filter(p => p.category === 'career').length;
    const personalCount = this.entries.filter(p => p.category === 'personal').length;
    const pinnedCount = this.entries.filter(p => p.pinned).length;

    if (totalEl) totalEl.textContent = total;
    if (careerEl) careerEl.textContent = careerCount;
    if (personalEl) personalEl.textContent = personalCount;
    if (pinnedEl) pinnedEl.textContent = pinnedCount;
  },

  /**
   * Render quick capture console (category tabs & subcategory pills)
   */
  renderCaptureConsole() {
    const tabsContainer = document.getElementById('pulse-cat-tabs');
    const subContainer = document.getElementById('pulse-subcat-pills');

    if (tabsContainer) {
      tabsContainer.innerHTML = `
        <button type="button" class="pulse-cat-tab ${this.selectedCategory === 'career' ? 'active career' : ''}" onclick="PulseEngine.setCaptureCategory('career')">
          <i data-lucide="briefcase"></i>
          <span>Career & Work</span>
        </button>
        <button type="button" class="pulse-cat-tab ${this.selectedCategory === 'personal' ? 'active personal' : ''}" onclick="PulseEngine.setCaptureCategory('personal')">
          <i data-lucide="user"></i>
          <span>Personal & Life</span>
        </button>
      `;
    }

    if (subContainer) {
      const activeCat = PULSE_CATEGORIES[this.selectedCategory];
      if (activeCat && activeCat.subcategories) {
        subContainer.innerHTML = Object.values(activeCat.subcategories).map(sub => {
          const isSelected = this.selectedSubcategory === sub.key;
          return `
            <button type="button" class="pulse-subcat-pill ${isSelected ? 'active ' + this.selectedCategory : ''}" data-sub="${sub.key}" onclick="PulseEngine.setCaptureSubcategory('${sub.key}')">
              <i data-lucide="${sub.icon}"></i>
              <span>${sub.label}</span>
            </button>
          `;
        }).join('');
      }
    }

    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  },

  /**
   * Render filter pills row
   */
  renderFilters() {
    const container = document.getElementById('pulse-filter-pills');
    if (!container) return;

    const total = this.entries.length;
    const careerCount = this.entries.filter(p => p.category === 'career').length;
    const personalCount = this.entries.filter(p => p.category === 'personal').length;
    const pinnedCount = this.entries.filter(p => p.pinned).length;

    container.innerHTML = `
      <button class="pulse-filter-pill ${this.activeFilter === 'all' ? 'active' : ''}" onclick="PulseEngine.setFilter('all')">
        <span>All Pulses</span>
        <span class="pulse-filter-count">${total}</span>
      </button>
      <button class="pulse-filter-pill filter-career ${this.activeFilter === 'career' ? 'active' : ''}" onclick="PulseEngine.setFilter('career')">
        <i data-lucide="briefcase"></i>
        <span>Career & Work</span>
        <span class="pulse-filter-count">${careerCount}</span>
      </button>
      <button class="pulse-filter-pill filter-personal ${this.activeFilter === 'personal' ? 'active' : ''}" onclick="PulseEngine.setFilter('personal')">
        <i data-lucide="user"></i>
        <span>Personal & Life</span>
        <span class="pulse-filter-count">${personalCount}</span>
      </button>
      <button class="pulse-filter-pill filter-pinned ${this.activeFilter === 'pinned' ? 'active' : ''}" onclick="PulseEngine.setFilter('pinned')">
        <i data-lucide="pin"></i>
        <span>Pinned</span>
        <span class="pulse-filter-count">${pinnedCount}</span>
      </button>
    `;

    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  },

  /**
   * Render timeline grouped by date
   */
  renderTimeline() {
    const container = document.getElementById('pulse-timeline-container');
    if (!container) return;

    let filtered = [...this.entries];

    // Filter by active tab
    if (this.activeFilter === 'career') {
      filtered = filtered.filter(p => p.category === 'career');
    } else if (this.activeFilter === 'personal') {
      filtered = filtered.filter(p => p.category === 'personal');
    } else if (this.activeFilter === 'pinned') {
      filtered = filtered.filter(p => p.pinned);
    }

    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter(p => {
        const textMatch = p.text.toLowerCase().includes(this.searchQuery);
        const catMatch = (p.category || '').toLowerCase().includes(this.searchQuery);
        const subMatch = (p.subcategory || '').toLowerCase().includes(this.searchQuery);
        return textMatch || catMatch || subMatch;
      });
    }

    // If no pulses exist at all
    if (this.entries.length === 0) {
      container.innerHTML = `
        <div class="pulse-empty-state">
          <div class="pulse-empty-icon-wrap">
            <i data-lucide="activity" class="pulse-empty-pulse-icon"></i>
          </div>
          <h3 class="pulse-empty-title">Your Pulse Stream is Empty</h3>
          <p class="pulse-empty-desc">
            Capture quick daily observations, small wins, critical lessons, and feedback as they happen.
            No lengthy journaling — just raw, authentic 1-2 liners.
          </p>
          <div class="pulse-empty-tips">
            <div class="pulse-tip-item">
              <span class="pulse-tip-badge career">Career</span>
              <span>"Delivered client presentation ahead of schedule — partner loved the metrics."</span>
            </div>
            <div class="pulse-tip-item">
              <span class="pulse-tip-badge personal">Personal</span>
              <span>"Resisted impulse purchase; put the savings directly into index funds."</span>
            </div>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    // If filter/search has 0 results
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="pulse-empty-search">
          <i data-lucide="search-x" class="pulse-search-empty-icon"></i>
          <h4>No matching pulses found</h4>
          <p>Try searching for something else or switch filter view.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    // Separate pinned vs standard or group chronologically
    // Sort reverse chronological by createdAt
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Group by Date string
    const groups = {};
    filtered.forEach(item => {
      const dateKey = item.date || new Date(item.createdAt).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    let html = '';

    sortedDates.forEach(dateStr => {
      let dateLabel = dateStr;
      if (dateStr === todayStr) {
        const fullToday = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        dateLabel = `Today · ${fullToday}`;
      } else if (dateStr === yesterdayStr) {
        const fullYesterday = yesterdayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        dateLabel = `Yesterday · ${fullYesterday}`;
      } else {
        try {
          const parts = dateStr.split('-');
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
          dateLabel = dateStr;
        }
      }

      html += `
        <div class="pulse-date-group">
          <div class="pulse-date-header">
            <span class="pulse-date-badge">
              <i data-lucide="calendar"></i>
              <span>${dateLabel}</span>
            </span>
            <div class="pulse-date-line"></div>
            <span class="pulse-date-count">${groups[dateStr].length} ${groups[dateStr].length === 1 ? 'pulse' : 'pulses'}</span>
          </div>
          <div class="pulse-cards-list">
            ${groups[dateStr].map(item => this.renderPulseCard(item)).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Format pulse timestamp into structured date, time, and relative strings
   */
  formatPulseDateTime(pulse) {
    if (!pulse) return { dateStr: '', timeStr: '', fullStr: '', fullDetailedStr: '', relativeStr: '' };
    
    let d;
    if (pulse.createdAt) {
      d = new Date(pulse.createdAt);
    } else if (pulse.date) {
      d = new Date(pulse.date + 'T12:00:00');
    } else {
      d = new Date();
    }
    
    if (isNaN(d.getTime())) d = new Date();

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    let dateStr = '';
    if (isToday) {
      dateStr = 'Today';
    } else if (isYesterday) {
      dateStr = 'Yesterday';
    } else {
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const fullCalendarDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const fullDetailedStr = `${fullCalendarDate} at ${timeStr}`;

    // Relative elapsed time
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    let relativeStr = '';
    if (elapsedSeconds < 60) {
      relativeStr = 'Just now';
    } else if (elapsedSeconds < 3600) {
      const mins = Math.floor(elapsedSeconds / 60);
      relativeStr = `${mins}m ago`;
    } else if (elapsedSeconds < 86400) {
      const hrs = Math.floor(elapsedSeconds / 3600);
      relativeStr = `${hrs}h ago`;
    } else {
      const days = Math.floor(elapsedSeconds / 86400);
      relativeStr = `${days}d ago`;
    }

    return {
      dateStr,
      timeStr,
      fullStr: `${dateStr} · ${timeStr}`,
      fullDetailedStr,
      relativeStr
    };
  },

  /**
   * Render individual Pulse card HTML
   */
  renderPulseCard(pulse) {
    const isEditing = this.editingId === pulse.id;
    const cat = PULSE_CATEGORIES[pulse.category] || PULSE_CATEGORIES.career;
    const sub = cat.subcategories[pulse.subcategory] || { label: pulse.subcategory || 'Note', icon: 'tag', color: '#94a3b8' };
    
    const dt = this.formatPulseDateTime(pulse);

    if (isEditing) {
      return `
        <div class="pulse-card editing ${pulse.category}">
          <div class="pulse-card-edit-header">
            <span class="pulse-cat-badge ${pulse.category}">
              <i data-lucide="${cat.icon}"></i>
              <span>${cat.label}</span>
            </span>
            <select id="pulse-edit-sub-${pulse.id}" class="pulse-edit-sub-select">
              ${Object.values(cat.subcategories).map(s => `
                <option value="${s.key}" ${s.key === pulse.subcategory ? 'selected' : ''}>${s.label}</option>
              `).join('')}
            </select>
            <div class="pulse-edit-date-wrap" title="Change date of this reflection">
              <i data-lucide="calendar" class="pulse-edit-date-icon"></i>
              <input type="date" id="pulse-edit-date-${pulse.id}" class="pulse-edit-date-input" value="${pulse.date || (pulse.createdAt ? new Date(pulse.createdAt).toISOString().split('T')[0] : '')}">
            </div>
          </div>
          <textarea id="pulse-edit-input-${pulse.id}" class="pulse-edit-textarea" rows="2">${this.escapeHTML(pulse.text)}</textarea>
          <div class="pulse-card-edit-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="PulseEngine.cancelEdit()">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="PulseEngine.saveEdit('${pulse.id}')">
              <i data-lucide="check"></i> Save
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="pulse-card ${pulse.category} ${pulse.pinned ? 'is-pinned' : ''}" id="pulse-card-${pulse.id}">
        <div class="pulse-card-top">
          <div class="pulse-card-tags">
            <span class="pulse-cat-badge ${pulse.category}">
              <i data-lucide="${cat.icon}"></i>
              <span>${cat.label}</span>
            </span>
            <span class="pulse-subcat-badge ${pulse.category}">
              <i data-lucide="${sub.icon}"></i>
              <span>${sub.label}</span>
            </span>
            ${pulse.pinned ? `
              <span class="pulse-pinned-indicator" title="Pinned Pulse">
                <i data-lucide="pin"></i>
              </span>
            ` : ''}
          </div>
          <div class="pulse-card-meta">
            <!-- Dedicated prominent Date & Time chip -->
            <div class="pulse-time-pill" title="Recorded: ${dt.fullDetailedStr}">
              <i data-lucide="clock"></i>
              <span class="pulse-time-text">${dt.fullStr}</span>
              <span class="pulse-rel-tag">${dt.relativeStr}</span>
            </div>
            <div class="pulse-action-buttons">
              <button class="pulse-icon-btn ${pulse.pinned ? 'active' : ''}" onclick="PulseEngine.togglePin('${pulse.id}')" title="${pulse.pinned ? 'Unpin' : 'Pin to top'}">
                <i data-lucide="pin"></i>
              </button>
              <button class="pulse-icon-btn" onclick="PulseEngine.startEdit('${pulse.id}')" title="Edit pulse">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="pulse-icon-btn delete-btn" onclick="PulseEngine.deletePulse('${pulse.id}')" title="Delete pulse">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="pulse-card-body">
          <p class="pulse-text">${this.escapeHTML(pulse.text)}</p>
        </div>
        <!-- Bottom Date/Time Info Strip -->
        <div class="pulse-card-footer">
          <span class="pulse-footer-datetime">
            <i data-lucide="calendar"></i>
            <span>Logged on ${dt.fullDetailedStr}</span>
          </span>
          <span class="pulse-footer-rel">${dt.relativeStr}</span>
        </div>
      </div>
    `;
  },


  /**
   * Escape HTML to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Global Exposure
if (typeof window !== 'undefined') {
  window.PulseEngine = PulseEngine;
  window.PULSE_CATEGORIES = PULSE_CATEGORIES;
}

// Auto-initialize when DOM ready
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    // Only init if we are on pulse page
    if (document.getElementById('pulse-timeline-container') || (typeof Components !== 'undefined' && Components.getCurrentPage() === 'pulse')) {
      PulseEngine.init();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PulseEngine, PULSE_CATEGORIES };
}

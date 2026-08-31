/**
 * Tesseract Life's Bucket List Engine
 * Curates lifetime dreams, epic experiences, and summit ambitions with 3 visual states and XP rewards.
 */

const BUCKETLIST_STORAGE_KEY = 'tesseract_bucketlist_data';

const BUCKETLIST_CATEGORIES = {
  travel: { label: 'Travel & Adventure', emoji: '🌍', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  career: { label: 'Career & Mastery', emoji: '🎯', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  health: { label: 'Health & Vitality', emoji: '💪', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  creative: { label: 'Creative & Skills', emoji: '🎨', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  financial: { label: 'Financial Freedom', emoji: '💰', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  relationships: { label: 'Life & Legacy', emoji: '❤️', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)' }
};

const BUCKETLIST_INITIAL_DATA = [
  {
    id: 'bl_01',
    title: 'Witness Northern Lights in Iceland',
    description: 'Camp under the Arctic sky and experience the Aurora Borealis in Reykjavik and Tromsø.',
    category: 'travel',
    status: 'dream',
    priority: 'high',
    targetDate: '2027-12-31',
    achievedDate: null,
    notes: 'Best time: Nov - Feb. Look into glass igloos in Finland as well.',
    emoji: '🌌',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bl_02',
    title: 'Publish a Best-Selling Architecture Book',
    description: 'Synthesize 10 years of system design and executive frameworks into a published physical hardcover.',
    category: 'career',
    status: 'in_progress',
    priority: 'high',
    targetDate: '2028-06-30',
    achievedDate: null,
    notes: 'Draft outline underway in Obsidian. 3 chapters sketched.',
    emoji: '📚',
    createdAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'bl_03',
    title: 'Complete a Full 42.2km Marathon',
    description: 'Train from 10k baseline to cross the finish line of a major marathon (Berlin or Tokyo).',
    category: 'health',
    status: 'in_progress',
    priority: 'medium',
    targetDate: '2027-09-20',
    achievedDate: null,
    notes: 'Currently running 15km weekly cadence.',
    emoji: '🏃',
    createdAt: '2026-02-01T00:00:00.000Z'
  },
  {
    id: 'bl_04',
    title: 'Master Classical Spanish Guitar',
    description: 'Learn to play Recuerdos de la Alhambra and Asturias fluidly by heart.',
    category: 'creative',
    status: 'dream',
    priority: 'low',
    targetDate: '2029-01-01',
    achievedDate: null,
    notes: 'Need to acquire a handcrafted cedar-top classical guitar.',
    emoji: '🎸',
    createdAt: '2026-03-15T00:00:00.000Z'
  },
  {
    id: 'bl_05',
    title: 'Achieve $5M Liquid Financial Freedom',
    description: 'Build automated dividend and asset growth generating complete sovereign freedom.',
    category: 'financial',
    status: 'in_progress',
    priority: 'high',
    targetDate: '2030-12-31',
    achievedDate: null,
    notes: 'Reinvesting monthly surplus across index funds & real estate syndicates.',
    emoji: '💰',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bl_06',
    title: 'Earn Private Pilot License (Helicopter)',
    description: 'Complete 40+ flight hours and solo cross-country flight navigation certification.',
    category: 'travel',
    status: 'dream',
    priority: 'medium',
    targetDate: '2029-07-01',
    achievedDate: null,
    notes: 'Check out flight school packages at regional airfield.',
    emoji: '🚁',
    createdAt: '2026-04-20T00:00:00.000Z'
  }
];

const BUCKETLIST_QUOTES = [
  { text: "The purpose of life is to live it, to taste experience to the utmost, to reach out eagerly and without fear.", author: "Eleanor Roosevelt" },
  { text: "In the end, it's not the years in your life that count. It's the life in your years.", author: "Abraham Lincoln" },
  { text: "Twenty years from now you will be more disappointed by the things that you didn't do than by the ones you did do.", author: "Mark Twain" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "To dare is to lose one's footing momentarily. Not to dare is to lose oneself.", author: "Søren Kierkegaard" }
];

const BucketListEngine = {
  dreams: [],
  currentCategory: 'all',
  currentStatus: 'all',

  init() {
    this.load();
    if (typeof Components !== 'undefined' && Components.getCurrentPage() === 'bucketlist') {
      this.render();
      this.renderQuote();
    }
  },

  load() {
    const saved = localStorage.getItem(BUCKETLIST_STORAGE_KEY);
    if (saved) {
      try {
        this.dreams = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse bucket list data', e);
        this.dreams = [...BUCKETLIST_INITIAL_DATA];
      }
    } else {
      this.dreams = [...BUCKETLIST_INITIAL_DATA];
      this.save();
    }
  },

  save() {
    localStorage.setItem(BUCKETLIST_STORAGE_KEY, JSON.stringify(this.dreams));
  },

  renderQuote() {
    const quoteEl = document.getElementById('bucketlist-quote-text');
    const authorEl = document.getElementById('bucketlist-quote-author');
    if (!quoteEl || !authorEl) return;

    const random = BUCKETLIST_QUOTES[Math.floor(Math.random() * BUCKETLIST_QUOTES.length)];
    quoteEl.textContent = `"${random.text}"`;
    authorEl.textContent = `— ${random.author}`;
  },

  render() {
    this.renderStats();
    this.renderGrid();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderStats() {
    const totalCount = this.dreams.length;
    const achievedCount = this.dreams.filter(d => d.status === 'achieved').length;
    const inProgressCount = this.dreams.filter(d => d.status === 'in_progress').length;
    const dreamCount = this.dreams.filter(d => d.status === 'dream').length;
    const pct = totalCount > 0 ? Math.round((achievedCount / totalCount) * 100) : 0;

    const elTotal = document.getElementById('stat-bl-total');
    const elAchieved = document.getElementById('stat-bl-achieved');
    const elProgress = document.getElementById('stat-bl-progress');
    const elPct = document.getElementById('stat-bl-pct');

    if (elTotal) elTotal.textContent = totalCount;
    if (elAchieved) elAchieved.textContent = achievedCount;
    if (elProgress) elProgress.textContent = inProgressCount;
    if (elPct) elPct.textContent = `${pct}%`;
  },

  renderGrid() {
    const grid = document.getElementById('bucketlist-grid');
    if (!grid) return;

    let filtered = [...this.dreams];

    if (this.currentCategory !== 'all') {
      filtered = filtered.filter(d => d.category === this.currentCategory);
    }

    if (this.currentStatus !== 'all') {
      filtered = filtered.filter(d => d.status === this.currentStatus);
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="bucketlist-empty">
          <div class="empty-icon">🪣</div>
          <h3>No life dreams found in this view</h3>
          <p>Click below to add a new bucket list dream and start forging your lifetime legacy.</p>
          <button class="btn btn-primary" onclick="BucketListEngine.openAddModal();">
            <i data-lucide="plus"></i>
            <span>Add Life Dream</span>
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(dream => {
      const catConfig = BUCKETLIST_CATEGORIES[dream.category] || BUCKETLIST_CATEGORIES.travel;
      const isAchieved = dream.status === 'achieved';
      const isInProgress = dream.status === 'in_progress';

      let statusBadge = '';
      if (isAchieved) {
        statusBadge = `<span class="dream-status-tag achieved" onclick="BucketListEngine.cycleStatus('${dream.id}', event)">✅ Achieved</span>`;
      } else if (isInProgress) {
        statusBadge = `<span class="dream-status-tag in-progress" onclick="BucketListEngine.cycleStatus('${dream.id}', event)">🚀 In Progress</span>`;
      } else {
        statusBadge = `<span class="dream-status-tag dream" onclick="BucketListEngine.cycleStatus('${dream.id}', event)">🔮 Dream</span>`;
      }

      let priorityDot = '';
      if (dream.priority === 'high') priorityDot = '<span class="dream-prio-dot high" title="High Priority"></span>';
      else if (dream.priority === 'medium') priorityDot = '<span class="dream-prio-dot med" title="Medium Priority"></span>';

      return `
        <div class="dream-card ${dream.status}" id="dream-card-${dream.id}">
          <div class="dream-card-top-bar" style="border-top-color: ${catConfig.color};"></div>
          <div class="dream-card-body">
            <div class="dream-header-row">
              <div class="dream-category-pill" style="color: ${catConfig.color}; background: ${catConfig.bg};">
                <span>${catConfig.emoji}</span>
                <span>${catConfig.label}</span>
              </div>
              <div class="dream-header-right">
                ${priorityDot}
                ${statusBadge}
              </div>
            </div>

            <div class="dream-content-row">
              <div class="dream-emoji-box">${dream.emoji || '✨'}</div>
              <div class="dream-text-block">
                <h4 class="dream-title ${isAchieved ? 'strike' : ''}">${escapeHTML(dream.title)}</h4>
                <p class="dream-desc">${escapeHTML(dream.description || '')}</p>
              </div>
            </div>

            ${dream.notes ? `
              <div class="dream-notes-box">
                <i data-lucide="file-text"></i>
                <span>${escapeHTML(dream.notes)}</span>
              </div>
            ` : ''}

            <div class="dream-footer">
              <div class="dream-target-date">
                <i data-lucide="calendar"></i>
                <span>${dream.achievedDate ? `Achieved: ${dream.achievedDate}` : (dream.targetDate ? `Target: ${dream.targetDate.substring(0, 4)}` : 'Lifetime')}</span>
              </div>

              <div class="dream-actions">
                ${!isAchieved ? `
                  <button class="dream-achieve-btn" onclick="BucketListEngine.achieveDream('${dream.id}', event)" title="Mark Achieved (+500 XP)">
                    <i data-lucide="check"></i>
                    <span>Achieve</span>
                  </button>
                ` : ''}
                <button class="dream-icon-btn" onclick="BucketListEngine.openAddModal('${dream.id}', event)" title="Edit Dream">
                  <i data-lucide="edit-3"></i>
                </button>
                <button class="dream-icon-btn delete" onclick="BucketListEngine.deleteDream('${dream.id}', event)" title="Delete">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  setCategoryFilter(category) {
    this.currentCategory = category;
    document.querySelectorAll('.category-pill').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-cat') === category);
    });
    this.render();
  },

  setStatusFilter(status) {
    this.currentStatus = status;
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-status') === status);
    });
    this.render();
  },

  cycleStatus(id, event) {
    if (event) event.stopPropagation();
    const dream = this.dreams.find(d => d.id === id);
    if (!dream) return;

    if (dream.status === 'dream') {
      dream.status = 'in_progress';
      if (typeof XPEngine !== 'undefined') XPEngine.award(10, `🚀 Bucket List: Started "${dream.title}"`);
      if (typeof showToast === 'function') showToast(`🚀 "${dream.title}" moved to In Progress!`, 'info');
    } else if (dream.status === 'in_progress') {
      this.achieveDream(id, event);
      return;
    } else {
      dream.status = 'dream';
      dream.achievedDate = null;
      if (typeof showToast === 'function') showToast(`Reset "${dream.title}" to Dream status.`, 'info');
    }

    this.save();
    this.render();
  },

  achieveDream(id, event) {
    if (event) event.stopPropagation();
    const dream = this.dreams.find(d => d.id === id);
    if (!dream) return;

    dream.status = 'achieved';
    dream.achievedDate = new Date().toISOString().split('T')[0];
    this.save();

    // Award +500 XP Massive Achievement
    if (typeof XPEngine !== 'undefined') {
      XPEngine.award(500, `🏆 LIFE DREAM ACHIEVED: ${dream.title}`);
    }

    if (typeof triggerConfetti === 'function') {
      triggerConfetti();
    }

    if (typeof showToast === 'function') {
      showToast(`🎉 LEGENDARY ACHIEVEMENT! "${dream.title}" marked as Achieved (+500 XP)!`, 'success');
    }

    this.render();
  },

  openAddModal(id = null, event) {
    if (event) event.stopPropagation();

    const modal = document.getElementById('bucketlist-modal');
    const form = document.getElementById('bucketlist-form');
    const titleEl = document.getElementById('bl-modal-title');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('bl-id').value = '';

    if (id) {
      const dream = this.dreams.find(d => d.id === id);
      if (dream) {
        if (titleEl) titleEl.textContent = 'Edit Life Dream';
        document.getElementById('bl-id').value = dream.id;
        document.getElementById('bl-title').value = dream.title || '';
        document.getElementById('bl-description').value = dream.description || '';
        document.getElementById('bl-category').value = dream.category || 'travel';
        document.getElementById('bl-status').value = dream.status || 'dream';
        document.getElementById('bl-priority').value = dream.priority || 'medium';
        document.getElementById('bl-emoji').value = dream.emoji || '✨';
        document.getElementById('bl-target-date').value = dream.targetDate ? dream.targetDate.substring(0, 10) : '';
        document.getElementById('bl-notes').value = dream.notes || '';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Add Life Dream';
      document.getElementById('bl-category').value = this.currentCategory !== 'all' ? this.currentCategory : 'travel';
    }

    modal.style.display = 'flex';
  },

  saveDream(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('bl-id').value;
    const title = document.getElementById('bl-title').value.trim();
    const description = document.getElementById('bl-description').value.trim();
    const category = document.getElementById('bl-category').value;
    const status = document.getElementById('bl-status').value;
    const priority = document.getElementById('bl-priority').value;
    const emoji = document.getElementById('bl-emoji').value.trim() || '✨';
    const targetDate = document.getElementById('bl-target-date').value || null;
    const notes = document.getElementById('bl-notes').value.trim();

    if (!title) {
      if (typeof showToast === 'function') showToast('Please enter a dream title.', 'warning');
      return;
    }

    if (id) {
      const dream = this.dreams.find(d => d.id === id);
      if (dream) {
        dream.title = title;
        dream.description = description;
        dream.category = category;
        dream.status = status;
        dream.priority = priority;
        dream.emoji = emoji;
        dream.targetDate = targetDate;
        dream.notes = notes;
        if (status === 'achieved' && !dream.achievedDate) {
          dream.achievedDate = new Date().toISOString().split('T')[0];
        }
      }
      if (typeof showToast === 'function') showToast(`Updated "${title}"`, 'success');
    } else {
      const newDream = {
        id: `bl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title,
        description,
        category,
        status,
        priority,
        emoji,
        targetDate,
        achievedDate: status === 'achieved' ? new Date().toISOString().split('T')[0] : null,
        notes,
        createdAt: new Date().toISOString()
      };
      this.dreams.unshift(newDream);

      if (typeof XPEngine !== 'undefined') {
        XPEngine.award(5, '🪣 Life Dream Added to Bucket List');
      }
      if (typeof showToast === 'function') showToast(`Added "${title}" to your Bucket List!`, 'success');
    }

    this.save();
    this.closeModal();
    this.render();
  },

  deleteDream(id, event) {
    if (event) event.stopPropagation();
    if (!confirm('Are you sure you want to remove this dream from your bucket list?')) return;

    this.dreams = this.dreams.filter(d => d.id !== id);
    this.save();
    this.render();
    if (typeof showToast === 'function') showToast('Dream removed from Bucket List.', 'info');
  },

  closeModal() {
    const modal = document.getElementById('bucketlist-modal');
    if (modal) modal.style.display = 'none';
  }
};

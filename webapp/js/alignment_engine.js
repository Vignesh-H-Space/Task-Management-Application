/**
 * Tesseract Strategic Alignment Index & Orphan Task Detector Engine
 * Measures how well tactical daily/weekly goals bridge to higher horizons.
 */

const AlignmentEngine = {
  currentTaskId: null,

  getStats() {
    if (typeof state === 'undefined' || !state.tasks) {
      return { totalTactical: 0, linkedCount: 0, orphanCount: 0, score: 100, orphans: [] };
    }

    // Only non-annual tasks require parent alignment (annual goals are top-level pillars)
    const tacticalTasks = state.tasks.filter(t => t.tier !== 'annual');
    const validParentIds = new Set(state.tasks.map(t => t.id));

    const linked = tacticalTasks.filter(t => t.parentId && validParentIds.has(t.parentId));
    const orphans = tacticalTasks.filter(t => !t.parentId || !validParentIds.has(t.parentId));
    const score = tacticalTasks.length > 0 ? Math.round((linked.length / tacticalTasks.length) * 100) : 100;

    return {
      totalTactical: tacticalTasks.length,
      linkedCount: linked.length,
      orphanCount: orphans.length,
      score,
      orphans
    };
  },

  renderAlignmentUI() {
    const stats = this.getStats();

    // Command Hero Quick Metric
    const heroMetricVal = document.getElementById('metric-alignment-score');
    if (heroMetricVal) {
      heroMetricVal.textContent = `${stats.score}%`;
      heroMetricVal.className = 'quick-metric-val';
      if (stats.score >= 90) heroMetricVal.classList.add('text-emerald');
      else if (stats.score >= 70) heroMetricVal.classList.add('text-amber');
      else heroMetricVal.classList.add('text-rose');
    }

    // Analytics Page Metric
    const analyticScore = document.getElementById('analytic-alignment-score');
    if (analyticScore) {
      analyticScore.textContent = `${stats.score}%`;
    }
  },

  openLinkModal(taskId, event) {
    if (event) event.stopPropagation();
    if (typeof state === 'undefined') return;

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.currentTaskId = taskId;

    const modal = document.getElementById('link-parent-modal');
    const targetTitleEl = document.getElementById('link-modal-target-title');
    const targetTierEl = document.getElementById('link-modal-target-tier');
    const listContainer = document.getElementById('link-modal-parent-list');

    if (!modal || !listContainer) return;

    if (targetTitleEl) targetTitleEl.textContent = task.title;
    if (targetTierEl) targetTierEl.textContent = `${task.tier.toUpperCase()} GOAL`;

    // Candidate parent goals: Annual Visions, Quarterly Objectives, Monthly Goals (excluding self)
    const tiersHierarchy = { daily: ['weekly', 'monthly', 'quarterly', 'annual'], weekly: ['monthly', 'quarterly', 'annual'], monthly: ['quarterly', 'annual'], quarterly: ['annual'] };
    const allowedTiers = tiersHierarchy[task.tier] || ['annual', 'quarterly', 'monthly', 'weekly'];

    const candidateParents = state.tasks.filter(t => t.id !== taskId && allowedTiers.includes(t.tier) && !t.completed);

    if (candidateParents.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-parents-note">
          <p>No higher-tier goals available. Create an Annual Vision or Quarterly Objective first!</p>
        </div>
      `;
    } else {
      // Group by tier
      const annualGoals = candidateParents.filter(t => t.tier === 'annual');
      const quarterlyGoals = candidateParents.filter(t => t.tier === 'quarterly');
      const monthlyGoals = candidateParents.filter(t => t.tier === 'monthly');
      const weeklyGoals = candidateParents.filter(t => t.tier === 'weekly');

      let html = '';

      const renderGroup = (title, emoji, items, colorClass) => {
        if (items.length === 0) return '';
        return `
          <div class="parent-picker-group">
            <div class="parent-group-header ${colorClass}">
              <span>${emoji}</span>
              <span>${title}</span>
            </div>
            <div class="parent-items-list">
              ${items.map(p => {
                const isCurrentParent = task.parentId === p.id;
                return `
                  <div class="parent-picker-item ${isCurrentParent ? 'selected' : ''}" onclick="AlignmentEngine.linkParent('${task.id}', '${p.id}');">
                    <div class="parent-item-main">
                      <span class="parent-item-title">${escapeHTML(p.title)}</span>
                      <span class="parent-item-cat">#${p.category} ${p.priority === 'urgent' ? '• 🔴 Urgent' : ''}</span>
                    </div>
                    <button class="btn btn-sm ${isCurrentParent ? 'btn-primary' : 'btn-secondary'}">
                      ${isCurrentParent ? '✓ Connected' : 'Connect'}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      };

      html += renderGroup('Annual Visions (Top North Stars)', '🏆', annualGoals, 'group-annual');
      html += renderGroup('Quarterly Objectives (90-Day Focus)', '🎯', quarterlyGoals, 'group-quarterly');
      html += renderGroup('Monthly Milestones', '🗓️', monthlyGoals, 'group-monthly');
      html += renderGroup('Weekly Deliverables', '📅', weeklyGoals, 'group-weekly');

      listContainer.innerHTML = html;
    }

    modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  linkParent(taskId, parentId) {
    if (typeof state === 'undefined') return;

    const task = state.tasks.find(t => t.id === taskId);
    const parent = state.tasks.find(p => p.id === parentId);
    if (!task || !parent) return;

    const wasOrphan = !task.parentId;
    task.parentId = parentId;

    if (typeof saveData === 'function') saveData();

    this.closeModal();

    if (wasOrphan && typeof XPEngine !== 'undefined') {
      XPEngine.award(15, `🌐 Strategic Alignment Linked: "${task.title.substring(0, 20)}..." → "${parent.title.substring(0, 20)}..."`);
    }

    if (typeof showToast === 'function') {
      showToast(`🎯 Strategic Bridge Established: Linked to "${parent.title}"!`, 'success');
    }

    if (typeof renderAll === 'function') renderAll();
  },

  unlinkParent(taskId, event) {
    if (event) event.stopPropagation();
    if (typeof state === 'undefined') return;

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.parentId = null;
    if (typeof saveData === 'function') saveData();

    if (typeof showToast === 'function') {
      showToast(`Unlinked parent goal from "${task.title}".`, 'info');
    }

    if (typeof renderAll === 'function') renderAll();
  },

  closeModal() {
    const modal = document.getElementById('link-parent-modal');
    if (modal) modal.style.display = 'none';
    this.currentTaskId = null;
  }
};

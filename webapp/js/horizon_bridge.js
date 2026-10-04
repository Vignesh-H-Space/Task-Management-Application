/**
 * Tesseract Horizon-Backlog Bridge Engine
 * Bi-directional synchronization engine connecting Executive Backlogs (BacklogEngine)
 * and Time Horizons (state.tasks).
 */

const HorizonBridge = {
  isSyncing: false,

  // Map Backlog Group to Category for Horizon Tasks
  mapGroupToCategory(group) {
    const map = {
      work: 'Career',
      household: 'Personal',
      physical: 'Health',
      petty: 'Personal',
      tesseract: 'Product',
      other: 'Personal'
    };
    return map[group] || 'Career';
  },

  // Map Category to Backlog Group
  mapCategoryToGroup(cat) {
    const map = {
      'Career': 'work',
      'Engineering': 'work',
      'Product': 'tesseract',
      'Health': 'physical',
      'Finance': 'work',
      'Personal': 'household'
    };
    return map[cat] || 'work';
  },

  // Map Severity to Priority
  mapSeverityToPriority(sev) {
    if (sev === 'high') return 'high';
    if (sev === 'moderate') return 'medium';
    return 'low';
  },

  // Map Priority to Severity
  mapPriorityToSeverity(pri) {
    if (pri === 'urgent' || pri === 'high') return 'high';
    if (pri === 'medium') return 'moderate';
    return 'low';
  },

  // Determine Horizon Tier from Backlog attributes
  determineTierFromBacklog(bkl) {
    if (bkl.horizonTier && ['general', 'daily', 'weekly', 'monthly', 'quarterly', 'annual'].includes(bkl.horizonTier)) {
      return bkl.horizonTier;
    }
    const todayStr = typeof BacklogEngine !== 'undefined' ? BacklogEngine.getTodayStr() : new Date().toISOString().split('T')[0];
    if (bkl.recurrence === 'daily' || bkl.dueDate === todayStr) return 'daily';
    if (bkl.recurrence === 'weekly') return 'weekly';
    if (bkl.recurrence === 'monthly') return 'monthly';
    if (bkl.recurrence === 'quarterly') return 'quarterly';
    if (bkl.recurrence === 'annually' || bkl.recurrence === 'annual') return 'annual';
    
    // Non-recurring undated or general items live in the General / Unscheduled Backlog
    return 'general';
  },

  // ════════════════════════════════════════════════════════════
  // 🔄 FULL BI-DIRECTIONAL INITIALIZATION & AUDIT
  // ════════════════════════════════════════════════════════════

  init() {
    this.syncAll();
  },

  syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Ensure BacklogEngine items exist in state.tasks
      if (typeof BacklogEngine !== 'undefined' && Array.isArray(BacklogEngine.items) && typeof state !== 'undefined' && Array.isArray(state.tasks)) {
        BacklogEngine.items.forEach(bkl => {
          this.syncBacklogItemToState(bkl, false);
        });

        if (typeof saveData === 'function') saveData();
      }
    } finally {
      this.isSyncing = false;
    }
  },

  // ════════════════════════════════════════════════════════════
  // ➡️ BACKLOG -> HORIZON SYNC
  // ════════════════════════════════════════════════════════════

  syncBacklogItemToState(bkl, shouldSave = true) {
    if (!bkl || typeof state === 'undefined' || !Array.isArray(state.tasks)) return;

    let task = state.tasks.find(t => t.backlogId === bkl.id || t.id === 'task_bkl_' + bkl.id);
    const tier = this.determineTierFromBacklog(bkl);
    const isStandalone = ['petty', 'household'].includes(bkl.group);

    if (task) {
      // Update existing horizon task
      task.title = bkl.objective;
      task.tier = tier;
      task.group = bkl.group;
      task.category = task.category || this.mapGroupToCategory(bkl.group);
      task.severity = bkl.severity;
      task.priority = this.mapSeverityToPriority(bkl.severity);
      task.dueDate = bkl.dueDate;
      task.reminderDate = bkl.reminderDate || null;
      task.recurrence = bkl.recurrence;
      task.completed = bkl.completed;
      task.completedAt = bkl.completedAt;
      task.completionCount = bkl.completionCount || 0;
      task.isStandalone = isStandalone;
    } else {
      // Create mirrored horizon task
      task = {
        id: 'task_bkl_' + bkl.id,
        backlogId: bkl.id,
        title: bkl.objective,
        description: '',
        tier: tier,
        group: bkl.group,
        category: this.mapGroupToCategory(bkl.group),
        severity: bkl.severity,
        priority: this.mapSeverityToPriority(bkl.severity),
        createdAt: bkl.createdAt ? (bkl.createdAt.includes('T') ? bkl.createdAt : bkl.createdAt + 'T00:00:00Z') : new Date().toISOString(),
        dueDate: bkl.dueDate,
        reminderDate: bkl.reminderDate || null,
        recurrence: bkl.recurrence || 'none',
        completed: bkl.completed,
        completedAt: bkl.completedAt,
        completionCount: bkl.completionCount || 0,
        isStandalone: isStandalone,
        parentId: null,
        tags: [bkl.group],
        subtasks: []
      };
      state.tasks.unshift(task);
    }

    if (shouldSave) {
      if (typeof saveData === 'function') saveData();
      if (typeof renderAll === 'function') renderAll();
    }
    return task;
  },

  onBacklogItemDeleted(backlogId) {
    if (typeof state === 'undefined' || !Array.isArray(state.tasks)) return;
    const prevLen = state.tasks.length;
    state.tasks = state.tasks.filter(t => t.backlogId !== backlogId && t.id !== 'task_bkl_' + backlogId);
    if (state.tasks.length !== prevLen) {
      if (typeof saveData === 'function') saveData();
      if (typeof renderAll === 'function') renderAll();
    }
  },

  // ════════════════════════════════════════════════════════════
  // ⬅️ HORIZON -> BACKLOG SYNC
  // ════════════════════════════════════════════════════════════

  syncHorizonTaskToBacklog(task, shouldSave = true) {
    if (!task || typeof BacklogEngine === 'undefined' || !Array.isArray(BacklogEngine.items)) return;

    let bkl = BacklogEngine.items.find(b => b.id === task.backlogId || ('task_bkl_' + b.id) === task.id);
    const assignedGroup = task.group || this.mapCategoryToGroup(task.category);
    const assignedSeverity = task.severity || this.mapPriorityToSeverity(task.priority);

    if (bkl) {
      bkl.objective = task.title;
      bkl.group = (typeof BACKLOG_GROUPS !== 'undefined' && BACKLOG_GROUPS[assignedGroup]) ? assignedGroup : 'work';
      bkl.severity = assignedSeverity;
      bkl.dueDate = task.dueDate || null;
      bkl.reminderDate = task.reminderDate || null;
      bkl.recurrence = task.recurrence || (task.tier === 'daily' ? 'daily' : (task.tier === 'weekly' ? 'weekly' : (task.tier === 'monthly' ? 'monthly' : (task.tier === 'quarterly' ? 'quarterly' : (task.tier === 'annual' ? 'annually' : 'none')))));
      bkl.completed = task.completed;
      bkl.completedAt = task.completedAt;
      bkl.horizonTier = task.tier;
    } else {
      const bklId = task.backlogId || ('bkl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
      task.backlogId = bklId;

      bkl = {
        id: bklId,
        objective: task.title,
        group: (typeof BACKLOG_GROUPS !== 'undefined' && BACKLOG_GROUPS[assignedGroup]) ? assignedGroup : 'work',
        severity: assignedSeverity,
        createdAt: task.createdAt ? (task.createdAt.split('T')[0]) : BacklogEngine.getTodayStr(),
        dueDate: task.dueDate || null,
        reminderDate: task.reminderDate || null,
        recurrence: task.recurrence || (task.tier === 'daily' ? 'daily' : (task.tier === 'weekly' ? 'weekly' : (task.tier === 'monthly' ? 'monthly' : (task.tier === 'quarterly' ? 'quarterly' : (task.tier === 'annual' ? 'annually' : 'none'))))),
        completed: task.completed,
        completedAt: task.completedAt,
        completionCount: 0,
        lastCompletedAt: null,
        horizonTier: task.tier
      };
      BacklogEngine.items.unshift(bkl);
    }

    if (shouldSave) {
      BacklogEngine.save();
      const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
      if (page === 'backlogs' || page === 'completed_backlogs') {
        BacklogEngine.render();
      }
    }
    return bkl;
  },

  onHorizonTaskDeleted(task) {
    if (!task || typeof BacklogEngine === 'undefined' || !Array.isArray(BacklogEngine.items)) return;
    const bklId = task.backlogId || task.id.replace('task_bkl_', '');
    const prevLen = BacklogEngine.items.length;
    BacklogEngine.items = BacklogEngine.items.filter(b => b.id !== bklId && b.id !== task.backlogId);
    if (BacklogEngine.items.length !== prevLen) {
      BacklogEngine.save();
      const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
      if (page === 'backlogs' || page === 'completed_backlogs') {
        BacklogEngine.render();
      }
    }
  }
};

// Global Exposure
if (typeof window !== 'undefined') {
  window.HorizonBridge = HorizonBridge;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HorizonBridge };
}

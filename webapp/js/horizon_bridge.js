/**
 * Tesseract Horizon-Backlog Bridge Engine
 * Bi-directional synchronization engine connecting Executive Backlogs (BacklogEngine / tesseract_backlog_data)
 * and Time Horizons & Kanban Board (state.tasks).
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
      // 1. Gather all Backlog items (either from BacklogEngine.items or localStorage)
      let bklItems = [];
      if (typeof BacklogEngine !== 'undefined' && Array.isArray(BacklogEngine.items) && BacklogEngine.items.length > 0) {
        bklItems = BacklogEngine.items;
      } else {
        const raw = localStorage.getItem('tesseract_backlog_data');
        if (raw) {
          try {
            bklItems = JSON.parse(raw);
          } catch (e) {
            console.error('Failed to parse tesseract_backlog_data in HorizonBridge', e);
          }
        }
      }

      // Ensure BacklogEngine items exist in state.tasks
      if (Array.isArray(bklItems) && typeof state !== 'undefined' && Array.isArray(state.tasks)) {
        // Collect current backlog IDs to purge deleted ones from state.tasks
        const validBacklogIds = new Set(bklItems.map(b => b.id));

        // Purge any orphan bridged tasks in state.tasks whose backlog was deleted
        const prevTaskCount = state.tasks.length;
        state.tasks = state.tasks.filter(t => !t.backlogId || validBacklogIds.has(t.backlogId));

        // Sync each backlog item into state.tasks
        bklItems.forEach(bkl => {
          this.syncBacklogItemToState(bkl, false);
        });

        if (typeof saveData === 'function') saveData();
      }
    } finally {
      this.isSyncing = false;
    }
  },

  // ════════════════════════════════════════════════════════════
  // ➡️ BACKLOG -> HORIZON & KANBAN SYNC
  // ════════════════════════════════════════════════════════════

  syncBacklogItemToState(bkl, shouldSave = true) {
    if (!bkl || typeof state === 'undefined' || !Array.isArray(state.tasks)) return;

    let task = state.tasks.find(t => t.backlogId === bkl.id || t.id === 'task_bkl_' + bkl.id);
    const tier = this.determineTierFromBacklog(bkl);
    const isStandalone = ['petty', 'household'].includes(bkl.group);

    // Initial kanban status for backlog items is 'backlog' (unless completed or explicitly moved)
    const initialKanbanStatus = bkl.completed ? 'done' : (bkl.kanbanStatus || 'backlog');

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
      task.recurrence = bkl.recurrence || 'none';
      task.completed = !!bkl.completed;
      task.completedAt = bkl.completedAt || null;
      task.completionCount = bkl.completionCount || 0;
      task.isStandalone = isStandalone;
      task.isBacklog = true;
      task.backlogId = bkl.id;

      if (!task.kanbanStatus) {
        task.kanbanStatus = initialKanbanStatus;
      } else if (bkl.completed && task.kanbanStatus !== 'done') {
        task.kanbanStatus = 'done';
      }
    } else {
      // Create mirrored horizon task
      task = {
        id: 'task_bkl_' + bkl.id,
        backlogId: bkl.id,
        isBacklog: true,
        kanbanStatus: initialKanbanStatus,
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
        completed: !!bkl.completed,
        completedAt: bkl.completedAt || null,
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
  // ⬅️ HORIZON & KANBAN -> BACKLOG SYNC
  // ════════════════════════════════════════════════════════════

  syncHorizonTaskToBacklog(task, shouldSave = true) {
    if (!task) return;

    let bklList = (typeof BacklogEngine !== 'undefined' && Array.isArray(BacklogEngine.items))
      ? BacklogEngine.items
      : null;

    if (!bklList) {
      const raw = localStorage.getItem('tesseract_backlog_data');
      if (raw) {
        try { bklList = JSON.parse(raw); } catch (e) { bklList = []; }
      } else {
        bklList = [];
      }
    }

    let bkl = bklList.find(b => b.id === task.backlogId || ('task_bkl_' + b.id) === task.id);
    const assignedGroup = task.group || this.mapCategoryToGroup(task.category);
    const assignedSeverity = task.severity || this.mapPriorityToSeverity(task.priority);

    if (bkl) {
      bkl.objective = task.title;
      bkl.group = (typeof BACKLOG_GROUPS !== 'undefined' && BACKLOG_GROUPS[assignedGroup]) ? assignedGroup : (bkl.group || 'work');
      bkl.severity = assignedSeverity;
      bkl.dueDate = task.dueDate || null;
      bkl.reminderDate = task.reminderDate || null;
      bkl.recurrence = task.recurrence || bkl.recurrence || 'none';
      bkl.completed = !!task.completed;
      bkl.completedAt = task.completedAt || (task.completed ? new Date().toISOString() : null);
      bkl.kanbanStatus = task.kanbanStatus || (task.completed ? 'done' : 'backlog');
      bkl.horizonTier = task.tier;
    } else {
      const bklId = task.backlogId || ('bkl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
      task.backlogId = bklId;
      task.isBacklog = true;

      bkl = {
        id: bklId,
        objective: task.title,
        group: (typeof BACKLOG_GROUPS !== 'undefined' && BACKLOG_GROUPS[assignedGroup]) ? assignedGroup : 'work',
        severity: assignedSeverity,
        createdAt: task.createdAt ? (task.createdAt.split('T')[0]) : new Date().toISOString().split('T')[0],
        dueDate: task.dueDate || null,
        reminderDate: task.reminderDate || null,
        recurrence: task.recurrence || 'none',
        completed: !!task.completed,
        completedAt: task.completedAt || (task.completed ? new Date().toISOString() : null),
        kanbanStatus: task.kanbanStatus || (task.completed ? 'done' : 'backlog'),
        completionCount: 0,
        lastCompletedAt: null,
        horizonTier: task.tier
      };
      bklList.unshift(bkl);
    }

    if (shouldSave) {
      if (typeof BacklogEngine !== 'undefined' && typeof BacklogEngine.save === 'function') {
        BacklogEngine.items = bklList;
        BacklogEngine.save();
        const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
        if (page === 'backlogs' || page === 'completed_backlogs') {
          BacklogEngine.render();
        }
      } else {
        localStorage.setItem('tesseract_backlog_data', JSON.stringify(bklList));
      }
    }
    return bkl;
  },

  onHorizonTaskDeleted(task) {
    if (!task) return;
    const bklId = task.backlogId || task.id.replace('task_bkl_', '');

    let bklList = (typeof BacklogEngine !== 'undefined' && Array.isArray(BacklogEngine.items))
      ? BacklogEngine.items
      : null;

    if (!bklList) {
      const raw = localStorage.getItem('tesseract_backlog_data');
      if (raw) {
        try { bklList = JSON.parse(raw); } catch (e) { bklList = []; }
      } else {
        bklList = [];
      }
    }

    const prevLen = bklList.length;
    bklList = bklList.filter(b => b.id !== bklId && b.id !== task.backlogId);
    if (bklList.length !== prevLen) {
      if (typeof BacklogEngine !== 'undefined' && typeof BacklogEngine.save === 'function') {
        BacklogEngine.items = bklList;
        BacklogEngine.save();
        const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : '';
        if (page === 'backlogs' || page === 'completed_backlogs') {
          BacklogEngine.render();
        }
      } else {
        localStorage.setItem('tesseract_backlog_data', JSON.stringify(bklList));
      }
    }
  }
};

// Global Exposure
if (typeof window !== 'undefined') {
  window.HorizonBridge = HorizonBridge;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    HorizonBridge.init();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HorizonBridge };
}

/**
 * TESSERACT DATA VAULT & RECOVERY INSPECTOR
 * 
 * Forensic inspection, data loss diagnostics, and 1-click rescue tools:
 * - Scans local storage, memory, and archives
 * - Reconstructs November 2 tasks ("Trim Pubic", "Dumbell Lift")
 * - Bridges backlogs into the active Flight Plan
 * - Prevents cloud sync clobbering by asserting master timestamp
 */

const VaultInspector = {
  /**
   * Run full forensic audit of local storage and memory
   */
  inspect() {
    const memTasks = (typeof state !== 'undefined' && Array.isArray(state.tasks)) ? state.tasks : [];
    
    let storageTasks = [];
    try {
      storageTasks = JSON.parse(localStorage.getItem('tesseract_goals_tasks_data') || '[]');
    } catch (e) {
      console.warn('[VaultInspector] Error reading storage tasks:', e);
    }

    let backlogs = [];
    try {
      backlogs = JSON.parse(localStorage.getItem('tesseract_backlog_data') || '[]');
    } catch (e) {
      console.warn('[VaultInspector] Error reading backlogs:', e);
    }

    let archive = [];
    try {
      archive = JSON.parse(localStorage.getItem('tesseract_daily_completions_archive') || '[]');
    } catch (e) {
      console.warn('[VaultInspector] Error reading archive:', e);
    }

    let preSync = null;
    try {
      const raw = localStorage.getItem('tesseract_pre_sync_safety_backup');
      if (raw) preSync = JSON.parse(raw);
    } catch (e) {
      console.warn('[VaultInspector] Error reading pre-sync backup:', e);
    }

    let pulse = [];
    try {
      pulse = JSON.parse(localStorage.getItem('tesseract_pulse_data') || '[]');
    } catch (e) {
      console.warn('[VaultInspector] Error reading pulse:', e);
    }

    const report = {
      timestamp: new Date().toISOString(),
      tasksInMemory: memTasks.length,
      tasksInStorage: storageTasks.length,
      backlogsInStorage: backlogs.length,
      archiveInStorage: archive.length,
      hasPreSyncBackup: !!preSync,
      pulseEntries: pulse.length,
      activeTasks: memTasks.map(t => ({ id: t.id, title: t.title, tier: t.tier, dueDate: t.dueDate, completed: !!t.completed })),
      backlogItems: backlogs.map(b => ({ id: b.id, title: b.objective, group: b.group, dueDate: b.dueDate, completed: !!b.completed }))
    };

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 TESSERACT DATA VAULT FORENSIC AUDIT:');
    console.table({
      'Tasks in Memory': report.tasksInMemory,
      'Tasks in LocalStorage': report.tasksInStorage,
      'Backlog Items': report.backlogsInStorage,
      'Archived Completions': report.archiveInStorage,
      'Pulse Reflections': report.pulseEntries,
      'Pre-Sync Safety Backup': report.hasPreSyncBackup ? 'Found' : 'None'
    });
    console.log('Active Tasks Preview:', report.activeTasks);
    console.log('Backlog Items Preview:', report.backlogItems);
    console.log('═══════════════════════════════════════════════════════');

    return report;
  },

  /**
   * 1-Click Rescue of November 2 tasks ("Trim Pubic", "Dumbell Lift")
   */
  restoreNov2Tasks() {
    try {
      const currentTasks = (typeof state !== 'undefined' && Array.isArray(state.tasks)) ? [...state.tasks] : [];
      const taskMap = new Map();
      currentTasks.forEach(t => { if (t && t.id) taskMap.set(t.id, t); });

      // Core November 2 goals
      const nov2Goals = [
        {
          id: 'bkl_trim_pubic_nov2',
          title: 'Trim Pubic',
          category: 'Health',
          group: 'physical',
          tier: 'daily',
          priority: 'high',
          severity: 'high',
          dueDate: '2026-11-02',
          completed: true,
          completedAt: '2026-11-02T21:30:00.000Z',
          updatedAt: Date.now(),
          recurrence: 'none'
        },
        {
          id: 'bkl_dumbell_lift_nov2',
          title: 'Dumbell Lift',
          category: 'Health',
          group: 'physical',
          tier: 'daily',
          priority: 'high',
          severity: 'high',
          dueDate: '2026-11-05',
          completed: false,
          updatedAt: Date.now(),
          recurrence: 'weekly'
        }
      ];

      // Re-add to backlogs if missing
      try {
        const bklRaw = localStorage.getItem('tesseract_backlog_data');
        let bkls = bklRaw ? JSON.parse(bklRaw) : [];
        if (!Array.isArray(bkls)) bkls = [];
        
        const existingBklTitles = new Set(bkls.map(b => (b.objective || '').trim().toLowerCase()));
        if (!existingBklTitles.has('trim pubic')) {
          bkls.unshift({
            id: 'bkl_trim_pubic_nov2',
            objective: 'Trim Pubic',
            group: 'physical',
            severity: 'high',
            dueDate: '2026-11-02',
            completed: true,
            completedAt: '2026-11-02T21:30:00.000Z',
            recurrence: 'none',
            createdAt: '2026-11-02T10:00:00.000Z'
          });
        }
        if (!existingBklTitles.has('dumbell lift')) {
          bkls.unshift({
            id: 'bkl_dumbell_lift_nov2',
            objective: 'Dumbell Lift',
            group: 'physical',
            severity: 'high',
            dueDate: '2026-11-05',
            completed: false,
            recurrence: 'weekly',
            createdAt: '2026-11-02T10:00:00.000Z'
          });
        }
        localStorage.setItem('tesseract_backlog_data', JSON.stringify(bkls));
        if (typeof BacklogEngine !== 'undefined') BacklogEngine.items = bkls;
      } catch (e) {
        console.warn('[VaultInspector] Backlog rescue error:', e);
      }

      // Add to task map
      nov2Goals.forEach(g => {
        taskMap.set(g.id, g);
      });

      const finalTasks = Array.from(taskMap.values());
      if (typeof state !== 'undefined') state.tasks = finalTasks;
      localStorage.setItem('tesseract_goals_tasks_data', JSON.stringify(finalTasks));

      // Assert master timestamp forward (+24 hours) so remote devices cannot clobber
      const masterTimestamp = Date.now() + 86400000;
      localStorage.setItem('tesseract_sync_last_local_modified', String(masterTimestamp));
      localStorage.setItem('tesseract_sync_last_remote_updated', String(masterTimestamp));

      if (typeof SyncEngine !== 'undefined' && typeof SyncEngine.pushNow === 'function') {
        SyncEngine.hasInitialPullCompleted = true;
        SyncEngine.pushNow();
      }

      if (typeof renderAll === 'function') renderAll();
      if (typeof renderFlightPlanView === 'function') renderFlightPlanView();
      this.closeModal();

      if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
        Components.showToast('🎉 Rescued November 2 tasks! "Trim Pubic" & "Dumbell Lift" restored.', 'success');
      }
      return true;
    } catch (err) {
      console.error('[VaultInspector] Rescue failed:', err);
      if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
        Components.showToast('Rescue error: ' + err.message, 'error');
      }
      return false;
    }
  },

  /**
   * Resync active tasks from Backlogs table
   */
  resyncFromBacklogs() {
    try {
      if (typeof HorizonBridge !== 'undefined' && typeof HorizonBridge.syncAll === 'function') {
        HorizonBridge.syncAll();
      }
      if (typeof renderAll === 'function') renderAll();
      this.closeModal();
      if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
        Components.showToast('✅ Synchronized active flight plan from Backlogs table', 'success');
      }
      return true;
    } catch (e) {
      console.error('[VaultInspector] Backlog resync error:', e);
      return false;
    }
  },

  /**
   * Restore full seed roadmap (35 goals)
   */
  restoreSeedRoadmap() {
    if (typeof INITIAL_TASKS !== 'undefined' && Array.isArray(INITIAL_TASKS)) {
      if (typeof state !== 'undefined') state.tasks = [...INITIAL_TASKS];
      localStorage.setItem('tesseract_goals_tasks_data', JSON.stringify(INITIAL_TASKS));
      if (typeof saveData === 'function') saveData();
      if (typeof renderAll === 'function') renderAll();
      this.closeModal();
      if (typeof Components !== 'undefined' && typeof Components.showToast === 'function') {
        Components.showToast('🚀 Restored complete 35-goal master roadmap!', 'success');
      }
    }
  },

  /**
   * Open the interactive diagnostic modal
   */
  openModal() {
    const existing = document.getElementById('vault-inspector-modal');
    if (existing) existing.remove();

    const report = this.inspect();

    const modalHTML = `
      <div class="modal-backdrop" id="vault-inspector-modal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;" onclick="if(event.target === this) VaultInspector.closeModal();">
        <div class="ritual-modal-card" style="max-width: 620px; width: 92%; max-height: 85vh; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">🔍</span>
              <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); font-family: var(--font-heading);">Data Vault Forensic Inspector</h3>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">Direct browser memory & storage status report</span>
              </div>
            </div>
            <button class="modal-close-btn" onclick="VaultInspector.closeModal();" style="background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid var(--border-subtle);">
              <span style="font-size: 1.4rem; font-weight: 700; color: var(--accent-primary); display: block;">${report.tasksInMemory}</span>
              <span style="font-size: 0.72rem; color: var(--text-secondary);">Tasks in Memory</span>
            </div>
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid var(--border-subtle);">
              <span style="font-size: 1.4rem; font-weight: 700; color: #10b981; display: block;">${report.backlogsInStorage}</span>
              <span style="font-size: 0.72rem; color: var(--text-secondary);">Backlog Items</span>
            </div>
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid var(--border-subtle);">
              <span style="font-size: 1.4rem; font-weight: 700; color: #f59e0b; display: block;">${report.archiveInStorage}</span>
              <span style="font-size: 0.72rem; color: var(--text-secondary);">Archived Done</span>
            </div>
          </div>

          <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 10px; padding: 14px; margin-bottom: 18px;">
            <strong style="font-size: 0.85rem; color: #93c5fd; display: block; margin-bottom: 4px;">🎯 Forensic Finding:</strong>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
              ${report.tasksInMemory === 0 ? 
                'Your current view has 0 tasks loaded in active memory (possibly due to mobile sync overwrite or strict rolling date filters). You can recover your November 2 work in 1 click below.' :
                `Found ${report.tasksInMemory} tasks in memory and ${report.backlogsInStorage} items in backlogs. If they are hidden on the home page, the 3-day flight plan is filtering for Today / Yesterday only.`
              }
            </p>
          </div>

          <div style="margin-bottom: 18px;">
            <h4 style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin: 0 0 8px 0;">Found Task Records</h4>
            <div style="max-height: 140px; overflow-y: auto; background: var(--bg-input); border-radius: 8px; border: 1px solid var(--border-color); padding: 8px 12px;">
              ${report.activeTasks.length > 0 ? 
                report.activeTasks.map(t => `
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; padding: 4px 0; border-bottom: 1px solid var(--border-subtle);">
                    <span style="color: var(--text-primary); font-weight: 500;">${t.completed ? '✅' : '⏳'} ${t.title}</span>
                    <span style="color: var(--text-muted); font-size: 0.7rem;">${t.dueDate || t.tier}</span>
                  </div>
                `).join('') :
                '<span style="color: var(--text-muted); font-size: 0.75rem;">No tasks currently stored in active task list.</span>'
              }
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button type="button" class="btn btn-warning" onclick="VaultInspector.restoreNov2Tasks()" style="width: 100%; justify-content: center; padding: 10px; font-weight: 600;">
              <span>🔄 Recover November 2 Tasks ("Trim Pubic" & "Dumbell Lift")</span>
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary" onclick="VaultInspector.resyncFromBacklogs()" style="flex: 1; justify-content: center; font-size: 0.78rem;">
                <span>Resync from Backlogs Table</span>
              </button>
              <button type="button" class="btn btn-secondary" onclick="VaultInspector.restoreSeedRoadmap()" style="flex: 1; justify-content: center; font-size: 0.78rem;">
                <span>Restore 35 Seed Goals</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeModal() {
    const modal = document.getElementById('vault-inspector-modal');
    if (modal) modal.remove();
  }
};

// Global Exposure
if (typeof window !== 'undefined') {
  window.VaultInspector = VaultInspector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VaultInspector };
}

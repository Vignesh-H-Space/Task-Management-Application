/**
 * Tesseract Eisenhower Matrix View
 * Urgent / Important 4-quadrant strategic prioritization system.
 */

const EISENHOWER_QUADRANTS = [
  { id: 'q1', label: 'DO FIRST', subtitle: 'Urgent & Important', emoji: '🔴', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)', border: 'rgba(239, 68, 68, 0.30)' },
  { id: 'q2', label: 'SCHEDULE', subtitle: 'Not Urgent & Important', emoji: '🔵', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)', border: 'rgba(59, 130, 246, 0.30)' },
  { id: 'q3', label: 'DELEGATE', subtitle: 'Urgent & Not Important', emoji: '🟡', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.30)' },
  { id: 'q4', label: 'ELIMINATE', subtitle: 'Not Urgent & Not Important', emoji: '⚪', color: '#64748b', bg: 'rgba(100, 116, 139, 0.06)', border: 'rgba(100, 116, 139, 0.25)' }
];

function classifyTaskQuadrant(task) {
  // Important = urgent or high priority, or quarterly/annual tier
  const isImportant = ['urgent', 'high'].includes(task.priority) || ['quarterly', 'annual'].includes(task.tier);
  // Urgent = urgent priority, or daily tier, or has due date within 3 days
  let isUrgent = task.priority === 'urgent' || task.tier === 'daily';
  if (!isUrgent && task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) isUrgent = true;
  }

  if (isUrgent && isImportant) return 'q1'; // Do First
  if (!isUrgent && isImportant) return 'q2'; // Schedule
  if (isUrgent && !isImportant) return 'q3'; // Delegate
  return 'q4'; // Eliminate
}

function renderEisenhowerMatrix() {
  const container = document.getElementById('eisenhower-matrix-container');
  if (!container) return;

  const tasksList = (typeof state !== 'undefined' && state.tasks) ? state.tasks : [];
  let activeTasks = tasksList.filter(t => !t.completed);
  if (typeof state !== 'undefined' && state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    activeTasks = activeTasks.filter(t => {
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchTags = (t.tags || []).some(tg => tg.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCat || matchTags;
    });
  }

  const quadrantTasks = { q1: [], q2: [], q3: [], q4: [] };
  activeTasks.forEach(t => {
    const q = classifyTaskQuadrant(t);
    quadrantTasks[q].push(t);
  });

  const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => s);
  const tiersList = typeof TIERS !== 'undefined' ? TIERS : [];

  container.innerHTML = EISENHOWER_QUADRANTS.map(q => {
    const tasks = quadrantTasks[q.id];
    const otherQuadrants = EISENHOWER_QUADRANTS.filter(oq => oq.id !== q.id);
    return `
      <div class="em-quadrant" data-quadrant="${q.id}" style="background: ${q.bg}; border-color: ${q.border};">
        <div class="em-quadrant-header" style="border-bottom-color: ${q.border};">
          <div class="em-quadrant-title">
            <span class="em-quadrant-emoji">${q.emoji}</span>
            <div>
              <span class="em-quadrant-label" style="color: ${q.color};">${q.label}</span>
              <span class="em-quadrant-sub">${q.subtitle}</span>
            </div>
          </div>
          <span class="em-quadrant-count" style="color: ${q.color};">${tasks.length}</span>
        </div>
        <div class="em-quadrant-body" id="em-body-${q.id}">
          ${tasks.length === 0 ? `<div class="em-empty">No tasks in this quadrant</div>` :
            tasks.map(t => {
              const tierObj = tiersList.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task' };
              return `
                <div class="em-task-card" data-id="${t.id}">
                  <div class="em-task-top">
                    <input type="checkbox" class="custom-checkbox em-chk" id="em-chk-${t.id}" onclick="toggleTaskCompletion('${t.id}')" aria-label="Complete">
                    <div class="em-task-info">
                      <div class="em-task-title">${esc(t.title)}</div>
                      <div class="em-task-meta">
                        <span class="em-tier-pill" style="color: ${tierObj.color || 'var(--text-muted)'}">${tierObj.emoji} ${tierObj.name}</span>
                        <span class="em-prio-pill em-prio-${t.priority}">${t.priority}</span>
                      </div>
                    </div>
                  </div>
                  <div class="em-task-actions">
                    <div class="em-move-dropdown">
                      <button class="em-move-btn" title="Move to quadrant">
                        <i data-lucide="move"></i>
                      </button>
                      <div class="em-move-menu">
                        ${otherQuadrants.map(oq => `
                          <button class="em-move-option" onclick="moveTaskToQuadrant('${t.id}', '${oq.id}', event)" style="color: ${oq.color};">
                            ${oq.emoji} ${oq.label}
                          </button>
                        `).join('')}
                      </div>
                    </div>
                    <button class="em-edit-btn" onclick="openEditModal('${t.id}')" title="Edit">
                      <i data-lucide="edit-3"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Bind drag-and-drop for Eisenhower quadrants
  if (typeof DragDropEngine !== 'undefined') {
    setTimeout(() => DragDropEngine.bindMatrixView(), 50);
  }
}

function moveTaskToQuadrant(taskId, quadrantId, event) {
  if (event) event.stopPropagation();
  if (typeof state === 'undefined' || !state.tasks) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Adjust priority and tier to match target quadrant classification
  switch (quadrantId) {
    case 'q1': // Urgent & Important — set urgent priority, daily tier
      task.priority = 'urgent';
      if (!['daily', 'weekly'].includes(task.tier)) task.tier = 'daily';
      break;
    case 'q2': // Not Urgent & Important — high priority, keep or move to monthly+
      task.priority = 'high';
      if (['daily'].includes(task.tier)) task.tier = 'weekly';
      break;
    case 'q3': // Urgent & Not Important — medium priority, daily tier
      task.priority = 'medium';
      if (!['daily'].includes(task.tier)) task.tier = 'daily';
      break;
    case 'q4': // Not Urgent & Not Important — low priority
      task.priority = 'low';
      if (['daily'].includes(task.tier)) task.tier = 'weekly';
      break;
  }

  if (typeof saveData === 'function') saveData();
  renderEisenhowerMatrix();
  if (typeof showToast === 'function') {
    const qLabel = EISENHOWER_QUADRANTS.find(q => q.id === quadrantId);
    showToast(`${qLabel.emoji} Moved "${task.title.substring(0, 25)}..." to ${qLabel.label}`, 'success');
  }
}

// Global exports
window.EISENHOWER_QUADRANTS = EISENHOWER_QUADRANTS;
window.classifyTaskQuadrant = classifyTaskQuadrant;
window.renderEisenhowerMatrix = renderEisenhowerMatrix;
window.moveTaskToQuadrant = moveTaskToQuadrant;

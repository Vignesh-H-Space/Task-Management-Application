/**
 * Tesseract Drag & Drop Engine
 * Smooth drag-and-drop reordering for task lists and Eisenhower matrix quadrants.
 * Pure vanilla JS — zero external libraries.
 */

const DragDropEngine = {
  draggedEl: null,
  draggedTaskId: null,
  placeholder: null,
  sourceContainer: null,
  isDragging: false,
  touchStartY: 0,
  touchStartX: 0,
  touchOffsetX: 0,
  touchOffsetY: 0,
  longPressTimer: null,

  init() {
    // Will be called after renderAll to bind drag handles to task cards
  },

  /**
   * Attach drag-and-drop to all .tasks-grid containers (list view)
   * and .em-quadrant-body containers (Eisenhower matrix)
   */
  bindListView() {
    const grids = document.querySelectorAll('.tasks-grid');
    grids.forEach(grid => this.makeContainerSortable(grid, 'list'));
  },

  bindMatrixView() {
    const quadrants = document.querySelectorAll('.em-quadrant-body');
    quadrants.forEach(qBody => this.makeContainerSortable(qBody, 'matrix'));
  },

  makeContainerSortable(container, mode) {
    const cards = mode === 'list'
      ? container.querySelectorAll('.task-card')
      : container.querySelectorAll('.em-task-card');

    cards.forEach(card => {
      card.setAttribute('draggable', 'true');
      card.classList.add('draggable-task');

      // --- Mouse Drag Events ---
      card.addEventListener('dragstart', (e) => this.handleDragStart(e, card, container, mode));
      card.addEventListener('dragend', (e) => this.handleDragEnd(e, mode));

      // --- Touch Events (Mobile) ---
      card.addEventListener('touchstart', (e) => this.handleTouchStart(e, card, container, mode), { passive: false });
      card.addEventListener('touchmove', (e) => this.handleTouchMove(e, container, mode), { passive: false });
      card.addEventListener('touchend', (e) => this.handleTouchEnd(e, mode), { passive: false });
    });

    // Container drop zone events
    container.addEventListener('dragover', (e) => this.handleDragOver(e, container, mode));
    container.addEventListener('drop', (e) => this.handleDrop(e, container, mode));
    container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
  },

  // ── Mouse: Drag Start ────────────────────────────────────
  handleDragStart(e, card, container, mode) {
    // Don't drag if clicking interactive elements
    if (e.target.closest('input, button, select, textarea, .action-btn, .em-move-dropdown')) {
      e.preventDefault();
      return;
    }

    this.isDragging = true;
    this.draggedEl = card;
    this.draggedTaskId = card.getAttribute('data-id');
    this.sourceContainer = container;

    card.classList.add('dragging');

    // Ghost image
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.draggedTaskId);

      // Custom ghost
      const ghost = card.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.width = card.offsetWidth + 'px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => ghost.remove(), 0);
    }
  },

  // ── Mouse: Drag Over ─────────────────────────────────────
  handleDragOver(e, container, mode) {
    e.preventDefault();
    if (!this.isDragging) return;

    e.dataTransfer.dropEffect = 'move';

    const cardSelector = mode === 'list' ? '.task-card' : '.em-task-card';
    const afterElement = this.getDragAfterElement(container, e.clientY, cardSelector);
    const draggingEl = this.draggedEl;

    if (!draggingEl) return;

    if (afterElement == null) {
      container.appendChild(draggingEl);
    } else {
      container.insertBefore(draggingEl, afterElement);
    }
  },

  // ── Mouse: Drop ──────────────────────────────────────────
  handleDrop(e, container, mode) {
    e.preventDefault();
    if (!this.isDragging || !this.draggedEl) return;

    this.draggedEl.classList.remove('dragging');

    if (mode === 'list') {
      this.commitListReorder(container);
    } else if (mode === 'matrix') {
      this.commitMatrixMove(container);
    }

    this.cleanup();
  },

  handleDragEnd(e, mode) {
    if (this.draggedEl) {
      this.draggedEl.classList.remove('dragging');
    }
    this.cleanup();
  },

  handleDragLeave(e) {
    // Optional: visual feedback
  },

  // ── Touch: Start ─────────────────────────────────────────
  handleTouchStart(e, card, container, mode) {
    // Don't drag if touching interactive elements
    if (e.target.closest('input, button, select, textarea, .action-btn, .em-move-dropdown')) {
      return;
    }

    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;

    // Long press to initiate drag on mobile (200ms)
    this.longPressTimer = setTimeout(() => {
      this.isDragging = true;
      this.draggedEl = card;
      this.draggedTaskId = card.getAttribute('data-id');
      this.sourceContainer = container;

      const rect = card.getBoundingClientRect();
      this.touchOffsetX = touch.clientX - rect.left;
      this.touchOffsetY = touch.clientY - rect.top;

      card.classList.add('dragging', 'touch-dragging');

      // Haptic feedback (vibration API)
      if (navigator.vibrate) navigator.vibrate(30);
    }, 200);
  },

  // ── Touch: Move ──────────────────────────────────────────
  handleTouchMove(e, container, mode) {
    // Cancel long press if moved too much before timer
    if (!this.isDragging && this.longPressTimer) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - this.touchStartX);
      const dy = Math.abs(touch.clientY - this.touchStartY);
      if (dx > 10 || dy > 10) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      return;
    }

    if (!this.isDragging || !this.draggedEl) return;
    e.preventDefault();

    const touch = e.touches[0];
    const cardSelector = mode === 'list' ? '.task-card' : '.em-task-card';

    // Find which container the touch is over (for matrix cross-quadrant drops)
    let targetContainer = container;
    if (mode === 'matrix') {
      const touchTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      const qBody = touchTarget ? touchTarget.closest('.em-quadrant-body') : null;
      if (qBody) targetContainer = qBody;
    }

    const afterElement = this.getDragAfterElement(targetContainer, touch.clientY, cardSelector);

    if (afterElement == null) {
      targetContainer.appendChild(this.draggedEl);
    } else {
      targetContainer.insertBefore(this.draggedEl, afterElement);
    }
  },

  // ── Touch: End ───────────────────────────────────────────
  handleTouchEnd(e, mode) {
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;

    if (!this.isDragging || !this.draggedEl) return;

    this.draggedEl.classList.remove('dragging', 'touch-dragging');

    // Determine which container the card ended up in
    const finalContainer = this.draggedEl.closest(
      mode === 'list' ? '.tasks-grid' : '.em-quadrant-body'
    );

    if (mode === 'list') {
      this.commitListReorder(finalContainer || this.sourceContainer);
    } else if (mode === 'matrix') {
      this.commitMatrixMove(finalContainer || this.sourceContainer);
    }

    this.cleanup();
  },

  // ── Get insertion point based on Y position ──────────────
  getDragAfterElement(container, y, selector) {
    const elements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];

    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  // ── Commit: List View Reorder (persist new order) ────────
  commitListReorder(container) {
    if (!container) return;

    // Get new order of task IDs from DOM
    const cards = container.querySelectorAll('.task-card');
    const newOrderIds = [...cards].map(c => c.getAttribute('data-id')).filter(Boolean);

    if (newOrderIds.length === 0) return;

    // Reorder state.tasks to match new order within this tier group
    // Collect the tier of first card to know which group was reordered
    const firstTask = (typeof state !== 'undefined') ? state.tasks.find(t => t.id === newOrderIds[0]) : null;
    if (!firstTask) return;

    const tier = firstTask.tier;
    const tierTaskIds = state.tasks.filter(t => t.tier === tier).map(t => t.id);

    // Build new full task array: keep non-tier tasks in place, reorder tier tasks
    const nonTierTasks = state.tasks.filter(t => t.tier !== tier);
    const reorderedTierTasks = newOrderIds
      .filter(id => tierTaskIds.includes(id))
      .map(id => state.tasks.find(t => t.id === id))
      .filter(Boolean);

    // Merge: insert reordered tier tasks at the position of the first original tier task
    const firstTierIndex = state.tasks.findIndex(t => t.tier === tier);
    const result = [...state.tasks.filter(t => t.tier !== tier)];
    result.splice(Math.min(firstTierIndex, result.length), 0, ...reorderedTierTasks);

    state.tasks = result;
    if (typeof saveData === 'function') saveData();
    if (typeof showToast === 'function') showToast('Task order updated', 'info');
  },

  // ── Commit: Matrix View Move (change quadrant) ───────────
  commitMatrixMove(container) {
    if (!container || !this.draggedTaskId) return;

    // Determine which quadrant the card was dropped into
    const quadrantEl = container.closest('.em-quadrant');
    if (!quadrantEl) return;

    const targetQuadrant = quadrantEl.getAttribute('data-quadrant');
    if (!targetQuadrant) return;

    // Use the existing moveTaskToQuadrant function
    if (typeof moveTaskToQuadrant === 'function') {
      moveTaskToQuadrant(this.draggedTaskId, targetQuadrant);
    }
  },

  cleanup() {
    this.isDragging = false;
    this.draggedEl = null;
    this.draggedTaskId = null;
    this.sourceContainer = null;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }
};

// Auto-initialize
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    DragDropEngine.init();
  });
}

/**
 * Tesseract Touch Gesture Optimization Engine
 * Pure Vanilla JS — Zero External Dependencies
 * 
 * Features:
 * 1. Pull-to-Refresh:
 *    - Native-feeling elastic resistance curve at top of viewport
 *    - Glassmorphism Onyx & Gold indicator with rotational arrow and spinning loader
 *    - Tactile haptic feedback (Vibration API) on threshold trigger
 *    - Synchronous re-fetching and UI re-render across all 7 pages
 * 
 * 2. Swipe Navigation:
 *    - Edge-Swipe Drawer: Swipe right from screen bezel (<35px) to open mobile sidebar; swipe left to close
 *    - Horizon Carousel Swipe: On index.html, swipe left/right to navigate between time horizons
 *    - Cadence Tab Swipe: On report.html, swipe left/right between Weekly, Monthly, Yearly debriefs
 * 
 * 3. Intelligent Conflict Resolution:
 *    - Automatically ignores gestures on inputs, textareas, modals, and horizontal scroll zones (Kanban, Heatmap)
 *    - Prevents collision with DragDropEngine long-press task reordering
 */

const TouchEngine = {
  isInitialized: false,
  isPulling: false,
  isRefreshing: false,
  pullStartY: 0,
  pullStartX: 0,
  currentPullDistance: 0,
  ptrThreshold: 60,
  ptrMaxDistance: 80,
  hapticTriggered: false,

  // Swipe Nav State
  swipeStartX: 0,
  swipeStartY: 0,
  swipeStartTime: 0,
  isEdgeSwipe: false,

  // Horizons for index.html swipe
  horizons: ['general', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'all'],
  // Cadences for report.html swipe
  cadences: ['weekly', 'monthly', 'yearly'],

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Ensure indicator exists in DOM
    this.ensurePtrIndicator();

    // Bind touch events
    this.bindPullToRefresh();
    this.bindSwipeNavigation();
    this.bindModalSheetGestures();
  },

  /**
   * Inject the Pull-to-Refresh Indicator if not already present
   */
  ensurePtrIndicator() {
    if (document.getElementById('ptr-indicator')) return;

    const ptrHTML = `
      <div id="ptr-indicator" class="ptr-indicator" aria-hidden="true">
        <div class="ptr-inner">
          <svg class="ptr-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
          <div class="ptr-spinner"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', ptrHTML);
  },

  /**
   * Pull to Refresh Engine
   */
  bindPullToRefresh() {
    const indicator = document.getElementById('ptr-indicator');
    const arrow = indicator ? indicator.querySelector('.ptr-arrow') : null;

    window.addEventListener('touchstart', (e) => {
      // Only single touch
      if (e.touches.length !== 1 || this.isRefreshing) return;

      // Only initiate if at the very top of page
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollY > 5) return;

      // Ignore if touching interactive or scrollable sub-elements
      if (this.isInteractiveElement(e.target)) return;

      const touch = e.touches[0];
      this.pullStartY = touch.clientY;
      this.pullStartX = touch.clientX;
      this.isPulling = true;
      this.currentPullDistance = 0;
      this.hapticTriggered = false;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!this.isPulling || this.isRefreshing) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - this.pullStartY;
      const deltaX = touch.clientX - this.pullStartX;

      // If user is scrolling horizontally or upwards, cancel PTR
      if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
        if (this.currentPullDistance > 0) {
          this.resetPtrIndicator();
        }
        return;
      }

      // Check current scroll position
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollY > 5) {
        this.resetPtrIndicator();
        this.isPulling = false;
        return;
      }

      // Elastic logarithmic resistance curve
      const resistanceFactor = 0.45;
      const rawDistance = deltaY * resistanceFactor;
      this.currentPullDistance = Math.min(rawDistance, this.ptrMaxDistance);

      if (!indicator) return;

      indicator.classList.add('active');
      indicator.style.transform = `translate(-50%, ${-75 + this.currentPullDistance * 1.15}px)`;
      indicator.style.opacity = Math.min(this.currentPullDistance / 35, 1).toString();

      // Rotate arrow
      if (arrow) {
        const rotation = Math.min((this.currentPullDistance / this.ptrThreshold) * 180, 180);
        arrow.style.transform = `rotate(${rotation}deg)`;
      }

      // Threshold reached feedback
      if (this.currentPullDistance >= this.ptrThreshold) {
        indicator.classList.add('threshold-met');
        if (!this.hapticTriggered) {
          this.hapticTriggered = true;
          if (navigator.vibrate) navigator.vibrate(22);
        }
      } else {
        indicator.classList.remove('threshold-met');
        this.hapticTriggered = false;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (!this.isPulling || this.isRefreshing) return;
      this.isPulling = false;

      if (this.currentPullDistance >= this.ptrThreshold) {
        this.triggerRefresh();
      } else {
        this.resetPtrIndicator();
      }
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      if (!this.isRefreshing) {
        this.isPulling = false;
        this.resetPtrIndicator();
      }
    }, { passive: true });
  },

  /**
   * Reset PTR Indicator to hidden state
   */
  resetPtrIndicator() {
    const indicator = document.getElementById('ptr-indicator');
    if (!indicator) return;

    indicator.classList.remove('active', 'threshold-met', 'refreshing');
    indicator.style.transform = '';
    indicator.style.opacity = '';
    const arrow = indicator.querySelector('.ptr-arrow');
    if (arrow) arrow.style.transform = '';
    this.currentPullDistance = 0;
    this.hapticTriggered = false;
  },

  /**
   * Execute pull-to-refresh reload and trigger data resync
   */
  triggerRefresh() {
    const indicator = document.getElementById('ptr-indicator');
    if (!indicator) return;

    this.isRefreshing = true;
    indicator.classList.remove('threshold-met');
    indicator.classList.add('refreshing');
    indicator.style.transform = 'translate(-50%, 16px)';
    indicator.style.opacity = '1';

    // Haptic confirmation
    if (navigator.vibrate) navigator.vibrate([15, 30, 20]);

    // Perform page-specific data refresh
    this.refreshCurrentPageData().then(() => {
      setTimeout(() => {
        this.isRefreshing = false;
        indicator.classList.add('refresh-complete');
        
        // Show executive confirmation toast
        if (typeof showToast === 'function') {
          showToast('⚡ Command Center Synchronized', 'success');
        }

        setTimeout(() => {
          indicator.classList.remove('refresh-complete');
          this.resetPtrIndicator();
        }, 400);
      }, 550);
    });
  },

  /**
   * Re-fetches local data and re-renders active page components
   */
  async refreshCurrentPageData() {
    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';

    // Common data reload
    if (typeof loadData === 'function') loadData();
    if (typeof loadStreak === 'function') loadStreak();
    if (typeof loadProfile === 'function') loadProfile();

    if (page === 'index') {
      if (typeof renderAll === 'function') renderAll();
      if (typeof HabitsEngine !== 'undefined' && typeof HabitsEngine.renderWidget === 'function') HabitsEngine.renderWidget();
      if (typeof XPEngine !== 'undefined' && typeof XPEngine.renderQuestBoard === 'function') XPEngine.renderQuestBoard();
      if (typeof RitualsEngine !== 'undefined' && typeof RitualsEngine.renderMorningBanner === 'function') RitualsEngine.renderMorningBanner();
      if (typeof DragDropEngine !== 'undefined') {
        DragDropEngine.bindListView();
        DragDropEngine.bindMatrixView();
      }
    } else if (page === 'report' && typeof ReportEngine !== 'undefined' && typeof ReportEngine.init === 'function') {
      ReportEngine.init();
    } else if (page === 'roadmap' && typeof RoadmapEngine !== 'undefined' && typeof RoadmapEngine.init === 'function') {
      RoadmapEngine.init();
    } else if (page === 'bucketlist' && typeof BucketListEngine !== 'undefined' && typeof BucketListEngine.init === 'function') {
      BucketListEngine.init();
    } else if (page === 'analytics' && typeof renderAll === 'function') {
      renderAll();
    } else if (page === 'profile' && typeof renderAll === 'function') {
      renderAll();
    } else if (page === 'cascade' && typeof renderAll === 'function') {
      renderAll();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Swipe Navigation Engine (Edge Drawer + Horizon/Cadence Swiping)
   */
  bindSwipeNavigation() {
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      this.swipeStartX = touch.clientX;
      this.swipeStartY = touch.clientY;
      this.swipeStartTime = Date.now();

      // Check if starting near left bezel for drawer open (< 36px)
      this.isEdgeSwipe = this.swipeStartX <= 36;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.swipeStartX;
      const deltaY = touch.clientY - this.swipeStartY;
      const elapsedTime = Date.now() - this.swipeStartTime;

      // Ignore slow drags (> 650ms)
      if (elapsedTime > 650) return;

      // Require horizontal dominance (|deltaX| > 1.4 * |deltaY|)
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;

      // Ignore if touched an interactive component (e.g. inputs, modals)
      const target = document.elementFromPoint(touch.clientX, touch.clientY) || e.target;
      if (this.isInteractiveElement(target)) return;

      // Check if sidebar is currently open
      const sidebar = document.getElementById('app-sidebar');
      const isSidebarOpen = sidebar && sidebar.classList.contains('mobile-open');

      // ── Gesture 1: Edge-Swipe Drawer Open (Left -> Right from edge) ──
      if (this.isEdgeSwipe && deltaX > 55 && !isSidebarOpen) {
        if (typeof Components !== 'undefined') {
          Components.toggleMobileSidebar();
          if (navigator.vibrate) navigator.vibrate(25);
        }
        return;
      }

      // ── Gesture 2: Sidebar Close Swipe (Right -> Left when open) ──
      if (isSidebarOpen && deltaX < -50) {
        if (typeof Components !== 'undefined') {
          Components.closeMobileSidebar();
          if (navigator.vibrate) navigator.vibrate(20);
        }
        return;
      }

      // ── Gesture 3: In-Page Content Swiping ───────────────────────
      // If drawer is closed, allow horizontal content swiping if outside scrollable containers
      if (!isSidebarOpen && !this.isInHorizontalScrollContainer(target)) {
        this.handleContentSwipe(deltaX);
      }
    }, { passive: true });
  },

  /**
   * Handle horizontal content swiping on index.html and report.html
   */
  handleContentSwipe(deltaX) {
    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';

    // ── Index.html: Horizon Swiping ──
    if (page === 'index' && typeof setHorizonFilter === 'function' && typeof state !== 'undefined') {
      const currentHorizon = state.activeHorizon || 'general';
      const currentIndex = this.horizons.indexOf(currentHorizon);

      if (currentIndex !== -1) {
        if (deltaX < -70 && currentIndex < this.horizons.length - 1) {
          // Swipe Left -> Next Horizon
          const nextHorizon = this.horizons[currentIndex + 1];
          setHorizonFilter(nextHorizon);
          if (navigator.vibrate) navigator.vibrate(20);
          this.showSwipeHorizonFeedback(nextHorizon);
        } else if (deltaX > 70 && currentIndex > 0) {
          // Swipe Right -> Previous Horizon
          const prevHorizon = this.horizons[currentIndex - 1];
          setHorizonFilter(prevHorizon);
          if (navigator.vibrate) navigator.vibrate(20);
          this.showSwipeHorizonFeedback(prevHorizon);
        }
      }
      return;
    }

    // ── Report.html: Cadence Tab Swiping ──
    if (page === 'report' && typeof ReportEngine !== 'undefined' && typeof ReportEngine.switchCadence === 'function') {
      const currentCadence = ReportEngine.currentCadence || 'weekly';
      const currentIdx = this.cadences.indexOf(currentCadence);

      if (currentIdx !== -1) {
        if (deltaX < -70 && currentIdx < this.cadences.length - 1) {
          const nextCadence = this.cadences[currentIdx + 1];
          ReportEngine.switchCadence(nextCadence);
          if (navigator.vibrate) navigator.vibrate(20);
        } else if (deltaX > 70 && currentIdx > 0) {
          const prevCadence = this.cadences[currentIdx - 1];
          ReportEngine.switchCadence(prevCadence);
          if (navigator.vibrate) navigator.vibrate(20);
        }
      }
    }
  },

  /**
   * Subtle toast/feedback when swiping horizons on index.html
   */
  showSwipeHorizonFeedback(horizon) {
    const labels = {
      general: '🏠 Executive Overview',
      daily: '🌅 Daily Tasks',
      weekly: '📅 Weekly Milestones',
      monthly: '🗓️ Monthly Goals',
      quarterly: '🎯 Quarterly Objectives',
      annual: '🏆 Annual Vision',
      all: '🌐 All Horizons'
    };
    if (typeof showToast === 'function') {
      showToast(labels[horizon] || horizon, 'info');
    }
  },

  /**
   * Check if element is interactive (inputs, buttons, modal, palette, dragging task)
   */
  isInteractiveElement(el) {
    if (!el || !(el instanceof Element)) return false;
    return !!el.closest(
      'input, textarea, select, button, .modal-card, .command-palette-card, .touch-dragging, .dragging, .action-btn'
    );
  },

  /**
   * Check if element is inside a container that relies on native horizontal scrolling
   */
  isInHorizontalScrollContainer(el) {
    if (!el || !(el instanceof Element)) return false;
    return !!el.closest(
      '.kanban-board-container, .kanban-board, .kanban-column-body, .timeline-matrix-container, .heatmap-matrix-table, .progress-summary-grid'
    );
  },

  /**
   * Mobile Bottom Sheet Touch Gestures (Swipe down on grabber bar to dismiss)
   */
  bindModalSheetGestures() {
    let sheetStartY = 0;
    let activeSheet = null;

    document.addEventListener('touchstart', (e) => {
      const grabber = e.target.closest('.sheet-grabber-bar, .sheet-grabber-pill');
      if (grabber) {
        const modal = grabber.closest('.modal-backdrop');
        if (modal && modal.style.display !== 'none') {
          sheetStartY = e.touches[0].clientY;
          activeSheet = modal;
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!activeSheet) return;
      const endY = e.changedTouches[0].clientY;
      const deltaY = endY - sheetStartY;
      if (deltaY > 45) {
        // Dragged down to dismiss
        if (activeSheet.id === 'task-modal') {
          if (typeof closeModal === 'function') closeModal();
        } else if (activeSheet.id === 'mobile-tools-sheet') {
          if (typeof Components !== 'undefined') Components.closeMobileToolsSheet();
        } else if (activeSheet.id === 'morning-priming-modal' || activeSheet.id === 'evening-shutdown-modal') {
          if (typeof RitualsEngine !== 'undefined') RitualsEngine.closeModals();
        } else if (activeSheet.id === 'link-parent-modal') {
          if (typeof AlignmentEngine !== 'undefined') AlignmentEngine.closeModal();
        } else {
          activeSheet.style.display = 'none';
        }
        if (navigator.vibrate) navigator.vibrate(20);
      }
      activeSheet = null;
    }, { passive: true });
  }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TouchEngine.init());
} else {
  TouchEngine.init();
}

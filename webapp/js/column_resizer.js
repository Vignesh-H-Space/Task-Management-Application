/**
 * TESSERACT COLUMN RESIZER ENGINE
 * 
 * Interactive, high-precision column resizing and minimizing for tabular views:
 * - Executive Backlogs Table (active & completed)
 * - Routine & Maintenance Tracker Table
 * 
 * Features:
 * - Hover near header boundary reveals resizer divider
 * - Click & drag horizontally to expand, shrink, or minimize column width
 * - Double-click handle to toggle between minimized compact mode and expanded mode
 * - Persists custom column widths to localStorage
 * - Seamless touch & mouse event normalization
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ColumnResizer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN_COL_WIDTH = 45; // Allow compact shrinking / minimizing
  const MAX_COL_WIDTH = 900;

  const ColumnResizer = {
    /**
     * Attach resizable handles to all header columns in a table
     * @param {HTMLTableElement|string} tableRef - Table element or selector
     * @param {string} storageKey - localStorage key to persist column widths
     * @param {Object} [options] - Additional configuration
     */
    attach(tableRef, storageKey, options = {}) {
      if (typeof document === 'undefined') return;

      const table = typeof tableRef === 'string' ? document.querySelector(tableRef) : tableRef;
      if (!table || !table.querySelectorAll) return;

      const thead = table.querySelector('thead');
      if (!thead) return;

      const headers = thead.querySelectorAll('th');
      if (!headers.length) return;

      // Allow flexible table sizing so columns can shrink below initial min-width
      if (table.style) {
        table.style.tableLayout = 'fixed';
        table.style.minWidth = 'auto';
      }

      // Load saved widths from localStorage
      const savedWidths = this.getSavedWidths(storageKey);

      headers.forEach((th, index) => {
        // Unique column key for storage
        const colKey = th.getAttribute('data-col-key') ||
                       th.getAttribute('data-sort-col') ||
                       (th.className ? th.className.trim().split(/\s+/)[0] : `col_${index}`);

        // Ensure relative positioning on the header
        th.style.position = 'relative';
        th.style.boxSizing = 'border-box';

        // Apply saved width if available
        if (savedWidths[colKey]) {
          const w = Math.max(MIN_COL_WIDTH, savedWidths[colKey]);
          th.style.width = `${w}px`;
          th.style.minWidth = `${w}px`;
          th.style.maxWidth = `${w}px`;
        }

        // Avoid duplicate handles
        let handle = th.querySelector('.col-resizer-handle');
        if (!handle) {
          handle = document.createElement('div');
          handle.className = 'col-resizer-handle';
          handle.setAttribute('role', 'separator');
          handle.setAttribute('aria-orientation', 'vertical');
          handle.setAttribute('title', 'Drag to resize column · Double-click to toggle minimize');
          th.appendChild(handle);
        }

        // Attach listeners only once
        if (!handle._hasResizeListener) {
          handle._hasResizeListener = true;
          this.bindResizeEvents(handle, th, table, colKey, storageKey, options);
        }
      });
    },

    /**
     * Bind drag and double-click resize events to a handle
     */
    bindResizeEvents(handle, th, table, colKey, storageKey, options) {
      let startX = 0;
      let startWidth = 0;
      let isDragging = false;
      let initialDefaultWidth = th.offsetWidth || 150;

      // Double-click to toggle minimize / compact mode
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentW = th.offsetWidth;
        const targetW = currentW <= 70 ? initialDefaultWidth : 55;

        th.style.width = `${targetW}px`;
        th.style.minWidth = `${targetW}px`;
        th.style.maxWidth = `${targetW}px`;

        this.saveColumnWidth(storageKey, colKey, targetW);
        this.notifyResize(table, options);
      });

      const onStart = (clientX, e) => {
        if (e.button && e.button !== 0) return;
        isDragging = true;
        startX = clientX;
        startWidth = th.getBoundingClientRect().width;
        if (!initialDefaultWidth) initialDefaultWidth = startWidth;

        handle.classList.add('is-resizing');
        document.body.classList.add('is-col-resizing');

        e.preventDefault();
        e.stopPropagation();

        const onMove = (moveEvent) => {
          if (!isDragging) return;
          const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
          const deltaX = currentX - startX;
          const newWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(startWidth + deltaX)));

          th.style.width = `${newWidth}px`;
          th.style.minWidth = `${newWidth}px`;
          th.style.maxWidth = `${newWidth}px`;

          this.notifyResize(table, options);
        };

        const onEnd = () => {
          if (!isDragging) return;
          isDragging = false;
          handle.classList.remove('is-resizing');
          document.body.classList.remove('is-col-resizing');

          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onEnd);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);

          const finalWidth = Math.round(th.getBoundingClientRect().width);
          this.saveColumnWidth(storageKey, colKey, finalWidth);
          this.notifyResize(table, options);
        };

        window.addEventListener('mousemove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
      };

      // Mouse drag
      handle.addEventListener('mousedown', (e) => onStart(e.clientX, e));

      // Touch drag for tablets / touch screens
      handle.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          onStart(e.touches[0].clientX, e);
        }
      }, { passive: false });
    },

    /**
     * Notify parent controllers of column dimension changes (e.g., to adjust scroll thumbs)
     */
    notifyResize(table, options = {}) {
      if (typeof options.onResize === 'function') {
        try { options.onResize(table); } catch (err) { console.warn('[ColumnResizer] onResize callback error:', err); }
      }
      if (typeof BacklogEngine !== 'undefined' && typeof BacklogEngine.updateTableScrollIndicator === 'function') {
        BacklogEngine.updateTableScrollIndicator();
      }
      if (typeof TrackerEngine !== 'undefined' && typeof TrackerEngine.updateScrollThumb === 'function') {
        TrackerEngine.updateScrollThumb();
      }
    },

    /**
     * Retrieve persisted widths object from localStorage
     */
    getSavedWidths(storageKey) {
      if (!storageKey || typeof localStorage === 'undefined') return {};
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        console.warn('[ColumnResizer] Error reading storage:', e);
        return {};
      }
    },

    /**
     * Persist a column width to localStorage
     */
    saveColumnWidth(storageKey, colKey, width) {
      if (!storageKey || !colKey || typeof localStorage === 'undefined') return;
      try {
        const widths = this.getSavedWidths(storageKey);
        widths[colKey] = width;
        localStorage.setItem(storageKey, JSON.stringify(widths));
      } catch (e) {
        console.warn('[ColumnResizer] Error saving column width:', e);
      }
    },

    /**
     * Reset column widths to defaults
     */
    reset(storageKey, tableRef) {
      if (storageKey && typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
      if (tableRef) {
        const table = typeof tableRef === 'string' ? document.querySelector(tableRef) : tableRef;
        if (table) {
          table.querySelectorAll('th').forEach(th => {
            th.style.width = '';
            th.style.minWidth = '';
            th.style.maxWidth = '';
          });
          this.notifyResize(table);
        }
      }
    }
  };

  return ColumnResizer;
});


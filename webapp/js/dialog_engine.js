/**
 * Tesseract Executive Dialog Engine
 * Production-grade custom modal dialogs replacing native browser alert(), confirm(), and prompt().
 * Features:
 * - Clean glassmorphism & dark/light theme awareness
 * - Non-blocking Promise-based API (async / await)
 * - Accessible keyboard navigation (Tab trap, Enter to submit, Esc to cancel)
 * - Safe HTML escaping to eliminate XSS
 * - Self-injecting styles with zero external CSS dependencies
 */

const TesseractDialog = (() => {
  let styleInjected = false;

  function injectStyles() {
    if (styleInjected || document.getElementById('tesseract-dialog-styles')) {
      styleInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'tesseract-dialog-styles';
    style.textContent = `
      .td-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(8, 10, 15, 0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .td-backdrop.td-visible {
        opacity: 1;
      }
      .td-dialog {
        background: var(--bg-card, #1c1e29);
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(255, 255, 255, 0.04);
        border-radius: 16px;
        width: 100%;
        max-width: 440px;
        overflow: hidden;
        color: var(--text-primary, #f1f5f9);
        font-family: var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        transform: scale(0.94) translateY(8px);
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
      }
      .td-backdrop.td-visible .td-dialog {
        transform: scale(1) translateY(0);
      }
      .td-header {
        padding: 22px 24px 14px 24px;
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }
      .td-icon-badge {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 20px;
      }
      .td-icon-info {
        background: rgba(59, 130, 246, 0.12);
        color: #3b82f6;
        border: 1px solid rgba(59, 130, 246, 0.25);
      }
      .td-icon-danger {
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.25);
      }
      .td-icon-warning {
        background: rgba(245, 158, 11, 0.12);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.25);
      }
      .td-icon-prompt {
        background: rgba(139, 92, 246, 0.12);
        color: #8b5cf6;
        border: 1px solid rgba(139, 92, 246, 0.25);
      }
      .td-title-wrap {
        flex: 1;
        min-width: 0;
      }
      .td-title {
        font-family: var(--font-heading, inherit);
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0 0 6px 0;
        color: var(--text-primary, #f1f5f9);
        line-height: 1.3;
      }
      .td-body {
        padding: 0 24px 20px 24px;
        color: var(--text-secondary, #94a3b8);
        font-size: 0.925rem;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .td-input-wrap {
        padding: 0 24px 20px 24px;
      }
      .td-input {
        width: 100%;
        box-sizing: border-box;
        background: var(--bg-input, #151720);
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
        border-radius: 8px;
        padding: 10px 14px;
        color: var(--text-primary, #f1f5f9);
        font-size: 0.95rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .td-input:focus {
        border-color: var(--accent-primary, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      }
      .td-textarea {
        min-height: 80px;
        resize: vertical;
      }
      .td-error-msg {
        color: #ef4444;
        font-size: 0.8rem;
        margin-top: 6px;
        display: none;
      }
      .td-footer {
        padding: 14px 24px 20px 24px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        background: rgba(0, 0, 0, 0.08);
        border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
      }
      .td-btn {
        padding: 9px 18px;
        border-radius: 8px;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
        font-family: inherit;
      }
      .td-btn:focus-visible {
        outline: 2px solid var(--accent-primary, #3b82f6);
        outline-offset: 2px;
      }
      .td-btn-cancel {
        background: transparent;
        color: var(--text-secondary, #94a3b8);
        border-color: var(--border-color, rgba(255, 255, 255, 0.12));
      }
      .td-btn-cancel:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary, #f1f5f9);
      }
      .td-btn-primary {
        background: var(--accent-primary, #3b82f6);
        color: #ffffff;
      }
      .td-btn-primary:hover {
        background: var(--accent-primary-hover, #2563eb);
      }
      .td-btn-danger {
        background: #ef4444;
        color: #ffffff;
      }
      .td-btn-danger:hover {
        background: #dc2626;
      }
      .td-btn-warning {
        background: #f59e0b;
        color: #111827;
      }
      .td-btn-warning:hover {
        background: #d97706;
      }
      @media (max-width: 480px) {
        .td-dialog {
          max-width: 100%;
          border-radius: 14px;
        }
        .td-footer {
          flex-direction: column-reverse;
          gap: 8px;
        }
        .td-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    styleInjected = true;
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function getVariantIcon(variant) {
    switch (variant) {
      case 'danger':
        return `<div class="td-icon-badge td-icon-danger">✕</div>`;
      case 'warning':
        return `<div class="td-icon-badge td-icon-warning">⚠️</div>`;
      case 'prompt':
        return `<div class="td-icon-badge td-icon-prompt">✏️</div>`;
      case 'info':
      default:
        return `<div class="td-icon-badge td-icon-info">ℹ</div>`;
    }
  }

  function trapFocus(dialogEl) {
    const focusable = dialogEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return () => {};
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    dialogEl.addEventListener('keydown', handleKeyDown);
    return () => dialogEl.removeEventListener('keydown', handleKeyDown);
  }

  function createBackdrop() {
    injectStyles();
    const backdrop = document.createElement('div');
    backdrop.className = 'td-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    return backdrop;
  }

  function showBackdrop(backdrop) {
    document.body.appendChild(backdrop);
    // Force reflow for CSS transition
    backdrop.offsetHeight;
    backdrop.classList.add('td-visible');
  }

  function closeBackdrop(backdrop, resolveVal, resolve) {
    backdrop.classList.remove('td-visible');
    setTimeout(() => {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (typeof resolve === 'function') resolve(resolveVal);
    }, 200);
  }

  return {
    /**
     * Replaces window.alert() with a non-blocking Promise
     * @param {string|object} options Message string or options object
     * @returns {Promise<void>}
     */
    alert(options) {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      const title = opts.title || 'Notification';
      const message = opts.message || '';
      const buttonLabel = opts.buttonLabel || 'OK';
      const variant = opts.variant || 'info';

      return new Promise((resolve) => {
        const backdrop = createBackdrop();
        const iconHtml = getVariantIcon(variant);

        backdrop.innerHTML = `
          <div class="td-dialog">
            <div class="td-header">
              ${iconHtml}
              <div class="td-title-wrap">
                <h3 class="td-title">${escapeHTML(title)}</h3>
              </div>
            </div>
            <div class="td-body">${escapeHTML(message)}</div>
            <div class="td-footer">
              <button type="button" class="td-btn td-btn-primary td-action-ok">${escapeHTML(buttonLabel)}</button>
            </div>
          </div>
        `;

        showBackdrop(backdrop);

        const okBtn = backdrop.querySelector('.td-action-ok');
        const dialog = backdrop.querySelector('.td-dialog');
        const removeTrap = trapFocus(dialog);

        function handleDone() {
          removeTrap();
          document.removeEventListener('keydown', handleKeyDown);
          closeBackdrop(backdrop, undefined, resolve);
        }

        function handleKeyDown(e) {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            handleDone();
          }
        }

        okBtn.addEventListener('click', handleDone);
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) handleDone();
        });
        document.addEventListener('keydown', handleKeyDown);

        setTimeout(() => okBtn.focus(), 50);
      });
    },

    /**
     * Replaces window.confirm() with a non-blocking Promise<boolean>
     * @param {string|object} options Message string or options object
     * @returns {Promise<boolean>}
     */
    confirm(options) {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      const title = opts.title || 'Confirm Action';
      const message = opts.message || '';
      const confirmLabel = opts.confirmLabel || 'Confirm';
      const cancelLabel = opts.cancelLabel || 'Cancel';
      const variant = opts.variant || 'default'; // 'default', 'danger', 'warning'

      return new Promise((resolve) => {
        const backdrop = createBackdrop();
        const iconVariant = variant === 'danger' ? 'danger' : (variant === 'warning' ? 'warning' : 'info');
        const iconHtml = getVariantIcon(iconVariant);
        const confirmBtnClass = variant === 'danger' ? 'td-btn-danger' : (variant === 'warning' ? 'td-btn-warning' : 'td-btn-primary');

        backdrop.innerHTML = `
          <div class="td-dialog">
            <div class="td-header">
              ${iconHtml}
              <div class="td-title-wrap">
                <h3 class="td-title">${escapeHTML(title)}</h3>
              </div>
            </div>
            <div class="td-body">${escapeHTML(message)}</div>
            <div class="td-footer">
              <button type="button" class="td-btn td-btn-cancel td-action-cancel">${escapeHTML(cancelLabel)}</button>
              <button type="button" class="td-btn ${confirmBtnClass} td-action-confirm">${escapeHTML(confirmLabel)}</button>
            </div>
          </div>
        `;

        showBackdrop(backdrop);

        const cancelBtn = backdrop.querySelector('.td-action-cancel');
        const confirmBtn = backdrop.querySelector('.td-action-confirm');
        const dialog = backdrop.querySelector('.td-dialog');
        const removeTrap = trapFocus(dialog);

        function cleanup() {
          removeTrap();
          document.removeEventListener('keydown', handleKeyDown);
        }

        function handleConfirm() {
          cleanup();
          closeBackdrop(backdrop, true, resolve);
        }

        function handleCancel() {
          cleanup();
          closeBackdrop(backdrop, false, resolve);
        }

        function handleKeyDown(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
          }
        }

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) handleCancel();
        });
        document.addEventListener('keydown', handleKeyDown);

        setTimeout(() => {
          if (variant === 'danger') {
            cancelBtn.focus(); // Safety default for destructive actions
          } else {
            confirmBtn.focus();
          }
        }, 50);
      });
    },

    /**
     * Replaces window.prompt() with a non-blocking Promise<string|null>
     * @param {string|object} options Message string or options object
     * @param {string} [defaultVal] Fallback default value if first arg is string
     * @returns {Promise<string|null>}
     */
    prompt(options, defaultVal = '') {
      const opts = typeof options === 'string'
        ? { message: options, defaultValue: defaultVal }
        : (options || {});
      const title = opts.title || 'Input Required';
      const message = opts.message || '';
      const placeholder = opts.placeholder || '';
      const defaultValue = opts.defaultValue !== undefined ? String(opts.defaultValue) : '';
      const inputType = opts.inputType || 'text'; // 'text', 'number', 'password', 'textarea'
      const confirmLabel = opts.confirmLabel || 'Save';
      const cancelLabel = opts.cancelLabel || 'Cancel';
      const validator = opts.validator || null; // fn(val): string|null (error message)

      return new Promise((resolve) => {
        const backdrop = createBackdrop();
        const iconHtml = getVariantIcon('prompt');
        const isTextarea = inputType === 'textarea';

        backdrop.innerHTML = `
          <div class="td-dialog">
            <div class="td-header">
              ${iconHtml}
              <div class="td-title-wrap">
                <h3 class="td-title">${escapeHTML(title)}</h3>
              </div>
            </div>
            ${message ? `<div class="td-body">${escapeHTML(message)}</div>` : ''}
            <div class="td-input-wrap">
              ${isTextarea
                ? `<textarea class="td-input td-textarea td-input-field" placeholder="${escapeHTML(placeholder)}">${escapeHTML(defaultValue)}</textarea>`
                : `<input type="${escapeHTML(inputType)}" class="td-input td-input-field" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(defaultValue)}" />`
              }
              <div class="td-error-msg td-input-error"></div>
            </div>
            <div class="td-footer">
              <button type="button" class="td-btn td-btn-cancel td-action-cancel">${escapeHTML(cancelLabel)}</button>
              <button type="button" class="td-btn td-btn-primary td-action-confirm">${escapeHTML(confirmLabel)}</button>
            </div>
          </div>
        `;

        showBackdrop(backdrop);

        const inputField = backdrop.querySelector('.td-input-field');
        const errorEl = backdrop.querySelector('.td-input-error');
        const cancelBtn = backdrop.querySelector('.td-action-cancel');
        const confirmBtn = backdrop.querySelector('.td-action-confirm');
        const dialog = backdrop.querySelector('.td-dialog');
        const removeTrap = trapFocus(dialog);

        function cleanup() {
          removeTrap();
          document.removeEventListener('keydown', handleKeyDown);
        }

        function validateAndSubmit() {
          const val = inputField.value;
          if (typeof validator === 'function') {
            const err = validator(val);
            if (err) {
              errorEl.textContent = err;
              errorEl.style.display = 'block';
              inputField.focus();
              return;
            }
          }
          cleanup();
          closeBackdrop(backdrop, val, resolve);
        }

        function handleCancel() {
          cleanup();
          closeBackdrop(backdrop, null, resolve);
        }

        function handleKeyDown(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
          } else if (e.key === 'Enter' && !isTextarea) {
            e.preventDefault();
            validateAndSubmit();
          }
        }

        confirmBtn.addEventListener('click', validateAndSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) handleCancel();
        });
        document.addEventListener('keydown', handleKeyDown);

        setTimeout(() => {
          inputField.focus();
          if (inputField.select && !isTextarea) inputField.select();
        }, 60);
      });
    }
  };
})();

// Attach to global window
if (typeof window !== 'undefined') {
  window.TesseractDialog = TesseractDialog;
}


/**
 * Tesseract Omni-Search Autocomplete Controller
 * Real-time unified search across active tasks, horizons, tags, categories, and bucket list dreams.
 */

function initSearchController() {
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const suggestionsPanel = document.getElementById('search-suggestions');
  if (!searchInput) return;

  let activeIndex = -1;

  function highlightMatch(text, query) {
    if (!text) return '';
    const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => s);
    if (!query) return esc(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return esc(text).replace(regex, '<mark>$1</mark>');
  }

  function getSuggestions(query) {
    if (!query) return { tasks: [], dreams: [] };
    const q = query.toLowerCase();

    // 1. Task matches across active state
    const taskMatches = (typeof state !== 'undefined' && state.tasks ? state.tasks : []).filter(t => {
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchTier = (t.tier || '').toLowerCase().includes(q);
      const matchTags = (t.tags || []).some(tg => tg.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCat || matchTier || matchTags;
    }).slice(0, 6);

    // 2. Bucket list dreams matches
    let dreamMatches = [];
    try {
      const rawDreams = localStorage.getItem('tesseract_bucketlist_data');
      if (rawDreams) {
        const dreams = JSON.parse(rawDreams);
        dreamMatches = (dreams || []).filter(d => {
          const matchTitle = (d.title || '').toLowerCase().includes(q);
          const matchDesc = (d.description || '').toLowerCase().includes(q);
          const matchCat = (d.category || '').toLowerCase().includes(q);
          return matchTitle || matchDesc || matchCat;
        }).slice(0, 3);
      }
    } catch (e) {
      console.warn('[Search] Failed to parse bucket list dreams:', e);
    }

    return { tasks: taskMatches, dreams: dreamMatches };
  }

  function renderSuggestions(query) {
    if (!suggestionsPanel) return;
    activeIndex = -1;

    if (!query || query.length === 0) {
      suggestionsPanel.style.display = 'none';
      suggestionsPanel.innerHTML = '';
      return;
    }

    const { tasks, dreams } = getSuggestions(query);
    const totalCount = tasks.length + dreams.length;
    const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => s);

    if (totalCount === 0) {
      suggestionsPanel.innerHTML = `
        <div class="search-suggestion-empty">
          No matches found for "<strong>${esc(query)}</strong>"
        </div>
      `;
      suggestionsPanel.style.display = 'block';
      return;
    }

    let html = '';

    if (tasks.length > 0) {
      html += `<div class="search-suggestion-header">Tasks & Goals (${tasks.length})</div>`;
      tasks.forEach((t, idx) => {
        const tiersList = typeof TIERS !== 'undefined' ? TIERS : [];
        const tierObj = tiersList.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task', color: '#6366f1' };
        html += `
          <div class="search-suggestion-item" data-type="task" data-id="${t.id}" data-index="${idx}" onclick="selectSearchTask('${t.id}')">
            <div class="search-suggestion-left">
              <span class="search-suggestion-emoji">${tierObj.emoji}</span>
              <div class="search-suggestion-title-box">
                <div class="search-suggestion-title">${highlightMatch(t.title, query)}</div>
                <div class="search-suggestion-sub">
                  <span style="color:${tierObj.color}">${tierObj.name}</span>
                  ${t.category ? ` • #${esc(t.category)}` : ''}
                  ${t.completed ? ' • <span style="color:#10b981;">✓ Completed</span>' : ''}
                </div>
              </div>
            </div>
            <div class="search-suggestion-right">
              <span class="search-suggestion-pill em-prio-${t.priority}">${t.priority}</span>
            </div>
          </div>
        `;
      });
    }

    if (dreams.length > 0) {
      html += `<div class="search-suggestion-header" style="margin-top:4px;">Bucket List Dreams (${dreams.length})</div>`;
      dreams.forEach((d, idx) => {
        const totalIdx = tasks.length + idx;
        html += `
          <div class="search-suggestion-item" data-type="dream" data-id="${d.id}" data-index="${totalIdx}" onclick="selectSearchDream('${d.id}')">
            <div class="search-suggestion-left">
              <span class="search-suggestion-emoji">${d.emoji || '🪣'}</span>
              <div class="search-suggestion-title-box">
                <div class="search-suggestion-title">${highlightMatch(d.title, query)}</div>
                <div class="search-suggestion-sub">
                  <span style="color:#f59e0b;">Bucket List</span>
                  ${d.category ? ` • #${esc(d.category)}` : ''}
                  ${d.targetYear ? ` • Target: ${d.targetYear}` : ''}
                  ${d.achieved ? ' • <span style="color:#10b981;">🏆 Achieved</span>' : ''}
                </div>
              </div>
            </div>
            <div class="search-suggestion-right">
              <span class="search-suggestion-pill" style="background:rgba(245,158,11,0.12); color:#f59e0b; border:1px solid rgba(245,158,11,0.25);">Dream</span>
            </div>
          </div>
        `;
      });
    }

    suggestionsPanel.innerHTML = html;
    suggestionsPanel.style.display = 'block';
  }

  // Live input listener
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (typeof state !== 'undefined') state.searchQuery = query.toLowerCase();

    if (clearSearchBtn) {
      clearSearchBtn.style.display = query ? 'flex' : 'none';
    }

    renderSuggestions(query.toLowerCase());

    const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
    if (page === 'index' && typeof state !== 'undefined') {
      if (state.viewMode === 'eisenhower' && typeof renderEisenhowerMatrix === 'function') {
        renderEisenhowerMatrix();
      } else if (typeof renderTaskList === 'function') {
        renderTaskList();
      }
    }
  });

  // Focus event to reopen suggestions if query exists
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      renderSuggestions(searchInput.value.trim().toLowerCase());
    }
  });

  // Keyboard navigation within suggestions
  searchInput.addEventListener('keydown', (e) => {
    if (!suggestionsPanel || suggestionsPanel.style.display === 'none') return;
    const items = suggestionsPanel.querySelectorAll('.search-suggestion-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      } else {
        suggestionsPanel.style.display = 'none';
      }
    }
  });

  function updateActiveItem(items) {
    items.forEach((it, idx) => {
      it.classList.toggle('active', idx === activeIndex);
      if (idx === activeIndex) {
        it.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      if (typeof state !== 'undefined') state.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      if (suggestionsPanel) {
        suggestionsPanel.style.display = 'none';
        suggestionsPanel.innerHTML = '';
      }
      const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
      if (page === 'index' && typeof state !== 'undefined') {
        if (state.viewMode === 'eisenhower' && typeof renderEisenhowerMatrix === 'function') {
          renderEisenhowerMatrix();
        } else if (typeof renderTaskList === 'function') {
          renderTaskList();
        }
      }
      searchInput.focus();
    });
  }

  // Click outside to dismiss
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('search-box-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      if (suggestionsPanel) suggestionsPanel.style.display = 'none';
    }
  });
}

function selectSearchTask(taskId) {
  const panel = document.getElementById('search-suggestions');
  if (panel) panel.style.display = 'none';

  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (page === 'index') {
    if (typeof openEditModal === 'function') openEditModal(taskId);
  } else {
    window.location.href = `index.html`;
  }
}

function selectSearchDream(dreamId) {
  const panel = document.getElementById('search-suggestions');
  if (panel) panel.style.display = 'none';

  const page = typeof Components !== 'undefined' ? Components.getCurrentPage() : 'index';
  if (page === 'bucketlist') {
    if (typeof BucketListEngine !== 'undefined') BucketListEngine.openAddModal(dreamId);
  } else {
    window.location.href = `bucketlist.html`;
  }
}

// Global exports
window.initSearchController = initSearchController;
window.selectSearchTask = selectSearchTask;
window.selectSearchDream = selectSearchDream;

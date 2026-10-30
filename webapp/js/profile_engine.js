/**
 * Tesseract Profile & Executive Data Vault Engine
 * Handles user profile, personal north star creed, lifetime statistics,
 * database backup exports, JSON data restoration, and vault analytics.
 */

const PROFILE_KEY = 'tesseract_profile_data';

const DEFAULT_CREED = {
  mission: 'Architect scalable systems, execute with ruthless consistency, and compound value across all life dimensions.',
  motto: 'Discipline is freedom. Compound daily.',
  values: ['Ruthless Prioritization', 'Deep Work Intensity', 'Unwavering Follow-Through']
};

function loadProfile() {
  const saved = localStorage.getItem(PROFILE_KEY);
  if (saved) {
    try {
      state.profile = JSON.parse(saved);
    } catch (e) {
      // Keep default
    }
  }
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
  if (typeof SyncEngine !== 'undefined') SyncEngine.queuePush();
}

function getProfileCreed() {
  if (typeof state === 'undefined') return { ...DEFAULT_CREED };
  if (!state.profile) state.profile = { name: 'Tesseract User', image: null };
  if (!state.profile.creed) {
    state.profile.creed = { ...DEFAULT_CREED };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
  }
  return state.profile.creed;
}

function renderProfileCreed() {
  const creed = getProfileCreed();
  const elMission = document.getElementById('creed-display-mission');
  const elMotto = document.getElementById('creed-display-motto');
  const elValues = document.getElementById('creed-display-values');
  const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => s);

  if (elMission) elMission.textContent = creed.mission || DEFAULT_CREED.mission;
  if (elMotto) elMotto.textContent = creed.motto || DEFAULT_CREED.motto;
  if (elValues) {
    elValues.innerHTML = '';
    const icons = ['shield-check', 'zap', 'target'];
    const valuesList = (creed.values && creed.values.length > 0) ? creed.values : DEFAULT_CREED.values;
    valuesList.forEach((val, idx) => {
      const tag = document.createElement('span');
      tag.className = 'creed-value-tag';
      tag.innerHTML = `<i data-lucide="${icons[idx % icons.length]}"></i> <span>${esc(val)}</span>`;
      elValues.appendChild(tag);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function openCreedModal() {
  const creed = getProfileCreed();
  const modal = document.getElementById('creed-editor-modal');
  if (!modal) return;

  const inMission = document.getElementById('creed-input-mission');
  const inMotto = document.getElementById('creed-input-motto');
  const inV1 = document.getElementById('creed-input-v1');
  const inV2 = document.getElementById('creed-input-v2');
  const inV3 = document.getElementById('creed-input-v3');

  if (inMission) inMission.value = creed.mission || '';
  if (inMotto) inMotto.value = creed.motto || '';
  if (inV1) inV1.value = (creed.values && creed.values[0]) || '';
  if (inV2) inV2.value = (creed.values && creed.values[1]) || '';
  if (inV3) inV3.value = (creed.values && creed.values[2]) || '';

  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCreedModal() {
  const modal = document.getElementById('creed-editor-modal');
  if (modal) modal.style.display = 'none';
}

function handleSaveCreed(event) {
  event.preventDefault();
  const inMission = document.getElementById('creed-input-mission');
  const inMotto = document.getElementById('creed-input-motto');
  const inV1 = document.getElementById('creed-input-v1');
  const inV2 = document.getElementById('creed-input-v2');
  const inV3 = document.getElementById('creed-input-v3');

  const newCreed = {
    mission: inMission ? inMission.value.trim() : DEFAULT_CREED.mission,
    motto: inMotto ? inMotto.value.trim() : DEFAULT_CREED.motto,
    values: [
      inV1 && inV1.value.trim() ? inV1.value.trim() : DEFAULT_CREED.values[0],
      inV2 && inV2.value.trim() ? inV2.value.trim() : DEFAULT_CREED.values[1],
      inV3 && inV3.value.trim() ? inV3.value.trim() : DEFAULT_CREED.values[2]
    ]
  };

  if (typeof state !== 'undefined') {
    if (!state.profile) state.profile = { name: 'Tesseract User', image: null };
    state.profile.creed = newCreed;
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));

  closeCreedModal();
  renderProfileCreed();
  if (typeof showToast === 'function') showToast('Personal North Star Creed saved! 🏛️', 'success');
}

function renderDataVaultStats() {
  const elTasks = document.getElementById('vstat-tasks');
  const elHabits = document.getElementById('vstat-habits');
  const elBucket = document.getElementById('vstat-bucket');
  const elFocus = document.getElementById('vstat-focus');
  const elStorageSize = document.getElementById('vault-storage-size');

  const taskCount = (typeof state !== 'undefined' && state.tasks) ? state.tasks.length : 0;
  const habitCount = (typeof HabitsEngine !== 'undefined' && HabitsEngine.habits) ? HabitsEngine.habits.length : 0;
  const bucketCount = (typeof BucketListEngine !== 'undefined' && BucketListEngine.dreams) ? BucketListEngine.dreams.length : 0;
  const focusCount = (typeof FocusEngine !== 'undefined') ? FocusEngine.getSessions().length : 0;

  if (elTasks) elTasks.textContent = taskCount;
  if (elHabits) elHabits.textContent = habitCount;
  if (elBucket) elBucket.textContent = bucketCount;
  if (elFocus) elFocus.textContent = focusCount;

  if (elStorageSize) {
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += (localStorage[key].length + key.length) * 2;
      }
    }
    const kb = (totalBytes / 1024).toFixed(1);
    const pct = ((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(1);
    elStorageSize.textContent = `${kb} KB used (${pct}% of 5 MB limit)`;
  }
}

function exportDataJSON() {
  const fullBackup = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    tasks: typeof state !== 'undefined' ? state.tasks : [],
    profile: typeof state !== 'undefined' ? state.profile : {},
    streak: typeof state !== 'undefined' ? state.streak : {},
    xpData: (typeof XPEngine !== 'undefined') ? XPEngine.data : null,
    habits: (typeof HabitsEngine !== 'undefined') ? HabitsEngine.habits : null,
    bucketList: (typeof BucketListEngine !== 'undefined') ? BucketListEngine.dreams : null,
    focusSessions: (typeof FocusEngine !== 'undefined') ? FocusEngine.getSessions() : null
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tesseract_executive_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  if (typeof showToast === 'function') showToast('Executive database backup downloaded! 💾', 'success');
}

function triggerImportJSON() {
  const input = document.getElementById('vault-import-input');
  if (input) input.click();
}

function handleVaultImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && data.version && data.tasks) {
        // Full Executive Backup
        if (typeof state !== 'undefined') state.tasks = data.tasks;
        if (typeof saveData === 'function') saveData();
        if (data.profile) {
          if (typeof state !== 'undefined') state.profile = data.profile;
          localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
        }
        if (data.streak) {
          if (typeof state !== 'undefined') state.streak = data.streak;
          localStorage.setItem(STREAK_KEY, JSON.stringify(data.streak));
        }
        if (data.xpData && typeof XPEngine !== 'undefined') {
          XPEngine.data = data.xpData;
          XPEngine.save();
        }
        if (data.habits && typeof HabitsEngine !== 'undefined') {
          HabitsEngine.habits = data.habits;
          HabitsEngine.save();
        }
        if (data.bucketList && typeof BucketListEngine !== 'undefined') {
          BucketListEngine.dreams = data.bucketList;
          BucketListEngine.save();
        }
        if (data.focusSessions && typeof FocusEngine !== 'undefined') {
          localStorage.setItem('tesseract_focus_sessions', JSON.stringify(data.focusSessions));
        }
        if (typeof showToast === 'function') showToast('Complete Executive Database restored successfully! 🎉', 'success');
      } else if (Array.isArray(data)) {
        // Legacy Task Array
        if (typeof state !== 'undefined') state.tasks = data;
        if (typeof saveData === 'function') saveData();
        if (typeof showToast === 'function') showToast(`Imported ${data.length} tasks successfully!`, 'success');
      } else {
        if (typeof TesseractDialog !== 'undefined') {
          TesseractDialog.alert({
            title: 'Unrecognized Backup',
            message: 'Unrecognized JSON format. Please use a valid Tesseract export file.',
            variant: 'warning'
          });
        } else {
          alert('Unrecognized JSON format. Please use a valid Tesseract export file.');
        }
        return;
      }
      if (typeof renderAll === 'function') renderAll();
      if (document.getElementById('profile-container')) renderProfileView();
    } catch (err) {
      if (typeof TesseractDialog !== 'undefined') {
        TesseractDialog.alert({
          title: 'Restore Error',
          message: 'Error parsing JSON backup file: ' + err.message,
          variant: 'danger'
        });
      } else {
        alert('Error parsing JSON backup file: ' + err.message);
      }
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function archiveCompletedTasks() {
  const tasksList = (typeof state !== 'undefined' && state.tasks) ? state.tasks : [];
  const completedDailyAndWeekly = tasksList.filter(t => (t.tier === 'daily' || t.tier === 'weekly') && t.completed);
  if (completedDailyAndWeekly.length === 0) {
    if (typeof showToast === 'function') showToast('No completed daily or weekly tasks to archive.', 'info');
    return;
  }

  const confirmed = typeof TesseractDialog !== 'undefined'
    ? await TesseractDialog.confirm({
        title: 'Archive Completed Tasks',
        message: `Archive ${completedDailyAndWeekly.length} completed daily/weekly tasks? They will be cleared from active matrix while preserving all your XP and stats.`,
        confirmLabel: 'Archive Tasks',
        variant: 'default'
      })
    : confirm(`Archive ${completedDailyAndWeekly.length} completed daily/weekly tasks? They will be cleared from active matrix while preserving all your XP and stats.`);

  if (confirmed) {
    if (typeof state !== 'undefined') {
      state.tasks = state.tasks.filter(t => !((t.tier === 'daily' || t.tier === 'weekly') && t.completed));
    }
    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();
    if (document.getElementById('profile-container')) renderProfileView();
    if (typeof showToast === 'function') showToast(`Archived ${completedDailyAndWeekly.length} tasks! Matrix optimized. 🧹`, 'success');
  }
}

function confirmResetData() {
  resetToSampleData();
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function resetToSampleData() {
  const confirmed = typeof TesseractDialog !== 'undefined'
    ? await TesseractDialog.confirm({
        title: 'Reset to Sample Data',
        message: 'Reset all tasks to original sample data? Custom additions will be overwritten.',
        confirmLabel: 'Reset Data',
        variant: 'danger'
      })
    : confirm('Reset all tasks to original sample data? Custom additions will be overwritten.');

  if (confirmed) {
    if (typeof state !== 'undefined') {
      state.tasks = typeof INITIAL_TASKS !== 'undefined' ? [...INITIAL_TASKS] : [];
    }
    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();
    if (document.getElementById('profile-container')) renderProfileView();
    if (typeof showToast === 'function') showToast('Restored sample data.', 'info');
  }
}

function renderProfileView() {
  const profileContainer = document.getElementById('profile-container');
  if (!profileContainer) return;

  const tasks = (typeof state !== 'undefined' && state.tasks) ? state.tasks : [];
  const streakCount = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : ((typeof state !== 'undefined' && state.streak) ? state.streak.count : 1);
  const streak = { count: streakCount, lastDate: (typeof state !== 'undefined' && state.streak ? state.streak.lastDate : null) };
  const profile = (typeof state !== 'undefined' && state.profile) ? state.profile : { name: 'Tesseract User', image: null };
  const completed = tasks.filter(t => t.completed);
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
  const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => s);
  const tiersList = typeof TIERS !== 'undefined' ? TIERS : [];

  // Best streak tracking
  const BEST_STREAK_KEY = 'tesseract_best_streak';
  let bestStreak = parseInt(localStorage.getItem(BEST_STREAK_KEY) || '0');
  if (streak.count > bestStreak) {
    bestStreak = streak.count;
    localStorage.setItem(BEST_STREAK_KEY, bestStreak.toString());
  }

  // Tagline based on stats
  let tagline = 'Starter';
  if (streak.count >= 100) tagline = 'Legendary';
  else if (streak.count >= 50) tagline = 'Relentless';
  else if (streak.count >= 30) tagline = 'Disciplined';
  else if (streak.count >= 7) tagline = 'Consistent';
  else if (completed.length > 0) tagline = 'Initiator';

  // Populate hero
  const profileNameEl = document.getElementById('profile-name');
  const profileTaglineEl = document.getElementById('profile-tagline');
  if (profileNameEl) profileNameEl.textContent = profile.name;
  if (profileTaglineEl) {
    profileTaglineEl.textContent = (typeof XPEngine !== 'undefined') ? XPEngine.data.rankTitle : tagline;
  }
  
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarFallback = document.getElementById('profile-avatar-fallback');
  if (avatarImg && avatarFallback) {
    if (profile.image) {
      avatarImg.src = profile.image;
      avatarImg.style.display = 'block';
      avatarFallback.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarFallback.style.display = 'block';
    }
  }

  // Member since
  const dates = tasks.map(t => t.createdAt).filter(Boolean).sort();
  const joinedDateEl = document.getElementById('profile-joined-date');
  if (dates.length > 0 && joinedDateEl) {
    const d = new Date(dates[0]);
    joinedDateEl.textContent = `Member since ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }

  // Executive Level & XP Card
  if (typeof XPEngine !== 'undefined') {
    const prog = XPEngine.getLevelProgress();
    const lvlBadge = document.getElementById('profile-level-badge');
    const rankTitle = document.getElementById('profile-rank-title');
    const rankDesc = document.getElementById('profile-rank-desc');
    const totalXP = document.getElementById('profile-total-xp');
    const multPill = document.getElementById('profile-multiplier-pill');
    const xpInLevel = document.getElementById('profile-xp-in-level');
    const nextRank = document.getElementById('profile-next-rank-preview');
    const xpFill = document.getElementById('profile-xp-fill');

    if (lvlBadge) lvlBadge.textContent = `Lvl ${prog.level}`;
    if (rankTitle) rankTitle.textContent = prog.title;
    const currentThreshold = typeof LEVEL_THRESHOLDS !== 'undefined' ? LEVEL_THRESHOLDS.find(t => t.level === prog.level) : null;
    if (rankDesc && currentThreshold) rankDesc.textContent = currentThreshold.tierName;
    if (totalXP) totalXP.textContent = `${XPEngine.data.totalXP} XP`;
    if (multPill) {
      const mult = XPEngine.getStreakMultiplier();
      multPill.textContent = `${mult}x Multiplier`;
      multPill.className = `profile-multiplier-badge ${mult > 1 ? 'active' : ''}`;
    }
    if (xpInLevel) xpInLevel.textContent = `${prog.currentXPInLevel} / ${prog.xpForNextLevel} XP`;
    if (nextRank) nextRank.textContent = `Next: Level ${prog.level + 1} (${prog.remainingXP} XP left)`;
    if (xpFill) xpFill.style.width = `${prog.pct}%`;
  }

  // Update stat cards
  const elTotal = document.getElementById('pstat-total-tasks') || document.getElementById('pstat-total-goals');
  const elCompleted = document.getElementById('pstat-completed') || document.getElementById('pstat-completed-goals');
  const elRate = document.getElementById('pstat-completion-rate');
  const elStreak = document.getElementById('pstat-streak') || document.getElementById('pstat-streak-days');
  const elShields = document.getElementById('pstat-shields') || document.getElementById('pstat-streak-shields');

  if (elTotal) elTotal.textContent = total;
  if (elCompleted) elCompleted.textContent = completed.length;
  if (elRate) elRate.textContent = `${rate}%`;
  if (elStreak) {
    elStreak.textContent = `${streak.count} 🔥`;
    elStreak.style.cursor = 'pointer';
    elStreak.title = 'Click to customize/adjust your streak';
    if (typeof promptEditStreak === 'function') elStreak.onclick = promptEditStreak;
  }
  if (elShields) elShields.textContent = `${(typeof XPEngine !== 'undefined') ? (XPEngine.data.streakShields || 0) : 0} 🛡️`;

  const elDeepWork = document.getElementById('pstat-deep-work');
  if (elDeepWork && typeof FocusEngine !== 'undefined') {
    elDeepWork.textContent = `${FocusEngine.getTotalHours()}h`;
  }

  // Lifetime Badge Showcase
  const badgeContainer = document.getElementById('profile-badge-showcase');
  const badgeCountEl = document.getElementById('profile-badge-count');
  if (badgeContainer && typeof XPEngine !== 'undefined') {
    badgeContainer.innerHTML = '';
    const earnedBadges = XPEngine.data.badges || [];
    const badgeDefs = typeof BADGE_DEFINITIONS !== 'undefined' ? BADGE_DEFINITIONS : [];
    if (badgeCountEl) badgeCountEl.textContent = `${earnedBadges.length} / ${badgeDefs.length} Unlocked`;

    badgeDefs.forEach(badge => {
      const isEarned = earnedBadges.includes(badge.id);
      const el = document.createElement('div');
      el.className = `profile-badge-item ${isEarned ? 'earned' : 'locked'}`;
      el.innerHTML = `
        <span class="badge-emoji">${badge.icon}</span>
        <span class="badge-name">${esc(badge.name)}</span>
        <span class="badge-days">${esc(badge.desc)}</span>
        <span class="badge-status ${isEarned ? 'earned' : 'locked'}">${isEarned ? '✓ Unlocked' : '🔒 Locked'}</span>
      `;
      badgeContainer.appendChild(el);
    });
  }

  // Horizon breakdown
  const breakdownContainer = document.getElementById('profile-horizon-breakdown');
  if (breakdownContainer) {
    breakdownContainer.innerHTML = '';
    tiersList.forEach(tier => {
      const tierTasks = tasks.filter(t => t.tier === tier.id);
      const tierDone = tierTasks.filter(t => t.completed).length;
      const tierTotal = tierTasks.length;
      const pct = tierTotal > 0 ? Math.round((tierDone / tierTotal) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'profile-horizon-row';
      row.innerHTML = `
        <span class="profile-horizon-label">${tier.emoji} ${tier.name}</span>
        <div class="profile-horizon-bar-track">
          <div class="profile-horizon-bar-fill" style="width: ${pct}%; background: ${tier.color};"></div>
        </div>
        <span class="profile-horizon-pct">${tierDone}/${tierTotal} (${pct}%)</span>
      `;
      breakdownContainer.appendChild(row);
    });
  }

  // Recent XP & Activity history
  const activityContainer = document.getElementById('profile-activity-list');
  if (activityContainer) {
    activityContainer.innerHTML = '';

    const history = (typeof XPEngine !== 'undefined' && XPEngine.data.history && XPEngine.data.history.length > 0)
      ? XPEngine.data.history
      : [];

    if (history.length === 0) {
      activityContainer.innerHTML = '<div class="profile-empty-activity">No XP logged yet. Start completing goals to gain executive level!</div>';
    } else {
      history.slice(0, 15).forEach(item => {
        const when = new Date(item.timestamp);
        const timeAgo = getTimeAgo(when);

        const el = document.createElement('div');
        el.className = 'profile-activity-item';
        el.innerHTML = `
          <div class="profile-activity-icon completed">⚡</div>
          <div class="profile-activity-text">
            <span class="activity-xp-gain">+${item.amount} XP</span>
            <span class="activity-reason">${esc(item.reason)}</span>
            ${item.multiplier > 1 ? `<span class="activity-mult">${item.multiplier}x</span>` : ''}
          </div>
          <div class="profile-activity-time">${timeAgo}</div>
        `;
        activityContainer.appendChild(el);
      });
    }
  }

  // Render Personal Creed & Data Vault
  renderProfileCreed();
  renderDataVaultStats();
}

// Global exports
window.PROFILE_KEY = PROFILE_KEY;
window.loadProfile = loadProfile;
window.saveProfile = saveProfile;
window.getProfileCreed = getProfileCreed;
window.renderProfileCreed = renderProfileCreed;
window.openCreedModal = openCreedModal;
window.closeCreedModal = closeCreedModal;
window.handleSaveCreed = handleSaveCreed;
window.renderDataVaultStats = renderDataVaultStats;
window.exportDataJSON = exportDataJSON;
window.triggerImportJSON = triggerImportJSON;
window.handleVaultImport = handleVaultImport;
window.archiveCompletedTasks = archiveCompletedTasks;
window.confirmResetData = confirmResetData;
window.getTimeAgo = getTimeAgo;
window.resetToSampleData = resetToSampleData;
window.renderProfileView = renderProfileView;

/**
 * Tesseract Execution Streak Engine
 * Tracks daily execution momentum, milestones, streak shields, and badges.
 */

const STREAK_KEY = 'tesseract_streak_data';

// Streak milestone badges
const STREAK_BADGES = [
  { days: 7,   emoji: '🏅', name: '1 Week' },
  { days: 14,  emoji: '⚡', name: '2 Weeks' },
  { days: 30,  emoji: '🌟', name: '30 Days' },
  { days: 50,  emoji: '💎', name: '50 Days' },
  { days: 75,  emoji: '🔥', name: '75 Days' },
  { days: 100, emoji: '👑', name: '100 Days' },
  { days: 150, emoji: '🚀', name: '150 Days' },
  { days: 200, emoji: '🏆', name: '200 Days' },
  { days: 250, emoji: '💫', name: '250 Days' },
  { days: 300, emoji: '🌈', name: '300 Days' },
  { days: 365, emoji: '🎯', name: '1 Year' }
];

function getToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 999;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);
  const diffTime = date2.getTime() - date1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function loadStreak() {
  if (typeof XPEngine !== 'undefined' && XPEngine.data) {
    state.streak = {
      count: XPEngine.data.streak || 1,
      lastDate: XPEngine.data.lastActiveDate || getToday()
    };
    return;
  }

  const saved = localStorage.getItem(STREAK_KEY);
  if (saved) {
    try {
      state.streak = JSON.parse(saved);
    } catch (e) {
      state.streak = { count: 1, lastDate: getToday() };
    }
  } else {
    state.streak = { count: 1, lastDate: getToday() };
    saveStreak();
  }
}

function saveStreak() {
  localStorage.setItem(STREAK_KEY, JSON.stringify(state.streak));
  if (typeof XPEngine !== 'undefined' && XPEngine.data) {
    XPEngine.data.streak = state.streak.count;
    XPEngine.data.lastActiveDate = state.streak.lastDate;
    XPEngine.save();
  }
  if (typeof SyncEngine !== 'undefined') SyncEngine.queuePush();
}

function checkAndUpdateStreak() {
  const today = getToday();
  if (!state.streak) state.streak = { count: 1, lastDate: null };

  const lastDate = state.streak.lastDate;
  const diffDays = getDaysBetween(lastDate, today);

  if (diffDays === 0) {
    // Already logged for today, streak is active
    return;
  }

  if (diffDays === 1) {
    // Consecutive day execution!
    state.streak.count = (state.streak.count || 0) + 1;
    state.streak.lastDate = today;
    saveStreak();
    if (typeof triggerConfetti === 'function') triggerConfetti();
    if (typeof showToast === 'function') {
      showToast(`🔥 Daily Streak Advanced! You're on a ${state.streak.count}-day streak!`, 'success');
    }
    renderStreakUI();
  } else if (diffDays > 1) {
    // Missed day(s)
    if (typeof XPEngine !== 'undefined' && XPEngine.data && XPEngine.data.streakShields > 0) {
      XPEngine.data.streakShields -= 1;
      state.streak.lastDate = today;
      saveStreak();
      if (typeof showToast === 'function') {
        showToast(`🛡️ Streak Shield Saved Your ${state.streak.count}-Day Streak! (${XPEngine.data.streakShields} shield left)`, 'warning');
      }
    } else {
      state.streak.count = 1;
      state.streak.lastDate = today;
      saveStreak();
      if (typeof showToast === 'function') {
        showToast(`🔥 Day 1 of your new execution streak! Rebuild your momentum.`, 'info');
      }
    }
    renderStreakUI();
  }
}

async function promptEditStreak() {
  const current = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : (state.streak ? state.streak.count : 1);
  const input = typeof TesseractDialog !== 'undefined'
    ? await TesseractDialog.prompt({
        title: 'Execution Streak',
        message: 'Set your active streak count in days:',
        defaultValue: current,
        inputType: 'number',
        confirmLabel: 'Save Streak'
      })
    : prompt('🔥 Set your current Execution Streak (Days):', current);

  if (input !== null) {
    const num = parseInt(String(input).trim(), 10);
    if (!isNaN(num) && num >= 0) {
      if (typeof XPEngine !== 'undefined' && typeof XPEngine.setManualStreak === 'function') {
        XPEngine.setManualStreak(num);
      } else {
        state.streak = { count: num, lastDate: getToday() };
        saveStreak();
        renderStreakUI();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showToast === 'function') showToast(`🔥 Streak updated to ${num} Days!`, 'success');
      }
    }
  }
}

function renderStreakUI() {
  const count = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : (state.streak ? state.streak.count : 1);
  const counterEl = document.getElementById('streak-counter');
  const fillEl = document.getElementById('streak-fill');
  const labelEl = document.getElementById('streak-badge-label');
  const badgeContainer = document.getElementById('streak-badges');

  if (counterEl) {
    counterEl.textContent = `${count} Day${count !== 1 ? 's' : ''}`;
    counterEl.title = 'Click to customize/adjust your streak';
    counterEl.style.cursor = 'pointer';
    counterEl.onclick = promptEditStreak;
  }

  const pstatStreak = document.getElementById('pstat-streak') || document.getElementById('pstat-streak-days');
  if (pstatStreak) {
    pstatStreak.textContent = `${count} 🔥`;
    pstatStreak.style.cursor = 'pointer';
    pstatStreak.title = 'Click to customize/adjust your streak';
    pstatStreak.onclick = promptEditStreak;
  }

  let nextBadge = STREAK_BADGES.find(b => b.days > count) || STREAK_BADGES[STREAK_BADGES.length - 1];
  let prevDays = 0;
  const currBadgeIndex = STREAK_BADGES.findIndex(b => b.days > count);
  if (currBadgeIndex > 0) {
    prevDays = STREAK_BADGES[currBadgeIndex - 1].days;
  }

  const progressRange = nextBadge.days - prevDays;
  const progressCurrent = count - prevDays;
  const pct = Math.min(100, Math.max(0, Math.round((progressCurrent / progressRange) * 100)));

  if (fillEl) fillEl.style.width = `${pct}%`;
  if (labelEl) {
    if (count >= 365) {
      labelEl.textContent = '🏆 Grandmaster (1 Year Achieved!)';
    } else {
      const daysLeft = nextBadge.days - count;
      labelEl.textContent = `Next: ${nextBadge.emoji} ${nextBadge.name} (${daysLeft}d left)`;
    }
  }

  if (badgeContainer) {
    badgeContainer.innerHTML = '';
    STREAK_BADGES.forEach((badge, idx) => {
      const earned = count >= badge.days;
      const isNext = !earned && (idx === 0 || count >= STREAK_BADGES[idx - 1].days);
      const span = document.createElement('span');
      span.className = `streak-badge-pill ${earned ? 'earned' : isNext ? 'next' : 'locked'}`;
      span.textContent = badge.emoji;
      span.title = earned
        ? `Unlocked: ${badge.name} (${badge.days} days streak)`
        : isNext
        ? `Next up: ${badge.name} (${badge.days - count} days to go!)`
        : `Locked: ${badge.name} (${badge.days} days streak)`;
      badgeContainer.appendChild(span);
    });
  }
}

// Global namespace exports
window.STREAK_KEY = STREAK_KEY;
window.STREAK_BADGES = STREAK_BADGES;
window.getToday = getToday;
window.getDaysBetween = getDaysBetween;
window.loadStreak = loadStreak;
window.saveStreak = saveStreak;
window.checkAndUpdateStreak = checkAndUpdateStreak;
window.promptEditStreak = promptEditStreak;
window.renderStreakUI = renderStreakUI;

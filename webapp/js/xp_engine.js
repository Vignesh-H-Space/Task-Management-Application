/**
 * Tesseract Gamified Leveling & Executive XP Engine
 * Battle-tested psychological engagement mechanics, XP progression, streak shields, daily quests & badges.
 */

const XP_STORAGE_KEY = 'tesseract_xp_data';

// XP Economy Base Values
const XP_VALUES = {
  DAILY_TASK: 10,
  WEEKLY_TASK: 50,
  MONTHLY_TASK: 200,
  QUARTERLY_TASK: 600,
  ANNUAL_VISION: 1500,
  SUBTASK: 5,
  FOCUS_SESSION_25: 25,
  FOCUS_SESSION_50: 55,
  FOCUS_SESSION_90: 100,
  FOCUS_SESSION_CUSTOM: 1, // per minute
  PERFECT_DAY_BONUS: 80,
  DAILY_LOGIN_BONUS: 15,
  COMEBACK_BONUS: 50,
  QUEST_COMPLETED: 40
};

// 50 Levels Progression with Executive Titles
const LEVEL_THRESHOLDS = [
  { level: 1,  xp: 0,      title: "🌱 Apprentice", desc: "Embarking on the execution matrix" },
  { level: 2,  xp: 80,     title: "🌱 Apprentice II", desc: "Building daily momentum" },
  { level: 3,  xp: 180,    title: "🌱 Apprentice III", desc: "Establishing habit loops" },
  { level: 4,  xp: 320,    title: "🌱 Apprentice IV", desc: "Consolidating task focus" },
  { level: 5,  xp: 500,    title: "🎯 Operator", desc: "Reliable daily task execution" },
  { level: 6,  xp: 750,    title: "🎯 Operator II", desc: "Eliminating trivial distractions" },
  { level: 7,  xp: 1050,   title: "🎯 Operator III", desc: "Consistent weekly milestones" },
  { level: 8,  xp: 1400,   title: "🎯 Operator IV", desc: "Mastering deep work blocks" },
  { level: 9,  xp: 1800,   title: "🎯 Operator V", desc: "High leverage task velocity" },
  { level: 10, xp: 2300,   title: "🛡️ Executor", desc: "Unshakable discipline & follow-through" },
  { level: 11, xp: 2900,   title: "🛡️ Executor II", desc: "Crushing complex subtask trees" },
  { level: 12, xp: 3600,   title: "🛡️ Executor III", desc: "Multi-horizon tactical harmony" },
  { level: 13, xp: 4400,   title: "🛡️ Executor IV", desc: "Relentless quarterly pacing" },
  { level: 14, xp: 5300,   title: "🛡️ Executor V", desc: "Zero context switching mastery" },
  { level: 15, xp: 6300,   title: "🔑 Strategist", desc: "Architecting multi-month campaigns" },
  { level: 16, xp: 7500,   title: "🔑 Strategist II", desc: "Synchronizing daily tasks to vision" },
  { level: 17, xp: 8800,   title: "🔑 Strategist III", desc: "Deep flow state on demand" },
  { level: 18, xp: 10200,  title: "🔑 Strategist IV", desc: "Systematic bottleneck elimination" },
  { level: 19, xp: 11800,  title: "🔑 Strategist V", desc: "Elite productivity output" },
  { level: 20, xp: 13500,  title: "⚡ Director", desc: "Commanding full horizon execution" },
  { level: 21, xp: 15500,  title: "⚡ Director II", desc: "High-throughput goal delivery" },
  { level: 22, xp: 17700,  title: "⚡ Director III", desc: "Flawless quarterly execution" },
  { level: 23, xp: 20100,  title: "⚡ Director IV", desc: "Master of focus soundscapes" },
  { level: 24, xp: 22700,  title: "⚡ Director V", desc: "Strategic resilience under pressure" },
  { level: 25, xp: 25500,  title: "🚀 Architect", desc: "Building compounding life systems" },
  { level: 26, xp: 28600,  title: "🚀 Architect II", desc: "Decoupled focus and momentum" },
  { level: 27, xp: 32000,  title: "🚀 Architect III", desc: "Peak executive velocity" },
  { level: 28, xp: 35700,  title: "🚀 Architect IV", desc: "Multi-year vision clarity" },
  { level: 29, xp: 39700,  title: "🚀 Architect V", desc: "Continuous flow mastery" },
  { level: 30, xp: 44000,  title: "🌊 Visionary", desc: "Translating annual ambitions to reality" },
  { level: 35, xp: 68000,  title: "🌊 Visionary V", desc: "Effortless high-impact delivery" },
  { level: 40, xp: 100000, title: "🧠 Grandmaster", desc: "Legendary discipline & focus" },
  { level: 45, xp: 145000, title: "🧠 Grandmaster V", desc: "Unmatched execution prowess" },
  { level: 50, xp: 200000, title: "👑 Master of Execution", desc: "Supreme master of the Tesseract matrix" }
];

// Lifetime Achievement Badges
const BADGE_DEFINITIONS = [
  { id: 'first_light', icon: '🌅', name: 'First Light', desc: 'Completed your first daily task', condition: 'task_daily' },
  { id: 'ignition', icon: '🔥', name: 'Ignition', desc: 'Maintained a 3-day execution streak', condition: 'streak_3' },
  { id: 'deep_work_init', icon: '🧠', name: 'Deep Work Initiate', desc: 'Completed your first 25m+ Focus session', condition: 'focus_first' },
  { id: 'weekly_crusher', icon: '📅', name: 'Weekly Crusher', desc: 'Achieved a Tactical Weekly Milestone', condition: 'task_weekly' },
  { id: 'monthly_conqueror', icon: '🗓️', name: 'Monthly Conqueror', desc: 'Achieved a Strategic Monthly Goal', condition: 'task_monthly' },
  { id: 'quarterly_titan', icon: '🎯', name: 'Quarterly Titan', desc: 'Crushed a 90-Day Quarterly Objective', condition: 'task_quarterly' },
  { id: 'annual_luminary', icon: '🏆', name: 'Annual Luminary', desc: 'Achieved an Annual Vision North Star', condition: 'task_annual' },
  { id: 'flow_state', icon: '⚡', name: 'Flow State', desc: 'Completed a 90m deep work session', condition: 'focus_90' },
  { id: 'perfect_day', icon: '🎯', name: 'Perfect Execution', desc: 'Cleared 100% of all daily tasks in one day', condition: 'perfect_day' },
  { id: 'shield_guardian', icon: '🛡️', name: 'Shield Guardian', desc: 'Earned and held a Streak Shield', condition: 'shield_held' },
  { id: 'centennial_club', icon: '💎', name: 'Centennial Club', desc: 'Completed 100 total goals and tasks', condition: 'tasks_100' },
  { id: 'veteran_streak', icon: '👑', name: '30-Day Legend', desc: 'Maintained an unbroken 30-day streak', condition: 'streak_30' }
];

// Daily Quest Templates Pool
const QUEST_TEMPLATES = [
  { id: 'q_daily_2', title: 'Complete 2 Daily Tasks', target: 2, type: 'daily_tasks', xp: 40, icon: 'check-square' },
  { id: 'q_focus_25', title: 'Log 25+ min Deep Work', target: 25, type: 'focus_mins', xp: 45, icon: 'zap' },
  { id: 'q_subtasks_3', title: 'Check off 3 Milestones', target: 3, type: 'subtasks', xp: 35, icon: 'list-checks' },
  { id: 'q_any_tier', title: 'Execute a Weekly/Monthly Goal', target: 1, type: 'higher_tier', xp: 60, icon: 'target' },
  { id: 'q_daily_3', title: 'Crush 3 Daily Tasks', target: 3, type: 'daily_tasks', xp: 50, icon: 'award' }
];

const XPEngine = {
  data: {
    totalXP: 120, // Starting bonus for endowed progress
    level: 1,
    rankTitle: "🌱 Apprentice",
    streak: 0,
    lastActiveDate: null,
    streakShields: 1, // Start with 1 free safety shield
    badges: [],
    questsDate: null,
    quests: [],
    history: []
  },

  init() {
    this.load();
    this.checkStreak();
    this.refreshDailyQuests();
    this.evaluateBadges();
  },

  load() {
    const saved = localStorage.getItem(XP_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.data = Object.assign(this.data, parsed);
      } catch (e) {
        console.error('Failed to parse XP data', e);
      }
    } else {
      // Award welcome badge & starting XP
      this.awardBadge('first_light', false);
      this.save();
    }
    this.syncLevel();
  },

  save() {
    localStorage.setItem(XP_STORAGE_KEY, JSON.stringify(this.data));
  },

  // Calculate current multiplier based on active streak
  getStreakMultiplier() {
    const s = this.data.streak || 0;
    if (s >= 30) return 2.0;
    if (s >= 7) return 1.5;
    if (s >= 3) return 1.2;
    return 1.0;
  },

  // Sync Level & Rank based on total XP
  syncLevel() {
    let currentLevel = 1;
    let currentTitle = LEVEL_THRESHOLDS[0].title;
    
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (this.data.totalXP >= LEVEL_THRESHOLDS[i].xp) {
        currentLevel = LEVEL_THRESHOLDS[i].level;
        currentTitle = LEVEL_THRESHOLDS[i].title;
      } else {
        break;
      }
    }

    const previousLevel = this.data.level || 1;
    this.data.level = currentLevel;
    this.data.rankTitle = currentTitle;

    return { leveledUp: currentLevel > previousLevel, oldLevel: previousLevel, newLevel: currentLevel, title: currentTitle };
  },

  getLevelProgress() {
    this.syncLevel();
    const currentLvl = this.data.level;
    const currentThresholdIdx = LEVEL_THRESHOLDS.findIndex(t => t.level === currentLvl);
    const currentBaseXP = LEVEL_THRESHOLDS[currentThresholdIdx] ? LEVEL_THRESHOLDS[currentThresholdIdx].xp : 0;
    
    const nextThreshold = LEVEL_THRESHOLDS[currentThresholdIdx + 1] || { level: 50, xp: 200000, title: "👑 Master of Execution" };
    const nextXP = nextThreshold.xp;

    const xpInCurrentLevel = Math.max(0, this.data.totalXP - currentBaseXP);
    const xpNeededForNext = Math.max(1, nextXP - currentBaseXP);
    const percent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));

    return {
      level: currentLvl,
      title: this.data.rankTitle,
      totalXP: this.data.totalXP,
      currentBaseXP,
      nextXP,
      xpInCurrentLevel,
      xpNeededForNext,
      remainingXP: Math.max(0, nextXP - this.data.totalXP),
      percent,
      nextTitle: nextThreshold.title
    };
  },

  /**
   * Main Award XP Method
   */
  award(amount, reason = 'Action Completed', sourceElement = null) {
    if (!amount || amount <= 0) return;

    const multiplier = this.getStreakMultiplier();
    const finalAmount = Math.round(amount * multiplier);

    this.data.totalXP += finalAmount;
    
    // Log history
    this.data.history.unshift({
      amount: finalAmount,
      baseAmount: amount,
      multiplier,
      reason,
      timestamp: new Date().toISOString()
    });
    if (this.data.history.length > 50) this.data.history.pop();

    // Trigger visual float pop
    this.triggerXPBurst(finalAmount, reason, multiplier, sourceElement);

    // Check level up
    const levelStatus = this.syncLevel();
    this.save();

    if (levelStatus.leveledUp) {
      this.triggerRankUpCeremony(levelStatus.oldLevel, levelStatus.newLevel, levelStatus.title);
    }

    this.evaluateBadges();
    this.updateUI();
  },

  /**
   * Floating XP burst animation
   */
  triggerXPBurst(amount, reason, multiplier = 1.0, sourceElement = null) {
    const container = document.getElementById('xp-burst-container');
    if (!container) return;

    const burst = document.createElement('div');
    burst.className = 'xp-burst-item';
    
    let multBadge = multiplier > 1.0 ? `<span class="xp-burst-mult">${multiplier}x STREAK</span>` : '';
    burst.innerHTML = `
      <div class="xp-burst-content">
        <span class="xp-burst-amount">+${amount} XP</span>
        ${multBadge}
        <span class="xp-burst-reason">${reason}</span>
      </div>
    `;

    // Position near clicked element if available, else center-right
    if (sourceElement && typeof sourceElement.getBoundingClientRect === 'function') {
      const rect = sourceElement.getBoundingClientRect();
      burst.style.top = `${Math.max(20, rect.top - 30)}px`;
      burst.style.left = `${Math.max(20, rect.left + rect.width / 2 - 40)}px`;
    } else {
      burst.style.bottom = '80px';
      burst.style.right = '30px';
    }

    container.appendChild(burst);

    setTimeout(() => {
      burst.classList.add('fade-out');
      setTimeout(() => burst.remove(), 400);
    }, 1800);
  },

  /**
   * Rank-Up Ceremony Modal with celebration
   */
  triggerRankUpCeremony(oldLvl, newLvl, rankTitle) {
    const modal = document.getElementById('rank-up-modal');
    if (!modal) return;

    const oldLvlEl = document.getElementById('rank-up-old-level');
    const newLvlEl = document.getElementById('rank-up-new-level');
    const titleEl = document.getElementById('rank-up-title');
    
    if (oldLvlEl) oldLvlEl.textContent = `Lvl ${oldLvl}`;
    if (newLvlEl) newLvlEl.textContent = `Lvl ${newLvl}`;
    if (titleEl) titleEl.textContent = rankTitle;

    modal.style.display = 'flex';
    if (typeof confetti === 'function') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }
  },

  closeRankUpModal() {
    const modal = document.getElementById('rank-up-modal');
    if (modal) modal.style.display = 'none';
  },

  /**
   * Daily Streak & Shield Protection Logic
   */
  getLocalDate(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getDaysDiff(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return 999;
    const [y1, m1, d1] = dateStr1.split('-').map(Number);
    const [y2, m2, d2] = dateStr2.split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1);
    const date2 = new Date(y2, m2 - 1, d2);
    const diffTime = date2.getTime() - date1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Daily Streak & Shield Protection Logic
   */
  checkStreak() {
    const today = this.getLocalDate();
    const lastActive = this.data.lastActiveDate;

    if (!lastActive) {
      this.data.streak = Math.max(1, this.data.streak || 1);
      this.data.lastActiveDate = today;
      this.save();
      this.syncAppState();
      return;
    }

    const diffDays = this.getDaysDiff(lastActive, today);

    if (diffDays === 0) {
      // Already recorded activity today — keep current streak
      this.syncAppState();
      return;
    }

    if (diffDays === 1) {
      // Consecutive day login / execution!
      this.data.streak = (this.data.streak || 0) + 1;
      this.data.lastActiveDate = today;
      
      // Award daily login bonus
      this.award(XP_VALUES.DAILY_LOGIN_BONUS, `Day ${this.data.streak} Daily Execution Bonus`);

      // Award 1 shield every 7 streak days (max 3)
      if (this.data.streak % 7 === 0) {
        this.data.streakShields = Math.min(3, (this.data.streakShields || 0) + 1);
        if (typeof showToast === 'function') {
          showToast(`🛡️ Streak Shield Earned! (Total: ${this.data.streakShields})`, 'success');
        }
      }
    } else if (diffDays > 1) {
      // Missed day(s)
      if (this.data.streakShields > 0) {
        // Shield absorbs the break!
        this.data.streakShields -= 1;
        this.data.lastActiveDate = today;
        if (typeof showToast === 'function') {
          showToast(`🛡️ Streak Shield Protected You! Your ${this.data.streak}-day streak was saved. (${this.data.streakShields} shield left)`, 'warning');
        }
      } else {
        // Streak Broken — Comeback reward
        const oldStreak = this.data.streak;
        this.data.streak = 1;
        this.data.lastActiveDate = today;
        if (oldStreak >= 3 && typeof showToast === 'function') {
          showToast(`⚡ Comeback Bonus! +${XP_VALUES.COMEBACK_BONUS} XP awarded to rebuild your streak!`, 'info');
          this.award(XP_VALUES.COMEBACK_BONUS, 'Streak Comeback Bonus');
        }
      }
    }

    this.save();
    this.syncAppState();
  },

  syncAppState() {
    if (typeof state !== 'undefined') {
      state.streak = {
        count: this.data.streak || 1,
        lastDate: this.data.lastActiveDate
      };
      localStorage.setItem('tesseract_streak', JSON.stringify(state.streak));
    }
  },

  setManualStreak(newCount) {
    const count = parseInt(newCount, 10);
    if (isNaN(count) || count < 0) return;
    this.data.streak = count;
    this.data.lastActiveDate = this.getLocalDate();
    this.save();
    this.syncAppState();
    this.updateUI();
    if (typeof renderStreakUI === 'function') renderStreakUI();
    if (typeof renderAll === 'function') renderAll();
    if (typeof showToast === 'function') showToast(`🔥 Streak set to ${count} Days!`, 'success');
  },

  /**
   * Daily Quests Refresh at Midnight
   */
  refreshDailyQuests() {
    const today = new Date().toISOString().split('T')[0];
    if (this.data.questsDate === today && this.data.quests && this.data.quests.length > 0) {
      return;
    }

    // Generate 3 daily quests from pool
    const shuffled = [...QUEST_TEMPLATES].sort(() => 0.5 - Math.random());
    this.data.quests = shuffled.slice(0, 3).map(q => ({
      id: q.id,
      title: q.title,
      target: q.target,
      type: q.type,
      current: 0,
      xp: q.xp,
      icon: q.icon,
      completed: false
    }));
    this.data.questsDate = today;
    this.save();
  },

  /**
   * Update Quest Progress on Action
   */
  updateQuestProgress(type, amount = 1) {
    if (!this.data.quests) return;
    let anyCompleted = false;

    this.data.quests.forEach(q => {
      if (!q.completed && q.type === type) {
        q.current = Math.min(q.target, q.current + amount);
        if (q.current >= q.target) {
          q.completed = true;
          anyCompleted = true;
          this.award(q.xp, `Quest Completed: ${q.title}`);
          if (typeof showToast === 'function') {
            showToast(`🏹 Quest Completed: "${q.title}" (+${q.xp} XP)`, 'success');
          }
        }
      }
    });

    if (anyCompleted) this.save();
  },

  /**
   * Evaluate & Unlock Achievement Badges
   */
  evaluateBadges() {
    const tasks = (typeof state !== 'undefined' && state.tasks) ? state.tasks : [];
    const completedTasks = tasks.filter(t => t.completed);
    const streak = this.data.streak || 0;

    BADGE_DEFINITIONS.forEach(b => {
      if (this.data.badges.includes(b.id)) return;

      let unlock = false;
      if (b.condition === 'task_daily' && completedTasks.some(t => t.tier === 'daily')) unlock = true;
      if (b.condition === 'task_weekly' && completedTasks.some(t => t.tier === 'weekly')) unlock = true;
      if (b.condition === 'task_monthly' && completedTasks.some(t => t.tier === 'monthly')) unlock = true;
      if (b.condition === 'task_quarterly' && completedTasks.some(t => t.tier === 'quarterly')) unlock = true;
      if (b.condition === 'task_annual' && completedTasks.some(t => t.tier === 'annual')) unlock = true;
      if (b.condition === 'streak_3' && streak >= 3) unlock = true;
      if (b.condition === 'streak_30' && streak >= 30) unlock = true;
      if (b.condition === 'tasks_100' && completedTasks.length >= 100) unlock = true;
      if (b.condition === 'shield_held' && (this.data.streakShields || 0) >= 1) unlock = true;

      if (unlock) {
        this.awardBadge(b.id);
      }
    });
  },

  awardBadge(badgeId, notify = true) {
    if (!this.data.badges.includes(badgeId)) {
      this.data.badges.push(badgeId);
      this.save();
      const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
      if (badge && notify && typeof showToast === 'function') {
        showToast(`🏅 Achievement Unlocked: ${badge.icon} ${badge.name}!`, 'success');
        if (typeof confetti === 'function') {
          confetti({ particleCount: 50, spread: 60 });
        }
      }
    }
  },

  /**
   * Sync Header, Hero & Profile UI elements
   */
  updateUI() {
    const prog = this.getLevelProgress();

    // Top Header XP Pill
    const headerXP = document.getElementById('header-xp-val');
    const headerLvl = document.getElementById('header-level-badge');
    const headerMult = document.getElementById('header-multiplier-badge');
    if (headerXP) headerXP.textContent = `${prog.totalXP.toLocaleString()} XP`;
    if (headerLvl) headerLvl.textContent = `Lvl ${prog.level}`;
    if (headerMult) {
      const mult = this.getStreakMultiplier();
      if (mult > 1.0) {
        headerMult.style.display = 'inline-flex';
        headerMult.textContent = `${mult}x 🔥`;
      } else {
        headerMult.style.display = 'none';
      }
    }

    // Render Quests on Home view if container present
    this.renderQuestBoard();
  },

  renderQuestBoard() {
    const board = document.getElementById('daily-quest-board');
    if (!board) return;

    const quests = this.data.quests || [];
    board.innerHTML = `
      <div class="quest-board-header">
        <div class="quest-board-title">
          <i data-lucide="compass"></i>
          <span>Daily Executive Quests</span>
        </div>
        <span class="quest-refresh-tag">Resets at midnight</span>
      </div>
      <div class="quest-list">
        ${quests.map(q => `
          <div class="quest-item ${q.completed ? 'completed' : ''}">
            <div class="quest-item-left">
              <span class="quest-icon-box ${q.completed ? 'done' : ''}">
                ${q.completed ? '✓' : `<i data-lucide="${q.icon || 'target'}"></i>`}
              </span>
              <div class="quest-info">
                <span class="quest-title">${q.title}</span>
                <div class="quest-progress-track">
                  <div class="quest-progress-bar" style="width: ${Math.round((q.current / q.target) * 100)}%"></div>
                </div>
              </div>
            </div>
            <div class="quest-reward">
              <span class="quest-xp-badge">+${q.xp} XP</span>
              <span class="quest-status-label">${q.completed ? 'Claimed' : `${q.current}/${q.target}`}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

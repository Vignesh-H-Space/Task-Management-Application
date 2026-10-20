/**
 * ==========================================================================
 * TESSERACT EXECUTIVE ARCHITECTURE — FOCUS & DEEP WORK ENGINE
 * Provides audio synthesis, Pomodoro timer, full-screen overlay, and analytics
 * ==========================================================================
 */

// ── Focus Mode & Deep Work Engine ──────────────────────────
const FOCUS_STORAGE_KEY = 'tesseract_focus_sessions';

const FocusEngine = {
  activeTaskId: null,
  durationMinutes: 25,
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  timerInterval: null,
  isRunning: false,
  audioContext: null,
  soundNodes: null,
  currentSound: 'rain',
  volume: 0.5,
  wakeLock: null,

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (e) {
        console.warn('Screen Wake Lock could not be obtained:', e);
      }
    }
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
      }).catch(() => {});
    }
  },

  init() {
    // Preset buttons
    document.querySelectorAll('.focus-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (this.isRunning) this.pause();
        const mins = parseInt(chip.getAttribute('data-minutes'), 10);
        this.setDuration(mins);
      });
    });

    // Control buttons
    const btnToggle = document.getElementById('focus-btn-toggle');
    if (btnToggle) btnToggle.addEventListener('click', () => this.toggle());

    const btnReset = document.getElementById('focus-btn-reset');
    if (btnReset) btnReset.addEventListener('click', () => this.reset());

    const btnMinus5 = document.getElementById('focus-btn-minus5');
    if (btnMinus5) btnMinus5.addEventListener('click', () => this.subtractFiveMinutes());

    const btnPlus5 = document.getElementById('focus-btn-plus5');
    if (btnPlus5) btnPlus5.addEventListener('click', () => this.addFiveMinutes());

    const btnCustom = document.getElementById('focus-btn-custom-duration');
    if (btnCustom) btnCustom.addEventListener('click', () => this.promptCustomDuration());

    const digitsDisplay = document.getElementById('focus-time-digits');
    if (digitsDisplay) {
      digitsDisplay.title = 'Click to set custom focus duration';
      digitsDisplay.addEventListener('click', () => this.promptCustomDuration());
    }

    const btnExit = document.getElementById('focus-exit-btn');
    if (btnExit) btnExit.addEventListener('click', () => this.close());

    const btnHeaderFocus = document.getElementById('btn-header-focus');
    if (btnHeaderFocus) {
      btnHeaderFocus.addEventListener('click', () => {
        this.open();
      });
    }

    const taskSelect = document.getElementById('focus-task-select');
    if (taskSelect) {
      taskSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.setTask(val || null);
      });
    }

    const btnComplete = document.getElementById('focus-btn-complete-task');
    if (btnComplete) btnComplete.addEventListener('click', () => this.markTaskComplete());

    // Soundscape controls (Moved Downwards)
    const soundSelect = document.getElementById('focus-sound-select');
    if (soundSelect) {
      soundSelect.addEventListener('change', (e) => {
        this.currentSound = e.target.value;
        if (this.isRunning) {
          this.stopAudio();
          this.playAudio(this.currentSound);
        }
      });
    }

    const volSlider = document.getElementById('focus-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        this.volume = parseFloat(e.target.value);
        if (this.soundNodes && this.soundNodes.masterGain && this.audioContext) {
          this.soundNodes.masterGain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        }
      });
    }

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('focus-mode-overlay');
      if (overlay && overlay.style.display !== 'none') {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        } else if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          this.toggle();
        } else if ((e.key === 'r' || e.key === 'R') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          this.reset();
        }
      }
    });
  },

  open(taskId = null) {
    const overlay = document.getElementById('focus-mode-overlay');
    if (!overlay) return;

    // If no taskId passed, smartly pick top incomplete Daily, Weekly, Monthly, Quarterly, Annual
    if (!taskId) {
      const incomplete = state.tasks.filter(t => !t.completed);
      const top = incomplete.find(t => t.tier === 'daily' && t.priority === 'urgent')
        || incomplete.find(t => t.tier === 'daily')
        || incomplete.find(t => t.tier === 'weekly')
        || incomplete.find(t => t.tier === 'monthly')
        || incomplete.find(t => t.tier === 'quarterly')
        || incomplete.find(t => t.tier === 'annual')
        || (incomplete.length > 0 ? incomplete[0] : null);
      taskId = top ? top.id : null;
    }

    // Populate Task Dropdown Switcher
    this.populateTaskPicker(taskId);

    this.setTask(taskId);
    this.reset();
    overlay.style.display = 'flex';
    lucide.createIcons();
  },

  populateTaskPicker(selectedTaskId = null) {
    const select = document.getElementById('focus-task-select');
    if (!select) return;
    select.innerHTML = '<option value="">⚡ Free Flow Sprint</option>';

    TIERS.forEach(tier => {
      const tierTasks = state.tasks.filter(t => t.tier === tier.id && !t.completed);
      if (tierTasks.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${tier.emoji} ${tier.name}`;
        tierTasks.forEach(task => {
          const opt = document.createElement('option');
          opt.value = task.id;
          opt.textContent = `[${tier.name.split(' ')[0]}] ${task.title.substring(0, 32)}${task.title.length > 32 ? '...' : ''}`;
          if (selectedTaskId === task.id) opt.selected = true;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      }
    });
  },

  setTask(taskId) {
    this.activeTaskId = taskId;
    const task = taskId ? state.tasks.find(t => t.id === taskId) : null;
    const taskTierEl = document.getElementById('focus-task-tier');
    const taskTitleEl = document.getElementById('focus-task-title');
    const taskDescEl = document.getElementById('focus-task-desc');
    const completeBtn = document.getElementById('focus-btn-complete-task');
    const select = document.getElementById('focus-task-select');

    if (select) select.value = taskId || '';

    if (task) {
      const tierObj = TIERS.find(t => t.id === task.tier) || { emoji: '📌', name: 'Task' };
      if (taskTierEl) taskTierEl.textContent = `${tierObj.emoji} ${tierObj.name.toUpperCase()}`;
      if (taskTitleEl) taskTitleEl.textContent = task.title;
      if (taskDescEl) taskDescEl.textContent = task.description || 'Focus on high-leverage execution. No distractions.';
      if (completeBtn) {
        completeBtn.style.display = 'inline-flex';
        const label = completeBtn.querySelector('#focus-complete-btn-text');
        if (label) label.textContent = task.completed ? 'Goal Completed ✅' : 'Mark Goal Complete';
      }
      this.renderFocusSubtasks(task);
    } else {
      if (taskTierEl) taskTierEl.textContent = '⚡ DEEP WORK SPRINT';
      if (taskTitleEl) taskTitleEl.textContent = 'Uninterrupted Flow Session';
      if (taskDescEl) taskDescEl.textContent = 'Single-task focus mode. Eliminate all context switching.';
      if (completeBtn) completeBtn.style.display = 'none';
      const container = document.getElementById('focus-subtasks-container');
      if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    }
  },

  renderFocusSubtasks(task) {
    const container = document.getElementById('focus-subtasks-container');
    if (!container) return;
    const subtasks = (task && task.subtasks) ? task.subtasks : [];
    if (subtasks.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const done = subtasks.filter(s => s.completed).length;
    const total = subtasks.length;
    const pct = Math.round((done / total) * 100);

    container.style.display = 'block';
    container.innerHTML = `
      <div class="focus-subtasks-header">
        <span>Milestones (${done}/${total})</span>
        <span>${pct}% Done</span>
      </div>
      <div class="focus-subtasks-list">
        ${subtasks.map(st => `
          <label class="focus-subtask-item ${st.completed ? 'completed' : ''}">
            <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''} data-focus-subtask="${st.id}">
            <span>${escapeHTML(st.title)}</span>
          </label>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('input[data-focus-subtask]').forEach(chk => {
      chk.addEventListener('change', () => {
        const sId = chk.getAttribute('data-focus-subtask');
        toggleSubtask(task.id, sId);
      });
    });
  },

  close() {
    this.pause();
    this.releaseWakeLock();
    this.stopAudio();
    const overlay = document.getElementById('focus-mode-overlay');
    if (overlay) overlay.style.display = 'none';
    document.title = 'Tesseract | Multi-Horizon Goal & Task Matrix';
  },

  setDuration(minutes) {
    this.durationMinutes = minutes;
    this.totalSeconds = minutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.updateDisplay();
    this.updateRing();
    this.highlightActivePreset();
  },

  promptCustomDuration() {
    const currentMins = Math.round(this.totalSeconds / 60);
    const input = prompt("Set custom focus duration in minutes (1 to 360):", currentMins);
    if (input !== null) {
      const parsed = parseInt(input.trim(), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 360) {
        if (this.isRunning) this.pause();
        this.setDuration(parsed);
        showToast(`Focus timer set to ${parsed}m.`, 'info');
      } else if (input.trim() !== '') {
        showToast('Please enter a valid number of minutes between 1 and 360.', 'error');
      }
    }
  },

  highlightActivePreset() {
    const currentMins = Math.round(this.totalSeconds / 60);
    let matched = false;
    document.querySelectorAll('.focus-preset-chip[data-minutes]').forEach(c => {
      const mins = parseInt(c.getAttribute('data-minutes'), 10);
      const isMatch = mins === currentMins;
      c.classList.toggle('active', isMatch);
      if (isMatch) matched = true;
    });
    const customChip = document.getElementById('focus-btn-custom-duration');
    if (customChip) customChip.classList.toggle('active', !matched);
  },

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  },

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.requestWakeLock();

    const statusEl = document.getElementById('focus-time-status');
    if (statusEl) statusEl.textContent = 'IN FLOW';

    const toggleText = document.getElementById('focus-toggle-text');
    if (toggleText) toggleText.textContent = 'Pause';

    const playIcon = document.getElementById('focus-play-icon');
    if (playIcon) {
      playIcon.setAttribute('data-lucide', 'pause');
      lucide.createIcons();
    }

    this.playAudio(this.currentSound);

    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      this.updateDisplay();
      this.updateRing();

      if (this.remainingSeconds <= 0) {
        this.onComplete();
      }
    }, 1000);
  },

  pause() {
    this.isRunning = false;
    this.releaseWakeLock();
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    const statusEl = document.getElementById('focus-time-status');
    if (statusEl) statusEl.textContent = 'PAUSED';

    const toggleText = document.getElementById('focus-toggle-text');
    if (toggleText) toggleText.textContent = 'Resume';

    const playIcon = document.getElementById('focus-play-icon');
    if (playIcon) {
      playIcon.setAttribute('data-lucide', 'play');
      lucide.createIcons();
    }

    this.stopAudio();
  },

  reset() {
    this.pause();
    this.remainingSeconds = this.totalSeconds;
    this.updateDisplay();
    this.updateRing();

    const statusEl = document.getElementById('focus-time-status');
    if (statusEl) statusEl.textContent = 'READY';

    const toggleText = document.getElementById('focus-toggle-text');
    if (toggleText) toggleText.textContent = 'Start Focus';
  },

  subtractFiveMinutes() {
    if (this.totalSeconds <= 300) {
      this.totalSeconds = Math.max(60, this.totalSeconds - 60);
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 60);
    } else {
      this.totalSeconds -= 300;
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 300);
    }
    this.durationMinutes = Math.round(this.totalSeconds / 60);
    this.updateDisplay();
    this.updateRing();
    this.highlightActivePreset();
  },

  addFiveMinutes() {
    this.totalSeconds += 300;
    this.remainingSeconds += 300;
    this.durationMinutes = Math.round(this.totalSeconds / 60);
    this.updateDisplay();
    this.updateRing();
    this.highlightActivePreset();
  },

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const str = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const digitsEl = document.getElementById('focus-time-digits');
    if (digitsEl) digitsEl.textContent = str;

    if (this.isRunning) {
      document.title = `(${str}) Focus Mode | Tesseract`;
    } else {
      document.title = 'Tesseract | Multi-Horizon Goal & Task Matrix';
    }
  },

  updateRing() {
    const ring = document.getElementById('focus-ring-progress');
    if (!ring) return;
    const circumference = 659.73; // 2 * pi * 105
    const progress = Math.max(0, this.remainingSeconds / this.totalSeconds);
    const offset = circumference * (1 - progress);
    ring.style.strokeDashoffset = offset;
  },

  onComplete() {
    this.pause();
    this.playChime();

    if (typeof confetti === 'function') {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    const durationMins = Math.round(this.totalSeconds / 60);
    const sessions = this.getSessions();
    const task = this.activeTaskId ? state.tasks.find(t => t.id === this.activeTaskId) : null;
    const newSession = {
      id: `fs_${Date.now()}`,
      taskId: this.activeTaskId,
      taskTitle: task ? task.title : 'General Deep Work Sprint',
      durationMinutes: durationMins,
      timestamp: new Date().toISOString()
    };
    sessions.push(newSession);
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(sessions));

    // Award Gamified XP
    if (typeof XPEngine !== 'undefined') {
      let focusXP = durationMins; // Base 1 XP per minute
      if (durationMins >= 90) focusXP = XP_VALUES.FOCUS_SESSION_90;
      else if (durationMins >= 50) focusXP = XP_VALUES.FOCUS_SESSION_50;
      else if (durationMins >= 25) focusXP = XP_VALUES.FOCUS_SESSION_25;

      XPEngine.award(focusXP, `Deep Work Flow (${durationMins}m)`);
      XPEngine.updateQuestProgress('focus_mins', durationMins);

      // Evaluate focus badges
      if (durationMins >= 90) XPEngine.awardBadge('flow_state');
      else if (durationMins >= 25) XPEngine.awardBadge('deep_work_init');
    }

    showToast('🎉 Focus session completed! Outstanding deep work.', 'success');
    this.reset();
    renderAll();
  },

  markTaskComplete() {
    if (!this.activeTaskId) return;
    toggleTaskCompletion(this.activeTaskId);
    const completeBtn = document.getElementById('focus-btn-complete-task');
    if (completeBtn) {
      const label = completeBtn.querySelector('#focus-complete-btn-text');
      if (label) label.textContent = 'Goal Completed! 🎉';
    }
    showToast('Task marked complete!', 'success');
  },

  getSessions() {
    try {
      return JSON.parse(localStorage.getItem(FOCUS_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  getTotalHours() {
    const sessions = this.getSessions();
    const totalMins = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    return (totalMins / 60).toFixed(1);
  },

  // ── Web Audio API Synthesizer (100% Offline Ambient Soundscapes) ────
  ensureAudioContext() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.audioContext = new AudioContextClass();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  },

  playAudio(type) {
    if (type === 'mute') return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    this.stopAudio();

    const ctx = this.audioContext;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    if (type === 'rain') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();

      this.soundNodes = { masterGain, source: whiteNoise };
    } else if (type === 'waves') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.08;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(0.2, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.25, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(swellGain.gain);

      noise.connect(filter);
      filter.connect(swellGain);
      swellGain.connect(masterGain);

      noise.start();
      lfo.start();

      this.soundNodes = { masterGain, source: noise, lfo };
    } else if (type === 'binaural') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.frequency.setValueAtTime(196, ctx.currentTime);
      osc2.frequency.setValueAtTime(206, ctx.currentTime);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc1.connect(toneGain);
      osc2.connect(toneGain);
      toneGain.connect(masterGain);

      osc1.start();
      osc2.start();

      this.soundNodes = { masterGain, osc1, osc2 };
    }
  },

  stopAudio() {
    if (this.soundNodes) {
      try {
        if (this.soundNodes.source) this.soundNodes.source.stop();
        if (this.soundNodes.lfo) this.soundNodes.lfo.stop();
        if (this.soundNodes.osc1) this.soundNodes.osc1.stop();
        if (this.soundNodes.osc2) this.soundNodes.osc2.stop();
      } catch (e) {}
      this.soundNodes = null;
    }
  },

  playChime() {
    this.ensureAudioContext();
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  }
};

// ══════════════════════════════════════════════════════════════════
// 📄 1-Click Executive Weekly Report Exporter Engine
// ══════════════════════════════════════════════════════════════════
const WeeklyReportEngine = {
  getReportData() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userName = (state.profile && state.profile.name) ? state.profile.name : 'Executive Leader';
    const totalXP = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.totalXP : 0;
    const level = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.level : 1;
    const rankTitle = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.rankTitle : 'Apprentice';
    const streak = (typeof XPEngine !== 'undefined' && XPEngine.data) ? XPEngine.data.streak : 0;

    // Completed tasks (either in last 7 days or marked completed)
    const completedTasks = state.tasks.filter(t => {
      if (!t.completed) return false;
      if (t.completedAt) {
        return new Date(t.completedAt) >= sevenDaysAgo;
      }
      return true; // Fallback for sample completed tasks
    });

    const activeTasks = state.tasks.filter(t => !t.completed);

    // Deep Work sessions
    let sessions = [];
    if (typeof FocusEngine !== 'undefined') {
      sessions = FocusEngine.getSessions();
    }
    const weeklySessions = sessions.filter(s => {
      if (!s.timestamp) return true;
      return new Date(s.timestamp) >= sevenDaysAgo;
    });
    const focusMins = weeklySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const focusHours = (focusMins / 60).toFixed(1);
    const avgSessionMins = weeklySessions.length > 0 ? Math.round(focusMins / weeklySessions.length) : 0;
    const maxSessionMins = weeklySessions.length > 0 ? Math.max(...weeklySessions.map(s => s.durationMinutes || 0)) : 0;

    // Habits consistency
    let habitsList = [];
    if (typeof HabitsEngine !== 'undefined' && HabitsEngine.habits && HabitsEngine.habits.length > 0) {
      habitsList = HabitsEngine.habits;
    } else {
      try {
        const raw = localStorage.getItem('tesseract_habits_data');
        if (raw) habitsList = JSON.parse(raw);
      } catch (e) {}
    }

    // Calculate 7-day adherence for habits
    const last7DayKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      last7DayKeys.push(d.toISOString().split('T')[0]);
    }

    let totalHabitChecks = 0;
    let possibleHabitChecks = habitsList.length * 7;
    const habitsStats = habitsList.map(h => {
      let checks = 0;
      let dotString = '';
      last7DayKeys.forEach(k => {
        if (h.history && h.history[k]) {
          checks++;
          dotString += '●';
        } else {
          dotString += '○';
        }
      });
      totalHabitChecks += checks;
      const pct = Math.round((checks / 7) * 100);
      return {
        id: h.id,
        title: h.title,
        icon: h.icon || '🎯',
        category: h.category || 'General',
        checks,
        pct,
        dotString
      };
    });
    const overallHabitAdherence = possibleHabitChecks > 0 ? Math.round((totalHabitChecks / possibleHabitChecks) * 100) : 100;

    // Strategic Alignment Score
    const totalTactical = state.tasks.filter(t => ['daily', 'weekly'].includes(t.tier) && !t.completed).length;
    const linkedTactical = state.tasks.filter(t => ['daily', 'weekly'].includes(t.tier) && !t.completed && t.parentId).length;
    const alignmentScore = totalTactical > 0 ? Math.round((linkedTactical / totalTactical) * 100) : 100;

    const dateRangeStr = `${sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return {
      userName,
      now,
      sevenDaysAgo,
      dateRangeStr,
      totalXP,
      level,
      rankTitle,
      streak,
      alignmentScore,
      completedTasks,
      activeTasks,
      weeklySessions,
      focusMins,
      focusHours,
      avgSessionMins,
      maxSessionMins,
      habitsStats,
      overallHabitAdherence
    };
  },

  generateMarkdown() {
    const data = this.getReportData();
    let md = `# 📄 TESSERACT EXECUTIVE WEEKLY REPORT\n`;
    md += `> **Executive:** ${data.userName} | **Period:** ${data.dateRangeStr} | **Generated:** ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\n\n`;
    md += `---\n\n`;

    md += `## 📊 Executive Summary\n`;
    md += `| Key Metric | Status / Value |\n`;
    md += `|---|---|\n`;
    md += `| **Executive Rank** | Level ${data.level} — ${data.rankTitle} |\n`;
    md += `| **Total XP** | ${data.totalXP.toLocaleString()} XP |\n`;
    md += `| **Execution Streak** | ${data.streak} Days 🔥 |\n`;
    md += `| **Strategic Alignment** | ${data.alignmentScore}% ${data.alignmentScore >= 85 ? '🟢 Optimal' : data.alignmentScore >= 70 ? '🟡 Moderate' : '🔴 Action Required'} |\n`;
    md += `| **Habit Adherence** | ${data.overallHabitAdherence}% |\n`;
    md += `| **Deep Work Logged** | ${data.focusHours} Hours (${data.weeklySessions.length} sessions) |\n\n`;

    md += `## ✅ Goals & Milestones Completed (${data.completedTasks.length})\n`;
    TIERS.forEach(tierObj => {
      const tierItems = data.completedTasks.filter(t => t.tier === tierObj.id);
      if (tierItems.length > 0) {
        md += `### ${tierObj.emoji} ${tierObj.name} (${tierItems.length})\n`;
        tierItems.forEach(t => {
          md += `- [x] **[${t.priority.toUpperCase()}]** ${t.title} *(#${t.category || 'General'})*\n`;
          if (t.description) md += `  - *Notes:* ${t.description.replace(/\n/g, ' ')}\n`;
        });
        md += `\n`;
      }
    });

    if (data.completedTasks.length === 0) {
      md += `*No completed goals logged in this 7-day period.*\n\n`;
    }

    md += `## 🧠 Deep Work & Flow Velocity\n`;
    md += `| Metric | Weekly Total |\n`;
    md += `|---|---|\n`;
    md += `| **Total Focus Hours** | ${data.focusHours} hrs (${data.focusMins} mins) |\n`;
    md += `| **Completed Sprints** | ${data.weeklySessions.length} sessions |\n`;
    md += `| **Average Session** | ${data.avgSessionMins} mins |\n`;
    md += `| **Peak Sprint** | ${data.maxSessionMins} mins |\n\n`;

    md += `## 🔁 Habit Consistency Matrix (Past 7 Days)\n`;
    md += `| Habit | 7-Day Consistency | Adherence |\n`;
    md += `|---|---|---|\n`;
    data.habitsStats.forEach(h => {
      md += `| ${h.icon} ${h.title} | \`${h.dotString}\` | **${h.pct}%** |\n`;
    });
    md += `| **Overall Consistency Score** | | **${data.overallHabitAdherence}%** |\n\n`;

    md += `## 🎯 High-Leverage Priorities In Flight\n`;
    const topActive = data.activeTasks.slice(0, 8);
    if (topActive.length > 0) {
      topActive.forEach(t => {
        const tierObj = TIERS.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task' };
        md += `- [ ] **[${t.priority.toUpperCase()}]** ${t.title} — *${tierObj.emoji} ${tierObj.name}* *(#${t.category || 'General'})*\n`;
      });
      md += `\n`;
    } else {
      md += `*All active objectives cleared!*\n\n`;
    }

    md += `---\n*Generated automatically by Tesseract Multi-Horizon Executive Operating System.*`;
    return md;
  },

  generateHTMLPreview() {
    const data = this.getReportData();
    let html = `
      <div class="report-preview-container">
        <div class="report-header-banner">
          <div class="report-badge-pill">OFFICIAL EXECUTIVE DEBRIEF</div>
          <h2 class="report-doc-title">TESSERACT WEEKLY REPORT</h2>
          <div class="report-meta-sub">
            <span>👤 ${escapeHTML(data.userName)}</span>
            <span>•</span>
            <span>📅 ${data.dateRangeStr}</span>
          </div>
        </div>

        <!-- 4-Stat Summary Cards -->
        <div class="report-stats-grid">
          <div class="report-stat-card gold">
            <span class="report-stat-label">EXECUTIVE RANK</span>
            <span class="report-stat-value">Lvl ${data.level}</span>
            <span class="report-stat-sub">${data.rankTitle}</span>
          </div>
          <div class="report-stat-card">
            <span class="report-stat-label">TOTAL XP</span>
            <span class="report-stat-value">${data.totalXP.toLocaleString()}</span>
            <span class="report-stat-sub">${data.streak} Day Streak 🔥</span>
          </div>
          <div class="report-stat-card">
            <span class="report-stat-label">DEEP WORK</span>
            <span class="report-stat-value">${data.focusHours}h</span>
            <span class="report-stat-sub">${data.weeklySessions.length} Flow Sprints</span>
          </div>
          <div class="report-stat-card">
            <span class="report-stat-label">HABIT SCORE</span>
            <span class="report-stat-value">${data.overallHabitAdherence}%</span>
            <span class="report-stat-sub">7-Day Consistency</span>
          </div>
        </div>

        <!-- Section: Completed Goals -->
        <div class="report-section-box">
          <div class="report-section-title">
            <span>✅ Completed Goals & Milestones</span>
            <span class="report-count-badge">${data.completedTasks.length} Done</span>
          </div>
          <div class="report-tasks-list">
    `;

    if (data.completedTasks.length === 0) {
      html += `<div class="report-empty-note">No goals marked completed in this period.</div>`;
    } else {
      TIERS.forEach(tierObj => {
        const tierItems = data.completedTasks.filter(t => t.tier === tierObj.id);
        if (tierItems.length > 0) {
          html += `
            <div class="report-tier-group">
              <div class="report-tier-header" style="color: ${tierObj.color || 'var(--accent-primary)'}">
                ${tierObj.emoji} ${tierObj.name} (${tierItems.length})
              </div>
          `;
          tierItems.forEach(t => {
            html += `
              <div class="report-task-row">
                <span class="report-check">✓</span>
                <span class="report-task-name">${escapeHTML(t.title)}</span>
                <span class="report-prio-pill prio-${t.priority}">${t.priority}</span>
                <span class="report-cat-tag">#${escapeHTML(t.category || 'General')}</span>
              </div>
            `;
          });
          html += `</div>`;
        }
      });
    }

    html += `
          </div>
        </div>

        <!-- Section: Habit Consistency Matrix -->
        <div class="report-section-box">
          <div class="report-section-title">
            <span>🔁 Habit Cadence Matrix</span>
            <span class="report-count-badge">${data.overallHabitAdherence}% Adherence</span>
          </div>
          <div class="report-habits-table">
            <div class="report-habit-header-row">
              <span>HABIT</span>
              <span>7-DAY CONSISTENCY</span>
              <span>SCORE</span>
            </div>
    `;

    data.habitsStats.forEach(h => {
      html += `
        <div class="report-habit-data-row">
          <span class="report-habit-name">${h.icon} ${escapeHTML(h.title)}</span>
          <span class="report-habit-dots font-mono">${h.dotString}</span>
          <span class="report-habit-pct">${h.pct}%</span>
        </div>
      `;
    });

    html += `
          </div>
        </div>

        <!-- Section: Active Priorities -->
        <div class="report-section-box">
          <div class="report-section-title">
            <span>🎯 High-Leverage Objectives In Flight</span>
            <span class="report-count-badge">${data.activeTasks.length} Active</span>
          </div>
          <div class="report-tasks-list">
    `;

    const topActive = data.activeTasks.slice(0, 6);
    if (topActive.length === 0) {
      html += `<div class="report-empty-note">All strategic objectives completed!</div>`;
    } else {
      topActive.forEach(t => {
        const tierObj = TIERS.find(ti => ti.id === t.tier) || { emoji: '📌', name: 'Task' };
        html += `
          <div class="report-task-row active">
            <span class="report-bullet">•</span>
            <span class="report-task-name">${escapeHTML(t.title)}</span>
            <span class="report-tier-badge">${tierObj.emoji} ${tierObj.name}</span>
            <span class="report-prio-pill prio-${t.priority}">${t.priority}</span>
          </div>
        `;
      });
    }

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  },

  open() {
    window.location.href = 'report.html';
  },

  close() {
    const modal = document.getElementById('weekly-report-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  },

  copyMarkdown() {
    const md = this.generateMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 Executive Weekly Report copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard.', 'error');
    });
  },

  downloadMarkdown() {
    const md = this.generateMarkdown();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `tesseract_executive_report_${dateStr}.md`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast('📥 Downloaded executive weekly report (.md)', 'success');
  },

  printReport() {
    window.print();
  }
};


// Expose FocusEngine globally on window
if (typeof window !== "undefined") {
  window.FocusEngine = FocusEngine;
}

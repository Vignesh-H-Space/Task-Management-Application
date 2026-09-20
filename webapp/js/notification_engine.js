/**
 * TESSERACT EXECUTIVE OS - NOTIFICATION & RITUAL ALARM ENGINE
 * 
 * Provides native lock-screen notifications, Morning Priming prompts,
 * Evening Shutdown reminders, and task deadline alerts via Web Push / Service Worker.
 */

const NotificationEngine = {
  STORAGE_KEY: 'tesseract_notifications_config',

  // Default configuration
  config: {
    enabled: false,
    morningTime: '08:00',
    morningEnabled: true,
    eveningTime: '21:30',
    eveningEnabled: true,
    taskDeadlinesEnabled: true,
    lastMorningAlertDate: null,
    lastEveningAlertDate: null,
    lastDeadlineCheckTime: 0
  },

  checkTimer: null,

  /**
   * Initialize notification engine on app startup
   */
  init() {
    this.loadConfig();
    this.updatePermissionState();

    // Start periodic background checker (every 45 seconds when page is open)
    if (this.checkTimer) clearInterval(this.checkTimer);
    this.checkTimer = setInterval(() => {
      this.runAlarmChecks();
    }, 45000);

    // Initial check right after boot
    setTimeout(() => {
      this.runAlarmChecks();
    }, 2000);
  },

  loadConfig() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse notifications config:', e);
      }
    }
  },

  saveConfig() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    // If SyncEngine is active, sync settings to cloud
    if (typeof SyncEngine !== 'undefined' && SyncEngine.status === 'synced') {
      SyncEngine.queuePush();
    }
  },

  /**
   * Checks current permission status from browser API
   */
  getPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission; // 'default', 'granted', 'denied'
  },

  updatePermissionState() {
    const perm = this.getPermission();
    if (perm !== 'granted') {
      this.config.enabled = false;
    }
    this.updateUI();
  },

  /**
   * Request native browser/OS notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      alert('Native Web Notifications are not supported by this browser.');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        this.config.enabled = true;
        this.saveConfig();
        this.updateUI();
        if (typeof showToast === 'function') {
          showToast('🔔 Notifications enabled! Alarms are active.', 'success');
        }
        await this.sendTestNotification();
        return true;
      } else {
        this.config.enabled = false;
        this.saveConfig();
        this.updateUI();
        if (result === 'denied') {
          alert('Notification permission was blocked. Please enable notifications in your browser/phone settings for this site.');
        }
        return false;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    }
  },

  /**
   * Send a rich native notification via ServiceWorker (with fallback to Notification constructor)
   */
  async sendNotification(title, options = {}) {
    if (this.getPermission() !== 'granted') return;

    const defaultOptions = {
      icon: './icons/icon-192.svg',
      badge: './icons/shortcut-task.svg',
      vibrate: [200, 100, 200],
      tag: 'tesseract-alert',
      renotify: true,
      requireInteraction: false
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Try service worker registration first (works on Android PWA lock screens & notification tray)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && 'showNotification' in reg) {
          return await reg.showNotification(title, finalOptions);
        }
      } catch (e) {
        console.warn('SW showNotification failed, falling back to window Notification:', e);
      }
    }

    // Fallback
    try {
      return new Notification(title, finalOptions);
    } catch (e) {
      console.error('Native notification dispatch failed:', e);
    }
  },

  /**
   * Run background checks for Morning Setup, Evening Shutdown, and Deadlines
   */
  runAlarmChecks() {
    if (!this.config.enabled || this.getPermission() !== 'granted') return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    const todayDateStr = now.toISOString().split('T')[0];

    // 1. Morning Priming Prompt
    if (this.config.morningEnabled && currentTimeStr >= this.config.morningTime) {
      if (this.config.lastMorningAlertDate !== todayDateStr) {
        // Check if user has already completed morning setup today
        let morningCompleted = false;
        if (typeof RitualsEngine !== 'undefined' && RitualsEngine.data) {
          morningCompleted = RitualsEngine.data.morningDate === todayDateStr && (RitualsEngine.data.morningTop3 || []).length > 0;
        }

        if (!morningCompleted) {
          this.sendNotification('🌅 Morning Priming: Command Today', {
            body: 'Good morning! Select your Top 3 high-leverage priorities for today.',
            tag: 'morning-ritual-alarm',
            data: { action: 'morning' },
            actions: [
              { action: 'morning', title: '🎯 Set Top 3' }
            ]
          });
          this.config.lastMorningAlertDate = todayDateStr;
          this.saveConfig();
        }
      }
    }

    // 2. Evening Shutdown Reminder
    if (this.config.eveningEnabled && currentTimeStr >= this.config.eveningTime) {
      if (this.config.lastEveningAlertDate !== todayDateStr) {
        let eveningCompleted = false;
        if (typeof RitualsEngine !== 'undefined' && RitualsEngine.data) {
          eveningCompleted = RitualsEngine.data.eveningDate === todayDateStr;
        }

        if (!eveningCompleted) {
          const streakCount = window.state && window.state.streak ? window.state.streak.count : 1;
          this.sendNotification('🌙 Evening Shutdown: Protect Your Streak', {
            body: `Ready for your debrief? Log your wins to protect your ${streakCount}-day active streak.`,
            tag: 'evening-ritual-alarm',
            data: { action: 'evening' },
            actions: [
              { action: 'evening', title: '✨ Review Wins' }
            ]
          });
          this.config.lastEveningAlertDate = todayDateStr;
          this.saveConfig();
        }
      }
    }

    // 3. Urgent Task Deadline Alerts (checks once every 2 hours after 4 PM)
    if (this.config.taskDeadlinesEnabled && now.getHours() >= 16) {
      const lastCheck = this.config.lastDeadlineCheckTime || 0;
      if (Date.now() - lastCheck > 2 * 60 * 60 * 1000) {
        this.checkPendingUrgentTasks(todayDateStr);
        this.config.lastDeadlineCheckTime = Date.now();
        this.saveConfig();
      }
    }
  },

  /**
   * Check if user has urgent uncompleted tasks for today
   */
  checkPendingUrgentTasks(todayDateStr) {
    const tasks = window.state && Array.isArray(window.state.tasks) ? window.state.tasks : [];
    const pendingUrgent = tasks.filter(t => !t.completed && (t.priority === 'urgent' || t.priority === 'high') && (t.tier === 'daily' || t.dueDate === todayDateStr));

    if (pendingUrgent.length > 0) {
      const task = pendingUrgent[0];
      this.sendNotification('⚡ Priority Alert: Incomplete Daily Goals', {
        body: `"${task.title}" and ${pendingUrgent.length - 1} other priority item(s) are pending for today.`,
        tag: 'task-deadline-alert',
        data: { action: 'task', id: task.id },
        actions: [
          { action: 'task_' + task.id, title: 'Open Task' }
        ]
      });
    }
  },

  /**
   * Send a rich test notification immediately
   */
  async sendTestNotification() {
    const perm = this.getPermission();
    if (perm !== 'granted') {
      const ok = await this.requestPermission();
      if (!ok) return;
    }

    await this.sendNotification('⚡ Tesseract Executive OS', {
      body: `Alarms verified! Morning Priming at ${this.config.morningTime} & Evening Review at ${this.config.eveningTime}.`,
      tag: 'test-notification',
      data: { action: 'test' }
    });

    if (typeof showToast === 'function') {
      showToast('📲 Test notification dispatched to your phone lock screen!', 'success');
    }
  },

  // ════════════════════════════════════════════════════════════
  // 🎛️ MODAL & UI MANAGEMENT
  // ════════════════════════════════════════════════════════════

  openModal() {
    const modal = document.getElementById('notification-settings-modal');
    if (!modal) return;

    this.updateUI();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeModal() {
    const modal = document.getElementById('notification-settings-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  updateUI() {
    const perm = this.getPermission();
    const statusPill = document.getElementById('notif-status-pill');
    const headerBell = document.getElementById('header-notif-btn');
    const toggleMaster = document.getElementById('notif-master-toggle');
    const morningTimeInput = document.getElementById('notif-morning-time');
    const morningToggle = document.getElementById('notif-morning-toggle');
    const eveningTimeInput = document.getElementById('notif-evening-time');
    const eveningToggle = document.getElementById('notif-evening-toggle');
    const deadlineToggle = document.getElementById('notif-deadline-toggle');

    if (headerBell) {
      if (this.config.enabled && perm === 'granted') {
        headerBell.classList.add('notif-active');
        headerBell.title = 'Alarms Active (Morning: ' + this.config.morningTime + ', Evening: ' + this.config.eveningTime + ')';
      } else {
        headerBell.classList.remove('notif-active');
        headerBell.title = 'Notifications & Alarms';
      }
    }

    if (statusPill) {
      if (perm === 'granted') {
        statusPill.className = 'notif-status-pill pill-active';
        statusPill.innerHTML = '<i data-lucide="check-circle"></i> System Permissions Granted';
      } else if (perm === 'denied') {
        statusPill.className = 'notif-status-pill pill-denied';
        statusPill.innerHTML = '<i data-lucide="x-circle"></i> Blocked in Browser Settings';
      } else {
        statusPill.className = 'notif-status-pill pill-default';
        statusPill.innerHTML = '<i data-lucide="bell-off"></i> Permission Required';
      }
    }

    if (toggleMaster) toggleMaster.checked = this.config.enabled && perm === 'granted';
    if (morningTimeInput) morningTimeInput.value = this.config.morningTime;
    if (morningToggle) morningToggle.checked = this.config.morningEnabled;
    if (eveningTimeInput) eveningTimeInput.value = this.config.eveningTime;
    if (eveningToggle) eveningToggle.checked = this.config.eveningEnabled;
    if (deadlineToggle) deadlineToggle.checked = this.config.taskDeadlinesEnabled;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Save changes made in the settings modal
   */
  handleSaveSettings() {
    const morningTimeInput = document.getElementById('notif-morning-time');
    const morningToggle = document.getElementById('notif-morning-toggle');
    const eveningTimeInput = document.getElementById('notif-evening-time');
    const eveningToggle = document.getElementById('notif-evening-toggle');
    const deadlineToggle = document.getElementById('notif-deadline-toggle');

    if (morningTimeInput) this.config.morningTime = morningTimeInput.value || '08:00';
    if (morningToggle) this.config.morningEnabled = morningToggle.checked;
    if (eveningTimeInput) this.config.eveningTime = eveningTimeInput.value || '21:30';
    if (eveningToggle) this.config.eveningEnabled = eveningToggle.checked;
    if (deadlineToggle) this.config.taskDeadlinesEnabled = deadlineToggle.checked;

    this.saveConfig();
    this.closeModal();

    if (typeof showToast === 'function') {
      showToast('💾 Alarm preferences saved successfully!', 'success');
    }
  },

  async handleToggleMaster(event) {
    const isChecked = event.target.checked;
    if (isChecked) {
      const granted = await this.requestPermission();
      if (!granted) {
        event.target.checked = false;
      }
    } else {
      this.config.enabled = false;
      this.saveConfig();
      this.updateUI();
      if (typeof showToast === 'function') {
        showToast('Notifications paused.', 'info');
      }
    }
  }
};

// Global export
window.NotificationEngine = NotificationEngine;

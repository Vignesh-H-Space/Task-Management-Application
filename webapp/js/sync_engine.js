/**
 * TESSERACT EXECUTIVE OS - E2EE REAL-TIME SYNC ENGINE
 * 
 * Provides Zero-Knowledge End-to-End Encryption (AES-GCM 256-bit + PBKDF2)
 * paired with Firebase Cloud Firestore real-time WebSocket listeners.
 *
 * Privacy Guarantee:
 * - All executive data (tasks, habits, streaks, XP, bucket list) is encrypted
 *   in the client browser BEFORE being sent to Google Firebase.
 * - Google's servers store ONLY scrambled ciphertext ({ iv, salt, ciphertext }).
 * - Decryption happens strictly in the user's browser using their secret passphrase.
 */

const SyncEngine = {
  // Storage Keys
  STORAGE_FIREBASE_CONFIG: 'tesseract_firebase_config',
  STORAGE_ROOM_ID: 'tesseract_sync_room_id',
  STORAGE_PASSPHRASE: 'tesseract_sync_passphrase',
  STORAGE_DEVICE_ID: 'tesseract_device_id',
  STORAGE_LAST_SYNCED: 'tesseract_sync_last_synced',

  // Active State
  status: 'unconfigured', // 'unconfigured' | 'connecting' | 'synced' | 'syncing' | 'error' | 'offline'
  statusMessage: 'Local Storage Only',
  db: null,
  firebaseApp: null,
  unsubscribeListener: null,
  pushDebounceTimer: null,
  isApplyingRemote: false,
  lastRemoteUpdatedAt: 0,
  cachedKey: null,
  cachedPassphrase: null,
  cachedSaltStr: null,

  /**
   * Initialize Sync Engine on page boot
   */
  async init() {
    this.checkPairingUrl();
    this.updateUIStatus();

    const config = this.getConfig();
    const roomId = this.getRoomId();
    const passphrase = this.getPassphrase();

    if (!config || !roomId || !passphrase) {
      this.setStatus('unconfigured', 'Cloud Sync Not Configured (Local Only)');
      return;
    }

    await this.connect();
  },

  /**
   * Unique identifier for this device/browser to prevent echo feedback loops
   */
  getDeviceId() {
    let id = localStorage.getItem(this.STORAGE_DEVICE_ID);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(this.STORAGE_DEVICE_ID, id);
    }
    return id;
  },

  getConfig() {
    const raw = localStorage.getItem(this.STORAGE_FIREBASE_CONFIG);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  getRoomId() {
    return localStorage.getItem(this.STORAGE_ROOM_ID) || '';
  },

  getPassphrase() {
    return localStorage.getItem(this.STORAGE_PASSPHRASE) || '';
  },

  saveCredentials(config, roomId, passphrase) {
    if (typeof config === 'string') {
      config = this.parseConfigString(config);
    }
    if (!config || !config.apiKey || !config.projectId) {
      throw new Error('Invalid Firebase configuration. Missing apiKey or projectId.');
    }
    if (!roomId || !roomId.trim()) {
      throw new Error('Sync Room ID is required.');
    }
    if (!passphrase || passphrase.length < 6) {
      throw new Error('Master Passphrase must be at least 6 characters long.');
    }

    localStorage.setItem(this.STORAGE_FIREBASE_CONFIG, JSON.stringify(config));
    localStorage.setItem(this.STORAGE_ROOM_ID, roomId.trim().toLowerCase());
    localStorage.setItem(this.STORAGE_PASSPHRASE, passphrase.trim());
    
    // Invalidate cached crypto key
    this.cachedKey = null;
    this.cachedPassphrase = null;
    this.cachedSaltStr = null;
  },

  clearCredentials() {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
    localStorage.removeItem(this.STORAGE_FIREBASE_CONFIG);
    localStorage.removeItem(this.STORAGE_ROOM_ID);
    localStorage.removeItem(this.STORAGE_PASSPHRASE);
    localStorage.removeItem(this.STORAGE_LAST_SYNCED);
    this.cachedKey = null;
    this.cachedPassphrase = null;
    this.cachedSaltStr = null;
    this.setStatus('unconfigured', 'Cloud Sync Disconnected (Local Only)');
  },

  /**
   * Helper to parse Firebase config whether user pastes raw JSON or JS object snippet
   */
  parseConfigString(rawStr) {
    if (!rawStr || typeof rawStr !== 'string') return null;
    let clean = rawStr.trim();

    // If pasted code like: const firebaseConfig = { ... };
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      clean = match[0];
    }

    // Try native JSON first
    try {
      return JSON.parse(clean);
    } catch (e) {
      // If JS object notation without quoted keys (e.g. apiKey: "...")
      try {
        const jsonFormatted = clean
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
          .replace(/'/g, '"')
          .replace(/,\s*}/g, '}');
        return JSON.parse(jsonFormatted);
      } catch (err2) {
        // Direct regex extraction fallback
        const extract = (key) => {
          const r = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
          const m = clean.match(r);
          return m ? m[1] : '';
        };
        const apiKey = extract('apiKey');
        const projectId = extract('projectId');
        if (apiKey && projectId) {
          return {
            apiKey,
            authDomain: extract('authDomain'),
            projectId,
            storageBucket: extract('storageBucket'),
            messagingSenderId: extract('messagingSenderId'),
            appId: extract('appId'),
            measurementId: extract('measurementId')
          };
        }
        return null;
      }
    }
  },

  // ════════════════════════════════════════════════════════════
  // 🔐 ZERO-KNOWLEDGE CRYPTOGRAPHY (AES-256-GCM + PBKDF2)
  // ════════════════════════════════════════════════════════════

  /**
   * Convert ArrayBuffer to Base64
   */
  bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  /**
   * Convert Base64 to ArrayBuffer
   */
  base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  /**
   * Derive AES-GCM 256-bit key from passphrase and salt using PBKDF2 (SHA-256, 100k iterations)
   */
  async deriveKey(passphrase, saltBytes) {
    const saltStr = this.bufferToBase64(saltBytes);
    if (this.cachedKey && this.cachedPassphrase === passphrase && this.cachedSaltStr === saltStr) {
      return this.cachedKey;
    }

    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Cryptography API is unavailable. Ensure HTTPS or localhost is used.');
    }

    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const derived = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.cachedKey = derived;
    this.cachedPassphrase = passphrase;
    this.cachedSaltStr = saltStr;
    return derived;
  },

  /**
   * Encrypt a JavaScript data object into zero-knowledge ciphertext
   */
  async encryptPayload(dataObject, passphrase) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for AES-GCM
    const key = await this.deriveKey(passphrase, salt);

    const jsonString = JSON.stringify(dataObject);
    const encodedData = new TextEncoder().encode(jsonString);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    return {
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      ciphertext: this.bufferToBase64(ciphertextBuffer),
      updatedAt: Date.now(),
      deviceId: this.getDeviceId(),
      version: '2.0'
    };
  },

  /**
   * Decrypt zero-knowledge ciphertext back into a JavaScript data object
   */
  async decryptPayload(encryptedRecord, passphrase) {
    if (!encryptedRecord || !encryptedRecord.salt || !encryptedRecord.iv || !encryptedRecord.ciphertext) {
      throw new Error('Invalid encrypted payload structure received from cloud.');
    }

    const saltBytes = new Uint8Array(this.base64ToBuffer(encryptedRecord.salt));
    const ivBytes = new Uint8Array(this.base64ToBuffer(encryptedRecord.iv));
    const ciphertextBytes = this.base64ToBuffer(encryptedRecord.ciphertext);

    const key = await this.deriveKey(passphrase, saltBytes);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        key,
        ciphertextBytes
      );

      const jsonString = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(jsonString);
    } catch (err) {
      throw new Error('Decryption failed. Please verify your Master Passphrase matches the writing device.');
    }
  },

  // ════════════════════════════════════════════════════════════
  // ☁️ FIREBASE FIRESTORE CONNECTION & REAL-TIME WEBSOCKET
  // ════════════════════════════════════════════════════════════

  /**
   * Connect to Firebase and listen to remote workspace updates
   */
  async connect() {
    const config = this.getConfig();
    const roomId = this.getRoomId();
    const passphrase = this.getPassphrase();

    if (!config || !roomId || !passphrase) {
      this.setStatus('unconfigured', 'Cloud Sync Not Configured');
      return;
    }

    if (typeof firebase === 'undefined') {
      this.setStatus('offline', 'Firebase SDK loading or offline...');
      return;
    }

    this.setStatus('connecting', 'Connecting to Cloud Mesh...');

    try {
      // Initialize Firebase App instance
      const appName = 'tesseractSyncApp';
      let targetApp = null;
      try {
        targetApp = firebase.app(appName);
      } catch (e) {
        targetApp = firebase.initializeApp(config, appName);
      }
      this.firebaseApp = targetApp;
      this.db = this.firebaseApp.firestore();

      // Enable offline persistence if available
      try {
        await this.db.enablePersistence({ synchronizeTabs: true });
      } catch (e) {
        // Ignore if already enabled or unsupported in current context
      }

      // Unsubscribe any previous listener
      if (this.unsubscribeListener) {
        this.unsubscribeListener();
        this.unsubscribeListener = null;
      }

      const docRef = this.db.collection('workspaces').doc(roomId);

      // Real-time WebSocket snapshot listener
      this.unsubscribeListener = docRef.onSnapshot(
        async (snapshot) => {
          if (!snapshot.exists) {
            // Workspace doesn't exist yet on Firestore, push local state as initial baseline
            this.setStatus('synced', 'E2EE Cloud Connected (New Room)');
            this.pushNow();
            return;
          }

          const remoteData = snapshot.data();
          if (!remoteData) return;

          // Check if update originated from this exact device (prevent echo loops)
          if (remoteData.deviceId === this.getDeviceId()) {
            this.setStatus('synced', 'E2EE Synced');
            return;
          }

          // Check if remote data is newer than what we last processed
          if (remoteData.updatedAt && remoteData.updatedAt <= this.lastRemoteUpdatedAt) {
            return;
          }

          try {
            this.setStatus('syncing', 'Decrypting incoming cloud update...');
            const decryptedState = await this.decryptPayload(remoteData, passphrase);
            this.lastRemoteUpdatedAt = remoteData.updatedAt;
            localStorage.setItem(this.STORAGE_LAST_SYNCED, new Date(remoteData.updatedAt).toLocaleTimeString());

            this.applyRemoteState(decryptedState);
            this.setStatus('synced', 'E2EE Synced');

            if (typeof showToast === 'function') {
              showToast('⚡ Live sync: Updated from mobile device', 'info');
            }
          } catch (decryptErr) {
            console.error('E2EE Decryption Error:', decryptErr);
            this.setStatus('error', 'Decryption Error: Check Passphrase');
            if (typeof showToast === 'function') {
              showToast('⚠️ Decryption error. Check your master passphrase!', 'error');
            }
          }
        },
        (error) => {
          console.error('Firestore onSnapshot error:', error);
          this.setStatus('error', 'Cloud sync connection error');
        }
      );

      this.setStatus('synced', 'E2EE Cloud Connected');
    } catch (err) {
      console.error('Failed to initialize Firebase Sync:', err);
      this.setStatus('error', err.message || 'Firebase Connection Error');
    }
  },

  /**
   * Queue a debounced push (600ms) to cloud when local data changes
   */
  queuePush() {
    if (this.isApplyingRemote) return; // Never echo back during remote payload ingestion
    if (this.status === 'unconfigured') return;

    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
    }

    this.pushDebounceTimer = setTimeout(() => {
      this.pushNow();
    }, 600);
  },

  /**
   * Instantly encrypt and write complete executive state to Firestore
   */
  async pushNow() {
    if (this.isApplyingRemote) return;
    const config = this.getConfig();
    const roomId = this.getRoomId();
    const passphrase = this.getPassphrase();

    if (!config || !roomId || !passphrase || !this.db) {
      return;
    }

    try {
      this.setStatus('syncing', 'Encrypting & syncing to cloud...');

      // Gather complete Executive OS state bundle
      const payload = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        tasks: window.state ? window.state.tasks : JSON.parse(localStorage.getItem('tesseract_goals_tasks_data') || '[]'),
        profile: window.state ? window.state.profile : JSON.parse(localStorage.getItem('tesseract_profile_data') || '{}'),
        streak: window.state ? window.state.streak : JSON.parse(localStorage.getItem('tesseract_streak') || '{}'),
        xpData: (typeof XPEngine !== 'undefined') ? XPEngine.data : JSON.parse(localStorage.getItem('tesseract_xp_data') || '{}'),
        habits: (typeof HabitsEngine !== 'undefined') ? HabitsEngine.habits : JSON.parse(localStorage.getItem('tesseract_habits_data') || '[]'),
        bucketList: (typeof BucketListEngine !== 'undefined') ? BucketListEngine.dreams : JSON.parse(localStorage.getItem('tesseract_bucketlist_data') || '[]'),
        focusSessions: (typeof FocusEngine !== 'undefined') ? FocusEngine.getSessions() : JSON.parse(localStorage.getItem('tesseract_focus_sessions') || '[]'),
        rituals: (typeof RitualsEngine !== 'undefined') ? RitualsEngine.data : JSON.parse(localStorage.getItem('tesseract_rituals_data') || '{}'),
        backlogs: (typeof BacklogEngine !== 'undefined') ? BacklogEngine.items : JSON.parse(localStorage.getItem('tesseract_backlog_data') || '[]'),
        docket: (typeof DocketEngine !== 'undefined') ? DocketEngine.items : JSON.parse(localStorage.getItem('tesseract_docket_data') || '[]')
      };

      // Encrypt with native AES-256-GCM
      const encryptedRecord = await this.encryptPayload(payload, passphrase);
      this.lastRemoteUpdatedAt = encryptedRecord.updatedAt;

      // Push zero-knowledge ciphertext to Firestore
      const docRef = this.db.collection('workspaces').doc(roomId);
      await docRef.set(encryptedRecord, { merge: true });

      const timeStr = new Date().toLocaleTimeString();
      localStorage.setItem(this.STORAGE_LAST_SYNCED, timeStr);
      this.setStatus('synced', `E2EE Synced at ${timeStr}`);
    } catch (err) {
      console.error('Sync push failed:', err);
      this.setStatus('error', 'Sync push failed: ' + (err.message || 'Network error'));
    }
  },

  /**
   * Ingest decrypted remote state into local storage & memory
   */
  applyRemoteState(data) {
    if (!data) return;
    this.isApplyingRemote = true;

    try {
      // 1. Tasks
      if (Array.isArray(data.tasks)) {
        if (window.state) window.state.tasks = data.tasks;
        localStorage.setItem('tesseract_goals_tasks_data', JSON.stringify(data.tasks));
      }

      // 2. Profile
      if (data.profile) {
        if (window.state) window.state.profile = data.profile;
        localStorage.setItem('tesseract_profile_data', JSON.stringify(data.profile));
      }

      // 3. Streaks
      if (data.streak) {
        if (window.state) window.state.streak = data.streak;
        localStorage.setItem('tesseract_streak', JSON.stringify(data.streak));
      }

      // 4. XP Engine
      if (data.xpData) {
        if (typeof XPEngine !== 'undefined') {
          XPEngine.data = data.xpData;
        }
        localStorage.setItem('tesseract_xp_data', JSON.stringify(data.xpData));
      }

      // 5. Habits Engine
      if (data.habits) {
        if (typeof HabitsEngine !== 'undefined') {
          HabitsEngine.habits = data.habits;
        }
        localStorage.setItem('tesseract_habits_data', JSON.stringify(data.habits));
      }

      // 6. Bucket List
      if (data.bucketList) {
        if (typeof BucketListEngine !== 'undefined') {
          BucketListEngine.dreams = data.bucketList;
        }
        localStorage.setItem('tesseract_bucketlist_data', JSON.stringify(data.bucketList));
      }

      // 7. Focus Sessions
      if (data.focusSessions) {
        localStorage.setItem('tesseract_focus_sessions', JSON.stringify(data.focusSessions));
      }

      // 8. Rituals
      if (data.rituals) {
        if (typeof RitualsEngine !== 'undefined') {
          RitualsEngine.data = data.rituals;
        }
        localStorage.setItem('tesseract_rituals_data', JSON.stringify(data.rituals));
      }

      // 9. Backlogs
      if (data.backlogs) {
        if (typeof BacklogEngine !== 'undefined') {
          BacklogEngine.items = data.backlogs;
          if (typeof Components !== 'undefined' && Components.getCurrentPage() === 'backlogs') {
            BacklogEngine.render();
          }
        }
        localStorage.setItem('tesseract_backlog_data', JSON.stringify(data.backlogs));
      }

      if (data.docket && Array.isArray(data.docket)) {
        if (typeof DocketEngine !== 'undefined') {
          DocketEngine.items = data.docket;
          if (typeof Components !== 'undefined' && Components.getCurrentPage() === 'backlogs') {
            DocketEngine.render();
          }
        }
        localStorage.setItem('tesseract_docket_data', JSON.stringify(data.docket));
      }

      // 9. Re-render UI views dynamically
      if (typeof renderAll === 'function') renderAll();
      if (typeof renderSidebarBadgeCounts === 'function') renderSidebarBadgeCounts();
      if (typeof updateAppBadge === 'function') updateAppBadge();
      if (typeof updateHeaderXPWidget === 'function') updateHeaderXPWidget();
      if (typeof renderProfileView === 'function') renderProfileView();
      if (typeof HabitsEngine !== 'undefined' && typeof HabitsEngine.render === 'function') HabitsEngine.render();
      if (typeof BucketListEngine !== 'undefined' && typeof BucketListEngine.render === 'function') BucketListEngine.render();
      if (typeof RoadmapEngine !== 'undefined' && typeof RoadmapEngine.render === 'function') RoadmapEngine.render();
      if (typeof DocketEngine !== 'undefined' && typeof DocketEngine.render === 'function' && typeof Components !== 'undefined' && Components.getCurrentPage() === 'backlogs') DocketEngine.render();
      if (typeof lucide !== 'undefined') lucide.createIcons();

    } finally {
      this.isApplyingRemote = false;
    }
  },

  // ════════════════════════════════════════════════════════════
  // 🔗 FAST PAIRING (URL FRAGMENT & QR CODE)
  // ════════════════════════════════════════════════════════════

  /**
   * Check for #pair= fragment in URL on page load for 1-tap phone setup
   */
  checkPairingUrl() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#pair=')) {
      try {
        const encoded = hash.substring(6);
        const jsonStr = decodeURIComponent(window.atob(encoded));
        const bundle = JSON.parse(jsonStr);

        if (bundle.config && bundle.roomId && bundle.passphrase) {
          this.saveCredentials(bundle.config, bundle.roomId, bundle.passphrase);
          // Remove hash cleanly without page reload
          history.replaceState(null, '', window.location.pathname + window.location.search);
          if (typeof showToast === 'function') {
            showToast('🎉 Paired with Executive Workstation! Real-time E2EE active.', 'success');
          }
        }
      } catch (e) {
        console.error('Failed to parse pairing URL:', e);
      }
    }
  },

  /**
   * Generate an instant pairing URL to scan/open on phone
   */
  generatePairingUrl() {
    const config = this.getConfig();
    const roomId = this.getRoomId();
    const passphrase = this.getPassphrase();

    if (!config || !roomId || !passphrase) return null;

    const bundle = { config, roomId, passphrase };
    const encoded = window.btoa(encodeURIComponent(JSON.stringify(bundle)));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#pair=${encoded}`;
  },

  /**
   * Generate random high-entropy passphrase
   */
  generateRandomPassphrase() {
    const words = [
      'aurora', 'nexus', 'quantum', 'obsidian', 'tesseract', 'solaris', 
      'vanguard', 'zenith', 'cipher', 'apex', 'horizon', 'hyperion',
      'stellar', 'chronos', 'titan', 'valkyrie', 'pulsar', 'vertex'
    ];
    const pick = () => words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${pick()}-${pick()}-${num}`;
  },

  // ════════════════════════════════════════════════════════════
  // 📊 STATUS & UI CONTROLS
  // ════════════════════════════════════════════════════════════

  setStatus(status, message) {
    this.status = status;
    this.statusMessage = message;
    this.updateUIStatus();
  },

  updateUIStatus() {
    const indicator = document.getElementById('sync-status-indicator');
    const modalStatusEl = document.getElementById('sync-modal-status');
    const mobileIndicator = document.getElementById('mobile-sync-status');

    let badgeClass = 'sync-pill-local';
    let icon = 'hard-drive';
    let text = 'Local Only';

    if (this.status === 'synced') {
      badgeClass = 'sync-pill-synced';
      icon = 'lock';
      text = 'E2EE Synced';
    } else if (this.status === 'syncing') {
      badgeClass = 'sync-pill-syncing';
      icon = 'refresh-cw';
      text = 'Syncing...';
    } else if (this.status === 'connecting') {
      badgeClass = 'sync-pill-connecting';
      icon = 'radio';
      text = 'Connecting...';
    } else if (this.status === 'error') {
      badgeClass = 'sync-pill-error';
      icon = 'alert-triangle';
      text = 'Sync Error';
    } else if (this.status === 'offline') {
      badgeClass = 'sync-pill-offline';
      icon = 'wifi-off';
      text = 'Offline';
    }

    if (indicator) {
      indicator.className = `header-sync-pill ${badgeClass}`;
      indicator.innerHTML = `
        <i data-lucide="${icon}" class="sync-icon ${this.status === 'syncing' ? 'spin' : ''}"></i>
        <span class="sync-text">${text}</span>
      `;
      indicator.title = this.statusMessage;
    }

    if (mobileIndicator) {
      mobileIndicator.className = `mobile-sync-badge ${badgeClass}`;
      mobileIndicator.innerHTML = `
        <i data-lucide="${icon}" class="${this.status === 'syncing' ? 'spin' : ''}"></i>
        <span>${text}</span>
      `;
    }

    if (modalStatusEl) {
      modalStatusEl.className = `sync-status-banner ${badgeClass}`;
      modalStatusEl.innerHTML = `
        <div class="sync-banner-icon"><i data-lucide="${icon}"></i></div>
        <div class="sync-banner-info">
          <div class="sync-banner-title">${text}</div>
          <div class="sync-banner-desc">${this.statusMessage}</div>
        </div>
      `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Open the Cloud Sync Configuration Modal
   */
  openModal() {
    let modal = document.getElementById('cloud-sync-modal');
    if (!modal) return;

    const config = this.getConfig();
    const roomId = this.getRoomId();
    const passphrase = this.getPassphrase();

    const configInput = document.getElementById('sync-config-input');
    const roomInput = document.getElementById('sync-room-input');
    const passInput = document.getElementById('sync-passphrase-input');

    if (configInput && config) {
      configInput.value = JSON.stringify(config, null, 2);
    }
    if (roomInput) {
      roomInput.value = roomId || 'executive-matrix';
    }
    if (passInput) {
      passInput.value = passphrase || '';
    }

    this.updatePairingSection();
    this.updateUIStatus();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeModal() {
    const modal = document.getElementById('cloud-sync-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  updatePairingSection() {
    const pairSection = document.getElementById('sync-pairing-section');
    const pairUrlInput = document.getElementById('sync-pair-url');
    if (!pairSection || !pairUrlInput) return;

    const url = this.generatePairingUrl();
    if (url && this.status === 'synced') {
      pairSection.style.display = 'block';
      pairUrlInput.value = url;
    } else {
      pairSection.style.display = 'none';
    }
  },

  /**
   * Save settings from modal form
   */
  async handleSaveSettings() {
    const configInput = document.getElementById('sync-config-input');
    const roomInput = document.getElementById('sync-room-input');
    const passInput = document.getElementById('sync-passphrase-input');

    if (!configInput || !roomInput || !passInput) return;

    try {
      this.saveCredentials(configInput.value, roomInput.value, passInput.value);
      if (typeof showToast === 'function') {
        showToast('🔒 Credentials saved! Connecting to E2EE Cloud...', 'info');
      }
      await this.connect();
      await this.pushNow();
      this.updatePairingSection();
      if (typeof showToast === 'function') {
        showToast('✨ Successfully connected & synchronized!', 'success');
      }
    } catch (err) {
      alert('Setup error: ' + err.message);
    }
  },

  copyPairingLink() {
    const pairUrlInput = document.getElementById('sync-pair-url');
    if (!pairUrlInput || !pairUrlInput.value) return;

    navigator.clipboard.writeText(pairUrlInput.value).then(() => {
      if (typeof showToast === 'function') {
        showToast('📋 Pairing link copied! Send to your phone to pair in 1 tap.', 'success');
      }
    }).catch(() => {
      pairUrlInput.select();
      document.execCommand('copy');
      if (typeof showToast === 'function') {
        showToast('📋 Copied to clipboard!', 'success');
      }
    });
  }
};

// Global export
window.SyncEngine = SyncEngine;

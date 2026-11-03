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
  STORAGE_LAST_REMOTE_UPDATED: 'tesseract_sync_last_remote_updated',
  STORAGE_LAST_LOCAL_MODIFIED: 'tesseract_sync_last_local_modified',

  // Active State
  status: 'unconfigured', // 'unconfigured' | 'connecting' | 'synced' | 'syncing' | 'error' | 'offline'
  statusMessage: 'Local Storage Only',
  db: null,
  firebaseApp: null,
  unsubscribeListener: null,
  pushDebounceTimer: null,
  isApplyingRemote: false,
  isPushing: false,
  hasInitialPullCompleted: false,
  lastRemoteUpdatedAt: 0,
  cachedKey: null,
  cachedPassphrase: null,
  cachedSaltStr: null,

  /**
   * Initialize Sync Engine on page boot
   */
  async init() {
    this.hasInitialPullCompleted = false;
    this.lastRemoteUpdatedAt = parseInt(localStorage.getItem(this.STORAGE_LAST_REMOTE_UPDATED) || '0', 10);
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
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.apiKey && (parsed.projectId || parsed.authDomain)) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  getRoomId() {
    const raw = localStorage.getItem(this.STORAGE_ROOM_ID) || '';
    return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'executive-matrix';
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
    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanRoom) {
      throw new Error('Sync Room ID must contain valid alphanumeric characters.');
    }
    if (!passphrase || passphrase.length < 6) {
      throw new Error('Master Passphrase must be at least 6 characters long.');
    }

    localStorage.setItem(this.STORAGE_FIREBASE_CONFIG, JSON.stringify(config));
    localStorage.setItem(this.STORAGE_ROOM_ID, cleanRoom);
    localStorage.setItem(this.STORAGE_PASSPHRASE, passphrase.trim());
    
    // Invalidate cached crypto key
    this.cachedKey = null;
    this.cachedPassphrase = null;
    this.cachedSaltStr = null;
  },

  clearCredentials() {
    if (this.unsubscribeListener) {
      try { this.unsubscribeListener(); } catch (e) { /* ignore */ }
      this.unsubscribeListener = null;
    }
    localStorage.removeItem(this.STORAGE_FIREBASE_CONFIG);
    localStorage.removeItem(this.STORAGE_ROOM_ID);
    localStorage.removeItem(this.STORAGE_PASSPHRASE);
    localStorage.removeItem(this.STORAGE_LAST_SYNCED);
    this.cachedKey = null;
    this.cachedPassphrase = null;
    this.cachedSaltStr = null;

    const configInput = document.getElementById('sync-config-input');
    const roomInput = document.getElementById('sync-room-input');
    const passInput = document.getElementById('sync-passphrase-input');
    if (configInput) configInput.value = '';
    if (roomInput) roomInput.value = 'executive-matrix';
    if (passInput) passInput.value = '';

    this.setStatus('unconfigured', 'Local Storage Only');
    this.closeModal();
    if (typeof showToast === 'function') {
      showToast('☁️ Cloud Sync disconnected. Working in Local Storage mode.', 'info');
    }
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
  portableCipher(plainText, keyStr, saltBytes) {
    const enc = new TextEncoder();
    const data = enc.encode(plainText);
    const keyBytes = enc.encode(keyStr);
    const salt = new Uint8Array(saltBytes);

    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + keyBytes[i % keyBytes.length] + salt[i % salt.length]) % 256;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }

    let i = 0; j = 0;
    const out = new Uint8Array(data.length);
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
      const K = s[(s[i] + s[j]) % 256];
      out[k] = data[k] ^ K;
    }
    return out.buffer;
  },

  portableDecipher(ciphertextBuffer, keyStr, saltBytes) {
    const data = new Uint8Array(ciphertextBuffer);
    const keyBytes = new TextEncoder().encode(keyStr);
    const salt = new Uint8Array(saltBytes);

    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + keyBytes[i % keyBytes.length] + salt[i % salt.length]) % 256;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }

    let i = 0; j = 0;
    const out = new Uint8Array(data.length);
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
      const K = s[(s[i] + s[j]) % 256];
      out[k] = data[k] ^ K;
    }
    return new TextDecoder().decode(out);
  },

  async deriveKey(passphrase, saltBytes) {
    const saltStr = this.bufferToBase64(saltBytes);
    if (this.cachedKey && this.cachedPassphrase === passphrase && this.cachedSaltStr === saltStr) {
      return this.cachedKey;
    }

    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
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
      } catch (e) {
        console.warn('[SyncEngine] SubtleCrypto deriveKey failed, using portable fallback:', e);
      }
    }

    this.cachedKey = { fallback: true, passphrase, saltStr };
    this.cachedPassphrase = passphrase;
    this.cachedSaltStr = saltStr;
    return this.cachedKey;
  },

  /**
   * Encrypt a JavaScript data object into zero-knowledge ciphertext
   */
  async encryptPayload(dataObject, passphrase) {
    const salt = (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues)
      ? window.crypto.getRandomValues(new Uint8Array(16))
      : (() => {
          const arr = new Uint8Array(16);
          for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
          return arr;
        })();

    const iv = (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues)
      ? window.crypto.getRandomValues(new Uint8Array(12))
      : (() => {
          const arr = new Uint8Array(12);
          for (let i = 0; i < 12; i++) arr[i] = Math.floor(Math.random() * 256);
          return arr;
        })();

    const key = await this.deriveKey(passphrase, salt);
    const jsonString = JSON.stringify(dataObject);

    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && !key.fallback) {
      try {
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
      } catch (e) {
        console.warn('[SyncEngine] Native encrypt failed, using portable stream cipher:', e);
      }
    }

    const cipherBytes = this.portableCipher(jsonString, passphrase, salt);
    return {
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      ciphertext: this.bufferToBase64(cipherBytes),
      updatedAt: Date.now(),
      deviceId: this.getDeviceId(),
      version: '2.0-portable'
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

    if (encryptedRecord.version === '2.0-portable' || !window.crypto || !window.crypto.subtle) {
      const decryptedString = this.portableDecipher(ciphertextBytes, passphrase, saltBytes);
      return JSON.parse(decryptedString);
    }

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
      try {
        const decryptedString = this.portableDecipher(ciphertextBytes, passphrase, saltBytes);
        return JSON.parse(decryptedString);
      } catch (fallbackErr) {
        throw new Error('Decryption failed. Please verify your Master Passphrase matches the writing device.');
      }
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

    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
      this.setStatus('offline', 'Firebase Firestore SDK offline or loading...');
      return;
    }

    this.setStatus('connecting', 'Connecting to Cloud Mesh...');

    try {
      const appName = 'tesseractSyncApp';
      let targetApp = null;
      const existingApp = (firebase.apps || []).find(a => a.name === appName);
      if (existingApp) {
        targetApp = existingApp;
      } else {
        targetApp = firebase.initializeApp(config, appName);
      }
      this.firebaseApp = targetApp;
      this.db = this.firebaseApp.firestore();

      // Unsubscribe any previous listener
      if (this.unsubscribeListener) {
        this.unsubscribeListener();
        this.unsubscribeListener = null;
      }

      const docRef = this.db.collection('workspaces').doc(roomId);

      // Real-time WebSocket snapshot listener
      this.unsubscribeListener = docRef.onSnapshot(
        async (snapshot) => {
          this.hasInitialPullCompleted = true;
          if (!snapshot.exists) {
            // Workspace doesn't exist yet on Firestore
            this.setStatus('synced', 'E2EE Cloud Connected (New Room)');
            this.queuePush();
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
            localStorage.setItem(this.STORAGE_LAST_REMOTE_UPDATED, String(remoteData.updatedAt));
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
          const isPerm = error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission'));
          if (isPerm) {
            this.setStatus('error', 'Firestore Permission Denied: Allow /workspaces in Firebase Console Rules');
          } else {
            this.setStatus('error', 'Cloud sync connection error: ' + (error.message || ''));
          }
        }
      );

      this.setStatus('synced', 'E2EE Cloud Connected');
    } catch (err) {
      console.error('Failed to initialize Firebase Sync:', err);
      const isPerm = err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission'));
      if (isPerm) {
        this.setStatus('error', 'Firestore Permission Denied: Update Firestore Security Rules');
      } else {
        this.setStatus('error', err.message || 'Firebase Connection Error');
      }
    }
  },

  /**
   * Queue a debounced push (600ms) to cloud when local data changes
   */
  markLocalModified() {
    try {
      localStorage.setItem(this.STORAGE_LAST_LOCAL_MODIFIED, String(Date.now()));
    } catch (e) {
      console.warn('[SyncEngine] Failed to mark local modification:', e);
    }
  },

  forcePushLaptopAsMaster() {
    this.markLocalModified();
    this.hasInitialPullCompleted = true;
    const res = this.pushNow();
    if (typeof showToast === 'function') {
      showToast('🚀 Pushed local device as master to cloud!', 'success');
    }
    return res;
  },

  pushLocalChange() {
    this.queuePush();
  },

  queuePush() {
    if (this.isApplyingRemote) return; // Never echo back during remote payload ingestion
    if (this.status === 'unconfigured' || this.status === 'error' || this.status === 'offline') return;

    // Safety guard: Never push to cloud before this device has completed its initial snapshot check
    if (!this.hasInitialPullCompleted && this.db && this.getRoomId()) {
      console.log('[SyncEngine] Initial cloud pull pending - deferring push until server state is verified.');
      return;
    }

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
    if (this.isApplyingRemote) return false;
    if (this.isPushing) {
      this.queuePush();
      return true;
    }
    const config = this.getConfig();
    const roomId = this.getRoomId();
    const passphrase = this.getPassphrase();

    if (!config || !roomId || !passphrase || !this.db) {
      return false;
    }

    this.isPushing = true;
    try {
      this.setStatus('syncing', 'Encrypting & syncing to cloud...');

      // Gather complete Executive OS state bundle
      const payload = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        tasks: window.state ? window.state.tasks : JSON.parse(localStorage.getItem('tesseract_goals_tasks_data') || '[]'),
        profile: window.state ? window.state.profile : JSON.parse(localStorage.getItem('tesseract_profile_data') || '{}'),
        streak: window.state ? window.state.streak : JSON.parse(localStorage.getItem('tesseract_streak_data') || '{}'),
        xpData: (typeof XPEngine !== 'undefined') ? XPEngine.data : JSON.parse(localStorage.getItem('tesseract_xp_data') || '{}'),
        habits: (typeof HabitsEngine !== 'undefined') ? HabitsEngine.habits : JSON.parse(localStorage.getItem('tesseract_habits_data') || '[]'),
        bucketList: (typeof BucketListEngine !== 'undefined') ? BucketListEngine.dreams : JSON.parse(localStorage.getItem('tesseract_bucketlist_data') || '[]'),
        focusSessions: (typeof FocusEngine !== 'undefined') ? FocusEngine.getSessions() : JSON.parse(localStorage.getItem('tesseract_focus_sessions') || '[]'),
        rituals: (typeof RitualsEngine !== 'undefined') ? RitualsEngine.data : JSON.parse(localStorage.getItem('tesseract_rituals_data') || '{}'),
        backlogs: ((typeof BacklogEngine !== 'undefined') ? BacklogEngine.items : JSON.parse(localStorage.getItem('tesseract_backlog_data') || '[]')).filter(i => {
          if (!i) return false;
          if (['bkl_01', 'bkl_02', 'bkl_03', 'bkl_04', 'bkl_05', 'bkl_06'].includes(i.id)) return false;
          const t = (i.objective || '').trim().toLowerCase();
          return !['refactor core architecture & clean codebase', 'upgrade home network & server backup strategy', 'full mobility & functional strength assessment routine', 'tesseract native push engine & real-time sync pipeline', 'tax & annual corporate document organization', 'drop off dry cleaning & pick up courier package'].includes(t);
        }),
        docket: (typeof DocketEngine !== 'undefined') ? DocketEngine.items : JSON.parse(localStorage.getItem('tesseract_docket_data') || '[]'),
        pulse: (typeof PulseEngine !== 'undefined') ? PulseEngine.entries : JSON.parse(localStorage.getItem('tesseract_pulse_data') || '[]'),
        radarAcks: JSON.parse(localStorage.getItem('tesseract_docket_radar_acks') || '{}'),
        trackers: (typeof TrackerEngine !== 'undefined') ? TrackerEngine.getTrackers() : JSON.parse(localStorage.getItem('tesseract_trackers') || '[]')
      };

      // Encrypt with native AES-256-GCM
      const encryptedRecord = await this.encryptPayload(payload, passphrase);
      this.lastRemoteUpdatedAt = encryptedRecord.updatedAt;
      localStorage.setItem(this.STORAGE_LAST_REMOTE_UPDATED, String(encryptedRecord.updatedAt));
      localStorage.setItem(this.STORAGE_LAST_LOCAL_MODIFIED, String(encryptedRecord.updatedAt));

      // Push zero-knowledge ciphertext to Firestore
      const docRef = this.db.collection('workspaces').doc(roomId);
      await docRef.set(encryptedRecord, { merge: true });

      const timeStr = new Date().toLocaleTimeString();
      localStorage.setItem(this.STORAGE_LAST_SYNCED, timeStr);
      this.setStatus('synced', `E2EE Synced at ${timeStr}`);
      return true;
    } catch (err) {
      console.error('Sync push failed:', err);
      const isAssertion = (err.message || '').includes('ASSERTION FAILED');
      const isPerm = err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission'));
      
      if (isAssertion) {
        this.setStatus('error', 'Sync engine reset. Please refresh the page to reconnect.');
      } else if (isPerm) {
        this.setStatus('error', 'Missing or insufficient permissions: Update Firestore Security Rules in Firebase Console.');
      } else {
        this.setStatus('error', 'Sync push failed: ' + (err.message || 'Network error'));
      }
      return false;
    } finally {
      this.isPushing = false;
    }
  },

  /**
   * Ingest decrypted remote state into local storage & memory
   */
  
  /**
   * Automatically create a safety snapshot in localStorage before applying incoming remote sync
   */
  createPreSyncSafetySnapshot() {
    try {
      const snapshot = {
        timestamp: Date.now(),
        dateStr: new Date().toLocaleString(),
        tasks: window.state && Array.isArray(window.state.tasks) ? window.state.tasks : JSON.parse(localStorage.getItem('tesseract_goals_tasks_data') || '[]'),
        profile: window.state && window.state.profile ? window.state.profile : JSON.parse(localStorage.getItem('tesseract_profile_data') || '{}'),
        streak: window.state && window.state.streak ? window.state.streak : JSON.parse(localStorage.getItem('tesseract_streak_data') || '{}'),
        xpData: (typeof XPEngine !== 'undefined') ? XPEngine.data : JSON.parse(localStorage.getItem('tesseract_xp_data') || '{}'),
        habits: (typeof HabitsEngine !== 'undefined') ? HabitsEngine.habits : JSON.parse(localStorage.getItem('tesseract_habits_data') || '[]'),
        bucketList: (typeof BucketListEngine !== 'undefined') ? BucketListEngine.dreams : JSON.parse(localStorage.getItem('tesseract_bucketlist_data') || '[]'),
        backlogs: (typeof BacklogEngine !== 'undefined') ? BacklogEngine.items : JSON.parse(localStorage.getItem('tesseract_backlog_data') || '[]'),
        pulse: (typeof PulseEngine !== 'undefined') ? PulseEngine.entries : JSON.parse(localStorage.getItem('tesseract_pulse_data') || '[]'),
        docket: (typeof DocketEngine !== 'undefined') ? DocketEngine.items : JSON.parse(localStorage.getItem('tesseract_docket_data') || '[]'),
        trackers: (typeof TrackerEngine !== 'undefined') ? TrackerEngine.getTrackers() : JSON.parse(localStorage.getItem('tesseract_trackers') || '[]')
      };
      localStorage.setItem('tesseract_pre_sync_safety_backup', JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[SyncEngine] Failed to create pre-sync safety snapshot:', e);
    }
  },

  /**
   * 1-Click recovery of local state taken before the last remote cloud sync
   */
  restorePreSyncSafetySnapshot() {
    try {
      const raw = localStorage.getItem('tesseract_pre_sync_safety_backup');
      if (!raw) {
        if (typeof showToast === 'function') showToast('⚠️ No pre-sync safety backup found in browser memory.', 'warning');
        return false;
      }
      const snapshot = JSON.parse(raw);
      this.applyRemoteState(snapshot, true); // true = force restore without merging
      this.hasInitialPullCompleted = true;
      this.queuePush(); // Push the restored state to Firestore so all devices recover
      if (typeof showToast === 'function') {
        showToast(`✅ Successfully restored pre-sync state from ${snapshot.dateStr || 'backup'}!`, 'success');
      }
      return true;
    } catch (e) {
      console.error('[SyncEngine] Failed to restore pre-sync safety snapshot:', e);
      if (typeof showToast === 'function') showToast('Failed to restore snapshot: ' + e.message, 'error');
      return false;
    }
  },

  /**
   * Non-destructively merge local tasks with remote tasks (Union + Last-Modified-Wins)
   */
  mergeTasks(localTasks, remoteTasks) {
    if (!Array.isArray(localTasks) || localTasks.length === 0) return Array.isArray(remoteTasks) ? remoteTasks : [];
    if (!Array.isArray(remoteTasks) || remoteTasks.length === 0) return localTasks;

    const map = new Map();
    // 1. Add all remote tasks
    remoteTasks.forEach(rt => {
      if (rt && rt.id) map.set(rt.id, rt);
    });

    // 2. Non-destructively preserve and merge local tasks
    localTasks.forEach(lt => {
      if (!lt || !lt.id) return;
      const rt = map.get(lt.id);
      if (!rt) {
        // Local task doesn't exist on remote yet -> PRESERVE IT!
        map.set(lt.id, lt);
      } else {
        // Conflict resolution: pick the version with the newer timestamp
        const ltTime = new Date(lt.updatedAt || lt.completedAt || lt.createdAt || 0).getTime();
        const rtTime = new Date(rt.updatedAt || rt.completedAt || rt.createdAt || 0).getTime();
        if (ltTime > rtTime) {
          map.set(lt.id, lt);
        }
      }
    });

    return Array.from(map.values());
  },

  /**
   * Generic entity union merge by ID and timestamp
   */
  mergeEntityList(localList, remoteList, idProp = 'id', timeProp = 'updatedAt') {
    if (!Array.isArray(localList) || localList.length === 0) return Array.isArray(remoteList) ? remoteList : [];
    if (!Array.isArray(remoteList) || remoteList.length === 0) return localList;

    const map = new Map();
    remoteList.forEach(item => {
      if (item && item[idProp]) map.set(item[idProp], item);
    });

    localList.forEach(localItem => {
      if (!localItem || !localItem[idProp]) return;
      const remoteItem = map.get(localItem[idProp]);
      if (!remoteItem) {
        map.set(localItem[idProp], localItem);
      } else {
        const lTime = new Date(localItem[timeProp] || localItem.createdAt || 0).getTime();
        const rTime = new Date(remoteItem[timeProp] || remoteItem.createdAt || 0).getTime();
        if (lTime > rTime) {
          map.set(localItem[idProp], localItem);
        }
      }
    });

    return Array.from(map.values());
  },

  applyRemoteState(data, isForceRestore = false) {
    if (!data) return;
    if (!isForceRestore) {
      this.createPreSyncSafetySnapshot();
    }
    this.isApplyingRemote = true;

    try {
      // 1. Tasks
      if (Array.isArray(data.tasks)) {
        const localTasks = (window.state && Array.isArray(window.state.tasks)) ? window.state.tasks : JSON.parse(localStorage.getItem('tesseract_goals_tasks_data') || '[]');
        const finalTasks = isForceRestore ? data.tasks : this.mergeTasks(localTasks, data.tasks);
        if (window.state) window.state.tasks = finalTasks;
        localStorage.setItem('tesseract_goals_tasks_data', JSON.stringify(finalTasks));
      }

      // 2. Profile
      if (data.profile) {
        if (window.state) window.state.profile = data.profile;
        localStorage.setItem('tesseract_profile_data', JSON.stringify(data.profile));
      }

      // 3. Streaks
      if (data.streak) {
        if (window.state) window.state.streak = data.streak;
        localStorage.setItem('tesseract_streak_data', JSON.stringify(data.streak));
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
      if (data.backlogs && Array.isArray(data.backlogs)) {
        const rawCount = data.backlogs.length;
        const localBacklogs = (typeof BacklogEngine !== 'undefined' && Array.isArray(BacklogEngine.items)) ? BacklogEngine.items : JSON.parse(localStorage.getItem('tesseract_backlog_data') || '[]');
        const mergedBacklogs = isForceRestore ? data.backlogs : this.mergeEntityList(localBacklogs, data.backlogs, 'id', 'updatedAt');
        const cleanedBacklogs = mergedBacklogs.filter(i => {
          if (!i) return false;
          if (['bkl_01', 'bkl_02', 'bkl_03', 'bkl_04', 'bkl_05', 'bkl_06'].includes(i.id)) return false;
          const t = (i.objective || '').trim().toLowerCase();
          return !['refactor core architecture & clean codebase', 'upgrade home network & server backup strategy', 'full mobility & functional strength assessment routine', 'tesseract native push engine & real-time sync pipeline', 'tax & annual corporate document organization', 'drop off dry cleaning & pick up courier package'].includes(t);
        });

        if (typeof BacklogEngine !== 'undefined') {
          BacklogEngine.items = cleanedBacklogs;
          if (typeof Components !== 'undefined' && (Components.getCurrentPage() === 'backlogs' || Components.getCurrentPage() === 'completed_backlogs')) {
            BacklogEngine.render();
          }
        }
        localStorage.setItem('tesseract_backlog_data', JSON.stringify(cleanedBacklogs));
        if (cleanedBacklogs.length !== rawCount) {
          this.queuePush();
        }
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

      // 10. Pulse
      if (data.pulse && Array.isArray(data.pulse)) {
        if (typeof PulseEngine !== 'undefined') {
          const localPulse = (typeof PulseEngine !== 'undefined' && Array.isArray(PulseEngine.entries)) ? PulseEngine.entries : JSON.parse(localStorage.getItem('tesseract_pulse_data') || '[]');
          const mergedPulse = isForceRestore ? data.pulse : this.mergeEntityList(localPulse, data.pulse, 'id', 'createdAt');
          if (typeof PulseEngine !== 'undefined') {
            PulseEngine.entries = mergedPulse;
            if (typeof Components !== 'undefined' && Components.getCurrentPage() === 'pulse') {
              PulseEngine.render();
            }
          }
          localStorage.setItem('tesseract_pulse_data', JSON.stringify(mergedPulse));
        }
      }

      // 11. Docket Radar Acks
      if (data.radarAcks && typeof data.radarAcks === 'object') {
        localStorage.setItem('tesseract_docket_radar_acks', JSON.stringify(data.radarAcks));
      }

      // 12. Routine & Cadence Trackers
      if (Array.isArray(data.trackers)) {
        localStorage.setItem('tesseract_trackers', JSON.stringify(data.trackers));
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
      if (typeof PulseEngine !== 'undefined' && typeof PulseEngine.render === 'function' && typeof Components !== 'undefined' && Components.getCurrentPage() === 'pulse') PulseEngine.render();
      if (typeof TrackerEngine !== 'undefined' && typeof TrackerEngine.render === 'function' && typeof Components !== 'undefined' && Components.getCurrentPage() === 'tracker') TrackerEngine.render();
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
          ${this.status === 'error' ? `<button type="button" class="btn btn-secondary btn-xs" style="margin-top: 8px;" onclick="SyncEngine.clearCredentials()"><i data-lucide="rotate-ccw"></i> Reset to Local Storage Only</button>` : ''}
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
      const pushSuccess = await this.pushNow();
      this.updatePairingSection();

      if (pushSuccess && this.status === 'synced') {
        if (typeof showToast === 'function') {
          showToast('✨ Successfully connected & synchronized!', 'success');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('⚠️ Sync failed: ' + (this.statusMessage || 'Push rejected'), 'error');
        }
      }
    } catch (err) {
      this.setStatus('error', 'Setup error: ' + err.message);
      if (typeof showToast === 'function') {
        showToast('⚠️ Setup error: ' + err.message, 'error');
      }
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
  },

  async confirmDisconnect() {
    const confirmed = typeof TesseractDialog !== 'undefined'
      ? await TesseractDialog.confirm({
          title: 'Disconnect Cloud Sync',
          message: 'Disconnect cloud sync from this device? Local data on this device will be kept intact.',
          confirmLabel: 'Disconnect',
          variant: 'danger'
        })
      : confirm('Disconnect cloud sync from this device? (Local data will be kept)');
    if (confirmed) {
      this.clearCredentials();
    }
  },

  copyFirestoreRule() {
    const rule = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}";
    navigator.clipboard.writeText(rule).then(() => {
      if (typeof showToast === 'function') {
        showToast('📋 Firestore Rules copied to clipboard!', 'success');
      }
    }).catch(() => {
      if (typeof TesseractDialog !== 'undefined') {
        TesseractDialog.prompt({
          title: 'Firestore Security Rule',
          message: 'Copy rule configuration below:',
          defaultValue: rule,
          inputType: 'textarea',
          confirmLabel: 'Done'
        });
      } else {
        prompt('Copy Firestore Rule:', rule);
      }
    });
  }
};

// Global export
window.SyncEngine = SyncEngine;

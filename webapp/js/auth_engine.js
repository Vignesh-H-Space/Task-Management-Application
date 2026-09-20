/**
 * TESSERACT EXECUTIVE OS - AUTHENTICATION & ACCESS CONTROL ENGINE
 * 
 * Provides cryptographic master authentication (PBKDF2 SHA-256),
 * session tokens, "Remember Me" persistent credentials, and route gating.
 */

const AuthEngine = {
  STORAGE_MASTER: 'tesseract_auth_master',
  STORAGE_SESSION_LOCAL: 'tesseract_auth_session',
  STORAGE_SESSION_TEMP: 'tesseract_auth_temp_session',

  // 30 Days persistence for "Remember Me"
  SESSION_DURATION_MS: 30 * 24 * 60 * 60 * 1000,

  /**
   * Helper: Convert ArrayBuffer to Base64
   */
  bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  /**
   * Helper: Convert Base64 to Uint8Array
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
   * Cryptographically hash a password with PBKDF2 (100k iterations SHA-256)
   */
  async hashPassword(password, saltBuffer) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Cryptography API is unavailable. Ensure HTTPS or localhost is used.');
    }

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const hashBuffer = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return this.bufferToBase64(hashBuffer);
  },

  /**
   * Check if master credentials have been configured
   */
  isSetup() {
    const saved = localStorage.getItem(this.STORAGE_MASTER);
    return !!saved;
  },

  /**
   * Configure master username and password on first-time launch
   */
  async setupMaster(username, password) {
    if (!username || !username.trim()) {
      throw new Error('Username is required.');
    }
    if (!password || password.length < 6) {
      throw new Error('Master password must be at least 6 characters long.');
    }

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const hash = await this.hashPassword(password, salt);

    const masterRecord = {
      username: username.trim().toLowerCase(),
      displayName: username.trim(),
      salt: this.bufferToBase64(salt),
      hash: hash,
      createdAt: Date.now()
    };

    localStorage.setItem(this.STORAGE_MASTER, JSON.stringify(masterRecord));
    return true;
  },

  /**
   * Verify username and password against stored cryptographic hash
   */
  async verify(username, password) {
    const raw = localStorage.getItem(this.STORAGE_MASTER);
    if (!raw) return false;

    let master;
    try {
      master = JSON.parse(raw);
    } catch (e) {
      return false;
    }

    if (master.username !== username.trim().toLowerCase()) {
      return false;
    }

    const saltBuffer = this.base64ToBuffer(master.salt);
    const computedHash = await this.hashPassword(password, saltBuffer);

    return computedHash === master.hash;
  },

  /**
   * Perform login with Remember Me support
   */
  async login(username, password, rememberMe = true) {
    const valid = await this.verify(username, password);
    if (!valid) {
      throw new Error('Invalid username or password.');
    }

    const session = {
      user: username.trim(),
      loginTime: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION_MS,
      rememberMe: !!rememberMe
    };

    const sessionStr = JSON.stringify(session);

    if (rememberMe) {
      localStorage.setItem(this.STORAGE_SESSION_LOCAL, sessionStr);
      sessionStorage.removeItem(this.STORAGE_SESSION_TEMP);
    } else {
      sessionStorage.setItem(this.STORAGE_SESSION_TEMP, sessionStr);
      localStorage.removeItem(this.STORAGE_SESSION_LOCAL);
    }

    return true;
  },

  /**
   * Check if current session is authenticated & unexpired
   */
  isAuthenticated() {
    // If not setup yet, not authenticated
    if (!this.isSetup()) {
      return false;
    }

    // Check localStorage (Remember Me)
    const local = localStorage.getItem(this.STORAGE_SESSION_LOCAL);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return true;
        } else {
          localStorage.removeItem(this.STORAGE_SESSION_LOCAL);
        }
      } catch (e) {
        localStorage.removeItem(this.STORAGE_SESSION_LOCAL);
      }
    }

    // Check sessionStorage (Single tab session)
    const temp = sessionStorage.getItem(this.STORAGE_SESSION_TEMP);
    if (temp) {
      try {
        const parsed = JSON.parse(temp);
        if (parsed.loginTime) {
          return true;
        }
      } catch (e) {
        sessionStorage.removeItem(this.STORAGE_SESSION_TEMP);
      }
    }

    return false;
  },

  /**
   * Get currently logged-in user name
   */
  getCurrentUser() {
    const raw = localStorage.getItem(this.STORAGE_MASTER);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.displayName || parsed.username || 'Executive';
      } catch (e) {}
    }
    return 'Executive';
  },

  /**
   * Gatekeeper: Include at top of protected pages.
   * If not authenticated, immediately redirect to login.html.
   */
  requireAuth() {
    // Avoid infinite redirect loop if already on login.html
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('login.html')) {
      return;
    }

    if (!this.isAuthenticated()) {
      const currentUrl = window.location.pathname + window.location.search;
      const redirectParam = encodeURIComponent(currentUrl);
      window.location.replace(`login.html?redirect=${redirectParam}`);
    }
  },

  /**
   * Sign out: Clears active sessions and redirects to login.html
   */
  logout() {
    localStorage.removeItem(this.STORAGE_SESSION_LOCAL);
    sessionStorage.removeItem(this.STORAGE_SESSION_TEMP);
    window.location.replace('login.html');
  }
};

// Global export
window.AuthEngine = AuthEngine;

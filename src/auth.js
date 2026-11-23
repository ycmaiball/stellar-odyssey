/* ═══════════════════════════════════════════════════════════════
   STELLAR ODYSSEY · CREW REGISTRY
   Client-side account prototype: PBKDF2-SHA256 credential storage,
   session persistence, duplicate detection, login throttling.
   The same data model and error codes back the server contract in
   docs/user-system.md — swap the storage layer, keep the UI.
   ═══════════════════════════════════════════════════════════════ */

const ACCOUNTS_KEY = 'stellar_odyssey:accounts:v1';
const SESSION_KEY = 'stellar_odyssey:session:v1';
const LOCKOUT_KEY = 'stellar_odyssey:lockout:v1';
const REMEMBER_KEY = 'stellar_odyssey:last_callsign:v1';

const ITERATIONS = 210000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60000;

const CALLSIGN_RE = /^[A-Za-z0-9_-]{3,16}$/;
const MAX_NICKNAME = 12;
const MIN_PASSWORD = 8;

/* Demo-only administrator. The password is never stored in source: only the
   PBKDF2-SHA256 digest of the demo passphrase lives here, using the same
   210k iterations as a normal account. Delete this block to remove it. */
const DEMO_ADMIN_ID = 'acct-demo-admin';
const DEMO_ADMIN = {
  id: DEMO_ADMIN_ID,
  callsign: 'ADMIN-DEMO',
  callsignKey: 'admin-demo',
  nickname: '演示管理员',
  salt: 'AQIDBAUGBwgJCgsMDQ4PEA==',
  hash: '1QzSanfK3N1tsWC36DrI0DuPNWyckw5YSjkTU1Pu+vU=',
  iterations: ITERATIONS,
  role: 'admin',
  createdAt: '2026-11-23T00:00:00.000Z',
  lastLoginAt: null,
  meta: { level: 1, ships: [], progress: {}, demo: true },
};

class AuthError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

/* ── encoding helpers ───────────────────────────────────────────── */

function bytesToB64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(aBytes, bBytes) {
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return bytesToB64(randomBytes(16)).replace(/[+/=]/g, '');
}

/* ── storage ───────────────────────────────────────────────────── */

function storageAvailable(kind) {
  try {
    const probe = `__probe_${Date.now()}`;
    window[kind].setItem(probe, '1');
    window[kind].removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
}

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    throw new AuthError(
      'STORAGE_UNAVAILABLE',
      '无法写入本机存储，请关闭无痕模式或检查浏览器存储空间。',
    );
  }
}

function readAccounts() {
  const list = readJSON(ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function findAccount(callsign) {
  const key = callsign.trim().toLowerCase();
  return readAccounts().find((item) => item.callsignKey === key) || null;
}

/* ── validation ────────────────────────────────────────────────── */

function seedDemoAdmin() {
  try {
    if (!storageAvailable('localStorage')) return;
    const accounts = readAccounts();
    if (accounts.some((item) => item && item.callsignKey === 'admin-demo')) return;
    accounts.push(JSON.parse(JSON.stringify(DEMO_ADMIN)));
    writeJSON(ACCOUNTS_KEY, accounts);
  } catch (error) {
    /* the demo account is optional; never block boot on it */
  }
}

function validateCallsign(value) {
  const text = value.trim();
  if (!text) return '请填写飞船账号。';
  if (!CALLSIGN_RE.test(text)) {
    return '飞船账号需 3–16 位，仅限字母、数字、下划线、连字符。';
  }
  return '';
}

function validateNickname(value) {
  const text = value.trim();
  if (!text) return '请填写舰长昵称。';
  if (Array.from(text).length < 2 || Array.from(text).length > MAX_NICKNAME) {
    return `舰长昵称需 2–${MAX_NICKNAME} 个字符。`;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) return '昵称包含不可见字符。';
  return '';
}

function passwordIssue(value) {
  const text = value;
  if (!text) return '请设置密码。';
  if (Array.from(text).length < MIN_PASSWORD) return `密码至少 ${MIN_PASSWORD} 位。`;
  if (Array.from(text).length > 64) return '密码不得超过 64 位。';
  if (!/[A-Za-z]/.test(text)) return '密码需包含至少一个字母。';
  if (!/[0-9]/.test(text)) return '密码需包含至少一个数字。';
  return '';
}

function strengthOf(value) {
  const text = value || '';
  const length = Array.from(text).length;
  let score = 0;
  if (length >= MIN_PASSWORD) score += 1;
  if (length >= 12) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  else if (/[A-Za-z]/.test(text)) score += 0.5;
  if (/[0-9]/.test(text)) score += 1;
  if (/[^A-Za-z0-9]/.test(text)) score += 1;
  let label = '强度 · 未设置';
  if (text) {
    if (score < 2) label = '强度 · 弱';
    else if (score < 3) label = '强度 · 中';
    else if (score < 4) label = '强度 · 强';
    else label = '强度 · 很强';
  }
  const percent = Math.min(100, Math.round((score / 4.5) * 100));
  return { label, percent, weak: Boolean(text) && score < 2 };
}

/* ── the controller ────────────────────────────────────────────── */

seedDemoAdmin();

export function createAuthSystem({ onAuthed, onSignedOut } = {}) {
  const root = document.getElementById('auth-screen');
  if (!root) throw new Error('auth-screen missing from index.html');

  const el = {
    root,
    tabRegister: document.getElementById('auth-tab-register'),
    tabLogin: document.getElementById('auth-tab-login'),
    formRegister: document.getElementById('auth-form-register'),
    formLogin: document.getElementById('auth-form-login'),
    callsign: document.getElementById('auth-callsign'),
    nickname: document.getElementById('auth-nickname'),
    password: document.getElementById('auth-password'),
    confirm: document.getElementById('auth-confirm'),
    loginCallsign: document.getElementById('auth-login-callsign'),
    loginPassword: document.getElementById('auth-login-password'),
    error: document.getElementById('auth-error'),
    submitRegister: document.getElementById('auth-submit-register'),
    submitLogin: document.getElementById('auth-submit-login'),
    strengthFill: document.getElementById('auth-strength-fill'),
    strengthLabel: document.getElementById('auth-strength-label'),
    lockout: document.getElementById('auth-lockout'),
    storageNote: document.getElementById('auth-storage-note'),
    summary: document.getElementById('auth-summary'),
  };

  const state = {
    mode: 'register',
    busy: false,
    lockUntil: 0,
    pending: null,
    secure: Boolean(window.crypto && window.crypto.subtle),
  };

  /* ── small DOM helpers ──────────────────────────────────────── */

  const fieldErrorNode = (field) => root.querySelector(`[data-error-for="${field}"]`);

  function setFieldError(field, message) {
    const node = fieldErrorNode(field);
    if (node) node.textContent = message || '';
    const input = root.querySelector(`[data-field="${field}"]`);
    if (input) input.classList.toggle('is-invalid', Boolean(message));
  }

  function clearFieldErrors() {
    root.querySelectorAll('[data-error-for]').forEach((node) => {
      node.textContent = '';
    });
    root.querySelectorAll('input').forEach((input) => input.classList.remove('is-invalid'));
  }

  function showError(message) {
    el.error.textContent = message || '';
    el.error.classList.toggle('is-visible', Boolean(message));
  }

  function setBusy(busy, label) {
    state.busy = busy;
    root.classList.toggle('is-busy', busy);
    [el.submitRegister, el.submitLogin].forEach((button) => {
      if (button) button.disabled = busy;
    });
    if (busy) {
      const active = state.mode === 'login' ? el.submitLogin : el.submitRegister;
      if (active) active.dataset.label = active.querySelector('.auth-submit__label')?.textContent || '';
      const target = active?.querySelector('.auth-submit__label');
      if (target && label) target.textContent = label;
    } else {
      const target = (state.mode === 'login' ? el.submitLogin : el.submitRegister)
        ?.querySelector('.auth-submit__label');
      const original = state.mode === 'login' ? '登录并进入驾驶舱' : '创建飞船账号';
      if (target) target.textContent = original;
    }
    updateLockState();
  }

  function updateLockState() {
    const remaining = Math.max(0, state.lockUntil - Date.now());
    if (el.lockout) {
      el.lockout.textContent = remaining > 0
        ? `尝试过于频繁 · ${Math.ceil(remaining / 1000)} 秒后可重试`
        : '';
      el.lockout.classList.toggle('is-visible', remaining > 0);
    }
    if (remaining > 0) {
      [el.submitRegister, el.submitLogin].forEach((button) => {
        if (button) button.disabled = true;
      });
    } else if (!state.busy) {
      [el.submitRegister, el.submitLogin].forEach((button) => {
        if (button) button.disabled = false;
      });
    }
  }

  /* ── session ────────────────────────────────────────────────── */

  function readSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session || !session.accountId || !session.expiresAt) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  }

  function writeSession(account) {
    const session = {
      accountId: account.id,
      callsign: account.callsign,
      nickname: account.nickname,
      role: account.role || 'captain',
      token: bytesToB64(randomBytes(24)).replace(/[+/=]/g, ''),
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL).toISOString(),
    };
    writeJSON(SESSION_KEY, session);
    return session;
  }

  function hasSession() {
    return Boolean(readSession());
  }

  function getSession() {
    return readSession();
  }

  function signOut() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* ignore */
    }
    if (typeof onSignedOut === 'function') onSignedOut();
    open();
  }

  /* ── tabs ───────────────────────────────────────────────────── */

  function setMode(mode) {
    state.mode = mode;
    const isLogin = mode === 'login';
    el.tabRegister.classList.toggle('is-active', !isLogin);
    el.tabLogin.classList.toggle('is-active', isLogin);
    el.tabRegister.setAttribute('aria-selected', String(!isLogin));
    el.tabLogin.setAttribute('aria-selected', String(isLogin));
    el.formRegister.classList.toggle('is-hidden', isLogin);
    el.formLogin.classList.toggle('is-hidden', !isLogin);
    showError('');
    clearFieldErrors();
    if (el.summary) {
      el.summary.textContent = isLogin
        ? '输入呼号与密码，回到 NX-07 驾驶舱。'
        : '注册后，航行记录与装配方案都会挂在你的呼号下。';
    }
    window.setTimeout(() => {
      const target = isLogin ? el.loginCallsign : el.callsign;
      target?.focus({ preventScroll: true });
    }, 60);
  }

  /* ── password strength ─────────────────────────────────────── */

  function refreshStrength() {
    const { label, percent, weak } = strengthOf(el.password.value);
    if (el.strengthFill) el.strengthFill.style.width = `${percent}%`;
    if (el.strengthLabel) el.strengthLabel.textContent = label;
    el.strengthFill?.parentElement?.classList.toggle('is-weak', weak);
  }

  /* ── register ───────────────────────────────────────────────── */

  async function handleRegister(event) {
    event.preventDefault();
    if (state.busy) return;
    showError('');
    clearFieldErrors();

    const callsign = el.callsign.value.trim();
    const nickname = el.nickname.value.trim();
    const password = el.password.value;
    const confirm = el.confirm.value;

    const issues = [
      ['callsign', validateCallsign(callsign)],
      ['nickname', validateNickname(nickname)],
      ['password', passwordIssue(password)],
      ['confirm', password !== confirm ? '两次输入的密码不一致。' : ''],
    ];
    const firstIssue = issues.find(([, message]) => message);
    issues.forEach(([field, message]) => setFieldError(field, message));
    if (firstIssue) {
      setFieldError(firstIssue[0], firstIssue[1]);
      showError(firstIssue[1]);
      (firstIssue[0] === 'confirm' ? el.confirm : root.querySelector(`[data-field="${firstIssue[0]}"]`))?.focus();
      return;
    }

    if (findAccount(callsign)) {
      setFieldError('callsign', '该飞船账号已被注册，换一个呼号。');
      showError('该飞船账号已被注册，换一个呼号。');
      el.callsign.focus();
      return;
    }

    try {
      setBusy(true, '正在生成密钥…');
      const salt = randomBytes(16);
      const hash = await derive(password, salt, ITERATIONS);
      const account = {
        id: uid(),
        callsign,
        callsignKey: callsign.toLowerCase(),
        nickname,
        salt: bytesToB64(salt),
        hash: bytesToB64(hash),
        iterations: ITERATIONS,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        meta: { level: 1, ships: [], progress: {} },
      };
      const accounts = readAccounts();
      accounts.push(account);
      writeJSON(ACCOUNTS_KEY, accounts);
      try {
        window.localStorage.setItem(REMEMBER_KEY, callsign);
      } catch (error) {
        /* non critical */
      }
      const session = writeSession(account);
      finish(account, session);
    } catch (error) {
      const message = error instanceof AuthError
        ? error.message
        : '注册失败，请稍后重试。';
      showError(message);
      setBusy(false);
    }
  }

  /* ── login ──────────────────────────────────────────────────── */

  async function handleLogin(event) {
    event.preventDefault();
    if (state.busy) return;
    if (state.lockUntil > Date.now()) {
      updateLockState();
      return;
    }
    showError('');
    clearFieldErrors();

    const callsign = el.loginCallsign.value.trim();
    const password = el.loginPassword.value;

    if (!callsign) {
      setFieldError('login-callsign', '请输入飞船账号。');
      showError('请输入飞船账号。');
      el.loginCallsign.focus();
      return;
    }
    if (!password) {
      setFieldError('login-password', '请输入密码。');
      showError('请输入密码。');
      el.loginPassword.focus();
      return;
    }

    try {
      setBusy(true, '正在校验身份…');
      const account = findAccount(callsign);
      let matched = false;
      if (account) {
        const hash = await derive(password, b64ToBytes(account.salt), account.iterations || ITERATIONS);
        matched = constantTimeEqual(hash, b64ToBytes(account.hash));
      } else {
        /* burn a comparable amount of time so a missing account and a wrong
           password take the same path from the user's point of view */
        await derive(password, randomBytes(16), ITERATIONS);
      }

      if (!matched) {
        registerFailure();
        showError('账号或密码不正确。');
        setBusy(false);
        updateLockState();
        return;
      }

      const accounts = readAccounts().map((item) => (
        item.id === account.id ? { ...item, lastLoginAt: new Date().toISOString() } : item
      ));
      writeJSON(ACCOUNTS_KEY, accounts);
      const refreshed = accounts.find((item) => item.id === account.id);
      resetFailures();
      const session = writeSession(refreshed);
      finish(refreshed, session);
    } catch (error) {
      const message = error instanceof AuthError ? error.message : '登录失败，请稍后重试。';
      showError(message);
      setBusy(false);
    }
  }

  function finish(account, session) {
    setBusy(false, '');
    if (typeof onAuthed === 'function') onAuthed(session, account);
    close();
  }

  /* ── throttling ─────────────────────────────────────────────── */

  function readLock() {
    try {
      const raw = window.sessionStorage.getItem(LOCKOUT_KEY);
      if (!raw) return { attempts: 0, until: 0 };
      const parsed = JSON.parse(raw);
      return {
        attempts: Number(parsed.attempts) || 0,
        until: Number(parsed.until) || 0,
      };
    } catch (error) {
      return { attempts: 0, until: 0 };
    }
  }

  function saveLock(value) {
    try {
      window.sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(value));
    } catch (error) {
      /* ignore */
    }
  }

  function registerFailure() {
    const lock = readLock();
    lock.attempts += 1;
    if (lock.attempts >= MAX_ATTEMPTS) {
      lock.until = Date.now() + LOCKOUT_MS;
      lock.attempts = 0;
    }
    saveLock(lock);
    state.lockUntil = lock.until;
  }

  function resetFailures() {
    saveLock({ attempts: 0, until: 0 });
    state.lockUntil = 0;
  }

  /* ── open / close ───────────────────────────────────────────── */

  function open(afterAuth) {
    clearFieldErrors();
    showError('');
    root.classList.remove('is-hidden', 'is-leaving');
    requestAnimationFrame(() => root.classList.add('is-ready'));
    state.pending = typeof afterAuth === 'function' ? afterAuth : null;

    const accounts = readAccounts();
    /* the seeded demo admin must not turn a first visit into a login screen */
    const captainAccounts = accounts.filter((item) => item && item.id !== DEMO_ADMIN_ID);
    const remembered = (() => {
      try {
        return window.localStorage.getItem(REMEMBER_KEY) || '';
      } catch (error) {
        return '';
      }
    })();
    if (remembered && el.loginCallsign) el.loginCallsign.value = remembered;
    if (el.loginCallsign && !el.loginCallsign.value && captainAccounts.length) {
      el.loginCallsign.value = captainAccounts[0].callsign;
    }
    setMode(captainAccounts.length || remembered ? 'login' : 'register');

    if (!storageAvailable('localStorage')) {
      showError('本机存储不可用（可能是无痕模式），无法保存飞船账号。');
      setBusy(false);
      if (el.submitRegister) el.submitRegister.disabled = true;
      if (el.submitLogin) el.submitLogin.disabled = true;
      return;
    }
    if (!state.secure) {
      showError('当前浏览器不支持 Web Crypto，无法安全保存密码；请使用最新版 Chrome / Edge / Safari。');
      if (el.submitRegister) el.submitRegister.disabled = true;
      if (el.submitLogin) el.submitLogin.disabled = true;
      return;
    }
    if (el.storageNote) {
      el.storageNote.textContent = '本地原型 · 密码经 PBKDF2-SHA256（210k 次迭代）哈希后仅存本机，请勿使用真实密码。';
    }
    updateLockState();
  }

  function close() {
    root.classList.add('is-leaving');
    window.setTimeout(() => {
      root.classList.add('is-hidden');
      root.classList.remove('is-ready', 'is-leaving');
    }, 480);
    const cb = state.pending;
    state.pending = null;
    if (typeof cb === 'function') window.setTimeout(cb, 200);
  }

  /* ── wiring ─────────────────────────────────────────────────── */

  el.tabRegister?.addEventListener('click', () => setMode('register'));
  el.tabLogin?.addEventListener('click', () => setMode('login'));
  el.formRegister?.addEventListener('submit', handleRegister);
  el.formLogin?.addEventListener('submit', handleLogin);

  el.password?.addEventListener('input', refreshStrength);
  el.confirm?.addEventListener('input', () => {
    if (el.confirm.value && el.confirm.value !== el.password.value) {
      setFieldError('confirm', '两次输入的密码不一致。');
    } else {
      setFieldError('confirm', '');
    }
  });

  const blurChecks = [
    [el.callsign, 'callsign', () => validateCallsign(el.callsign.value)],
    [el.nickname, 'nickname', () => validateNickname(el.nickname.value)],
    [el.password, 'password', () => passwordIssue(el.password.value)],
  ];
  blurChecks.forEach(([input, field, check]) => {
    input?.addEventListener('blur', () => {
      if (!input.value) return;
      setFieldError(field, check());
    });
    input?.addEventListener('input', () => setFieldError(field, ''));
  });

  el.callsign?.addEventListener('input', () => {
    setFieldError('callsign', '');
    showError('');
  });
  el.loginCallsign?.addEventListener('input', () => setFieldError('login-callsign', ''));
  el.loginPassword?.addEventListener('input', () => setFieldError('login-password', ''));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      /* the stop() guard: authentication cannot be skipped */
      event.stopPropagation();
    }
  });

  updateLockState();

  return {
    hasSession,
    getSession,
    signOut,
    open,
    close,
    element: root,
    get accounts() {
      return readAccounts().map(({ hash, salt, ...rest }) => rest);
    },
  };
}
/**
 * 统一 API 请求封装
 */

const API_BASE = '';  // 同源，不需要额外前缀

function getToken() {
  return localStorage.getItem('ae1_token');
}

function setToken(token) {
  localStorage.setItem('ae1_token', token);
}

function removeToken() {
  localStorage.removeItem('ae1_token');
  localStorage.removeItem('ae1_user');
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('ae1_user') || 'null');
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('ae1_user', JSON.stringify(user));
}

/**
 * 通用 fetch 封装
 * @param {string} path  - API路径
 * @param {object} opts  - fetch 选项
 * @param {boolean} auth - 是否携带 Bearer token
 */
async function apiFetch(path, opts = {}, auth = true) {
  const headers = { ...(opts.headers || {}) };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(API_BASE + path, { ...opts, headers });

  if (resp.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('未登录或Token已过期');
  }

  if (!resp.ok) {
    let msg = `请求失败 (${resp.status})`;
    try {
      const err = await resp.json();
      msg = err.detail || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const ct = resp.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) {
    return resp.json();
  }
  return resp;
}

/** GET */
function apiGet(path, auth = true) {
  return apiFetch(path, { method: 'GET' }, auth);
}

/** POST JSON */
function apiPost(path, body, auth = true) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) }, auth);
}

/** POST FormData */
function apiPostForm(path, formData, auth = true) {
  return apiFetch(path, { method: 'POST', body: formData, headers: {} }, auth);
}

/** PUT JSON */
function apiPut(path, body, auth = true) {
  return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }, auth);
}

/** DELETE */
function apiDelete(path, auth = true) {
  return apiFetch(path, { method: 'DELETE' }, auth);
}

// ── Toast 通知 ────────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" style="color:var(--${type === 'info' ? 'primary' : type})"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── 模态框 ───────────────────────────────────────────────────────────────────

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (typeof window.handleModalClosed === 'function') {
    window.handleModalClosed(id);
  }
}

// 点击遮罩关闭
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    if (typeof window.handleModalClosed === 'function') {
      window.handleModalClosed(e.target.id);
    }
  }
});

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function priorityLabel(priority) {
  if (priority >= 10) return { text: '主管理员', cls: 'badge-danger' };
  if (priority >= 8)  return { text: '管理员', cls: 'badge-warning' };
  return { text: '用户', cls: 'badge-gray' };
}

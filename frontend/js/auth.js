/**
 * 登录 / 注册 / 登出逻辑
 */

// ── 页面 Tab 切换 ─────────────────────────────────────────────────────────────

function switchTab(tab) {
  const loginForm    = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const tabLogin     = document.getElementById('tab-login');
  const tabRegister  = document.getElementById('tab-register');
  if (!loginForm) return;

  if (tab === 'login') {
    loginForm.style.display    = '';
    registerForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
  } else {
    loginForm.style.display    = 'none';
    registerForm.style.display = '';
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
  }
  document.getElementById('alert-box').innerHTML = '';
}

function showAlert(message, type = 'error') {
  const box = document.getElementById('alert-box');
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

// ── 登录 ──────────────────────────────────────────────────────────────────────

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');

  if (!username || !password) { showAlert('请填写用户名和密码'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 登录中…';

  try {
    const res = await apiPost('/api/auth/login', { username, password }, false);
    setToken(res.access_token);
    setCurrentUser(res.user);
    window.location.href = '/';
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> 登录';
  }
}

// ── 注册 ──────────────────────────────────────────────────────────────────────

async function handleRegister(event) {
  event.preventDefault();
  const username  = document.getElementById('reg-username').value.trim();
  const password  = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const btn = document.getElementById('btn-register');

  if (!username || !password) { showAlert('请填写所有必填字段'); return; }
  if (password !== password2) { showAlert('两次密码不一致'); return; }
  if (password.length < 6)   { showAlert('密码至少6位'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 注册中…';

  try {
    const res = await apiPost('/api/auth/register', { username, password }, false);
    setToken(res.access_token);
    setCurrentUser(res.user);
    window.location.href = '/';
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> 注册';
  }
}

// ── 登出 ──────────────────────────────────────────────────────────────────────

function logout() {
  removeToken();
  window.location.href = '/login';
}

// ── 页面守卫（login.html 用：已登录则跳转首页）────────────────────────────────

(function loginPageGuard() {
  if (!document.getElementById('form-login')) return; // 不在登录页
  if (getToken()) {
    window.location.href = '/';
  }
})();

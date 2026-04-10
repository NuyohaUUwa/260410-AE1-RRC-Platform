/**
 * 主页面初始化
 */

(async function init() {
  // 未登录跳转
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    return;
  }

  // 从服务器刷新用户信息
  let user;
  try {
    user = await apiGet('/api/users/me');
    setCurrentUser(user);
  } catch (_) {
    window.location.href = '/login';
    return;
  }

  // 顶栏用户信息
  const nameEl  = document.getElementById('topbar-username');
  const badgeEl = document.getElementById('topbar-badge');
  if (nameEl) nameEl.textContent = user.username;
  if (badgeEl) {
    const pl = priorityLabel(user.priority);
    badgeEl.className = `badge ${pl.cls}`;
    badgeEl.textContent = pl.text;
  }

  // 显示管理面板按钮（priority >= 8）
  const adminBtn = document.getElementById('btn-admin-panel');
  if (adminBtn && user.priority >= 8) {
    adminBtn.style.display = '';
    const userTab = document.getElementById('admin-tab-users');
    if (userTab) userTab.style.display = '';
    const logsTab = document.getElementById('admin-tab-logs');
    if (logsTab && user.is_main_admin) logsTab.style.display = '';
  }

  // 显示公告编辑按钮（priority >= 8）
  const editAnnouncementBtn = document.getElementById('btn-edit-announcement');
  if (editAnnouncementBtn && user.priority >= 8) {
    editAnnouncementBtn.style.display = '';
  }

  // 并行加载数据
  await Promise.allSettled([
    loadAnnouncement(),
    loadToolLinks(),
    loadMessages(),
    loadVideos(),
  ]);

  // 定时刷新视频列表（处理锁定过期）
  setInterval(loadVideos, 60 * 1000);
})();

function openPasswordModal() {
  const ids = ['pwd-current', 'pwd-new', 'pwd-new2'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal('modal-password');
}

async function changePassword() {
  const currentPassword = document.getElementById('pwd-current').value;
  const newPassword = document.getElementById('pwd-new').value;
  const confirmPassword = document.getElementById('pwd-new2').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('请填写完整密码信息', 'warning');
    return;
  }
  if (newPassword.length < 6) {
    showToast('新密码至少6位', 'warning');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('两次输入的新密码不一致', 'warning');
    return;
  }

  try {
    await apiPut('/api/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    showToast('密码已更新，请重新登录', 'success');
    closeModal('modal-password');
    setTimeout(logout, 600);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

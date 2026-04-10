/**
 * 管理员功能：公告编辑、工具链接、用户管理
 */

let _currentPriorityUserId = null;

// ── 公告 ─────────────────────────────────────────────────────────────────────

async function loadAnnouncement() {
  const bodyEl = document.getElementById('announcement-body');
  const metaEl = document.getElementById('announcement-meta');
  try {
    const data = await apiGet('/api/announcements');
    bodyEl.innerHTML = marked.parse(data.content || '');
    if (data.updated_by && data.updated_at) {
      metaEl.textContent = `最后更新：${data.updated_by} · ${formatDate(data.updated_at)}`;
    }
  } catch (err) {
    bodyEl.innerHTML = '<p style="color:var(--text-muted)">公告加载失败</p>';
  }
}

function openAnnouncementEditor() {
  const bodyEl = document.getElementById('announcement-body');
  // 将当前渲染内容的原始 markdown 加载到编辑器（从服务器重新取）
  apiGet('/api/announcements').then(data => {
    document.getElementById('announcement-editor').value = data.content || '';
    previewAnnouncement();
  });
  openModal('modal-announcement');
}

function previewAnnouncement() {
  const editor = document.getElementById('announcement-editor');
  const preview = document.getElementById('announcement-preview');
  if (!editor || !preview) return;
  preview.innerHTML = marked.parse(editor.value || '');
}

async function saveAnnouncement() {
  const content = document.getElementById('announcement-editor').value;
  try {
    await apiPut('/api/announcements', { content });
    showToast('公告已更新', 'success');
    closeModal('modal-announcement');
    loadAnnouncement();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── 管理面板 ─────────────────────────────────────────────────────────────────

function openAdminPanel() {
  openModal('modal-admin');
  switchAdminTab('tools');
}

function switchAdminTab(tab) {
  const toolsPanel = document.getElementById('admin-panel-tools');
  const usersPanel = document.getElementById('admin-panel-users');
  const tabs = document.querySelectorAll('#admin-tabs .login-tab');

  tabs.forEach((t, i) => {
    t.classList.toggle('active', (tab === 'tools' && i === 0) || (tab === 'users' && i === 1));
  });

  if (tab === 'tools') {
    toolsPanel.style.display = '';
    usersPanel.style.display = 'none';
    loadToolManageList();
  } else {
    toolsPanel.style.display = 'none';
    usersPanel.style.display = '';
    loadUserTable();
  }
}

// ── 工具链接 ─────────────────────────────────────────────────────────────────

async function loadToolLinks() {
  const list = document.getElementById('tool-links-list');
  if (!list) return;
  try {
    const tools = await apiGet('/api/tools');
    if (!tools.length) {
      list.innerHTML = `
        <div class="empty-state" style="padding:1rem 0">
          <i class="fa-solid fa-link" style="font-size:1.5rem"></i>
          <p style="font-size:.82rem;margin-top:.3rem">暂无工具链接</p>
        </div>`;
      return;
    }
    list.innerHTML = tools.map(t => `
      <a class="tool-link" href="${escapeHtml(t.url)}" target="_blank" rel="noopener">
        <i class="fa-solid ${escapeHtml(t.icon || 'fa-link')}"></i>
        <span>${escapeHtml(t.name)}</span>
      </a>
    `).join('');
  } catch (_) {}
}

async function loadToolManageList() {
  const listEl = document.getElementById('tool-manage-list');
  if (!listEl) return;
  try {
    const tools = await apiGet('/api/tools');
    if (!tools.length) {
      listEl.innerHTML = '<p style="font-size:.85rem;color:var(--text-muted)">暂无工具链接</p>';
      return;
    }
    listEl.innerHTML = tools.map(t => `
      <div class="tool-manage-item">
        <i class="fa-solid ${escapeHtml(t.icon || 'fa-link')}" style="color:var(--primary)"></i>
        <div class="tool-info">
          <div class="tool-name">${escapeHtml(t.name)}</div>
          <div class="tool-url" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px">${escapeHtml(t.url)}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteTool('${t.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');
  } catch (_) {}
}

async function addTool() {
  const name = document.getElementById('tool-name').value.trim();
  const url  = document.getElementById('tool-url').value.trim();
  const icon = document.getElementById('tool-icon').value.trim() || 'fa-link';
  const desc = document.getElementById('tool-desc').value.trim();

  if (!name) { showToast('请输入工具名称', 'warning'); return; }
  if (!url)  { showToast('请输入链接 URL', 'warning'); return; }

  try {
    await apiPost('/api/tools', { name, url, icon, description: desc });
    showToast('工具链接已添加', 'success');
    document.getElementById('tool-name').value = '';
    document.getElementById('tool-url').value  = '';
    document.getElementById('tool-desc').value = '';
    loadToolManageList();
    loadToolLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTool(toolId) {
  if (!confirm('确定要删除该工具链接吗？')) return;
  try {
    await apiDelete(`/api/tools/${toolId}`);
    showToast('已删除', 'success');
    loadToolManageList();
    loadToolLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── 用户管理 ─────────────────────────────────────────────────────────────────

async function loadUserTable() {
  const wrap = document.getElementById('user-table-wrap');
  if (!wrap) return;

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.is_main_admin) {
    wrap.innerHTML = '<p style="color:var(--text-muted)">仅主管理员可查看用户管理</p>';
    return;
  }

  try {
    const users = await apiGet('/api/users');
    if (!users.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted)">暂无用户</p>';
      return;
    }
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="user-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>Priority</th>
              <th>角色</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const pl = priorityLabel(u.priority ?? 3);
              const isMain = u.is_main_admin;
              return `
                <tr>
                  <td><strong>${escapeHtml(u.username)}</strong>${isMain ? ' <span class="badge badge-danger" style="font-size:.7rem">主Admin</span>' : ''}</td>
                  <td>${u.priority !== undefined ? u.priority : '-'}</td>
                  <td><span class="badge ${pl.cls}">${pl.text}</span></td>
                  <td>${formatDate(u.created_at)}</td>
                  <td>
                    ${!isMain ? `<button class="btn btn-ghost btn-sm" onclick="openPriorityModal('${u.id}', '${escapeHtml(u.username)}', ${u.priority ?? 3})">
                      <i class="fa-solid fa-star"></i> 修改
                    </button>` : '<span style="color:var(--text-light);font-size:.82rem">不可修改</span>'}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    wrap.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

function openPriorityModal(userId, username, currentPriority) {
  _currentPriorityUserId = userId;
  document.getElementById('priority-user-label').textContent = `用户：${username}`;
  document.getElementById('priority-input').value = currentPriority;
  openModal('modal-priority');
}

async function savePriority() {
  const priority = parseInt(document.getElementById('priority-input').value, 10);
  if (isNaN(priority) || priority < 1 || priority > 9) {
    showToast('priority 范围为 1-9', 'warning');
    return;
  }
  try {
    await apiPut(`/api/users/${_currentPriorityUserId}/priority`, { priority });
    showToast('priority 已更新', 'success');
    closeModal('modal-priority');
    loadUserTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

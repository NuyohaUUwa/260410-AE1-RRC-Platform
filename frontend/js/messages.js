/**
 * 留言反馈逻辑
 */

async function loadMessages() {
  const list = document.getElementById('messages-list');
  if (!list) return;
  try {
    const msgs = await apiGet('/api/messages');
    const currentUser = getCurrentUser();
    const canDelete = !!(currentUser && (currentUser.is_main_admin || Number(currentUser.priority) >= 8));
    if (!msgs.length) {
      list.innerHTML = '<p style="font-size:.82rem;color:var(--text-light);text-align:center;padding:.5rem 0">暂无留言</p>';
      return;
    }
    list.innerHTML = msgs.map(m => `
      <div class="message-item">
        <div class="meta">
          <strong>${escapeHtml(m.username)}</strong>
          <div class="meta-right">
            <span>${formatDate(m.created_at)}</span>
            ${canDelete ? `<button class="btn btn-danger btn-sm message-delete-btn" onclick="deleteMessage('${m.id}')" title="删除留言"><i class="fa-solid fa-trash"></i> 删除</button>` : ''}
          </div>
        </div>
        <div>${escapeHtml(m.content)}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="font-size:.82rem;color:var(--danger)">加载失败</p>';
  }
}

async function deleteMessage(messageId) {
  try {
    await apiDelete(`/api/messages/${messageId}`);
    loadMessages();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitMessage() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content) { showToast('请输入留言内容', 'warning'); return; }
  if (content.length > 1000) { showToast('留言不能超过1000字', 'warning'); return; }

  try {
    await apiPost('/api/messages', { content });
    input.value = '';
    showToast('留言已发送', 'success');
    loadMessages();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

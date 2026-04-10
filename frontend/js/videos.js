/**
 * 视频上传 / 下载 / 预览逻辑
 */

let _selectedFile = null;

function buildAuthenticatedMediaUrl(path) {
  const token = getToken();
  if (!token) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}token=${encodeURIComponent(token)}`;
}

// ── 拖拽上传 ──────────────────────────────────────────────────────────────────

(function initDragDrop() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) applySelectedFile(file);
  });
})();

function onFileSelected(input) {
  if (input.files[0]) applySelectedFile(input.files[0]);
}

function applySelectedFile(file) {
  _selectedFile = file;
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) uploadSection.open = true;
  document.getElementById('drop-zone').style.display = 'none';
  const info = document.getElementById('selected-file-info');
  info.style.display = 'flex';
  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('selected-file-size').textContent = formatBytes(file.size);
}

function clearFileSelection() {
  _selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('drop-zone').style.display = '';
  document.getElementById('selected-file-info').style.display = 'none';
}

// ── 上传视频 ──────────────────────────────────────────────────────────────────

async function uploadVideo() {
  const title = document.getElementById('upload-title').value.trim();
  const desc  = document.getElementById('upload-desc').value.trim();

  if (!title) { showToast('请填写视频标题', 'warning'); return; }
  if (!_selectedFile) { showToast('请选择视频文件', 'warning'); return; }

  const btn = document.getElementById('btn-upload');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 上传中…';

  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressPct  = document.getElementById('upload-percent');
  progressWrap.style.display = '';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', desc);
  formData.append('file', _selectedFile);

  try {
    // 使用 XHR 以获取上传进度
    await uploadWithProgress(formData, (pct) => {
      progressFill.style.width = pct + '%';
      progressPct.textContent = pct + '%';
    });

    showToast('视频上传成功！', 'success');
    document.getElementById('upload-title').value = '';
    document.getElementById('upload-desc').value  = '';
    clearFileSelection();
    loadVideos();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 开始上传';
    progressWrap.style.display = 'none';
    progressFill.style.width = '0%';
  }
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload');

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        removeToken();
        window.location.href = '/login';
        reject(new Error('未登录'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = `上传失败 (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).detail || msg; } catch (_) {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误，上传失败')));
    xhr.send(formData);
  });
}

// ── 视频列表 ──────────────────────────────────────────────────────────────────

async function loadVideos() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="spinner"></div>
      <p style="margin-top:.5rem">加载中…</p>
    </div>`;

  try {
    const videos = await apiGet('/api/videos');
    const currentUser = getCurrentUser();

    if (!videos.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fa-solid fa-film"></i>
          <p>暂无视频，成为第一个上传者吧！</p>
        </div>`;
      return;
    }

    grid.innerHTML = videos.map(v => renderVideoCard(v, currentUser)).join('');
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>
        <p>${err.message}</p>
      </div>`;
  }
}

function renderVideoCard(v, currentUser) {
  const lockMinutes = 30;
  const isOwner = currentUser && v.uploader_id === currentUser.id;
  const isAdmin = currentUser && currentUser.priority >= 8;
  const previewUrl = buildAuthenticatedMediaUrl(`/api/videos/${v.id}/stream`);
  const downloadUrl = buildAuthenticatedMediaUrl(`/api/videos/${v.id}/download`);

  const timeStr   = formatDate(v.upload_time);
  const sizeStr   = formatBytes(v.file_size);
  const dlCount   = v.download_count || 0;

  // 计算锁定剩余时间
  let lockRemain = '';
  if (v.locked) {
    const uploadTime = new Date(v.upload_time);
    const unlockTime = new Date(uploadTime.getTime() + lockMinutes * 60 * 1000);
    const remaining  = Math.max(0, Math.ceil((unlockTime - Date.now()) / 60000));
    lockRemain = `还有 ${remaining} 分钟解锁`;
  }

  const canDownload = v.can_access;
  const publishedCount = v.published_count || 0;
  const publishedActive = !!v.published_by_me;
  const publishedUsers = Array.isArray(v.published_usernames) ? v.published_usernames : [];
  const previewHtml = canDownload
    ? `<video
          preload="metadata"
          src="${previewUrl}"
          style="width:100%;height:100%"
          muted
        ></video>`
    : `<div class="video-preview-placeholder">
         <i class="fa-solid fa-lock"></i>
         <span>当前账号暂无在线预览权限</span>
       </div>`;

  return `
    <div class="video-card" id="vcard-${v.id}">
      <div class="video-preview ${canDownload ? '' : 'locked-preview'}" ${canDownload ? `onclick="openVideoPlayer('${v.id}', ${JSON.stringify(v.title).replace(/"/g, '&quot;')})"` : ''}>
        ${previewHtml}
      </div>
      <div class="video-info">
        <div class="video-title">${escapeHtml(v.title)}</div>
        ${v.description ? `<div class="video-desc">${escapeHtml(v.description)}</div>` : ''}
        <div class="video-meta">
          <span><i class="fa-solid fa-user"></i> ${escapeHtml(v.uploader_name)}</span>
          <span><i class="fa-solid fa-clock"></i> ${timeStr}</span>
          <span><i class="fa-solid fa-download"></i> ${dlCount} 次</span>
          <span><i class="fa-solid fa-file"></i> ${sizeStr}</span>
          ${v.locked ? `<span style="color:var(--warning)"><i class="fa-solid fa-lock"></i> 锁定中 ${lockRemain}</span>` : ''}
        </div>
        <div class="video-actions">
          <a
            class="btn btn-primary btn-sm"
            href="${downloadUrl}"
            ${canDownload ? '' : 'style="pointer-events:none;opacity:.4"'}
            title="${canDownload ? '下载视频' : '权限不足'}"
          >
            <i class="fa-solid fa-download"></i> 下载
          </a>
          ${(isOwner || isAdmin) ? `
            <button class="btn btn-danger btn-sm" onclick="deleteVideo('${v.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
        </div>
        <div class="video-quick-replies">
          <button
            class="quick-reply-btn ${publishedActive ? 'active' : ''}"
            id="published-btn-${v.id}"
            onclick="togglePublished('${v.id}')"
            title="标记该视频已发布"
          >
            <span class="icon">📣</span>
            <span>已发布</span>
            <span class="count" id="published-count-${v.id}">${publishedCount}</span>
          </button>
          <div class="quick-reply-users" id="published-users-${v.id}">
            ${renderPublishedUsers(publishedUsers)}
          </div>
        </div>
      </div>
    </div>`;
}

async function deleteVideo(videoId) {
  if (!confirm('确定要删除该视频吗？此操作不可撤销。')) return;
  try {
    await apiDelete(`/api/videos/${videoId}`);
    showToast('视频已删除', 'success');
    const card = document.getElementById(`vcard-${videoId}`);
    if (card) card.remove();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function togglePublished(videoId) {
  try {
    const data = await apiPost(`/api/videos/${videoId}/published-toggle`, {});
    const btn = document.getElementById(`published-btn-${videoId}`);
    const count = document.getElementById(`published-count-${videoId}`);
    const users = document.getElementById(`published-users-${videoId}`);
    if (btn) btn.classList.toggle('active', !!data.published_by_me);
    if (count) count.textContent = data.published_count ?? 0;
    if (users) users.innerHTML = renderPublishedUsers(data.published_usernames || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPublishedUsers(usernames) {
  if (!usernames.length) return '';
  return usernames.map(name => `<span class="quick-reply-user">${escapeHtml(name)}</span>`).join('');
}

function openVideoPlayer(videoId, title) {
  const player = document.getElementById('video-player');
  const titleEl = document.getElementById('video-player-title');
  if (!player) return;

  player.src = buildAuthenticatedMediaUrl(`/api/videos/${videoId}/stream`);
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-circle-play"></i> ${escapeHtml(title || '视频播放')}`;
  }
  openModal('modal-video-player');
  player.play().catch(() => {});
}

function closeVideoPlayer() {
  const player = document.getElementById('video-player');
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
  closeModal('modal-video-player');
}

window.handleModalClosed = function(id) {
  if (id !== 'modal-video-player') return;
  const player = document.getElementById('video-player');
  if (!player) return;
  player.pause();
  player.removeAttribute('src');
  player.load();
};

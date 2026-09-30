/**
 * Synthetix AI Website Cloner — Client Script
 */

const API_BASE = '';
let pollingInterval = null;
let isCloning = false;

// ─── DOM Elements ────────────────────────────────────────────

const urlInput = document.getElementById('urlInput');
const cloneBtn = document.getElementById('cloneBtn');
const previewSection = document.getElementById('previewSection');
const modifySection = document.getElementById('modifySection');
const logsSection = document.getElementById('logsSection');
const modifyInput = document.getElementById('modifyInput');
const modifyBtn = document.getElementById('modifyBtn');
const previewFrame = document.getElementById('previewFrame');
const previewLink = document.getElementById('previewLink');
const previewContainer = document.getElementById('previewContainer');
const logsContent = document.getElementById('logsContent');
const modHistory = document.getElementById('modHistory');
const tokenUsage = document.getElementById('tokenUsage');

// Code Inspector DOM Elements
const codeInspectorSection = document.getElementById('codeInspectorSection');
const fileTabs = document.getElementById('fileTabs');
const activeFileName = document.getElementById('activeFileName');
const activeFileCode = document.getElementById('activeFileCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');

let projectFilesCache = [];
let currentActiveFilePath = '';

// ─── Preset Chips & Suggestions ──────────────────────────────

document.querySelectorAll('.preset-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    urlInput.value = chip.dataset.url;
    urlInput.focus();
    urlInput.classList.add('pulse-highlight');
    setTimeout(() => urlInput.classList.remove('pulse-highlight'), 800);
  });
});

document.querySelectorAll('.mod-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    modifyInput.value = chip.dataset.prompt;
    modifyInput.focus();
  });
});

// ─── Event Listeners ─────────────────────────────────────────

cloneBtn.addEventListener('click', startClone);
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') startClone();
});

modifyBtn.addEventListener('click', applyModification);
modifyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') applyModification();
});

// Viewport switching
document.querySelectorAll('.toolbar-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toolbar-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const viewport = btn.dataset.viewport;
    previewContainer.className = 'preview-frame-container';
    if (viewport !== 'desktop') {
      previewContainer.classList.add(viewport);
    }
  });
});

// ─── Clone Operation ─────────────────────────────────────────

async function startClone() {
  const url = urlInput.value.trim();
  if (!url || !url.startsWith('http')) {
    urlInput.style.borderColor = '#f43f5e';
    urlInput.focus();
    setTimeout(() => { urlInput.style.borderColor = ''; }, 2000);
    return;
  }

  if (isCloning) return;
  isCloning = true;

  // Update UI
  setBtnLoading(cloneBtn, true);
  previewSection.style.display = 'none';
  modifySection.style.display = 'none';
  logsSection.style.display = 'block';

  // Reset pipeline cards
  document.querySelectorAll('.pipeline-card').forEach((card) => {
    card.classList.remove('active', 'completed');
    const badge = card.querySelector('.status-badge');
    badge.className = 'status-badge pending';
    badge.textContent = 'Pending';
  });

  // Activate first stage immediately
  const firstCard = document.querySelector('[data-stage="analysis"]');
  if (firstCard) {
    firstCard.classList.add('active');
    const b = firstCard.querySelector('.status-badge');
    b.className = 'status-badge running';
    b.textContent = 'Analyzing...';
  }

  try {
    const response = await fetch(`${API_BASE}/api/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Clone failed to initiate');
      setBtnLoading(cloneBtn, false);
      isCloning = false;
      return;
    }

    // Start polling for status
    startPolling();
  } catch (err) {
    alert(`Connection Error: ${err.message}`);
    setBtnLoading(cloneBtn, false);
    isCloning = false;
  }
}

// ─── Status Polling ──────────────────────────────────────────

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/status`);
      const data = await response.json();

      updatePipelineUI(data);
      updateTokenUsage(data.tokenUsage);
      updateLogs(data.logs);

      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(pollingInterval);
        pollingInterval = null;
        isCloning = false;
        setBtnLoading(cloneBtn, false);

        if (data.status === 'completed') {
          showPreview();
          modifySection.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 1800);
}

function updatePipelineUI(data) {
  if (!data.stages) return;

  data.stages.forEach((stage) => {
    const stageEl = document.querySelector(`[data-stage="${stage.name}"]`);
    if (!stageEl) return;

    const badge = stageEl.querySelector('.status-badge');
    badge.className = `status-badge ${stage.status}`;
    badge.textContent = stage.status === 'running' ? 'Active' : stage.status.charAt(0).toUpperCase() + stage.status.slice(1);

    stageEl.classList.toggle('active', stage.status === 'running');
    stageEl.classList.toggle('completed', stage.status === 'completed');
  });
}

function updateTokenUsage(usage) {
  if (!usage) return;
  document.getElementById('inputTokens').textContent = (usage.inputTokens || 0).toLocaleString();
  document.getElementById('outputTokens').textContent = (usage.outputTokens || 0).toLocaleString();
  document.getElementById('apiCalls').textContent = usage.calls || 0;
  document.getElementById('estCost').textContent = usage.estimatedCost || '$0.0000 (Free Tier)';
}

function updateLogs(logs) {
  if (!logs || logs.length === 0) return;
  logsContent.textContent = logs.join('\n');
  logsContent.scrollTop = logsContent.scrollHeight;
}

// ─── Preview ─────────────────────────────────────────────────

function showPreview() {
  const previewUrl = `${API_BASE}/api/preview`;

  previewSection.style.display = 'block';
  previewFrame.src = `${previewUrl}?t=${Date.now()}`;
  previewLink.href = previewUrl;

  previewSection.scrollIntoView({ behavior: 'smooth' });
}

// ─── Modification ────────────────────────────────────────────

async function applyModification() {
  const instruction = modifyInput.value.trim();
  if (!instruction) return;

  setBtnLoading(modifyBtn, true);
  modifyInput.disabled = true;

  const modItem = addModHistoryItem(instruction, 'pending');

  try {
    const response = await fetch(`${API_BASE}/api/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction }),
    });

    const data = await response.json();

    if (response.ok) {
      const filesCount = data.files ? data.files.length : 0;
      const fileNames = data.files ? data.files.map(f => f.path.split('/').pop()).join(', ') : '';
      modItem.querySelector('.mod-status').innerHTML = `✅ Refactored <span class="mod-files-badge">(${filesCount} file${filesCount === 1 ? '' : 's'}: ${fileNames})</span>`;
      
      if (data.explanation || data.plan) {
        const detail = document.createElement('div');
        detail.className = 'mod-detail-text';
        detail.textContent = `📋 ${data.plan || ''}${data.explanation ? ' — ' + data.explanation : ''}`;
        modItem.appendChild(detail);
      }

      // Reload project files in the inspector and highlight modified ones
      const modifiedPaths = data.files ? data.files.map(f => f.path) : [];
      await loadProjectFiles(modifiedPaths);

      // Refresh live preview frame with cache-buster
      previewFrame.src = `${API_BASE}/api/preview?t=${Date.now()}`;
    } else {
      modItem.classList.add('error');
      modItem.querySelector('.mod-status').textContent = '❌ Failed: ' + (data.error || 'Server error');
    }
  } catch (err) {
    modItem.classList.add('error');
    modItem.querySelector('.mod-status').textContent = '❌ Network Error';
  }

  modifyInput.value = '';
  modifyInput.disabled = false;
  modifyInput.focus();
  setBtnLoading(modifyBtn, false);

  try {
    const statusRes = await fetch(`${API_BASE}/api/status`);
    const statusData = await statusRes.json();
    updateTokenUsage(statusData.tokenUsage);
  } catch {}
}

function addModHistoryItem(text, status) {
  const item = document.createElement('div');
  item.className = 'mod-history-item';
  item.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; flex-wrap: wrap;">
      <span class="mod-text">💬 "${text}"</span>
      <span class="mod-status">${status === 'pending' ? '⏳ Refactoring AST...' : status}</span>
    </div>
  `;
  modHistory.prepend(item);
  return item;
}

// ─── Codebase & Diff Inspector ──────────────────────────────

async function loadProjectFiles(highlightPaths = []) {
  try {
    const res = await fetch(`${API_BASE}/api/project-files`);
    if (!res.ok) return;

    const data = await res.json();
    projectFilesCache = data.files || [];

    if (projectFilesCache.length === 0) {
      activeFileCode.textContent = '// No generated files found yet. Run a clone first!';
      return;
    }

    renderFileTabs(highlightPaths);

    // If there are highlighted files, open the first modified one; otherwise open the first component or globals.css
    let targetFile = highlightPaths.length > 0
      ? projectFilesCache.find(f => highlightPaths.includes(f.path))
      : projectFilesCache.find(f => f.path.includes('globals.css')) || projectFilesCache[0];

    if (targetFile) {
      displayFileContent(targetFile.path);
    }
  } catch (err) {
    console.warn('Could not load project files:', err);
  }
}

function renderFileTabs(highlightPaths = []) {
  fileTabs.innerHTML = '';

  projectFilesCache.forEach((file) => {
    const tab = document.createElement('button');
    const isModified = highlightPaths.some(p => p === file.path || file.path.endsWith(p));
    tab.className = `file-tab ${file.path === currentActiveFilePath ? 'active' : ''}`;
    
    // Choose icon
    let icon = '📄';
    if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) icon = '⚛️';
    else if (file.path.endsWith('.css')) icon = '🎨';
    else if (file.path.endsWith('.json')) icon = '⚙️';

    tab.innerHTML = `
      <span>${icon}</span>
      <span>${file.path}</span>
      ${isModified ? '<span class="file-badge-modified">Modified</span>' : ''}
    `;

    tab.addEventListener('click', () => {
      displayFileContent(file.path);
    });

    fileTabs.appendChild(tab);
  });
}

function displayFileContent(filePath) {
  currentActiveFilePath = filePath;
  const file = projectFilesCache.find(f => f.path === filePath);

  if (!file) return;

  activeFileName.textContent = file.path;
  activeFileCode.textContent = file.content;

  // Update active tab styling
  document.querySelectorAll('.file-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.textContent.includes(file.path));
  });
}

function copyActiveCode() {
  if (!activeFileCode.textContent) return;
  navigator.clipboard.writeText(activeFileCode.textContent).then(() => {
    const origText = copyCodeBtn.textContent;
    copyCodeBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyCodeBtn.textContent = origText; }, 1800);
  });
}

if (refreshFilesBtn) {
  refreshFilesBtn.addEventListener('click', () => loadProjectFiles());
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', copyActiveCode);
}

// ─── Initial Page Load Setup ─────────────────────────────────

// Automatically load project files if a clone already exists
loadProjectFiles();

// ─── Helpers ─────────────────────────────────────────────────

function setBtnLoading(btn, loading) {
  const textEl = btn.querySelector('.btn-text');
  const loadingEl = btn.querySelector('.btn-loading');

  if (loading) {
    textEl.style.display = 'none';
    loadingEl.style.display = 'inline-flex';
    btn.disabled = true;
  } else {
    textEl.style.display = 'inline-flex';
    loadingEl.style.display = 'none';
    btn.disabled = false;
  }
}


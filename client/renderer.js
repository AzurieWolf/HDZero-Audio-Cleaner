const state = { items: [], outputDirectory: null, processing: false, nextId: 1 };
const acceptedExtensions = new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v']);

const elements = {
  list: document.getElementById('queue-list'), dropZone: document.getElementById('drop-zone'),
  dropTitle: document.getElementById('drop-title'), dropSubtitle: document.getElementById('drop-subtitle'),
  count: document.getElementById('queue-count'), add: document.getElementById('add-button'),
  clear: document.getElementById('clear-button'), process: document.getElementById('process-button'),
  caption: document.getElementById('process-caption'), cancel: document.getElementById('cancel-button'),
  denoise: document.getElementById('denoise-toggle'), attenuation: document.getElementById('attenuation'),
  attenuationValue: document.getElementById('attenuation-value'), attenuationControls: document.getElementById('attenuation-controls'),
  output: document.getElementById('output-button'), outputLabel: document.getElementById('output-label'),
  openWhenComplete: document.getElementById('open-when-complete'), summary: document.getElementById('summary')
};

function fileName(filePath) { return filePath.split(/[\\/]/).pop(); }
function extension(filePath) { const name = fileName(filePath); return name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : ''; }
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function globalTreatmentSettings() {
  return {
    channel: document.querySelector('input[name="channel"]:checked').value,
    denoise: elements.denoise.checked,
    attenuation: elements.denoise.checked ? Number(elements.attenuation.value) : null
  };
}

function applyGlobalTreatmentSettings(settings) {
  const channel = ['left', 'right', 'both'].includes(settings.channel) ? settings.channel : 'right';
  document.querySelector(`input[name="channel"][value="${channel}"]`).checked = true;
  document.querySelectorAll('.choice').forEach((choice) => choice.classList.toggle('selected', choice.querySelector('input').checked));
  elements.denoise.checked = Boolean(settings.denoise);
  elements.attenuation.value = Number(settings.attenuation) || 30;
  elements.attenuationValue.value = `${elements.attenuation.value} dB`;
  elements.attenuationControls.classList.toggle('disabled', !elements.denoise.checked);
}

function addPaths(paths) {
  const known = new Set(state.items.map((item) => item.path.toLowerCase()));
  paths.filter((filePath) => acceptedExtensions.has(extension(filePath)) && !known.has(filePath.toLowerCase())).forEach((filePath) => {
    state.items.push({ id: state.nextId++, path: filePath, status: 'queued', progress: 0, detail: 'Waiting', customSettings: null });
    known.add(filePath.toLowerCase());
  });
  render();
}

function render() {
  elements.dropZone.classList.toggle('compact', state.items.length > 0);
  elements.dropTitle.textContent = state.items.length ? 'Drop more videos here' : 'Drop video files here';
  elements.dropSubtitle.textContent = state.items.length ? 'or click to browse' : 'or use Add videos to select multiple recordings';
  elements.list.hidden = state.items.length === 0;
  elements.count.textContent = `${state.items.length} ${state.items.length === 1 ? 'file' : 'files'}`;
  elements.clear.disabled = state.processing || state.items.length === 0;
  elements.add.disabled = state.processing;
  elements.output.disabled = state.processing;
  elements.openWhenComplete.disabled = state.processing;
  elements.process.disabled = state.processing || state.items.length === 0;
  elements.cancel.hidden = !state.processing;
  elements.caption.textContent = state.items.length ? `${state.items.length} ${state.items.length === 1 ? 'video' : 'videos'} · sequential` : 'Add videos to begin';
  elements.list.innerHTML = state.items.map((item, index) => `
    <article class="queue-item ${item.status}" data-id="${item.id}">
      <span class="file-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="file-icon"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zM15 3v5h4M10 11l5 3-5 3z"/></svg></span>
      <span class="file-copy"><span class="file-name-row"><strong title="${escapeHtml(item.path)}">${escapeHtml(fileName(item.path))}</strong>${item.customSettings ? '<b class="custom-pill">CUSTOM</b>' : ''}</span><small>${escapeHtml(item.detail)}</small><span class="item-progress"><i style="width:${item.progress}%"></i></span></span>
      <span class="status-pill">${item.status}</span>
      <button class="edit-button" type="button" data-edit="${item.id}" ${state.processing ? 'disabled' : ''}>Edit / preview</button>
      <button class="remove-button" type="button" data-remove="${item.id}" aria-label="Remove ${escapeHtml(fileName(item.path))}" ${state.processing ? 'disabled' : ''}>×</button>
    </article>`).join('');
}

async function chooseVideos() { addPaths(await window.hdzero.selectVideos()); }

elements.add.addEventListener('click', chooseVideos);
elements.dropZone.addEventListener('click', chooseVideos);
elements.clear.addEventListener('click', () => { state.items = []; render(); });
elements.list.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove]');
  const editButton = event.target.closest('[data-edit]');
  if (removeButton && !state.processing) {
    const id = Number(removeButton.dataset.remove);
    state.items = state.items.filter((item) => item.id !== id);
    render();
  }
  if (editButton && !state.processing) {
    const item = state.items.find((candidate) => candidate.id === Number(editButton.dataset.edit));
    if (item) window.hdzero.openEditor({
      id: item.id, path: item.path, customSettings: item.customSettings, globalSettings: globalTreatmentSettings()
    });
  }
});

['dragenter', 'dragover'].forEach((name) => document.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => document.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.remove('dragging'); }));
document.addEventListener('drop', (event) => {
  const paths = Array.from(event.dataTransfer.files, (file) => window.hdzero.pathFromFile(file)).filter(Boolean);
  addPaths(paths);
});

document.querySelectorAll('input[name="channel"]').forEach((input) => input.addEventListener('change', () => {
  document.querySelectorAll('.choice').forEach((choice) => choice.classList.toggle('selected', choice.querySelector('input').checked));
}));

elements.denoise.addEventListener('change', () => elements.attenuationControls.classList.toggle('disabled', !elements.denoise.checked));
elements.attenuation.addEventListener('input', () => { elements.attenuationValue.value = `${elements.attenuation.value} dB`; });
elements.output.addEventListener('click', async () => {
  const selected = await window.hdzero.selectOutputDirectory();
  if (selected) { state.outputDirectory = selected; elements.outputLabel.textContent = selected; elements.outputLabel.title = selected; }
});

elements.process.addEventListener('click', async () => {
  if (!state.items.length || state.processing) return;
  state.processing = true;
  state.items.forEach((item) => { item.status = 'queued'; item.progress = 0; item.detail = 'Waiting'; });
  elements.summary.textContent = 'Processing the queue. You can leave this window open in the background.';
  render();
  const payload = {
    items: state.items.map(({ id, path, customSettings }) => ({ id, path, customSettings })),
    settings: {
      channel: document.querySelector('input[name="channel"]:checked').value,
      denoise: elements.denoise.checked,
      attenuation: elements.denoise.checked ? Number(elements.attenuation.value) : null,
      outputDirectory: state.outputDirectory,
      openWhenComplete: elements.openWhenComplete.checked
    }
  };
  try { await window.hdzero.processQueue(payload); }
  catch (error) { elements.summary.textContent = `Could not start: ${error.message}`; state.processing = false; render(); }
});

elements.cancel.addEventListener('click', () => { elements.cancel.disabled = true; elements.cancel.textContent = 'Cancelling…'; window.hdzero.cancel(); });

window.hdzero.onProgress((update) => {
  const item = state.items.find((candidate) => candidate.id === update.id);
  if (!item) return;
  Object.assign(item, { status: update.status, progress: update.progress, detail: update.detail, output: update.output });
  elements.summary.textContent = update.status === 'failed' ? `Error: ${update.detail}` : `File ${update.index} of ${update.total} · ${update.detail}`;
  render();
});

window.hdzero.onFinished(({ results, cancelled }) => {
  state.processing = false;
  elements.cancel.disabled = false;
  elements.cancel.textContent = 'Cancel';
  const completed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok && !result.cancelled).length;
  elements.summary.textContent = cancelled ? `Batch cancelled · ${completed} completed` : `Batch finished · ${completed} completed${failed ? ` · ${failed} failed` : ''}`;
  render();
});

window.hdzero.onCustomSettings(({ id, settings }) => {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return;
  item.customSettings = settings;
  item.detail = settings ? 'Custom audio settings' : 'Waiting · global settings';
  render();
});

window.hdzero.onGlobalSettings((settings) => {
  applyGlobalTreatmentSettings(settings);
  state.items.forEach((item) => {
    if (!item.customSettings && item.status === 'queued') item.detail = 'Waiting · global settings';
  });
  render();
});

const controls = document.querySelector('.window-controls');
const maximizeButton = document.getElementById('maximize');
document.getElementById('minimize').addEventListener('click', () => window.windowControls.perform('minimize'));
maximizeButton.addEventListener('click', () => window.windowControls.perform('maximize'));
document.getElementById('close').addEventListener('click', () => window.windowControls.perform('close'));
window.windowControls.onStateChange(({ maximized }) => {
  controls.classList.toggle('is-maximized', maximized);
  maximizeButton.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
  maximizeButton.title = maximized ? 'Restore' : 'Maximize';
});

window.hdzero.getAppInfo().then(({ version }) => {
  document.getElementById('app-version').textContent = `v${version}`;
});

render();

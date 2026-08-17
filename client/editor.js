const state = {
  id: null, sourceUrl: '', previewUrl: '', duration: 0, start: 0, end: 0,
  previewLength: 10, globalSettings: null, hasCustomSettings: false, generating: false,
  audioGraph: null, playbackFrame: null
};

const elements = {
  player: document.getElementById('player'), empty: document.getElementById('viewer-empty'),
  name: document.getElementById('video-name'), path: document.getElementById('video-path'),
  custom: document.getElementById('custom-state'), timeline: document.getElementById('timeline'),
  highlight: document.getElementById('range-highlight'), playhead: document.getElementById('playhead'),
  start: document.getElementById('range-start'), end: document.getElementById('range-end'),
  rangeDuration: document.getElementById('range-duration'), previewDuration: document.getElementById('preview-duration'),
  showSource: document.getElementById('show-source'), showPreview: document.getElementById('show-preview'),
  viewerLabel: document.getElementById('viewer-label'), denoise: document.getElementById('editor-denoise'),
  attenuation: document.getElementById('editor-attenuation'), attenuationValue: document.getElementById('editor-attenuation-value'),
  attenuationControls: document.getElementById('editor-attenuation-controls'), generate: document.getElementById('generate-preview'),
  apply: document.getElementById('apply-settings'), applyGlobal: document.getElementById('apply-global-settings'), reset: document.getElementById('reset-settings'),
  message: document.getElementById('editor-message'), progress: document.getElementById('preview-progress'),
  progressFill: document.getElementById('preview-progress-fill'), progressStatus: document.getElementById('preview-status'),
  progressPercent: document.getElementById('preview-percent')
};

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - (minutes * 60);
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`;
}

function currentSettings() {
  return {
    channel: document.querySelector('input[name="editor-channel"]:checked').value,
    denoise: elements.denoise.checked,
    attenuation: elements.denoise.checked ? Number(elements.attenuation.value) : null
  };
}

function updateGenerateState() {
  elements.generate.disabled = state.generating || state.duration <= 0 || !elements.denoise.checked;
}

function applyLiveChannel() {
  if (!state.audioGraph) return;
  const channel = document.querySelector('input[name="editor-channel"]:checked').value;
  const { context, leftToLeft, leftToRight, rightToLeft, rightToRight } = state.audioGraph;
  const gains = channel === 'left'
    ? [1, 1, 0, 0]
    : channel === 'right'
      ? [0, 0, 1, 1]
      : [1, 0, 0, 1];
  [leftToLeft, leftToRight, rightToLeft, rightToRight].forEach((node, index) => {
    node.gain.setValueAtTime(gains[index], context.currentTime);
  });
}

async function ensureAudioGraph() {
  try {
    if (!state.audioGraph) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(elements.player);
      const splitter = context.createChannelSplitter(2);
      const merger = context.createChannelMerger(2);
      const leftToLeft = context.createGain();
      const leftToRight = context.createGain();
      const rightToLeft = context.createGain();
      const rightToRight = context.createGain();
      source.connect(splitter);
      splitter.connect(leftToLeft, 0);
      splitter.connect(leftToRight, 0);
      splitter.connect(rightToLeft, 1);
      splitter.connect(rightToRight, 1);
      leftToLeft.connect(merger, 0, 0);
      leftToRight.connect(merger, 0, 1);
      rightToLeft.connect(merger, 0, 0);
      rightToRight.connect(merger, 0, 1);
      merger.connect(context.destination);
      state.audioGraph = { context, leftToLeft, leftToRight, rightToLeft, rightToRight };
    }
    if (state.audioGraph.context.state === 'suspended') await state.audioGraph.context.resume();
    applyLiveChannel();
  } catch (error) {
    elements.message.textContent = `Live channel monitoring is unavailable: ${error.message}`;
  }
}

function applySettings(settings) {
  const channel = settings.channel || 'right';
  document.querySelector(`input[name="editor-channel"][value="${channel}"]`).checked = true;
  document.querySelectorAll('.choice').forEach((choice) => choice.classList.toggle('selected', choice.querySelector('input').checked));
  elements.denoise.checked = Boolean(settings.denoise);
  elements.attenuation.value = Number(settings.attenuation) || 30;
  elements.attenuationValue.value = `${elements.attenuation.value} dB`;
  elements.attenuationControls.classList.toggle('disabled', !elements.denoise.checked);
  updateGenerateState();
  applyLiveChannel();
}

function updateCustomState() {
  elements.custom.textContent = state.hasCustomSettings ? 'Custom settings applied' : 'Using global settings';
  elements.custom.classList.toggle('active', state.hasCustomSettings);
}

function updateSelection(seekVideo = true) {
  if (!state.duration) return;
  state.previewLength = Number(elements.previewDuration.value);
  const actualLength = Math.min(state.previewLength, state.duration);
  state.start = Math.min(Math.max(0, Number(elements.timeline.value)), Math.max(0, state.duration - actualLength));
  state.end = Math.min(state.duration, state.start + actualLength);
  elements.timeline.value = String(state.start);
  const left = (state.start / state.duration) * 100;
  const width = ((state.end - state.start) / state.duration) * 100;
  elements.highlight.style.left = `${left}%`;
  elements.highlight.style.width = `${width}%`;
  elements.playhead.style.left = `${left}%`;
  elements.start.value = formatTime(state.start);
  elements.end.value = formatTime(state.end);
  elements.rangeDuration.textContent = `${(state.end - state.start).toFixed(1)} second selection`;
  if (seekVideo && elements.showSource.classList.contains('active')) elements.player.currentTime = state.start;
}

function syncSelectionToPlayback() {
  if (!elements.showSource.classList.contains('active') || !state.duration) return;
  const currentTime = Number(elements.player.currentTime);
  if (!Number.isFinite(currentTime)) return;
  elements.timeline.value = String(currentTime);
  updateSelection(false);
}

function stopPlaybackTracking() {
  if (state.playbackFrame !== null) cancelAnimationFrame(state.playbackFrame);
  state.playbackFrame = null;
}

function trackPlayback() {
  syncSelectionToPlayback();
  if (!elements.player.paused && !elements.player.ended && elements.showSource.classList.contains('active')) {
    state.playbackFrame = requestAnimationFrame(trackPlayback);
  } else {
    state.playbackFrame = null;
  }
}

function startPlaybackTracking() {
  if (state.playbackFrame === null && elements.showSource.classList.contains('active')) {
    state.playbackFrame = requestAnimationFrame(trackPlayback);
  }
}

function showSource() {
  elements.player.src = state.sourceUrl;
  elements.player.load();
  elements.player.currentTime = state.start;
  elements.showSource.classList.add('active');
  elements.showPreview.classList.remove('active');
  elements.showSource.setAttribute('aria-pressed', 'true');
  elements.showPreview.setAttribute('aria-pressed', 'false');
  elements.viewerLabel.textContent = 'Viewing source video';
}

function showPreview() {
  if (!state.previewUrl) return;
  stopPlaybackTracking();
  elements.player.src = state.previewUrl;
  elements.player.load();
  elements.showPreview.classList.add('active');
  elements.showSource.classList.remove('active');
  elements.showPreview.setAttribute('aria-pressed', 'true');
  elements.showSource.setAttribute('aria-pressed', 'false');
  elements.viewerLabel.textContent = `Viewing processed ${state.end - state.start}s preview`;
  elements.player.play().catch(() => {});
}

window.videoEditor.onInit((payload) => {
  state.id = payload.id;
  state.sourceUrl = payload.sourceUrl;
  state.duration = Number(payload.duration) || 0;
  state.globalSettings = payload.hasCustomSettings ? null : { ...payload.settings };
  state.hasCustomSettings = payload.hasCustomSettings;
  elements.name.textContent = payload.name;
  elements.path.textContent = payload.path;
  document.getElementById('app-version').textContent = `v${payload.version}`;
  applySettings(payload.settings);
  updateCustomState();
  elements.player.src = state.sourceUrl;
  elements.player.load();
  elements.timeline.max = String(state.duration);
  updateGenerateState();
  updateSelection(false);
});

elements.player.addEventListener('loadedmetadata', () => {
  elements.empty.hidden = true;
  if (!elements.showSource.classList.contains('active')) return;
  state.duration = Number(elements.player.duration) || 0;
  elements.timeline.max = String(state.duration);
  updateGenerateState();
  updateSelection(false);
});

elements.player.addEventListener('error', () => {
  elements.empty.hidden = false;
  elements.empty.textContent = 'This format cannot be played directly. Generated previews will use MP4.';
});

elements.player.addEventListener('play', () => {
  ensureAudioGraph();
  startPlaybackTracking();
});

elements.player.addEventListener('pause', () => {
  syncSelectionToPlayback();
  stopPlaybackTracking();
});

elements.player.addEventListener('ended', () => {
  syncSelectionToPlayback();
  stopPlaybackTracking();
});

elements.player.addEventListener('timeupdate', syncSelectionToPlayback);

elements.player.addEventListener('seeking', () => {
  syncSelectionToPlayback();
});

elements.timeline.addEventListener('input', () => updateSelection(true));
elements.previewDuration.addEventListener('change', () => updateSelection(true));
elements.showSource.addEventListener('click', showSource);
elements.showPreview.addEventListener('click', showPreview);

document.querySelectorAll('input[name="editor-channel"]').forEach((input) => input.addEventListener('change', () => {
  document.querySelectorAll('.choice').forEach((choice) => choice.classList.toggle('selected', choice.querySelector('input').checked));
  ensureAudioGraph();
  elements.message.textContent = 'Channel monitoring changed live. Apply it to use this channel during final processing.';
}));
elements.denoise.addEventListener('change', () => {
  elements.attenuationControls.classList.toggle('disabled', !elements.denoise.checked);
  updateGenerateState();
  elements.message.textContent = elements.denoise.checked
    ? 'Noise reduction enabled. Generate a denoised preview of the highlighted range.'
    : 'Channel selection is monitored live. Enable noise reduction to generate a preview.';
});
elements.attenuation.addEventListener('input', () => {
  elements.attenuationValue.value = `${elements.attenuation.value} dB`;
  elements.message.textContent = 'Settings changed. Generate a preview or apply them to this video.';
});

elements.generate.addEventListener('click', async () => {
  if (state.generating || !state.duration || !elements.denoise.checked) return;
  state.generating = true;
  elements.generate.disabled = true;
  elements.progress.hidden = false;
  elements.progressFill.style.width = '0%';
  elements.progressPercent.value = '0%';
  elements.message.textContent = 'Generating preview with the selected audio settings…';
  try {
    const result = await window.videoEditor.generatePreview({
      start: state.start, duration: state.end - state.start, settings: currentSettings()
    });
    state.previewUrl = result.url;
    elements.showPreview.disabled = false;
    elements.message.textContent = 'Preview ready. Compare it with the original, then apply the settings if desired.';
    showPreview();
  } catch (error) {
    elements.message.textContent = `Preview failed: ${error.message}`;
  } finally {
    state.generating = false;
    updateGenerateState();
  }
});

elements.apply.addEventListener('click', async () => {
  await window.videoEditor.saveCustomSettings(currentSettings());
  state.hasCustomSettings = true;
  updateCustomState();
  elements.message.textContent = 'Custom settings saved for this video.';
});

elements.applyGlobal.addEventListener('click', async () => {
  const settings = currentSettings();
  await window.videoEditor.useAsGlobalSettings(settings);
  state.globalSettings = { ...settings };
  state.hasCustomSettings = false;
  updateCustomState();
  elements.message.textContent = 'Global settings updated. Queued videos without custom overrides will use these settings.';
});

elements.reset.addEventListener('click', async () => {
  const globalSettings = await window.videoEditor.clearCustomSettings();
  state.globalSettings = { ...globalSettings };
  state.hasCustomSettings = false;
  applySettings(globalSettings);
  updateCustomState();
  elements.message.textContent = 'This video will use the global settings from the main window.';
});

window.videoEditor.onProgress(({ progress, detail }) => {
  elements.progress.hidden = false;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressPercent.value = `${progress}%`;
  elements.progressStatus.textContent = detail;
});

window.videoEditor.onGlobalSettings((settings) => {
  state.globalSettings = { ...settings };
  if (!state.hasCustomSettings) applySettings(settings);
});

const controls = document.querySelector('.window-controls');
const maximizeButton = document.getElementById('maximize');
document.getElementById('minimize').addEventListener('click', () => window.windowControls.perform('minimize'));
maximizeButton.addEventListener('click', () => window.windowControls.perform('maximize'));
document.getElementById('close').addEventListener('click', () => window.windowControls.perform('close'));
window.windowControls.onStateChange(({ maximized }) => {
  controls.classList.toggle('is-maximized', maximized);
  maximizeButton.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
});

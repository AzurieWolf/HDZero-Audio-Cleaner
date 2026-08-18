const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, WebContentsView, dialog, ipcMain, shell } = require('electron');

let mainWindow;
let editorView = null;
let editorViewReady = null;
let editorOpening = false;
let activeProcess = null;
let cancelRequested = false;
let lastVideoDirectory = null;
const editorSessions = new Map();

const VIDEO_FILTERS = [
  { name: 'Video files', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'] },
  { name: 'All files', extensions: ['*'] }
];

function preferencesPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadPreferences() {
  try {
    const preferences = JSON.parse(fs.readFileSync(preferencesPath(), 'utf8'));
    if (typeof preferences.lastVideoDirectory === 'string' && fs.existsSync(preferences.lastVideoDirectory)) {
      lastVideoDirectory = preferences.lastVideoDirectory;
    }
  } catch {
    lastVideoDirectory = null;
  }
}

async function savePreferences() {
  await fs.promises.mkdir(path.dirname(preferencesPath()), { recursive: true });
  await fs.promises.writeFile(preferencesPath(), JSON.stringify({ lastVideoDirectory }, null, 2), 'utf8');
}

function findResource(candidates, label) {
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`${label} was not found. Run [Client_Install_Requirements].bat and try again.`);
  return found;
}

function getFfmpegPath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'bin', 'ffmpeg.exe')]
    : [path.join(__dirname, 'dependencies', 'ffmpeg.exe')];
  return findResource(candidates, 'FFmpeg');
}

function getPythonCommand() {
  const bundled = app.isPackaged && path.join(process.resourcesPath, 'denoise', 'denoise-worker.exe');
  if (bundled && fs.existsSync(bundled)) return { command: bundled, prefix: [], standalone: true };
  if (process.platform === 'win32') return { command: 'py', prefix: ['-3.11'], standalone: false };
  return { command: 'python3', prefix: [], standalone: false };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function sendWindowState(window) {
  if (!window || window.isDestroyed()) return;
  const payload = { maximized: window.isMaximized() };
  window.webContents.send('window-state-changed', payload);
  if (editorView && !editorView.webContents.isDestroyed()) {
    editorView.webContents.send('window-state-changed', payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 790,
    minWidth: 820,
    minHeight: 610,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'favicon.ico'),
    backgroundColor: '#080a0e',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('did-finish-load', () => {
    sendWindowState(mainWindow);
    prepareEditorView();
  });
  mainWindow.on('maximize', () => sendWindowState(mainWindow));
  mainWindow.on('unmaximize', () => sendWindowState(mainWindow));
  mainWindow.on('resize', () => {
    if (!editorView || editorView.webContents.isDestroyed()) return;
    const [width, height] = mainWindow.getContentSize();
    editorView.setBounds({ x: 0, y: 48, width, height: Math.max(0, height - 48) });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function closeEditorView() {
  if (!editorView || !mainWindow || mainWindow.isDestroyed()) return;
  const view = editorView;
  const session = editorSessions.get(view.webContents.id);
  editorSessions.delete(view.webContents.id);
  if (session && session.tempDirectory) fs.promises.rm(session.tempDirectory, { recursive: true, force: true }).catch(() => {});
  send('editor-visibility-changed', false);
  if (session && session.attached) mainWindow.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.close();
  if (editorView === view) {
    editorView = null;
    editorViewReady = null;
  }
  mainWindow.webContents.focus();
  prepareEditorView();
}

function prepareEditorView() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  if (editorView && !editorView.webContents.isDestroyed()) return editorViewReady;
  editorView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'editor_preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  editorView.setBackgroundColor('#00000000');
  editorViewReady = editorView.webContents.loadFile(path.join(__dirname, 'editor.html'));
  return editorViewReady;
}

async function createEditorView(payload) {
  if (editorSessions.size || editorOpening) return;
  editorOpening = true;
  try {
    await prepareEditorView();
    if (!mainWindow || mainWindow.isDestroyed() || !editorView || editorView.webContents.isDestroyed()) {
      editorOpening = false;
      return;
    }

    const session = {
      webContents: editorView.webContents,
      itemId: payload.id,
      input: payload.path,
      globalSettings: payload.globalSettings,
      customSettings: payload.customSettings || null,
      tempDirectory: null,
      attached: false
    };
    const editorWebContentsId = editorView.webContents.id;
    editorSessions.set(editorWebContentsId, session);
    const [width, height] = mainWindow.getContentSize();
    editorView.setBounds({ x: 0, y: 48, width, height: Math.max(0, height - 48) });
    mainWindow.contentView.addChildView(editorView);
    session.attached = true;
    send('editor-visibility-changed', true);
    session.webContents.focus();
    session.webContents.send('editor-start-transition');
    editorOpening = false;
    const duration = await probeDuration(getFfmpegPath(), session.input);
    if (session.webContents.isDestroyed()) return;
    session.webContents.send('editor-init', {
      id: session.itemId,
      name: path.basename(session.input),
      path: session.input,
      sourceUrl: pathToFileURL(session.input).href,
      duration,
      version: app.getVersion(),
      settings: session.customSettings || session.globalSettings,
      hasCustomSettings: Boolean(session.customSettings)
    });
    sendWindowState(mainWindow);
  } catch (error) {
    editorOpening = false;
    throw error;
  }
}

function runProcess(command, args, { onStdout } = {}) {
  return new Promise((resolve, reject) => {
    if (cancelRequested) return reject(new Error('Processing cancelled.'));
    let stderr = '';
    let stdout = '';
    let settled = false;
    const child = spawn(command, args, { windowsHide: true });
    activeProcess = child;
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (stdout.length > 12000) stdout = stdout.slice(-12000);
      if (onStdout) onStdout(text);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      activeProcess = null;
      reject(new Error(error.code === 'ENOENT' ? `${path.basename(command)} could not be started.` : error.message));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      activeProcess = null;
      if (cancelRequested) return reject(new Error('Processing cancelled.'));
      if (code === 0) resolve();
      else {
        const diagnosticLines = stderr.trim().split(/\r?\n/).filter((line) => {
          const text = line.trim();
          return text
            && !text.includes('torchaudio.backend.common.AudioMetaData')
            && !text.startsWith('from torchaudio.backend.common import AudioMetaData')
            && !text.startsWith('fatal: not a git repository');
        });
        const logLines = stdout.trim().split(/\r?\n/).filter((line) => {
          const text = line.trim();
          return text && !text.startsWith('HDZERO_PROGRESS=');
        });
        const details = [...logLines.slice(-5), ...diagnosticLines.slice(-5)].join('\n');
        reject(new Error(details || `Process exited with code ${code}.`));
      }
    });
  });
}

function probeDuration(ffmpeg, input) {
  return new Promise((resolve) => {
    let stderr = '';
    const child = spawn(ffmpeg, ['-hide_banner', '-i', input], { windowsHide: true });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', () => resolve(0));
    child.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) return resolve(0);
      resolve((Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]));
    });
  });
}

function createProgressReader(duration, start, end, callback) {
  let buffer = '';
  let lastPercent = -1;
  return (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      const separator = line.indexOf('=');
      if (separator < 0) continue;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      let ratio = null;
      if (key === 'out_time_us' && duration > 0) ratio = Number(value) / 1000000 / duration;
      if (key === 'progress' && value === 'end') ratio = 1;
      if (ratio === null || !Number.isFinite(ratio)) continue;
      const percent = Math.round(start + (Math.max(0, Math.min(1, ratio)) * (end - start)));
      if (percent !== lastPercent) {
        lastPercent = percent;
        callback(percent);
      }
    }
  };
}

function withFfmpegProgress(args) {
  const output = args.pop();
  return [...args, '-progress', 'pipe:1', '-nostats', output];
}

function outputSuffix(settings) {
  const operations = [];
  if (settings.channel !== 'both') operations.push('fixed');
  if (settings.denoise) {
    const attenuation = Number.isFinite(Number(settings.attenuation))
      ? `-${Math.round(Number(settings.attenuation))}db`
      : '';
    operations.push(`denoised${attenuation}`);
  }
  return operations.length ? operations.join('+') : 'processed';
}

function outputPathFor(input, outputDirectory, settings) {
  const parsed = path.parse(input);
  const baseDirectory = outputDirectory || parsed.dir;
  const directory = settings.organizeOutputs ? path.join(baseDirectory, 'Fixed Videos') : baseDirectory;
  const suffix = outputSuffix(settings);
  let candidate = path.join(directory, `${parsed.name}_${suffix}${parsed.ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name}_${suffix}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function audioCodecFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.webm') return ['-c:a', 'libopus', '-b:a', '192k'];
  if (extension === '.avi') return ['-c:a', 'pcm_s16le'];
  return ['-c:a', 'aac', '-b:a', '320k'];
}

function channelFilter(channel) {
  if (channel === 'right') return ['-af', 'pan=mono|c0=c1'];
  if (channel === 'left') return ['-af', 'pan=mono|c0=c0'];
  return [];
}

function previewPlaybackFilter(channel) {
  if (channel === 'both') return [];
  return ['-af', 'pan=stereo|c0=c0|c1=c0'];
}

async function processOne(item, settings, index, total) {
  const ffmpeg = getFfmpegPath();
  const duration = await probeDuration(ffmpeg, item.path);
  const output = outputPathFor(item.path, settings.outputDirectory, settings);
  const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hdzero-audio-'));
  const extracted = path.join(tempDirectory, 'source.wav');
  const enhanced = path.join(tempDirectory, 'enhanced.wav');
  const update = (status, progress, detail = '') => send('processing-progress', {
    id: item.id, status, progress, detail, index, total, output
  });

  try {
    await fs.promises.mkdir(path.dirname(output), { recursive: true });
    if (settings.denoise) {
      update('processing', 0, 'Extracting audio · 0%');
      const extractionArgs = withFfmpegProgress([
        '-y', '-hide_banner', '-loglevel', 'error', '-ignore_editlist', '1',
        '-i', item.path, '-map', '0:a:0', ...channelFilter(settings.channel),
        '-ar', '48000', '-c:a', 'pcm_s16le', extracted
      ]);
      await runProcess(ffmpeg, extractionArgs, {
        onStdout: createProgressReader(duration, 0, 25, (progress) => update('processing', progress, `Extracting audio · ${progress}%`))
      });

      update('processing', 25, 'Loading DeepFilterNet 3 · 25%');
      const python = getPythonCommand();
      const worker = app.isPackaged
        ? path.join(process.resourcesPath, 'denoise', 'denoise_worker.py')
        : path.join(__dirname, 'denoise_worker.py');
      const model = app.isPackaged
        ? path.join(process.resourcesPath, 'models', 'DeepFilterNet3')
        : path.join(__dirname, 'dependencies', 'models', 'DeepFilterNet3');
      const args = python.standalone ? [] : [...python.prefix, worker];
      args.push('--input', extracted, '--output', enhanced, '--model', model);
      if (settings.attenuation !== null) args.push('--attenuation', String(settings.attenuation));
      let pythonBuffer = '';
      await runProcess(python.command, args, {
        onStdout: (chunk) => {
          pythonBuffer += chunk;
          const lines = pythonBuffer.split(/\r?\n/);
          pythonBuffer = lines.pop();
          for (const line of lines) {
            const match = line.match(/^HDZERO_PROGRESS=(\d+):(.*)$/);
            if (!match) continue;
            const stageRatio = Math.max(0, Math.min(100, Number(match[1]))) / 100;
            const progress = Math.round(25 + (stageRatio * 50));
            update('processing', progress, `${match[2]} · ${progress}%`);
          }
        }
      });

      update('processing', 75, 'Replacing audio track · 75%');
      const muxArgs = withFfmpegProgress([
        '-y', '-hide_banner', '-loglevel', 'error', '-ignore_editlist', '1',
        '-i', item.path, '-i', enhanced, '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', ...audioCodecFor(output), '-shortest', output
      ]);
      await runProcess(ffmpeg, muxArgs, {
        onStdout: createProgressReader(duration, 75, 100, (progress) => update('processing', progress, `Replacing audio track · ${progress}%`))
      });
    } else {
      update('processing', 0, 'Cleaning audio channel · 0%');
      const cleaningArgs = withFfmpegProgress([
        '-y', '-hide_banner', '-loglevel', 'error', '-ignore_editlist', '1',
        '-i', item.path, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
        ...channelFilter(settings.channel), ...audioCodecFor(output), output
      ]);
      await runProcess(ffmpeg, cleaningArgs, {
        onStdout: createProgressReader(duration, 0, 100, (progress) => update('processing', progress, `Cleaning audio channel · ${progress}%`))
      });
    }
    update('complete', 100, 'Complete');
    return { id: item.id, ok: true, output };
  } catch (error) {
    if (fs.existsSync(output)) await fs.promises.rm(output, { force: true }).catch(() => {});
    update(cancelRequested ? 'cancelled' : 'failed', 0, error.message);
    return { id: item.id, ok: false, cancelled: cancelRequested, error: error.message };
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

function editorProgress(session, progress, detail) {
  if (!session.webContents.isDestroyed()) session.webContents.send('preview-progress', { progress, detail });
}

async function generatePreview(session, request) {
  if (activeProcess) throw new Error('Another video is currently processing. Please wait for it to finish.');
  const ffmpeg = getFfmpegPath();
  const start = Math.max(0, Number(request.start) || 0);
  const duration = Math.max(0.1, Math.min(30, Number(request.duration) || 5));
  const settings = request.settings;
  if (!settings.denoise) throw new Error('Enable AI noise reduction to generate a denoised preview.');
  const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hdzero-preview-'));
  const extracted = path.join(tempDirectory, 'source.wav');
  const enhanced = path.join(tempDirectory, 'enhanced.wav');
  const output = path.join(tempDirectory, 'preview.mp4');

  try {
    editorProgress(session, 0, 'Extracting preview audio');
    const extractionArgs = withFfmpegProgress([
      '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(duration),
      '-i', session.input, '-map', '0:a:0', ...channelFilter(settings.channel),
      '-ar', '48000', '-c:a', 'pcm_s16le', extracted
    ]);
    await runProcess(ffmpeg, extractionArgs, {
      onStdout: createProgressReader(duration, 0, 25, (progress) => editorProgress(session, progress, `Extracting audio · ${progress}%`))
    });

    editorProgress(session, 25, 'Loading DeepFilterNet 3');
    const python = getPythonCommand();
    const worker = app.isPackaged
      ? path.join(process.resourcesPath, 'denoise', 'denoise_worker.py')
      : path.join(__dirname, 'denoise_worker.py');
    const model = app.isPackaged
      ? path.join(process.resourcesPath, 'models', 'DeepFilterNet3')
      : path.join(__dirname, 'dependencies', 'models', 'DeepFilterNet3');
    const args = python.standalone ? [] : [...python.prefix, worker];
    args.push('--input', extracted, '--output', enhanced, '--model', model, '--attenuation', String(settings.attenuation));
    let pythonBuffer = '';
    await runProcess(python.command, args, {
      onStdout: (chunk) => {
        pythonBuffer += chunk;
        const lines = pythonBuffer.split(/\r?\n/);
        pythonBuffer = lines.pop();
        for (const line of lines) {
          const match = line.match(/^HDZERO_PROGRESS=(\d+):(.*)$/);
          if (!match) continue;
          const progress = Math.round(25 + ((Number(match[1]) / 100) * 45));
          editorProgress(session, progress, `${match[2]} · ${progress}%`);
        }
      }
    });

    editorProgress(session, 70, 'Rendering denoised preview');
    const renderArgs = withFfmpegProgress([
      '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(duration),
      '-i', session.input, '-i', enhanced, '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      ...previewPlaybackFilter(settings.channel), '-c:a', 'aac', '-b:a', '256k',
      '-shortest', '-movflags', '+faststart', output
    ]);
    await runProcess(ffmpeg, renderArgs, {
      onStdout: createProgressReader(duration, 70, 100, (progress) => editorProgress(session, progress, `Rendering denoised preview · ${progress}%`))
    });

    if (session.webContents.isDestroyed()) {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
      throw new Error('The editor window was closed.');
    }
    const previousDirectory = session.tempDirectory;
    session.tempDirectory = tempDirectory;
    if (previousDirectory) fs.promises.rm(previousDirectory, { recursive: true, force: true }).catch(() => {});
    return { url: `${pathToFileURL(output).href}?generated=${Date.now()}`, start, duration };
  } catch (error) {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

ipcMain.handle('select-videos', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add videos to the queue',
    properties: ['openFile', 'multiSelections'],
    filters: VIDEO_FILTERS,
    ...(lastVideoDirectory ? { defaultPath: lastVideoDirectory } : {})
  });
  if (!result.canceled && result.filePaths.length) {
    lastVideoDirectory = path.dirname(result.filePaths[0]);
    await savePreferences().catch(() => {});
  }
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose output folder', properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-app-info', () => ({ version: app.getVersion() }));

ipcMain.handle('open-editor', (_event, payload) => {
  if (!payload || !Number.isFinite(Number(payload.id)) || !fs.existsSync(payload.path)) {
    throw new Error('The selected video is no longer available.');
  }
  return createEditorView(payload);
});

ipcMain.handle('close-editor', (event) => {
  if (!editorSessions.has(event.sender.id)) return false;
  closeEditorView();
  return true;
});

ipcMain.on('request-editor-back', (event) => {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id || !editorView || editorView.webContents.isDestroyed()) return;
  editorView.webContents.send('editor-request-close');
});

ipcMain.on('request-settings', (event) => {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) return;
  const session = editorView && !editorView.webContents.isDestroyed()
    ? editorSessions.get(editorView.webContents.id)
    : null;
  if (session && session.attached) editorView.webContents.send('open-settings');
  else send('open-settings');
});

ipcMain.on('theme-changed', (_event, theme) => {
  if (!['red', 'cyan', 'magenta', 'violet', 'amber', 'emerald'].includes(theme)) return;
  send('theme-changed', theme);
  if (editorView && !editorView.webContents.isDestroyed()) editorView.webContents.send('theme-changed', theme);
});

ipcMain.on('font-scale-changed', (_event, value) => {
  const fontScale = Number(value);
  if (!Number.isFinite(fontScale) || fontScale < 100 || fontScale > 150) return;
  send('font-scale-changed', fontScale);
  if (editorView && !editorView.webContents.isDestroyed()) editorView.webContents.send('font-scale-changed', fontScale);
});

ipcMain.handle('generate-preview', async (event, request) => {
  const session = editorSessions.get(event.sender.id);
  if (!session) throw new Error('The editor session is no longer available.');
  return generatePreview(session, request);
});

ipcMain.handle('save-custom-settings', (event, settings) => {
  const session = editorSessions.get(event.sender.id);
  if (!session) throw new Error('The editor session is no longer available.');
  session.customSettings = settings;
  send('custom-settings-updated', { id: session.itemId, settings });
  return true;
});

ipcMain.handle('use-as-global-settings', (event, settings) => {
  const sourceSession = editorSessions.get(event.sender.id);
  if (!sourceSession) throw new Error('The editor session is no longer available.');
  sourceSession.customSettings = null;
  send('custom-settings-updated', { id: sourceSession.itemId, settings: null });
  send('global-settings-updated', settings);
  for (const session of editorSessions.values()) {
    session.globalSettings = { ...settings };
    if (!session.webContents.isDestroyed()) {
      session.webContents.send('editor-global-settings-updated', settings);
    }
  }
  return settings;
});

ipcMain.handle('clear-custom-settings', (event) => {
  const session = editorSessions.get(event.sender.id);
  if (!session) throw new Error('The editor session is no longer available.');
  session.customSettings = null;
  send('custom-settings-updated', { id: session.itemId, settings: null });
  return session.globalSettings;
});

ipcMain.handle('process-queue', async (_event, payload) => {
  if (activeProcess) throw new Error('A batch is already processing.');
  cancelRequested = false;
  const results = [];
  for (let index = 0; index < payload.items.length; index += 1) {
    if (cancelRequested) break;
    const item = payload.items[index];
    const itemSettings = item.customSettings
      ? { ...payload.settings, ...item.customSettings }
      : payload.settings;
    results.push(await processOne(item, itemSettings, index + 1, payload.items.length));
  }
  const wasCancelled = cancelRequested;
  if (!wasCancelled && payload.settings.openWhenComplete) {
    const directories = new Map();
    for (const result of results.filter((entry) => entry.ok && entry.output)) {
      const directory = path.dirname(result.output);
      const key = process.platform === 'win32' ? directory.toLowerCase() : directory;
      if (!directories.has(key)) directories.set(key, directory);
    }
    for (const directory of directories.values()) await shell.openPath(directory);
  }
  send('processing-finished', { results, cancelled: wasCancelled });
  cancelRequested = false;
  return results;
});

ipcMain.on('cancel-processing', () => {
  cancelRequested = true;
  if (activeProcess && !activeProcess.killed) activeProcess.kill();
});

ipcMain.on('window-control', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!window) return;
  if (action === 'minimize') window.minimize();
  if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  if (action === 'close') window.close();
});

app.whenReady().then(() => {
  loadPreferences();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => {
  cancelRequested = true;
  if (activeProcess && !activeProcess.killed) activeProcess.kill();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

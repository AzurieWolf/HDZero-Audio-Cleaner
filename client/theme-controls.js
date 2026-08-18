(() => {
  const modal = document.getElementById('settings-modal');
  const closeButton = modal.querySelector('.settings-close');
  const themeInputs = Array.from(modal.querySelectorAll('input[name="app-theme"]'));
  const api = window.hdzero || window.videoEditor;
  const themes = new Set(['red', 'cyan', 'magenta', 'violet', 'amber']);

  function normalizedTheme(theme) {
    return themes.has(theme) ? theme : 'red';
  }

  function applyTheme(theme, notify = false) {
    const selected = normalizedTheme(theme);
    document.documentElement.dataset.theme = selected;
    const input = themeInputs.find((candidate) => candidate.value === selected);
    if (input) input.checked = true;
    try { localStorage.setItem('hdzero-theme', selected); } catch {}
    if (notify) api.setTheme(selected);
  }

  function openSettings() {
    applyTheme(document.documentElement.dataset.theme);
    modal.hidden = false;
    closeButton.focus();
  }

  function closeSettings() {
    modal.hidden = true;
  }

  themeInputs.forEach((input) => input.addEventListener('change', () => {
    if (input.checked) applyTheme(input.value, true);
  }));
  closeButton.addEventListener('click', closeSettings);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeSettings();
  });

  api.onOpenSettings(openSettings);
  api.onThemeChanged((theme) => applyTheme(theme));
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) settingsButton.addEventListener('click', () => api.requestSettings());
  applyTheme(document.documentElement.dataset.theme);
})();

(() => {
  const modal = document.getElementById('settings-modal');
  const closeButton = modal.querySelector('.settings-close');
  const themeInputs = Array.from(modal.querySelectorAll('input[name="app-theme"]'));
  const tabButtons = Array.from(modal.querySelectorAll('[data-settings-tab]'));
  const tabPanels = Array.from(modal.querySelectorAll('[data-settings-panel]'));
  const fontScaleInput = modal.querySelector('#font-scale');
  const fontScaleValue = modal.querySelector('#font-scale-value');
  const api = window.hdzero || window.videoEditor;
  const themes = new Set(['red', 'cyan', 'magenta', 'violet', 'amber', 'emerald']);

  function prepareScalableFonts() {
    const scaleValue = (value) => value.replace(/(\d+(?:\.\d+)?)(px|rem|em|vw)/g, 'calc($1$2 * var(--font-scale))');
    const visitRules = (rules) => {
      Array.from(rules).forEach((rule) => {
        if (rule.cssRules) visitRules(rule.cssRules);
        const fontSize = rule.style?.fontSize;
        if (fontSize && !fontSize.includes('--font-scale')) rule.style.fontSize = scaleValue(fontSize);
      });
    };
    Array.from(document.styleSheets).forEach((stylesheet) => visitRules(stylesheet.cssRules));
  }

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

  function normalizedFontScale(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 100;
    return Math.min(150, Math.max(100, Math.round(numericValue / 5) * 5));
  }

  function applyFontScale(value, notify = false) {
    const selected = normalizedFontScale(value);
    document.documentElement.style.setProperty('--font-scale', String(selected / 100));
    fontScaleInput.value = String(selected);
    fontScaleValue.value = selected === 100 ? 'Default' : `+${selected - 100}%`;
    try { localStorage.setItem('hdzero-font-scale', String(selected)); } catch {}
    if (notify) api.setFontScale(selected);
  }

  function selectTab(name, focus = false) {
    tabButtons.forEach((button) => {
      const selected = button.dataset.settingsTab === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      if (selected && focus) button.focus();
    });
    tabPanels.forEach((panel) => {
      const selected = panel.dataset.settingsPanel === name;
      panel.classList.toggle('active', selected);
      panel.hidden = !selected;
    });
  }

  function openSettings() {
    applyTheme(document.documentElement.dataset.theme);
    applyFontScale(localStorage.getItem('hdzero-font-scale'));
    selectTab('interface');
    modal.hidden = false;
    closeButton.focus();
  }

  function closeSettings() {
    modal.hidden = true;
  }

  themeInputs.forEach((input) => input.addEventListener('change', () => {
    if (input.checked) applyTheme(input.value, true);
  }));
  tabButtons.forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.settingsTab)));
  fontScaleInput.addEventListener('input', () => applyFontScale(fontScaleInput.value, true));
  closeButton.addEventListener('click', closeSettings);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeSettings();
  });

  api.onOpenSettings(openSettings);
  api.onThemeChanged((theme) => applyTheme(theme));
  api.onFontScaleChanged((value) => applyFontScale(value));
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) settingsButton.addEventListener('click', () => api.requestSettings());
  prepareScalableFonts();
  applyTheme(document.documentElement.dataset.theme);
  applyFontScale(localStorage.getItem('hdzero-font-scale'));
})();

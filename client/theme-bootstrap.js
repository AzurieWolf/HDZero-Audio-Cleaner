(() => {
  try {
    const theme = localStorage.getItem('hdzero-theme');
    const themes = new Set(['red', 'cyan', 'magenta', 'violet', 'amber']);
    document.documentElement.dataset.theme = themes.has(theme) ? theme : 'red';
    const storedScale = Number(localStorage.getItem('hdzero-font-scale'));
    const fontScale = Number.isFinite(storedScale) && storedScale >= 100 && storedScale <= 150 ? storedScale : 100;
    document.documentElement.style.setProperty('--font-scale', String(fontScale / 100));
  } catch {
    document.documentElement.dataset.theme = 'red';
    document.documentElement.style.setProperty('--font-scale', '1');
  }
})();

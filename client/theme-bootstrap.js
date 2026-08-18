(() => {
  try {
    const theme = localStorage.getItem('hdzero-theme');
    const themes = new Set(['red', 'cyan', 'magenta', 'violet', 'amber']);
    document.documentElement.dataset.theme = themes.has(theme) ? theme : 'red';
  } catch {
    document.documentElement.dataset.theme = 'red';
  }
})();

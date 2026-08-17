(() => {
  try {
    const theme = localStorage.getItem('hdzero-theme');
    document.documentElement.dataset.theme = theme === 'cyan' ? 'cyan' : 'red';
  } catch {
    document.documentElement.dataset.theme = 'red';
  }
})();

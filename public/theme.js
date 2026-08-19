// Reads the saved theme from localStorage and applies it to <html> and the
// preloader background before first paint. Runs as a blocking <script> so
// there's no flash of the wrong theme.
//
// Agora's colors are hardcoded in src/index.css via :root {} and .dark {}
// blocks. There is no custom-theme branch; the only thing this script
// does is set the right class on <html> and paint the preloader with the
// matching background + primary color so the page doesn't flash white
// in dark mode (or vice versa) before the React bundle boots.
//
// The colors below MUST stay in sync with the values in src/index.css.
(function () {
  var builtins = {
    dark:  { bg: 'hsl(0 0% 10%)',  primary: 'hsl(24 100% 50%)' },
    light: { bg: 'hsl(0 0% 100%)', primary: 'hsl(24 100% 50%)' }
  };

  var theme = 'system';

  // Embeddable widgets (/embed/*) take their theme from the URL, not from
  // storage. They render inside a third-party iframe where localStorage is
  // partitioned per embedding site, so the stored preference belongs to the
  // partner's origin — somewhere the visitor has never chosen a theme. The
  // embedder picks instead, and `auto` means "follow the visitor's OS", which
  // is the same thing this script already calls `system`.
  var embedTheme = null;
  if (location.pathname.indexOf('/embed/') === 0) {
    try {
      var requested = new URLSearchParams(location.search).get('theme');
      if (requested === 'light' || requested === 'dark') embedTheme = requested;
      else if (requested === 'auto') embedTheme = 'system';
    } catch (e) {}
  }

  if (embedTheme) {
    theme = embedTheme;
  } else {
    try {
      var cfg = JSON.parse(localStorage.getItem('nostr:app-config') || '{}');
      if (cfg.theme === 'dark' || cfg.theme === 'light' || cfg.theme === 'system') {
        theme = cfg.theme;
      }
    } catch (e) {}
  }

  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var colors = builtins[theme] || builtins.dark;

  document.documentElement.className = theme;
  document.body.style.background = colors.bg;
  var p = document.getElementById('preloader');
  if (p) {
    p.style.background = colors.bg;
    var logo = p.querySelector('[data-logo]');
    if (logo) logo.style.background = colors.primary;
    var spinner = p.querySelector('[data-spinner]');
    if (spinner) {
      spinner.style.borderColor = colors.primary.replace(')', ' / 0.25)');
      spinner.style.borderTopColor = colors.primary;
    }
  }
})();

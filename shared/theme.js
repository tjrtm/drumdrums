(function () {
  const STORAGE_KEY = 'drumdrums-theme';
  const root = document.documentElement;
  const systemMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const icons = {
    moon: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 8.5 8.5 0 1 0 21 14.5Z" stroke-linecap="round" stroke-linejoin="round" /></svg>',
    sun: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round" /></svg>'
  };

  const readStoredTheme = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  };

  const persistTheme = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      /* no-op */
    }
  };

  const systemPrefersDark = () => systemMedia ? systemMedia.matches : false;

  const initialStored = readStoredTheme();
  let currentTheme = initialStored === 'light' || initialStored === 'dark'
    ? initialStored
    : (root.dataset.theme === 'light' || root.dataset.theme === 'dark')
      ? root.dataset.theme
      : (systemPrefersDark() ? 'dark' : 'light');
  root.dataset.theme = currentTheme;
  if (document.body) {
    document.body.setAttribute('data-theme', currentTheme);
  }

  let userLocked = initialStored === 'light' || initialStored === 'dark';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  const srLabel = document.createElement('span');
  srLabel.className = 'sr-only';
  srLabel.textContent = 'Toggle color theme';
  const iconSlot = document.createElement('span');
  iconSlot.className = 'theme-toggle__icon';
  button.append(srLabel, iconSlot);

  const syncButton = () => {
    button.setAttribute('aria-pressed', currentTheme === 'dark');
    iconSlot.innerHTML = currentTheme === 'dark' ? icons.sun : icons.moon;
    button.title = currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  };

  const applyTheme = (nextTheme, { persist } = { persist: false }) => {
    currentTheme = nextTheme;
    root.dataset.theme = nextTheme;
    if (document.body) {
      document.body.setAttribute('data-theme', nextTheme);
    }
    syncButton();
    if (persist) {
      persistTheme(nextTheme);
      userLocked = true;
    }
  };

  const toggleTheme = () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next, { persist: true });
  };

  const init = () => {
    if (document.querySelector('.theme-toggle')) return;
    button.addEventListener('click', toggleTheme);
    const anchor = document.querySelector('[data-theme-anchor]') ||
      document.querySelector('.theme-toggle-anchor') ||
      document.querySelector('header .actions') ||
      document.querySelector('header .navIcons') ||
      document.querySelector('header');
    if (anchor) {
      button.classList.add('theme-toggle--inline');
      anchor.appendChild(button);
    } else {
      document.body.appendChild(button);
    }
    applyTheme(currentTheme);
  };

  if (systemMedia && typeof systemMedia.addEventListener === 'function') {
    systemMedia.addEventListener('change', (event) => {
      if (!userLocked) {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

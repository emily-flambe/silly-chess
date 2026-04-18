/**
 * Theme management — persists the chosen visual theme (Classic / Minimal / Dusk)
 * to localStorage and applies the matching class to the app root.
 */

export type Theme = 'classic' | 'minimal' | 'dark';

const STORAGE_KEY = 'silly-chess-theme';
const THEMES: Theme[] = ['classic', 'minimal', 'dark'];
const DEFAULT_THEME: Theme = 'classic';

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as string[]).includes(value);
}

export class ThemeManager {
  private root: HTMLElement;
  private current: Theme;
  private changeCallbacks: Array<(theme: Theme) => void> = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this.current = this.loadStoredTheme();
    this.applyTheme(this.current);
    this.wireTopbarToggle();
  }

  getTheme(): Theme {
    return this.current;
  }

  setTheme(theme: Theme): void {
    if (this.current === theme) return;
    this.current = theme;
    this.applyTheme(theme);
    this.persistTheme(theme);
    this.syncToggleButtons();
    this.changeCallbacks.forEach(cb => cb(theme));
  }

  onChange(cb: (theme: Theme) => void): void {
    this.changeCallbacks.push(cb);
  }

  private loadStoredTheme(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isTheme(stored)) return stored;
    } catch {
      // Ignore storage errors (e.g. private mode)
    }
    return DEFAULT_THEME;
  }

  private persistTheme(theme: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }

  private applyTheme(theme: Theme): void {
    for (const t of THEMES) {
      this.root.classList.remove(`theme-${t}`);
    }
    this.root.classList.add(`theme-${theme}`);
  }

  private wireTopbarToggle(): void {
    const buttons = this.root.querySelectorAll<HTMLButtonElement>('[data-theme]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        if (isTheme(theme)) this.setTheme(theme);
      });
    });
    this.syncToggleButtons();
  }

  private syncToggleButtons(): void {
    const buttons = this.root.querySelectorAll<HTMLButtonElement>('[data-theme]');
    buttons.forEach(btn => {
      btn.classList.toggle('on', btn.dataset.theme === this.current);
    });
  }
}

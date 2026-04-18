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
    // Apply the theme class to both the app root and <html>.
    //
    // The <html> class is what makes the theme's CSS custom properties
    // (--panel, --fg, --overlay, etc.) reachable by elements that live
    // *outside* #app-root — specifically the start/settings modals and
    // pawn-promotion dialog, which are appended to document.body by
    // their owning components. Without this, var(--panel) fails to
    // resolve on those modals and the `background` falls back to its
    // initial value (transparent), making the dialog hard to read.
    const targets: Element[] = [document.documentElement, this.root];
    for (const target of targets) {
      for (const t of THEMES) {
        target.classList.remove(`theme-${t}`);
      }
      target.classList.add(`theme-${theme}`);
    }
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

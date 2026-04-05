/**
 * Explanation Panel Component
 *
 * Displays AI-generated position explanations from the Claude API.
 * Caches explanations by FEN to avoid redundant API calls.
 */

export class ExplanationPanel {
  private container: HTMLElement;
  private panelEl: HTMLElement | null = null;
  private buttonEl: HTMLElement | null = null;
  private cache: Map<string, string> = new Map();
  private loading = false;
  private visible = false;
  private dismissed503 = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.injectStyles();
  }

  /**
   * Create the explain button and attach it to a parent element.
   * Returns the button element for the caller to position.
   */
  createButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'explain-btn';
    btn.title = 'Explain this position';
    btn.textContent = 'Explain';
    btn.style.display = 'none';
    this.buttonEl = btn;
    return btn;
  }

  /**
   * Show or hide the explain button based on game state.
   */
  setButtonVisible(visible: boolean): void {
    if (this.buttonEl) {
      this.buttonEl.style.display = visible ? 'inline-flex' : 'none';
    }
  }

  /**
   * Request an explanation for a given position.
   */
  async explain(params: {
    fen: string;
    evaluation: string;
    bestMove?: string;
    pvLine?: string[];
    playerColor?: string;
    moveHistory?: string[];
  }): Promise<void> {
    if (this.loading) return;

    // Check cache
    const cached = this.cache.get(params.fen);
    if (cached) {
      this.showPanel(cached);
      return;
    }

    this.setLoading(true);

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.status === 503) {
        if (!this.dismissed503) {
          this.showPanel('Set up ANTHROPIC_API_KEY to enable AI explanations.', true);
          this.dismissed503 = true;
        }
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        this.showPanel(errData.error || 'Failed to get explanation.');
        return;
      }

      const data = await response.json() as { explanation: string };
      this.cache.set(params.fen, data.explanation);
      this.showPanel(data.explanation);
    } catch (err) {
      console.error('Explanation request failed:', err);
      this.showPanel('Could not reach the explanation service.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Display the explanation panel with given text.
   */
  private showPanel(text: string, isInfo = false): void {
    this.removePanel();

    const panel = document.createElement('div');
    panel.className = 'explain-panel' + (isInfo ? ' explain-panel--info' : '');

    const content = document.createElement('div');
    content.className = 'explain-panel__text';
    content.textContent = text;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'explain-panel__close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Dismiss';
    closeBtn.addEventListener('click', () => this.removePanel());

    panel.appendChild(content);
    panel.appendChild(closeBtn);
    this.container.appendChild(panel);
    this.panelEl = panel;
    this.visible = true;

    // Trigger fade-in
    requestAnimationFrame(() => panel.classList.add('explain-panel--visible'));
  }

  /**
   * Remove the explanation panel.
   */
  removePanel(): void {
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
      this.visible = false;
    }
  }

  /**
   * Whether the panel is currently shown.
   */
  isVisible(): boolean {
    return this.visible;
  }

  private setLoading(loading: boolean): void {
    this.loading = loading;
    if (this.buttonEl) {
      this.buttonEl.textContent = loading ? 'Thinking...' : 'Explain';
      this.buttonEl.classList.toggle('explain-btn--loading', loading);
      (this.buttonEl as HTMLButtonElement).disabled = loading;
    }
  }

  private injectStyles(): void {
    if (document.getElementById('explain-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'explain-panel-styles';
    style.textContent = `
      .explain-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border: 1px solid #444;
        border-radius: 6px;
        background: #1a2440;
        color: #ccc;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }

      .explain-btn:hover:not(:disabled) {
        background: #223050;
        border-color: #829769;
        color: #eee;
      }

      .explain-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }

      .explain-btn--loading {
        animation: explain-pulse 1.2s ease-in-out infinite;
      }

      @keyframes explain-pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }

      .explain-panel {
        background: #1a2440;
        border: 1px solid #333;
        border-left: 3px solid #829769;
        border-radius: 6px;
        padding: 12px 36px 12px 14px;
        margin-top: 8px;
        position: relative;
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .explain-panel--visible {
        opacity: 1;
        transform: translateY(0);
      }

      .explain-panel--info {
        border-left-color: #666;
      }

      .explain-panel__text {
        font-size: 0.875rem;
        line-height: 1.5;
        color: #ddd;
      }

      .explain-panel--info .explain-panel__text {
        color: #999;
        font-style: italic;
      }

      .explain-panel__close {
        position: absolute;
        top: 6px;
        right: 8px;
        background: none;
        border: none;
        color: #666;
        font-size: 1.1rem;
        cursor: pointer;
        padding: 2px 6px;
        line-height: 1;
        border-radius: 3px;
      }

      .explain-panel__close:hover {
        color: #ccc;
        background: rgba(255,255,255,0.05);
      }
    `;
    document.head.appendChild(style);
  }
}

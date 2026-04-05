/**
 * Tactics Panel Component
 *
 * Displays detected tactical patterns for the current chess position.
 * Styled to match the existing dark theme.
 */

import type { TacticalPattern } from '../services/ChessGrammarClient';

type State = 'idle' | 'loading' | 'results';

export class TacticsPanel {
  private container: HTMLElement;
  private panelElement: HTMLElement;
  private contentElement: HTMLElement;
  private state: State = 'idle';
  private patterns: TacticalPattern[] = [];

  constructor(container: HTMLElement) {
    this.container = container;

    this.panelElement = document.createElement('div');
    this.panelElement.className = 'tactics-panel';

    const header = document.createElement('div');
    header.className = 'tactics-header';
    header.textContent = 'Tactics';

    this.contentElement = document.createElement('div');
    this.contentElement.className = 'tactics-content';

    this.panelElement.appendChild(header);
    this.panelElement.appendChild(this.contentElement);
    this.container.appendChild(this.panelElement);

    this.applyStyles();
    this.render();
  }

  /** Show loading state */
  setLoading(): void {
    this.state = 'loading';
    this.render();
  }

  /** Update with detected patterns */
  setPatterns(patterns: TacticalPattern[]): void {
    this.patterns = patterns;
    this.state = 'results';
    this.render();
  }

  /** Clear the panel */
  clear(): void {
    this.patterns = [];
    this.state = 'idle';
    this.render();
  }

  private render(): void {
    if (this.state === 'loading') {
      this.contentElement.innerHTML =
        '<div class="tactics-status tactics-loading">Analyzing\u2026</div>';
      return;
    }

    if (this.state === 'idle' || this.patterns.length === 0) {
      this.contentElement.innerHTML =
        '<div class="tactics-status">No tactics detected</div>';
      return;
    }

    const items = this.patterns
      .map((p) => {
        const squaresText = p.keySquares.length > 0
          ? `<span class="tactics-squares">${p.keySquares.join(', ')}</span>`
          : '';
        return `
          <div class="tactics-item${p.isMate ? ' tactics-mate' : ''}">
            <div class="tactics-description">${this.escapeHtml(p.description)}</div>
            ${squaresText ? `<div class="tactics-detail">${squaresText}</div>` : ''}
          </div>
        `;
      })
      .join('');

    this.contentElement.innerHTML = items;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private applyStyles(): void {
    if (document.getElementById('tactics-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'tactics-panel-styles';
    style.textContent = `
      .tactics-panel {
        background: #16213e;
        border-radius: 8px;
        overflow: hidden;
      }

      .tactics-header {
        padding: 0.625rem 1rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #9a9eb1;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #1f2b47;
      }

      .tactics-content {
        padding: 0.5rem;
        max-height: 200px;
        overflow-y: auto;
      }

      .tactics-status {
        padding: 0.75rem 0.5rem;
        text-align: center;
        color: #666;
        font-size: 0.8125rem;
      }

      .tactics-loading {
        color: #829769;
      }

      .tactics-item {
        padding: 0.5rem;
        border-radius: 4px;
        margin-bottom: 0.25rem;
        background: rgba(130, 151, 105, 0.08);
        border-left: 3px solid #829769;
      }

      .tactics-item.tactics-mate {
        border-left-color: #e74c3c;
        background: rgba(231, 76, 60, 0.08);
      }

      .tactics-description {
        font-size: 0.8125rem;
        color: #eee;
        line-height: 1.4;
      }

      .tactics-detail {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: #829769;
      }

      .tactics-squares {
        font-family: monospace;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * GameControls Component
 * Main control panel with game actions and settings
 */

import { DifficultySlider } from './DifficultySlider';

export type PlayerColor = 'white' | 'black';

export class GameControls {
  private container: HTMLElement;
  private modal: HTMLElement | null = null;
  private settingsPanel: HTMLElement | null = null;
  private difficultySlider: DifficultySlider | null = null;

  private gameActive: boolean = false;
  private canUndo: boolean = false;
  private showCoordinates: boolean = true;

  private newGameCallbacks: Array<(color: PlayerColor) => void> = [];
  private resignCallbacks: Array<() => void> = [];
  private undoCallbacks: Array<() => void> = [];
  private hintCallbacks: Array<() => void> = [];

  private readonly STORAGE_KEY_COORDS = 'silly-chess-show-coords';

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadPreferences();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the controls UI
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="game-controls">
        <div class="control-buttons">
          <button class="control-btn new-game-btn">
            <span class="btn-icon">+</span>
            New Game
          </button>
          <button class="control-btn resign-btn" ${!this.gameActive ? 'disabled' : ''}>
            <span class="btn-icon">X</span>
            Resign
          </button>
          <button class="control-btn undo-btn" ${!this.canUndo ? 'disabled' : ''}>
            <span class="btn-icon">←</span>
            Undo
          </button>
          <button class="control-btn hint-btn" ${!this.gameActive ? 'disabled' : ''}>
            <span class="btn-icon">?</span>
            Hint
          </button>
          <button class="control-btn settings-btn">
            <span class="btn-icon">⚙</span>
            Settings
          </button>
        </div>
      </div>
    `;

    this.applyStyles();
    this.renderModal();
    this.renderSettingsPanel();
  }

  /**
   * Render the new game modal
   */
  private renderModal(): void {
    if (this.modal) {
      document.body.removeChild(this.modal);
    }

    this.modal = document.createElement('div');
    this.modal.className = 'game-modal';
    this.modal.style.display = 'none';
    this.modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <h2 class="modal-title">New Game</h2>
        <p class="modal-subtitle">Choose your color</p>

        <div class="color-selection">
          <button class="color-btn" data-color="white">
            <span class="color-icon color-icon-white">&#9812;</span>
            <span class="color-label">White</span>
          </button>
          <button class="color-btn" data-color="random">
            <span class="color-icon">?</span>
            <span class="color-label">Random</span>
          </button>
          <button class="color-btn" data-color="black">
            <span class="color-icon color-icon-black">&#9812;</span>
            <span class="color-label">Black</span>
          </button>
        </div>

        <div class="modal-actions">
          <button class="modal-btn cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Add modal event listeners
    const overlay = this.modal.querySelector('.modal-overlay');
    const cancelBtn = this.modal.querySelector('.cancel-btn');
    const colorButtons = this.modal.querySelectorAll('.color-btn');

    overlay?.addEventListener('click', () => this.hideModal());
    cancelBtn?.addEventListener('click', () => this.hideModal());

    colorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const colorChoice = (btn as HTMLElement).dataset.color as 'white' | 'black' | 'random';
        let color: PlayerColor;

        if (colorChoice === 'random') {
          color = Math.random() < 0.5 ? 'white' : 'black';
        } else {
          color = colorChoice;
        }

        this.hideModal();
        this.notifyNewGame(color);
      });
    });
  }

  /**
   * Render the settings panel
   */
  private renderSettingsPanel(): void {
    if (this.settingsPanel) {
      document.body.removeChild(this.settingsPanel);
    }

    this.settingsPanel = document.createElement('div');
    this.settingsPanel.className = 'settings-panel';
    this.settingsPanel.style.display = 'none';
    this.settingsPanel.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-content">
        <div class="settings-header">
          <h2 class="settings-title">Settings</h2>
          <button class="settings-close">×</button>
        </div>

        <div class="settings-body">
          <div id="difficulty-container"></div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" class="setting-checkbox coords-toggle" ${this.showCoordinates ? 'checked' : ''}>
              <span>Show Coordinates</span>
            </label>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.settingsPanel);

    // Initialize difficulty slider in settings
    const difficultyContainer = this.settingsPanel.querySelector('#difficulty-container');
    if (difficultyContainer) {
      this.difficultySlider = new DifficultySlider(difficultyContainer as HTMLElement);
    }

    // Add settings event listeners
    const overlay = this.settingsPanel.querySelector('.settings-overlay');
    const closeBtn = this.settingsPanel.querySelector('.settings-close');
    const coordsToggle = this.settingsPanel.querySelector('.coords-toggle');

    overlay?.addEventListener('click', () => this.hideSettings());
    closeBtn?.addEventListener('click', () => this.hideSettings());

    coordsToggle?.addEventListener('change', (e) => {
      this.showCoordinates = (e.target as HTMLInputElement).checked;
      this.savePreferences();
    });
  }

  /**
   * Apply CSS styles
   */
  private applyStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .game-controls {
        background: #16213e;
        padding: 20px;
        border-radius: 8px;
      }

      .control-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .control-btn {
        padding: 12px 16px;
        background: #4a4e69;
        color: #eee;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .control-btn:hover:not(:disabled) {
        background: #5c6078;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }

      .control-btn:active:not(:disabled) {
        transform: translateY(0);
      }

      .control-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-icon {
        font-size: 16px;
      }

      .new-game-btn {
        background: #829769;
        color: #1a1a2e;
      }

      .new-game-btn:hover:not(:disabled) {
        background: #94a877;
      }

      /* Modal Styles */
      .game-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
      }

      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }

      .modal-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #16213e;
        border-radius: 12px;
        padding: 32px;
        min-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      }

      .modal-title {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 700;
        color: #eee;
        text-align: center;
      }

      .modal-subtitle {
        margin: 0 0 24px 0;
        font-size: 14px;
        color: #888;
        text-align: center;
      }

      .color-selection {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }

      .color-btn {
        padding: 24px 16px;
        background: #4a4e69;
        color: #eee;
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .color-btn:hover {
        background: #5c6078;
        border-color: #829769;
        transform: translateY(-4px);
      }

      .color-icon {
        font-size: 48px;
      }

      /* Match actual piece styling */
      .color-icon-white {
        color: #fff;
        text-shadow:
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000,
          0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .color-icon-black {
        color: #333;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .color-label {
        font-size: 14px;
        font-weight: 600;
      }

      .modal-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
      }

      .modal-btn {
        padding: 10px 24px;
        background: #4a4e69;
        color: #eee;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .modal-btn:hover {
        background: #5c6078;
      }

      /* Settings Panel Styles */
      .settings-panel {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
      }

      .settings-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }

      .settings-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border-radius: 12px;
        min-width: 500px;
        max-width: 600px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      }

      .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 24px 16px 24px;
        border-bottom: 1px solid #333;
      }

      .settings-title {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #eee;
      }

      .settings-close {
        background: none;
        border: none;
        color: #888;
        font-size: 32px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s ease;
      }

      .settings-close:hover {
        color: #eee;
      }

      .settings-body {
        padding: 24px;
      }

      .setting-item {
        padding: 16px;
        background: #16213e;
        border-radius: 8px;
        margin-bottom: 12px;
      }

      .setting-label {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        user-select: none;
        color: #eee;
        font-size: 14px;
        font-weight: 500;
      }

      .setting-checkbox {
        width: 20px;
        height: 20px;
        cursor: pointer;
        accent-color: #829769;
      }
    `;

    if (!document.head.querySelector('style[data-component="game-controls"]')) {
      style.setAttribute('data-component', 'game-controls');
      document.head.appendChild(style);
    }
  }

  /**
   * Attach event listeners to control buttons
   */
  private attachEventListeners(): void {
    const newGameBtn = this.container.querySelector('.new-game-btn');
    const resignBtn = this.container.querySelector('.resign-btn');
    const undoBtn = this.container.querySelector('.undo-btn');
    const hintBtn = this.container.querySelector('.hint-btn');
    const settingsBtn = this.container.querySelector('.settings-btn');

    newGameBtn?.addEventListener('click', () => this.showModal());
    resignBtn?.addEventListener('click', () => this.handleResign());
    undoBtn?.addEventListener('click', () => this.handleUndo());
    hintBtn?.addEventListener('click', () => this.handleHint());
    settingsBtn?.addEventListener('click', () => this.showSettings());
  }

  /**
   * Show new game modal
   */
  private showModal(): void {
    if (this.modal) {
      this.modal.style.display = 'block';
    }
  }

  /**
   * Hide new game modal
   */
  private hideModal(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  /**
   * Show settings panel
   */
  private showSettings(): void {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'block';
    }
  }

  /**
   * Hide settings panel
   */
  private hideSettings(): void {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'none';
    }
  }

  /**
   * Handle resign action
   */
  private handleResign(): void {
    if (!this.gameActive) return;
    this.resignCallbacks.forEach(callback => callback());
  }

  /**
   * Handle undo action
   */
  private handleUndo(): void {
    if (!this.canUndo) return;
    this.undoCallbacks.forEach(callback => callback());
  }

  /**
   * Handle hint action
   */
  private handleHint(): void {
    if (!this.gameActive) return;
    this.hintCallbacks.forEach(callback => callback());
  }

  /**
   * Notify new game callbacks
   */
  private notifyNewGame(color: PlayerColor): void {
    this.newGameCallbacks.forEach(callback => callback(color));
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    const coords = localStorage.getItem(this.STORAGE_KEY_COORDS);

    if (coords !== null) {
      this.showCoordinates = coords === 'true';
    }
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    localStorage.setItem(this.STORAGE_KEY_COORDS, this.showCoordinates.toString());
  }

  /**
   * Set game active state
   */
  public setGameActive(active: boolean): void {
    this.gameActive = active;
    const resignBtn = this.container.querySelector('.resign-btn') as HTMLButtonElement;
    const hintBtn = this.container.querySelector('.hint-btn') as HTMLButtonElement;
    if (resignBtn) {
      resignBtn.disabled = !active;
    }
    if (hintBtn) {
      hintBtn.disabled = !active;
    }
  }

  /**
   * Set can undo state
   */
  public setCanUndo(canUndo: boolean): void {
    this.canUndo = canUndo;
    const undoBtn = this.container.querySelector('.undo-btn') as HTMLButtonElement;
    if (undoBtn) {
      undoBtn.disabled = !canUndo;
    }
  }

  /**
   * Register new game callback
   */
  public onNewGame(callback: (color: PlayerColor) => void): void {
    this.newGameCallbacks.push(callback);
  }

  /**
   * Register resign callback
   */
  public onResign(callback: () => void): void {
    this.resignCallbacks.push(callback);
  }

  /**
   * Register undo callback
   */
  public onUndo(callback: () => void): void {
    this.undoCallbacks.push(callback);
  }

  /**
   * Register hint callback
   */
  public onHint(callback: () => void): void {
    this.hintCallbacks.push(callback);
  }

  /**
   * Get difficulty slider instance
   */
  public getDifficultySlider(): DifficultySlider | null {
    return this.difficultySlider;
  }

  /**
   * Get current preferences
   */
  public getPreferences(): { showCoordinates: boolean } {
    return {
      showCoordinates: this.showCoordinates,
    };
  }
}

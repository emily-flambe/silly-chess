/**
 * GameControls Component
 * Main control panel with game actions and settings
 */

import { DifficultySlider } from './DifficultySlider';

export type PlayerColor = 'white' | 'black';
export type GameMode = 'vs-ai' | 'vs-player';

export interface NewGameOptions {
  color: PlayerColor;
  mode: GameMode;
}

export class GameControls {
  private container: HTMLElement;
  private modal: HTMLElement | null = null;
  private settingsPanel: HTMLElement | null = null;
  private difficultySlider: DifficultySlider | null = null;
  private modalDifficultySlider: DifficultySlider | null = null;

  private gameActive: boolean = false;
  private showCoordinates: boolean = true;
  private selectedMode: GameMode = 'vs-ai';

  private newGameCallbacks: Array<(options: NewGameOptions) => void> = [];
  private resignCallbacks: Array<() => void> = [];
  private hintCallbacks: Array<() => void> = [];
  private coordinatesChangeCallbacks: Array<(show: boolean) => void> = [];

  private resignConfirmVisible: boolean = false;

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
            New Game
          </button>
          <button class="control-btn resign-btn" ${!this.gameActive ? 'disabled' : ''}>
            Resign
          </button>
          <button class="control-btn hint-btn" ${!this.gameActive ? 'disabled' : ''}>
            Hint
          </button>
          <button class="control-btn settings-btn">
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
        <h2 class="modal-title">Play Chess</h2>

        <div class="modal-step modal-step-mode">
          <p class="modal-subtitle">Choose game mode</p>
          <div class="mode-selection">
            <button class="mode-btn" data-mode="vs-ai">
              <span class="mode-label">vs Computer</span>
            </button>
            <button class="mode-btn" data-mode="vs-player">
              <span class="mode-label">vs Human</span>
            </button>
          </div>
        </div>

        <div class="modal-step modal-step-difficulty" style="display: none;">
          <p class="modal-subtitle">Set difficulty</p>
          <div id="modal-difficulty-container"></div>
          <div class="modal-step-buttons">
            <button class="modal-btn back-btn-difficulty">Back</button>
            <button class="modal-btn next-btn-difficulty">Next</button>
          </div>
        </div>

        <div class="modal-step modal-step-color" style="display: none;">
          <p class="modal-subtitle">Choose your color</p>
          <div class="color-selection">
            <button class="color-btn" data-color="white">
              <span class="color-icon color-icon-white" aria-hidden="true"></span>
              <span class="color-label">White</span>
            </button>
            <button class="color-btn" data-color="random">
              <span class="color-icon color-icon-random" aria-hidden="true"></span>
              <span class="color-label">Random</span>
            </button>
            <button class="color-btn" data-color="black">
              <span class="color-icon color-icon-black" aria-hidden="true"></span>
              <span class="color-label">Black</span>
            </button>
          </div>
          <button class="modal-btn back-btn">Back</button>
        </div>

        <div class="modal-actions">
          <button class="modal-btn cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Initialize difficulty slider in modal
    const modalDifficultyContainer = this.modal.querySelector('#modal-difficulty-container');
    if (modalDifficultyContainer) {
      this.modalDifficultySlider = new DifficultySlider(modalDifficultyContainer as HTMLElement);
    }

    // Add modal event listeners
    const overlay = this.modal.querySelector('.modal-overlay');
    const cancelBtn = this.modal.querySelector('.cancel-btn');
    const backBtn = this.modal.querySelector('.back-btn');
    const backBtnDifficulty = this.modal.querySelector('.back-btn-difficulty');
    const nextBtnDifficulty = this.modal.querySelector('.next-btn-difficulty');
    const modeButtons = this.modal.querySelectorAll('.mode-btn');
    const colorButtons = this.modal.querySelectorAll('.color-btn');
    const modeStep = this.modal.querySelector('.modal-step-mode') as HTMLElement;
    const difficultyStep = this.modal.querySelector('.modal-step-difficulty') as HTMLElement;
    const colorStep = this.modal.querySelector('.modal-step-color') as HTMLElement;

    overlay?.addEventListener('click', () => this.hideModal());
    cancelBtn?.addEventListener('click', () => this.hideModal());

    // Back from color step goes to difficulty (vs-ai) or mode (vs-player)
    backBtn?.addEventListener('click', () => {
      colorStep.style.display = 'none';
      if (this.selectedMode === 'vs-ai') {
        difficultyStep.style.display = '';
      } else {
        modeStep.style.display = '';
      }
    });

    // Back from difficulty step goes to mode
    backBtnDifficulty?.addEventListener('click', () => {
      difficultyStep.style.display = 'none';
      modeStep.style.display = '';
    });

    // Next from difficulty step goes to color
    nextBtnDifficulty?.addEventListener('click', () => {
      difficultyStep.style.display = 'none';
      colorStep.style.display = '';
    });

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMode = (btn as HTMLElement).dataset.mode as GameMode;
        modeStep.style.display = 'none';
        if (this.selectedMode === 'vs-ai') {
          difficultyStep.style.display = '';
        } else {
          colorStep.style.display = '';
        }
      });
    });

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
        this.notifyNewGame({ color, mode: this.selectedMode });
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
      this.coordinatesChangeCallbacks.forEach(cb => cb(this.showCoordinates));
    });
  }

  /**
   * Apply CSS styles
   */
  private applyStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .game-controls {
        background: var(--panel);
        padding: 20px;
        border-radius: var(--radius, 10px);
        border: 1px solid var(--panel-border);
      }

      .control-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .control-btn {
        padding: 12px 16px;
        background: var(--btn);
        color: var(--fg);
        border: 1px solid var(--btn-border);
        border-radius: 8px;
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
        background: var(--btn-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px var(--shadow, rgba(0, 0, 0, 0.15));
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
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }

      .new-game-btn:hover:not(:disabled) {
        background: var(--accent-hover, var(--accent));
        filter: brightness(1.05);
      }

      /* Resign Confirmation */
      .resign-confirm {
        grid-column: 1 / -1;
        text-align: center;
      }

      .resign-confirm-text {
        color: var(--fg);
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 12px;
      }

      .resign-confirm-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .resign-confirm-yes {
        background: var(--danger, #c0392b) !important;
        color: #fff !important;
        border-color: var(--danger, #c0392b) !important;
      }

      .resign-confirm-yes:hover:not(:disabled) {
        filter: brightness(1.1);
      }

      .resign-confirm-no {
        background: var(--btn) !important;
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
    const hintBtn = this.container.querySelector('.hint-btn');
    const settingsBtn = this.container.querySelector('.settings-btn');

    newGameBtn?.addEventListener('click', () => this.showModal());
    resignBtn?.addEventListener('click', () => this.handleResign());
    hintBtn?.addEventListener('click', () => this.handleHint());
    settingsBtn?.addEventListener('click', () => this.showSettings());
  }

  /**
   * Show new game modal
   */
  showModal(): void {
    if (this.modal) {
      // Reset to mode selection step
      const modeStep = this.modal.querySelector('.modal-step-mode') as HTMLElement;
      const difficultyStep = this.modal.querySelector('.modal-step-difficulty') as HTMLElement;
      const colorStep = this.modal.querySelector('.modal-step-color') as HTMLElement;
      if (modeStep) modeStep.style.display = '';
      if (difficultyStep) difficultyStep.style.display = 'none';
      if (colorStep) colorStep.style.display = 'none';
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
   * Handle resign action — show inline confirmation
   */
  private handleResign(): void {
    if (!this.gameActive || this.resignConfirmVisible) return;
    this.showResignConfirm();
  }

  /**
   * Show inline resign confirmation in the controls area
   */
  private showResignConfirm(): void {
    this.resignConfirmVisible = true;
    const controlButtons = this.container.querySelector('.control-buttons') as HTMLElement;
    if (!controlButtons) return;

    controlButtons.innerHTML = `
      <div class="resign-confirm">
        <p class="resign-confirm-text">Resign this game?</p>
        <div class="resign-confirm-buttons">
          <button class="control-btn resign-confirm-yes">Yes, resign</button>
          <button class="control-btn resign-confirm-no">Cancel</button>
        </div>
      </div>
    `;

    const yesBtn = controlButtons.querySelector('.resign-confirm-yes');
    const noBtn = controlButtons.querySelector('.resign-confirm-no');

    yesBtn?.addEventListener('click', () => {
      this.hideResignConfirm();
      this.resignCallbacks.forEach(callback => callback());
    });

    noBtn?.addEventListener('click', () => {
      this.hideResignConfirm();
    });
  }

  /**
   * Hide resign confirmation and restore normal controls
   */
  private hideResignConfirm(): void {
    this.resignConfirmVisible = false;
    const controlButtons = this.container.querySelector('.control-buttons') as HTMLElement;
    if (!controlButtons) return;

    controlButtons.innerHTML = `
      <button class="control-btn new-game-btn">
        New Game
      </button>
      <button class="control-btn resign-btn" ${!this.gameActive ? 'disabled' : ''}>
        Resign
      </button>
      <button class="control-btn hint-btn" ${!this.gameActive ? 'disabled' : ''}>
        Hint
      </button>
      <button class="control-btn settings-btn">
        Settings
      </button>
    `;

    this.attachEventListeners();
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
  private notifyNewGame(options: NewGameOptions): void {
    this.newGameCallbacks.forEach(callback => callback(options));
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
   * Register new game callback
   */
  public onNewGame(callback: (options: NewGameOptions) => void): void {
    this.newGameCallbacks.push(callback);
  }

  /**
   * Register resign callback
   */
  public onResign(callback: () => void): void {
    this.resignCallbacks.push(callback);
  }

  /**
   * Register hint callback
   */
  public onHint(callback: () => void): void {
    this.hintCallbacks.push(callback);
  }

  /**
   * Register coordinates change callback
   */
  public onCoordinatesChange(callback: (show: boolean) => void): void {
    this.coordinatesChangeCallbacks.push(callback);
  }

  /**
   * Get settings difficulty slider instance
   */
  public getDifficultySlider(): DifficultySlider | null {
    return this.difficultySlider;
  }

  /**
   * Get modal difficulty slider instance (used during game creation)
   */
  public getModalDifficultySlider(): DifficultySlider | null {
    return this.modalDifficultySlider;
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

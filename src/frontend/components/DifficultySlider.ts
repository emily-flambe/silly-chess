/**
 * DifficultySlider Component
 * Elo difficulty slider (800-3000) with preset buttons and localStorage persistence
 */

export interface DifficultyPreset {
  label: string;
  elo: number;
}

export class DifficultySlider {
  private container: HTMLElement;
  private slider!: HTMLInputElement;
  private valueDisplay!: HTMLElement;
  private currentElo: number = 1500;
  private changeCallbacks: Array<(elo: number) => void> = [];

  private readonly STORAGE_KEY = 'silly-chess-elo';
  private readonly MIN_ELO = 800;
  private readonly MAX_ELO = 3000;

  private readonly PRESETS: DifficultyPreset[] = [
    { label: 'Beginner', elo: 800 },
    { label: 'Casual', elo: 1200 },
    { label: 'Club', elo: 1500 },
    { label: 'Advanced', elo: 1800 },
    { label: 'Expert', elo: 2200 },
  ];

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadFromStorage();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the difficulty slider UI
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="difficulty-slider">
        <div class="difficulty-header">
          <label class="difficulty-label">Difficulty</label>
          <span class="difficulty-value">${this.currentElo}</span>
        </div>

        <div class="slider-container">
          <span class="slider-label">800</span>
          <input
            type="range"
            min="${this.MIN_ELO}"
            max="${this.MAX_ELO}"
            step="50"
            value="${this.currentElo}"
            class="elo-slider"
          />
          <span class="slider-label">3000</span>
        </div>

        <div class="difficulty-presets">
          ${this.PRESETS.map(preset => `
            <button
              class="preset-button"
              data-elo="${preset.elo}"
            >
              ${preset.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.applyStyles();

    // Cache DOM references
    this.slider = this.container.querySelector('.elo-slider') as HTMLInputElement;
    this.valueDisplay = this.container.querySelector('.difficulty-value') as HTMLElement;
  }

  /**
   * Apply CSS styles to the component
   */
  private applyStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .difficulty-slider {
        background: #16213e;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .difficulty-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .difficulty-label {
        font-size: 14px;
        font-weight: 600;
        color: #eee;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .difficulty-value {
        font-size: 18px;
        font-weight: 700;
        color: #829769;
        font-variant-numeric: tabular-nums;
      }

      .slider-container {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }

      .slider-label {
        font-size: 12px;
        color: #888;
        min-width: 40px;
        text-align: center;
      }

      .elo-slider {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        background: #333;
        border-radius: 3px;
        outline: none;
        cursor: pointer;
      }

      .elo-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: #829769;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.15s ease;
      }

      .elo-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }

      .elo-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: #829769;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.15s ease;
      }

      .elo-slider::-moz-range-thumb:hover {
        transform: scale(1.15);
      }

      .difficulty-presets {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .preset-button {
        flex: 1;
        min-width: 70px;
        padding: 8px 12px;
        background: #4a4e69;
        color: #eee;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .preset-button:hover {
        background: #5c6078;
        transform: translateY(-1px);
      }

      .preset-button:active {
        transform: translateY(0);
      }

      .preset-button.active {
        background: #829769;
        color: #1a1a2e;
      }
    `;

    // Only append if not already added
    if (!document.head.querySelector('style[data-component="difficulty-slider"]')) {
      style.setAttribute('data-component', 'difficulty-slider');
      document.head.appendChild(style);
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Slider input
    this.slider.addEventListener('input', () => {
      this.updateElo(parseInt(this.slider.value, 10));
    });

    // Preset buttons
    const presetButtons = this.container.querySelectorAll('.preset-button');
    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const elo = parseInt((button as HTMLElement).dataset.elo || '1500', 10);
        this.setElo(elo);
      });
    });
  }

  /**
   * Update Elo value and trigger callbacks
   */
  private updateElo(elo: number): void {
    this.currentElo = elo;
    this.valueDisplay.textContent = elo.toString();
    this.updateActivePreset();
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * Update active preset button styling
   */
  private updateActivePreset(): void {
    const presetButtons = this.container.querySelectorAll('.preset-button');
    presetButtons.forEach(button => {
      const buttonElo = parseInt((button as HTMLElement).dataset.elo || '0', 10);
      if (buttonElo === this.currentElo) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Notify change callbacks
   */
  private notifyChange(): void {
    this.changeCallbacks.forEach(callback => callback(this.currentElo));
  }

  /**
   * Load Elo from localStorage
   */
  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const elo = parseInt(stored, 10);
      if (elo >= this.MIN_ELO && elo <= this.MAX_ELO) {
        this.currentElo = elo;
      }
    }
  }

  /**
   * Save Elo to localStorage
   */
  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, this.currentElo.toString());
  }

  /**
   * Get current Elo value
   */
  public getElo(): number {
    return this.currentElo;
  }

  /**
   * Set Elo value programmatically
   */
  public setElo(elo: number): void {
    const clampedElo = Math.max(this.MIN_ELO, Math.min(this.MAX_ELO, elo));
    this.currentElo = clampedElo;
    this.slider.value = clampedElo.toString();
    this.valueDisplay.textContent = clampedElo.toString();
    this.updateActivePreset();
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * Register change callback
   */
  public onChange(callback: (elo: number) => void): void {
    this.changeCallbacks.push(callback);
  }
}

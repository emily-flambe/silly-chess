/**
 * Evaluation Bar Component
 *
 * Displays a vertical bar showing position advantage based on Stockfish analysis.
 * White advantage shown from top, black advantage from bottom.
 */

export class EvalBar {
  private container: HTMLElement;
  private barElement: HTMLElement;
  private whiteSection: HTMLElement;
  private blackSection: HTMLElement;
  private evalText: HTMLElement;
  private currentEval: number | string = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create bar structure
    this.barElement = this.createBarElement();
    this.whiteSection = this.createSection('white');
    this.blackSection = this.createSection('black');
    this.evalText = this.createEvalText();

    // Assemble components
    this.barElement.appendChild(this.whiteSection);
    this.barElement.appendChild(this.blackSection);
    this.barElement.appendChild(this.evalText);
    this.container.appendChild(this.barElement);

    // Initialize to equal position
    this.reset();
  }

  /**
   * Create the main bar container
   */
  private createBarElement(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'eval-bar';

    // Styling
    Object.assign(bar.style, {
      position: 'relative',
      width: '30px',
      height: '100%',
      border: '1px solid #555',
      borderRadius: '4px',
      overflow: 'hidden',
      backgroundColor: '#2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    });

    return bar;
  }

  /**
   * Create a colored section (white or black)
   */
  private createSection(color: 'white' | 'black'): HTMLElement {
    const section = document.createElement('div');
    section.className = `eval-bar-${color}`;

    const bgColor = color === 'white' ? '#f0f0f0' : '#2a2a2a';

    Object.assign(section.style, {
      width: '100%',
      backgroundColor: bgColor,
      transition: 'height 400ms ease-out',
      flexShrink: '0'
    });

    return section;
  }

  /**
   * Create the evaluation text display
   */
  private createEvalText(): HTMLElement {
    const text = document.createElement('div');
    text.className = 'eval-text';

    Object.assign(text.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '11px',
      fontWeight: 'bold',
      fontFamily: 'monospace',
      color: '#fff',
      textShadow: '0 0 2px #000, 0 0 4px #000',
      pointerEvents: 'none',
      whiteSpace: 'nowrap'
    });

    return text;
  }

  /**
   * Convert centipawns to percentage for white
   * Uses sigmoid-like scaling for smooth gradient
   */
  private evalToPercent(centipawns: number): number {
    const maxEval = 700; // centipawns for ~90% display
    const clamped = Math.max(-maxEval, Math.min(maxEval, centipawns));
    return 50 + (clamped / maxEval) * 40;
  }

  /**
   * Update the bar heights based on percentage
   */
  private updateBarHeights(whitePercent: number): void {
    const blackPercent = 100 - whitePercent;

    this.whiteSection.style.height = `${whitePercent}%`;
    this.blackSection.style.height = `${blackPercent}%`;
  }

  /**
   * Update the evaluation text display
   */
  private updateEvalText(value: number | string): void {
    if (typeof value === 'string') {
      // Mate evaluation (e.g., "M3")
      const mateNum = parseInt(value.substring(1));
      this.evalText.textContent = `M${mateNum}`;
    } else {
      // Centipawn evaluation
      const pawns = value / 100;
      const formatted = pawns >= 0
        ? `+${pawns.toFixed(1)}`
        : pawns.toFixed(1);
      this.evalText.textContent = formatted;
    }

    // Adjust text color based on which side has advantage
    const isWhiteAdvantage = typeof value === 'string' || value >= 0;
    this.evalText.style.color = isWhiteAdvantage ? '#333' : '#fff';
  }

  /**
   * Set evaluation in centipawns (positive = white advantage)
   */
  public setEvaluation(value: number): void {
    this.currentEval = value;

    const whitePercent = this.evalToPercent(value);
    this.updateBarHeights(whitePercent);
    this.updateEvalText(value);
  }

  /**
   * Set mate evaluation (positive = white mates, negative = black mates)
   */
  public setMate(moves: number): void {
    const mateString = `M${Math.abs(moves)}`;
    this.currentEval = mateString;

    // Mate = 95% for winning side
    const whitePercent = moves > 0 ? 95 : 5;
    this.updateBarHeights(whitePercent);
    this.updateEvalText(mateString);
  }

  /**
   * Handle evaluation from Stockfish analysis
   * Handles both number (centipawns) and string ("M3") formats
   */
  public setAnalysisEvaluation(evaluation: number | string): void {
    if (typeof evaluation === 'string') {
      // Parse mate notation (e.g., "M3" or "-M5")
      const isNegative = evaluation.startsWith('-');
      const mateNum = parseInt(evaluation.replace(/[^\d]/g, ''));
      this.setMate(isNegative ? -mateNum : mateNum);
    } else {
      // Regular centipawn evaluation
      this.setEvaluation(evaluation);
    }
  }

  /**
   * Clear/reset to equal position
   */
  public reset(): void {
    this.currentEval = 0;
    this.updateBarHeights(50);
    this.evalText.textContent = '0.0';
    this.evalText.style.color = '#fff';
  }

  /**
   * Show/hide the bar
   */
  public setVisible(visible: boolean): void {
    this.barElement.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Get current evaluation
   */
  public getEvaluation(): number | string {
    return this.currentEval;
  }

  /**
   * Destroy the component and clean up
   */
  public destroy(): void {
    this.barElement.remove();
  }
}

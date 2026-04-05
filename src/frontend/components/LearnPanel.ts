/**
 * Learn From Mistakes Panel
 *
 * Post-game review mode where the player replays their mistakes/blunders
 * and tries to find the best move. Uses Stockfish to validate attempts.
 */

export interface MistakeEntry {
  moveIndex: number;       // index in fenHistory/sanMoves
  fenBefore: string;       // position before the mistake
  fenAfter: string;        // position after the mistake
  playerMove: string;      // SAN of the mistake move
  bestMove: string;        // UCI of the best move
  bestMoveSan: string;     // SAN of the best move
  evalBefore: number;      // centipawn eval before (white's perspective)
  evalAfter: number;       // centipawn eval after (white's perspective)
  bestMoveEval: number;    // centipawn eval of the best move (white's perspective)
  classification: string;  // 'mistake' or 'blunder'
}

export interface LearnModeState {
  active: boolean;
  mistakes: MistakeEntry[];
  currentIndex: number;
  waitingForMove: boolean;
  solved: boolean;
  finished: boolean;
  correctCount: number;
}

type LearnEventCallback = () => void;

export class LearnPanel {
  private container: HTMLElement;
  private panelElement: HTMLElement;
  private state: LearnModeState = {
    active: false,
    mistakes: [],
    currentIndex: 0,
    waitingForMove: false,
    solved: false,
    finished: false,
    correctCount: 0,
  };

  private onNextCallbacks: LearnEventCallback[] = [];
  private onExitCallbacks: LearnEventCallback[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'learn-panel';
    this.panelElement.style.display = 'none';
    this.container.appendChild(this.panelElement);
    this.injectStyles();
  }

  /** Show the panel and enter learn mode */
  activate(mistakes: MistakeEntry[]): void {
    this.state = {
      active: true,
      mistakes,
      currentIndex: 0,
      waitingForMove: true,
      solved: false,
      finished: false,
      correctCount: 0,
    };
    this.panelElement.style.display = 'block';
    this.render();
  }

  /** Hide the panel and exit learn mode */
  deactivate(): void {
    this.state.active = false;
    this.panelElement.style.display = 'none';
  }

  isActive(): boolean {
    return this.state.active;
  }

  isWaitingForMove(): boolean {
    return this.state.waitingForMove;
  }

  getCurrentMistake(): MistakeEntry | null {
    if (!this.state.active || this.state.finished) return null;
    return this.state.mistakes[this.state.currentIndex] ?? null;
  }

  /** Called when the player's attempted move is correct */
  showCorrect(bestMoveSan: string, evalCp: number): void {
    this.state.waitingForMove = false;
    this.state.solved = true;
    this.state.correctCount++;
    this.render();
    this.renderFeedback(true, bestMoveSan, evalCp);
  }

  /** Called when the player's attempted move is wrong */
  showIncorrect(bestMoveSan: string, evalCp: number): void {
    this.state.waitingForMove = false;
    this.state.solved = false;
    this.render();
    this.renderFeedback(false, bestMoveSan, evalCp);
  }

  /** Show a loading state while Stockfish computes */
  showLoading(message: string): void {
    this.panelElement.innerHTML = '';

    const header = this.createHeader();
    this.panelElement.appendChild(header);

    const body = document.createElement('div');
    body.className = 'learn-body';
    body.innerHTML = `<div class="learn-loading">${message}</div>`;
    this.panelElement.appendChild(body);
  }

  onNext(cb: LearnEventCallback): void {
    this.onNextCallbacks.push(cb);
  }

  onExit(cb: LearnEventCallback): void {
    this.onExitCallbacks.push(cb);
  }

  /** Advance to next mistake */
  private advanceToNext(): void {
    const nextIndex = this.state.currentIndex + 1;
    if (nextIndex >= this.state.mistakes.length) {
      this.state.finished = true;
      this.state.waitingForMove = false;
      this.render();
      return;
    }
    this.state.currentIndex = nextIndex;
    this.state.waitingForMove = true;
    this.state.solved = false;
    this.onNextCallbacks.forEach(cb => cb());
    this.render();
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'learn-header';

    const title = document.createElement('span');
    title.className = 'learn-title';
    title.textContent = 'Learn From Mistakes';

    const exitBtn = document.createElement('button');
    exitBtn.className = 'learn-exit-btn';
    exitBtn.textContent = 'Exit';
    exitBtn.addEventListener('click', () => {
      this.onExitCallbacks.forEach(cb => cb());
    });

    header.appendChild(title);
    header.appendChild(exitBtn);
    return header;
  }

  private render(): void {
    this.panelElement.innerHTML = '';

    const header = this.createHeader();
    this.panelElement.appendChild(header);

    if (this.state.finished) {
      this.renderFinished();
      return;
    }

    const mistake = this.state.mistakes[this.state.currentIndex];
    if (!mistake) return;

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'learn-progress';
    const total = this.state.mistakes.length;
    const current = this.state.currentIndex + 1;
    progress.innerHTML = `
      <div class="learn-progress-text">Mistake ${current} of ${total}</div>
      <div class="learn-progress-bar">
        <div class="learn-progress-fill" style="width: ${(current / total) * 100}%"></div>
      </div>
    `;
    this.panelElement.appendChild(progress);

    // Challenge prompt
    const body = document.createElement('div');
    body.className = 'learn-body';

    const classLabel = mistake.classification === 'blunder' ? 'blunder' : 'mistake';
    const classColor = mistake.classification === 'blunder' ? '#e63946' : '#e88430';

    if (this.state.waitingForMove) {
      body.innerHTML = `
        <div class="learn-prompt">
          You played <strong>${mistake.playerMove}</strong>
          (<span style="color: ${classColor}">${classLabel}</span>).
          <br>Find the best move!
        </div>
        <div class="learn-hint">Click a piece to make your move</div>
      `;
    }

    this.panelElement.appendChild(body);
  }

  private renderFeedback(correct: boolean, bestMoveSan: string, evalCp: number): void {
    const body = this.panelElement.querySelector('.learn-body');
    if (!body) return;

    const mistake = this.state.mistakes[this.state.currentIndex];
    if (!mistake) return;

    const classLabel = mistake.classification === 'blunder' ? 'blunder' : 'mistake';
    const classColor = mistake.classification === 'blunder' ? '#e63946' : '#e88430';
    const evalStr = (evalCp / 100).toFixed(1);
    const evalSign = evalCp >= 0 ? '+' : '';

    if (correct) {
      body.innerHTML = `
        <div class="learn-prompt">
          You played <strong>${mistake.playerMove}</strong>
          (<span style="color: ${classColor}">${classLabel}</span>).
        </div>
        <div class="learn-feedback learn-correct">
          Correct! The best move was <strong>${bestMoveSan}</strong> (${evalSign}${evalStr})
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="learn-prompt">
          You played <strong>${mistake.playerMove}</strong>
          (<span style="color: ${classColor}">${classLabel}</span>).
        </div>
        <div class="learn-feedback learn-incorrect">
          Not quite. The best move was <strong>${bestMoveSan}</strong> (${evalSign}${evalStr})
        </div>
      `;
    }

    // Next / Finish button
    const btnContainer = document.createElement('div');
    btnContainer.className = 'learn-actions';

    const isLast = this.state.currentIndex >= this.state.mistakes.length - 1;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'learn-next-btn';
    nextBtn.textContent = isLast ? 'Finish' : 'Next Mistake';
    nextBtn.addEventListener('click', () => this.advanceToNext());
    btnContainer.appendChild(nextBtn);

    body.appendChild(btnContainer);
  }

  private renderFinished(): void {
    const body = document.createElement('div');
    body.className = 'learn-body learn-finished';

    const total = this.state.mistakes.length;
    const correct = this.state.correctCount;

    body.innerHTML = `
      <div class="learn-summary-icon">&#9733;</div>
      <div class="learn-summary-text">
        You've reviewed all your mistakes!
      </div>
      <div class="learn-summary-score">
        ${correct} of ${total} solved correctly
      </div>
    `;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'learn-actions';

    const doneBtn = document.createElement('button');
    doneBtn.className = 'learn-next-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => {
      this.onExitCallbacks.forEach(cb => cb());
    });
    btnContainer.appendChild(doneBtn);
    body.appendChild(btnContainer);

    this.panelElement.appendChild(body);
  }

  private injectStyles(): void {
    if (document.getElementById('learn-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'learn-panel-styles';
    style.textContent = `
      .learn-panel {
        background: #16213e;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        margin-top: 12px;
      }

      .learn-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: #1a1a2e;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .learn-title {
        font-weight: 600;
        font-size: 14px;
        color: #b8a9e8;
      }

      .learn-exit-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #aaa;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.15s ease;
      }

      .learn-exit-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #eee;
      }

      .learn-progress {
        padding: 10px 14px 6px;
      }

      .learn-progress-text {
        font-size: 12px;
        color: #aaa;
        margin-bottom: 6px;
      }

      .learn-progress-bar {
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .learn-progress-fill {
        height: 100%;
        background: #b8a9e8;
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .learn-body {
        padding: 14px;
      }

      .learn-prompt {
        font-size: 14px;
        color: #eee;
        line-height: 1.5;
      }

      .learn-hint {
        font-size: 12px;
        color: #888;
        margin-top: 8px;
        font-style: italic;
      }

      .learn-loading {
        font-size: 13px;
        color: #aaa;
        text-align: center;
        padding: 16px 0;
      }

      .learn-feedback {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.5;
      }

      .learn-correct {
        background: rgba(45, 90, 39, 0.3);
        border: 1px solid rgba(45, 90, 39, 0.5);
        color: #8fc98a;
      }

      .learn-incorrect {
        background: rgba(90, 39, 39, 0.3);
        border: 1px solid rgba(90, 39, 39, 0.5);
        color: #e88;
      }

      .learn-actions {
        margin-top: 12px;
        display: flex;
        justify-content: center;
      }

      .learn-next-btn {
        background: #b8a9e8;
        color: #1a1a2e;
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .learn-next-btn:hover {
        background: #c9bcf0;
        transform: translateY(-1px);
      }

      .learn-finished {
        text-align: center;
        padding: 20px 14px;
      }

      .learn-summary-icon {
        font-size: 40px;
        color: #f0c040;
        margin-bottom: 8px;
      }

      .learn-summary-text {
        font-size: 16px;
        color: #eee;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .learn-summary-score {
        font-size: 14px;
        color: #aaa;
        margin-bottom: 12px;
      }
    `;
    document.head.appendChild(style);
  }
}

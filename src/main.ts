import confetti from 'canvas-confetti';
import { HandTracker } from './tracker/HandTracker';
import { UIManager, UIButton } from './ui/UIManager';
import { IGame } from './games/IGame';
import { TargetRush } from './games/TargetRush';
import { DragDrop } from './games/DragDrop';
import { AirMaze } from './games/AirMaze';
import { ReflexGame } from './games/ReflexGame';
import { AirSlicer } from './games/AirSlicer';
import { LeaderboardService } from './services/LeaderboardService';
import { soundManager } from './audio/SoundSynthesizer';

type AppState = 'MAIN_MENU' | 'CASUAL' | 'LEADERBOARD' | 'GAME_PLAY' | 'CASUAL_DONE' | 'RANKED_DONE';

class AirMouseApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tracker: HandTracker;
  private uiManager: UIManager;

  private state: AppState = 'MAIN_MENU';
  private currentGame: IGame | null = null;
  private rankedSequence: IGame[] = [];
  private isRanked = false;

  private rankedTotalTime = 0;
  private casualTotalTime = 0;
  private lastFrameTime = performance.now();

  private prevClicked = false;
  private highlightedBtn: UIButton | null = null;

  // Shift Key tracking
  private shiftCount = 0;
  private lastShiftTime = 0;

  private smoothCursor = { x: 960, y: 540 };

  // UI Buttons
  private btnCasual: UIButton = { id: 'casual', x: 735, y: 270, w: 450, h: 90, text: 'Casual Play', isHovered: false };
  private btnRanked: UIButton = { id: 'ranked', x: 735, y: 390, w: 450, h: 90, text: 'Ranked Play', isHovered: false };
  private btnLeader: UIButton = { id: 'leader', x: 735, y: 510, w: 450, h: 90, text: 'Leaderboard', isHovered: false };

  private btnBack: UIButton = { id: 'back', x: 55, y: 55, w: 225, h: 80, text: 'Back', isHovered: false };

  private btnGame1: UIButton = { id: 'g1', x: 735, y: 180, w: 450, h: 80, text: 'Target Rush', isHovered: false };
  private btnGame2: UIButton = { id: 'g2', x: 735, y: 280, w: 450, h: 80, text: 'Drag & Drop', isHovered: false };
  private btnGame3: UIButton = { id: 'g3', x: 735, y: 380, w: 450, h: 80, text: 'Air Maze', isHovered: false };
  private btnGame4: UIButton = { id: 'g4', x: 735, y: 480, w: 450, h: 80, text: 'Reflex Challenge', isHovered: false };
  private btnGame5: UIButton = { id: 'g5', x: 735, y: 580, w: 450, h: 80, text: 'Air Slicer', isHovered: false };

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.width = 1920;
    this.canvas.height = 1080;

    this.tracker = new HandTracker(1920, 1080);
    this.uiManager = new UIManager(1920, 1080);

    this.setupListeners();
  }


  public async start() {
    LeaderboardService.fetchScores(); // Load scores initially
    
    const loadingOverlay = document.getElementById('loading-overlay');
    const cameraStatusText = document.getElementById('camera-status-text');
    const cameraDot = document.getElementById('camera-dot');

    const success = await this.tracker.initialize();

    if (cameraStatusText && cameraDot) {
      if (success) {
        cameraStatusText.textContent = 'Camera Active';
        cameraDot.classList.add('active');
      } else {
        cameraStatusText.textContent = 'Mouse/Touch Mode';
      }
    }

    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => loadingOverlay.style.display = 'none', 500);
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  private setupListeners() {
    // Mouse / Touch Fallback Listener
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = 1920 / rect.width;
      const scaleY = 1080 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      this.tracker.setMousePosition(x, y, e.buttons === 1);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = 1920 / rect.width;
      const scaleY = 1080 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      this.tracker.setMousePosition(x, y, true);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = 1920 / rect.width;
      const scaleY = 1080 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      this.tracker.setMousePosition(x, y, false);
    });

    // Triple Shift Key Exit/Back listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        const now = performance.now();
        if (now - this.lastShiftTime < 1000) {
          this.shiftCount++;
        } else {
          this.shiftCount = 1;
        }
        this.lastShiftTime = now;

        if (this.shiftCount >= 3) {
          this.state = 'MAIN_MENU';
          this.currentGame = null;
          this.shiftCount = 0;
        }
      }
    });

    // Auto-fullscreen on first interaction
    const requestFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      document.removeEventListener('click', requestFullscreen);
    };
    document.addEventListener('click', requestFullscreen);

    // Modal submit handler
    const btnSubmit = document.getElementById('btn-submit-score');
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
    const modal = document.getElementById('ranked-modal');

    if (btnSubmit && nameInput && modal) {
      btnSubmit.addEventListener('click', () => {
        const name = nameInput.value.trim() || 'Anonymous';
        LeaderboardService.addScore(name, this.rankedTotalTime);
        modal.style.display = 'none';
        this.state = 'LEADERBOARD';
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          btnSubmit.click();
        }
      });
    }
  }

  private loop() {
    const now = performance.now();
    let dt = (now - this.lastFrameTime) / 1000.0;
    if (dt > 0.1) dt = 0.1; // Cap at 100ms
    this.lastFrameTime = now;

    // 1. Clear background
    this.ctx.fillStyle = '#2e1e1e';
    this.ctx.fillRect(0, 0, 1920, 1080);

    // 3. Update Hand Tracker
    const useThumbPinch = (this.state === 'GAME_PLAY');
    const input = this.tracker.update(useThumbPinch);
    const { cursorPos, isClicked, isDetected, videoElement, landmarks, isCameraActive } = input;

    if (isDetected) {
      if (isCameraActive) {
        this.smoothCursor.x += (cursorPos.x - this.smoothCursor.x) * 0.4;
        this.smoothCursor.y += (cursorPos.y - this.smoothCursor.y) * 0.4;
      } else {
        this.smoothCursor.x = cursorPos.x;
        this.smoothCursor.y = cursorPos.y;
      }
    }

    const justClicked = isClicked && !this.prevClicked;
    this.prevClicked = isClicked;

    if (justClicked) {
      soundManager.playClick();
    }

    // 3. Mini Cam preview when not playing or in ranked, or if toggled via gesture
    const pip = document.getElementById('pip-camera-container');
    if (pip) {
      if (this.state !== 'GAME_PLAY' && this.state !== 'RANKED_DONE' || input.showCameraPreview) {
        pip.classList.add('visible');
      } else {
        pip.classList.remove('visible');
      }
    }

    // 4. Update sticky highlighted button
    const activeBtns: UIButton[] = [];
    if (this.state === 'MAIN_MENU') activeBtns.push(this.btnCasual, this.btnRanked, this.btnLeader);
    else if (this.state === 'CASUAL') activeBtns.push(this.btnBack, this.btnGame1, this.btnGame2, this.btnGame3, this.btnGame4, this.btnGame5);
    else if (this.state === 'LEADERBOARD') activeBtns.push(this.btnBack);
    else if (this.state === 'GAME_PLAY' && !this.isRanked) activeBtns.push(this.btnBack);
    else if (this.state === 'CASUAL_DONE') activeBtns.push(this.btnBack);

    let newlyHoveredBtn: UIButton | null = null;
    for (const btn of activeBtns) {
      if (this.smoothCursor.x >= btn.x && this.smoothCursor.x <= btn.x + btn.w && this.smoothCursor.y >= btn.y && this.smoothCursor.y <= btn.y + btn.h) {
        newlyHoveredBtn = btn;
        break;
      }
    }

    if (newlyHoveredBtn) {
      this.highlightedBtn = newlyHoveredBtn;
    } else if (this.highlightedBtn && !activeBtns.includes(this.highlightedBtn)) {
      // Clear remembered button if we changed menus
      this.highlightedBtn = null;
    }

    for (const btn of activeBtns) {
      btn.isHovered = (btn === this.highlightedBtn);
    }

    // 5. Render States
    switch (this.state) {
      case 'MAIN_MENU':
        this.uiManager.drawMainMenu(this.ctx, activeBtns);
        if (justClicked && this.highlightedBtn) {
          if (this.highlightedBtn === this.btnCasual) this.state = 'CASUAL';
          else if (this.highlightedBtn === this.btnRanked) {
            this.state = 'GAME_PLAY';
            this.isRanked = true;
            this.rankedSequence = [
              new TargetRush(1920, 1080),
              new AirMaze(1920, 1080),
              new DragDrop(1920, 1080),
              new ReflexGame(1920, 1080),
              new AirSlicer(1920, 1080)
            ];
            this.currentGame = this.rankedSequence.shift()!;
            this.rankedTotalTime = 0;
          } else if (this.highlightedBtn === this.btnLeader) {
            this.state = 'LEADERBOARD';
            LeaderboardService.fetchScores();
          }
        }
        break;

      case 'CASUAL':
        this.uiManager.drawCasualMenu(this.ctx, activeBtns);
        if (justClicked && this.highlightedBtn) {
          if (this.highlightedBtn === this.btnBack) this.state = 'MAIN_MENU';
          else {
            this.state = 'GAME_PLAY';
            this.isRanked = false;
            this.casualTotalTime = 0;
            if (this.highlightedBtn === this.btnGame1) this.currentGame = new TargetRush(1920, 1080);
            else if (this.highlightedBtn === this.btnGame2) this.currentGame = new DragDrop(1920, 1080);
            else if (this.highlightedBtn === this.btnGame3) this.currentGame = new AirMaze(1920, 1080);
            else if (this.highlightedBtn === this.btnGame4) this.currentGame = new ReflexGame(1920, 1080);
            else if (this.highlightedBtn === this.btnGame5) this.currentGame = new AirSlicer(1920, 1080);
          }
        }
        break;

      case 'LEADERBOARD':
        this.uiManager.drawLeaderboard(this.ctx, this.btnBack);
        if (justClicked && this.highlightedBtn === this.btnBack) {
          this.state = 'MAIN_MENU';
        }
        break;

      case 'GAME_PLAY':
        if (!this.isRanked) {
          this.uiManager.drawButton(this.ctx, this.btnBack);
          if (justClicked && this.highlightedBtn === this.btnBack) {
            this.state = 'CASUAL';
            this.currentGame = null;
          }
        }

        if (this.currentGame) {
          const finished = this.currentGame.update({
            cursorPos: this.smoothCursor,
            isPinched: isClicked,
            justPinched: justClicked
          });
          
          // Accumulate time if not waiting
          const waiting = this.currentGame.isWaiting ? this.currentGame.isWaiting() : false;
          if (!waiting) {
            if (this.isRanked) this.rankedTotalTime += dt;
            else this.casualTotalTime += dt;
          }

          this.currentGame.draw(this.ctx, 1920, 1080);

          // Draw Game Name
          this.ctx.textAlign = 'left';
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          this.ctx.font = 'bold 42px Outfit, sans-serif';
          const nameX = this.isRanked ? 55 : 310;
          this.ctx.fillText(this.currentGame.name.toUpperCase(), nameX, 110);

          if (finished) {
            if (this.isRanked) {
              if (this.rankedSequence.length > 0) {
                this.currentGame = this.rankedSequence.shift()!;
              } else {
                this.state = 'RANKED_DONE';
                this.currentGame = null;
                this.triggerRankedDone();
              }
            } else {
              this.state = 'CASUAL_DONE';
              this.currentGame = null;
            }
          }
        }
        break;

      case 'CASUAL_DONE':
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#a6e3a1';
        this.ctx.font = '900 72px Outfit, sans-serif';
        this.ctx.fillText('CHALLENGE COMPLETED!', 960, 248);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Outfit, sans-serif';
        this.ctx.fillText(`Time Taken: ${this.casualTotalTime.toFixed(2)}s`, 960, 360);

        this.uiManager.drawButton(this.ctx, this.btnBack);
        if (justClicked && this.highlightedBtn === this.btnBack) {
          this.state = 'CASUAL';
        }
        break;

      case 'RANKED_DONE':
        // Modal is active during RANKED_DONE
        break;
    }

    // Draw gesture help overlay
    this.uiManager.drawHelpOverlay(this.ctx);

    // 6. Draw hand tracking / mouse cursor overlay
    if (isDetected) {
      this.uiManager.drawCursor(this.ctx, this.smoothCursor, isClicked);
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  private triggerRankedDone() {
    soundManager.playWin();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const modal = document.getElementById('ranked-modal');
    const timeDisplay = document.getElementById('ranked-time-display');
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement;

    if (modal && timeDisplay && nameInput) {
      timeDisplay.textContent = `Total Time: ${this.rankedTotalTime.toFixed(2)}s`;
      nameInput.value = '';
      modal.style.display = 'flex';
      setTimeout(() => nameInput.focus(), 100);
    }
  }
}

// Instantiate and launch
const app = new AirMouseApp();
app.start();

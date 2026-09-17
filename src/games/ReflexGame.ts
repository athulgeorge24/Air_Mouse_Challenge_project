import { IGame, GameStateInput } from './IGame';
import { soundManager } from '../audio/SoundSynthesizer';

export class ReflexGame implements IGame {
  public name = "Reflex Challenge";
  private state: 'WAIT' | 'CLICK' | 'DONE' = 'WAIT';
  private waitEndTime: number;
  private targetRect: { x: number; y: number; w: number; h: number };
  private width: number;
  private height: number;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.targetRect = { x: w / 2 - 60, y: h / 2 - 60, w: 120, h: 120 };
    this.waitEndTime = performance.now() + (Math.random() * 3000 + 2000);
  }

  public update(input: GameStateInput): boolean {
    const { cursorPos, justPinched } = input;
    const now = performance.now();

    if (this.state === 'WAIT') {
      if (now >= this.waitEndTime) {
        this.state = 'CLICK';
        soundManager.playHit();
      } else if (justPinched) {
        // Penalty for early pinch
        soundManager.playBomb();
        this.waitEndTime = now + (Math.random() * 3000 + 2000);
      }
    } else if (this.state === 'CLICK') {
      if (justPinched) {
        this.state = 'DONE';
        soundManager.playWin();
        return true; // Game finished
      }
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.textAlign = 'center';

    const { x, y, w, h } = this.targetRect;

    if (this.state === 'WAIT') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Outfit, sans-serif';
      ctx.fillText('Wait for it...', width / 2, height / 2 - 120);

      ctx.strokeStyle = '#f38ba8';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = 'rgba(243, 139, 168, 0.1)';
      ctx.fillRect(x, y, w, h);
    } else if (this.state === 'CLICK') {
      ctx.fillStyle = '#a6e3a1';
      ctx.font = 'bold 40px Outfit, sans-serif';
      ctx.fillText('CLICK NOW!', width / 2, height / 2 - 120);

      ctx.strokeStyle = '#a6e3a1';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = 'rgba(166, 227, 161, 0.8)';
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
  }

  public getFinalScore(): string {
    return this.state === 'DONE' ? 'SUCCESS' : 'WAITING';
  }

  public isWaiting(): boolean {
    return this.state === 'WAIT';
  }
}

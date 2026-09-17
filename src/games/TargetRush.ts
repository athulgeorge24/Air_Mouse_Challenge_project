import { IGame, GameStateInput } from './IGame';
import { soundManager } from '../audio/SoundSynthesizer';

export class TargetRush implements IGame {
  public name = "Target Rush";
  public score = 0;
  public targetCount = 5;
  private currentTarget: { x: number; y: number; r: number } | null = null;
  private width: number;
  private height: number;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.spawnTarget();
  }

  private spawnTarget() {
    const r = 60;
    const x = Math.floor(Math.random() * (this.width - 2 * r - 400)) + r + 200;
    const y = Math.floor(Math.random() * (this.height - 2 * r - 400)) + r + 200;
    this.currentTarget = { x, y, r };
  }

  public update(input: GameStateInput): boolean {
    const { cursorPos, justPinched } = input;
    if (justPinched && this.currentTarget) {
      const dist = Math.hypot(cursorPos.x - this.currentTarget.x, cursorPos.y - this.currentTarget.y);
      if (dist <= this.currentTarget.r + 30) {
        soundManager.playHit();
        this.score++;
        if (this.score < this.targetCount) {
          this.spawnTarget();
        } else {
          this.currentTarget = null;
          soundManager.playWin();
          return true; // Game Finished
        }
      }
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    // Header text
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Targets: ${this.score}/${this.targetCount}`, width / 2, 50);

    // Target circle
    if (this.currentTarget) {
      const { x, y, r } = this.currentTarget;

      // Glow effect
      ctx.shadowColor = '#f38ba8';
      ctx.shadowBlur = 15;

      // Inner fill
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f38ba8';
      ctx.fill();

      // Outer border
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Target bullseye inner ring
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  public getFinalScore(): number {
    return this.score;
  }
}

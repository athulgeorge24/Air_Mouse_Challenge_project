import { IGame, GameStateInput } from './IGame';
import { soundManager } from '../audio/SoundSynthesizer';

interface Wall {
  x: number;
  gapY: number;
  gapHeight: number;
  width: number;
  passed: boolean;
}

export class AirMaze implements IGame {
  public name = "Air Maze";
  public score = 0;
  public targetScore = 20;

  private cursorR = 15;
  private collisionR = 5;
  private walls: Wall[] = [];
  private wallSpeed = 8;
  private spawnTimer = 0;
  private startTime = performance.now();
  private width: number;
  private height: number;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  private spawnWall() {
    const width = 100;
    const gapHeight = 220;
    const gapY = Math.floor(Math.random() * (this.height - gapHeight - 200)) + 100;
    this.walls.push({ x: this.width, gapY, gapHeight, width, passed: false });
  }

  public update(input: GameStateInput): boolean {
    const { cursorPos } = input;
    const cx = cursorPos.x;
    const cy = cursorPos.y;
    const now = performance.now();

    if (this.score >= this.targetScore) {
      soundManager.playWin();
      return true;
    }

    // Spawn wall every 1.5 seconds
    if (now - this.spawnTimer > 1500) {
      this.spawnWall();
      this.spawnTimer = now;
    }

    let hit = false;

    // Check ceiling or floor collision
    if (cy < this.collisionR || cy > this.height - this.collisionR) {
      hit = true;
    }

    // Update wall positions & check collision
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i];
      wall.x -= this.wallSpeed;

      // X collision range
      if (cx > wall.x - this.collisionR && cx < wall.x + wall.width + this.collisionR) {
        // Y collision outside the gap
        if (cy < wall.gapY + this.collisionR || cy > wall.gapY + wall.gapHeight - this.collisionR) {
          hit = true;
        }
      }

      // Check passed for score
      if (!wall.passed && cx > wall.x + wall.width) {
        wall.passed = true;
        this.score++;
        soundManager.playHit();
      }

      // Remove offscreen walls
      if (wall.x < -wall.width) {
        this.walls.splice(i, 1);
      }
    }

    if (hit) {
      soundManager.playBomb();
      this.score = 0;
      this.walls = [];
      this.spawnTimer = now - 1000;
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(1);

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}/${this.targetScore}  |  Time: ${elapsed}s`, width / 2, 50);

    // Draw walls
    this.walls.forEach(wall => {
      ctx.fillStyle = '#f38ba8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      // Top wall
      ctx.fillRect(wall.x, 0, wall.width, wall.gapY);
      ctx.strokeRect(wall.x, 0, wall.width, wall.gapY);

      // Bottom wall
      const bottomY = wall.gapY + wall.gapHeight;
      ctx.fillRect(wall.x, bottomY, wall.width, height - bottomY);
      ctx.strokeRect(wall.x, bottomY, wall.width, height - bottomY);
    });

    ctx.restore();
  }

  public getFinalScore(): number {
    return this.score;
  }
}

import { IGame, GameStateInput } from './IGame';
import { soundManager } from '../audio/SoundSynthesizer';

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  isBomb: boolean;
  shape: number;
  isSliced: boolean;
  slicedTimer: number;
  rotation: number;
  rotSpeed: number;
}

export class AirSlicer implements IGame {
  public name = "Air Slicer";
  public score = 0;
  public targetScore = 15;

  private fruits: Fruit[] = [];
  private slashTrail: { x: number; y: number }[] = [];
  private lastCursorPos: { x: number; y: number } | null = null;
  private spawnTimer = 0;
  private width: number;
  private height: number;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  private spawnItem() {
    // INCREASE THE SIZE OF FRUIT
    const r = Math.floor(Math.random() * 40) + 70; 
    const x = Math.floor(Math.random() * (this.width - 200)) + 100;
    const y = this.height + r;

    let vx = 0;
    if (x < this.width / 2 - 200) {
      // Spawned on the far left -> fall towards the right
      vx = Math.random() * 6 + 2; 
    } else if (x > this.width / 2 + 200) {
      // Spawned on the far right -> fall towards the left
      vx = -(Math.random() * 6 + 2);
    } else {
      // Spawned in the center -> fall mostly straight up and down
      vx = (Math.random() - 0.5) * 4;
    }

    // THROW SLOWER
    const vy = -(Math.random() * 6 + 12); 
    const isBomb = Math.random() < 0.2;
    // RANDOM SHAPES
    const shape = isBomb ? 0 : Math.floor(Math.random() * 3); 
    const rotation = Math.random() * Math.PI * 2;
    const rotSpeed = (Math.random() - 0.5) * 0.1;

    this.fruits.push({ x, y, vx, vy, r, isBomb, shape, isSliced: false, slicedTimer: 0, rotation, rotSpeed });
  }

  private lineIntersectCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    
    if (l2 === 0) return Math.hypot(cx - x1, cy - y1) <= r;
    
    let t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t)); 
    
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    
    return Math.hypot(cx - projX, cy - projY) <= r;
  }

  public update(input: GameStateInput): boolean {
    const { cursorPos, isPinched } = input;
    const now = performance.now();

    if (now - this.spawnTimer > 1500) {
      this.spawnItem();
      this.spawnTimer = now;
    }

    const prevPos = this.lastCursorPos || { x: cursorPos.x, y: cursorPos.y };

    const dx = cursorPos.x - prevPos.x;
    const dy = cursorPos.y - prevPos.y;
    const speed = Math.hypot(dx, dy);
    
    // Update lastCursorPos for the next frame's speed calculation
    this.lastCursorPos = { x: cursorPos.x, y: cursorPos.y };
    const isSlicing = isPinched || speed > 10; // Swipe fast OR pinch

    if (isSlicing) {
      this.slashTrail.push({ x: cursorPos.x, y: cursorPos.y });
      if (this.slashTrail.length > 12) {
        this.slashTrail.shift();
      }
    } else if (this.slashTrail.length > 0) {
      this.slashTrail.shift(); // gradually fade trail
    }

    const cx = cursorPos.x;
    const cy = cursorPos.y;

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.x += f.vx;
      f.y += f.vy;
      f.vy += 0.12; // Gravity
      f.rotation += f.rotSpeed;

      if (f.isSliced) {
        f.slicedTimer += 1;
        // Remove after slicing animation completes
        if (f.slicedTimer > 40) {
          this.fruits.splice(i, 1);
        }
        continue;
      }

      if (isSlicing) {
        const isHit = this.lineIntersectCircle(prevPos.x, prevPos.y, cx, cy, f.x, f.y, f.r + 130);
        if (isHit) {
          if (f.isBomb) {
            soundManager.playBomb();
            this.score = Math.max(0, this.score - 2);
            this.fruits.splice(i, 1);
          } else {
            soundManager.playSlice();
            this.score++;
            f.isSliced = true;
            // "LET THE PLAYER ABLE TO SLICE THROUGH IT": 
            // Rather than immediately deleting, it stays as sliced, splits in two, and falls.
            f.vx = f.vx * 0.5;
          }
          continue;
        }
      }

      if (f.y > this.height + f.r + 60 && f.vy > 0) {
        this.fruits.splice(i, 1);
      }
    }

    if (this.score >= this.targetScore) {
      soundManager.playWin();
      return true;
    }

    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}/${this.targetScore}`, width / 2, 50);

    this.fruits.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      if (f.isBomb) {
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fillStyle = '#f38ba8';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#11111b';
        ctx.font = `bold ${f.r}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, 0);
      } else {
        // Draw normal fruit (or sliced pieces)
        const drawShape = (isHalf: number) => { // isHalf: 0 = full, 1 = left, 2 = right
          ctx.beginPath();
          if (f.shape === 0) {
            // Circle
            if (isHalf === 1) ctx.arc(0, 0, f.r, Math.PI / 2, Math.PI * 1.5);
            else if (isHalf === 2) ctx.arc(0, 0, f.r, Math.PI * 1.5, Math.PI / 2);
            else ctx.arc(0, 0, f.r, 0, Math.PI * 2);
          } else if (f.shape === 1) {
            // Square
            if (isHalf === 1) ctx.rect(-f.r, -f.r, f.r, f.r * 2);
            else if (isHalf === 2) ctx.rect(0, -f.r, f.r, f.r * 2);
            else ctx.rect(-f.r, -f.r, f.r * 2, f.r * 2);
          } else if (f.shape === 2) {
            // Triangle
            const h = f.r * Math.sqrt(3) / 2;
            if (isHalf === 1) {
              ctx.moveTo(0, -f.r);
              ctx.lineTo(-h, f.r / 2);
              ctx.lineTo(0, f.r / 2);
            } else if (isHalf === 2) {
              ctx.moveTo(0, -f.r);
              ctx.lineTo(h, f.r / 2);
              ctx.lineTo(0, f.r / 2);
            } else {
              ctx.moveTo(0, -f.r);
              ctx.lineTo(-h, f.r / 2);
              ctx.lineTo(h, f.r / 2);
            }
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };

        const colors = ['#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7'];
        ctx.fillStyle = colors[f.shape % colors.length];
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';

        if (f.isSliced) {
          // Draw left half shifting left and right half shifting right
          const offset = f.slicedTimer * 2;
          ctx.save();
          ctx.translate(-offset, offset * 0.5);
          ctx.rotate(-f.slicedTimer * 0.05);
          drawShape(1);
          ctx.restore();

          ctx.save();
          ctx.translate(offset, offset * 0.5);
          ctx.rotate(f.slicedTimer * 0.05);
          drawShape(2);
          ctx.restore();
        } else {
          drawShape(0);
          
          // Shine
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    if (this.slashTrail.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.slashTrail[0].x, this.slashTrail[0].y);
      for (let i = 1; i < this.slashTrail.length; i++) {
        ctx.lineTo(this.slashTrail[i].x, this.slashTrail[i].y);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.strokeStyle = '#89b4fa';
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  public getFinalScore(): number {
    return this.score;
  }
}

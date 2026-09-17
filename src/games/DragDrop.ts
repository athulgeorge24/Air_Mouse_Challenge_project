import { IGame, GameStateInput } from './IGame';
import { soundManager } from '../audio/SoundSynthesizer';

export class DragDrop implements IGame {
  public name = "Drag & Drop";
  public itemsDropped = 0;
  public targetDrops = 3;

  private objRect = { x: 100, y: 300, w: 120, h: 120 };
  private zoneRect = { x: 1000, y: 300, w: 200, h: 200 };
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private width: number;
  private height: number;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.spawnItem();
  }

  private spawnItem() {
    this.objRect.x = Math.floor(Math.random() * 250) + 100;
    this.objRect.y = Math.floor(Math.random() * (this.height - 350)) + 150;
    this.zoneRect.x = Math.floor(Math.random() * 200) + (this.width - 450);
    this.zoneRect.y = Math.floor(Math.random() * (this.height - 350)) + 150;
  }

  public update(input: GameStateInput): boolean {
    const { cursorPos, isPinched, justPinched } = input;
    const { x: cx, y: cy } = cursorPos;
    const { x: ox, y: oy, w: ow, h: oh } = this.objRect;
    const { x: zx, y: zy, w: zw, h: zh } = this.zoneRect;

    if (justPinched) {
      if (cx >= ox - 30 && cx <= ox + ow + 30 && cy >= oy - 30 && cy <= oy + oh + 30) {
        this.isDragging = true;
        this.dragOffset = { x: cx - ox, y: cy - oy };
        soundManager.playClick();
      }
    }

    if (this.isDragging) {
      if (isPinched) {
        this.objRect.x = cx - this.dragOffset.x;
        this.objRect.y = cy - this.dragOffset.y;
      } else {
        // Released pinch
        this.isDragging = false;
        const centerObjX = this.objRect.x + ow / 2;
        const centerObjY = this.objRect.y + oh / 2;

        if (centerObjX >= zx && centerObjX <= zx + zw && centerObjY >= zy && centerObjY <= zy + zh) {
          soundManager.playHit();
          this.itemsDropped++;
          if (this.itemsDropped < this.targetDrops) {
            this.spawnItem();
          } else {
            soundManager.playWin();
            return true; // Game Completed
          }
        }
      }
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();

    // Title / progress
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Drop Items: ${this.itemsDropped}/${this.targetDrops}`, width / 2, 50);

    // Target DROP Zone
    const { x: zx, y: zy, w: zw, h: zh } = this.zoneRect;
    ctx.strokeStyle = '#a6e3a1';
    ctx.lineWidth = 4;
    ctx.strokeRect(zx, zy, zw, zh);

    ctx.fillStyle = 'rgba(166, 227, 161, 0.15)';
    ctx.fillRect(zx, zy, zw, zh);

    ctx.fillStyle = '#a6e3a1';
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillText('DROP', zx + zw / 2, zy + zh / 2 + 7);

    // Draggable Object
    const { x: ox, y: oy, w: ow, h: oh } = this.objRect;
    ctx.shadowColor = this.isDragging ? '#89b4fa' : '#000000';
    ctx.shadowBlur = this.isDragging ? 20 : 8;

    ctx.fillStyle = this.isDragging ? '#89b4fa' : '#fab387';
    ctx.beginPath();
    ctx.roundRect(ox, oy, ow, oh, 12);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#1e1e24';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText(this.isDragging ? 'DRAGGING' : 'HOLD PINCH', ox + ow / 2, oy + oh / 2 + 5);

    ctx.restore();
  }

  public getFinalScore(): number {
    return this.itemsDropped;
  }
}

import { LeaderboardService } from '../services/LeaderboardService';
import { soundManager } from '../audio/SoundSynthesizer';

export interface UIButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  isHovered: boolean;
}

export class UIManager {
  private width: number;
  private height: number;

  constructor(w = window.innerWidth, h = window.innerHeight) {
    this.width = w;
    this.height = h;
  }

  public setDimensions(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public drawButton(ctx: CanvasRenderingContext2D, btn: UIButton) {
    const { x, y, w, h, text, isHovered } = btn;

    ctx.save();
    
    // Glowing shadow
    ctx.shadowColor = isHovered ? 'rgba(137, 180, 250, 0.3)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = isHovered ? 20 : 15;
    ctx.shadowOffsetY = isHovered ? 0 : 8;
    
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    
    // Fill Gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    if (isHovered) {
      gradient.addColorStop(0, '#585b70');
      gradient.addColorStop(1, '#45475a');
    } else {
      gradient.addColorStop(0, '#45475a');
      gradient.addColorStop(1, '#313244');
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke Outline
    if (isHovered) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#89b4fa';
      ctx.stroke();
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();
      
      // Top inner highlight for 3D effect
      ctx.beginPath();
      ctx.moveTo(x + 24, y + 1);
      ctx.lineTo(x + w - 24, y + 1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Text
    ctx.fillStyle = isHovered ? '#ffffff' : '#cdd6f4';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (isHovered) {
      ctx.shadowColor = '#89b4fa';
      ctx.shadowBlur = 10;
    }
    
    ctx.fillText(text, x + w / 2, y + h / 2);

    ctx.restore();
  }

  public checkHover(btn: UIButton, cursorPos: { x: number; y: number }): boolean {
    const { x, y, w, h } = btn;
    btn.isHovered = cursorPos.x >= x && cursorPos.x <= x + w && cursorPos.y >= y && cursorPos.y <= y + h;
    return btn.isHovered;
  }

  public drawMainMenu(ctx: CanvasRenderingContext2D, buttons: UIButton[]) {
    ctx.save();
    // Subtitle & Title
    ctx.textAlign = 'center';

    ctx.fillStyle = '#89b4fa';
    ctx.font = '900 81px Outfit, sans-serif';
    ctx.shadowColor = 'rgba(137, 180, 250, 0.4)';
    ctx.shadowBlur = 15;
    ctx.fillText('AIR MOUSE CHALLENGE', this.width / 2, 157);
    ctx.shadowBlur = 0;

    buttons.forEach(btn => this.drawButton(ctx, btn));
    ctx.restore();
  }

  public drawCasualMenu(ctx: CanvasRenderingContext2D, buttons: UIButton[]) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = '#89b4fa';
    ctx.font = '900 72px Outfit, sans-serif';
    ctx.fillText('CASUAL PLAY MODE', this.width / 2, 101);

    buttons.forEach(btn => this.drawButton(ctx, btn));
    ctx.restore();
  }

  public drawLeaderboard(ctx: CanvasRenderingContext2D, btnBack: UIButton) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = '#89b4fa';
    ctx.font = '900 72px Outfit, sans-serif';
    ctx.fillText('TOP RANKED LEADERBOARD', this.width / 2, 101);

    const scores = LeaderboardService.getScores();
    let startY = 191;

    if (scores.length === 0) {
      ctx.fillStyle = '#a0a5b5';
      ctx.font = 'bold 40px Outfit, sans-serif';
      ctx.fillText('No scores registered yet!', this.width / 2, startY + 56);
    } else {
      scores.forEach((score, idx) => {
        const isTop3 = idx < 3;
        ctx.fillStyle = isTop3 ? (idx === 0 ? '#f9e2af' : idx === 1 ? '#cdd6f4' : '#fab387') : '#ffffff';
        ctx.font = isTop3 ? 'bold 47px Outfit, sans-serif' : '40px Outfit, sans-serif';

        const text = `${idx + 1}.  ${score.name.padEnd(16, ' ')}  -  ${score.time.toFixed(2)}s`;
        ctx.fillText(text, this.width / 2, startY);
        startY += 47;
      });
    }

    this.drawButton(ctx, btnBack);
    ctx.restore();
  }


  public drawCursor(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, isClicked: boolean) {
    ctx.save();
    const { x, y } = pos;

    // Glowing halo
    ctx.shadowColor = isClicked ? '#a6e3a1' : '#89b4fa';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = isClicked ? '#a6e3a1' : '#89b4fa';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  public drawHelpOverlay(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    const pad = 30;
    const boxW = 580;
    const boxH = 180;
    const startX = this.width - boxW - pad;
    const startY = this.height - boxH - pad;

    // Glass panel background
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(20, 20, 30, 0.7)';
    ctx.beginPath();
    ctx.roundRect(startX, startY, boxW, boxH, 20);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Title
    ctx.shadowColor = 'rgba(137, 180, 250, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#89b4fa';
    ctx.font = 'bold 26px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Gesture Guide', startX + 30, startY + 25);
    ctx.shadowBlur = 0;

    // List
    ctx.fillStyle = '#f8f9fa';
    ctx.font = '500 22px Outfit, sans-serif';
    ctx.fillText('🤏  Pinch (Index+Thumb / Middle) : Click & Drag', startX + 30, startY + 65);
    ctx.fillText('🤘  Spider-Man : Show Camera', startX + 30, startY + 100);
    ctx.fillText('✊  Fist : Hide Camera', startX + 30, startY + 135);

    ctx.restore();
  }
}


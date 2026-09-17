export interface GameStateInput {
  cursorPos: { x: number; y: number };
  isPinched: boolean;
  justPinched: boolean;
}

export interface IGame {
  name: string;
  update(input: GameStateInput): boolean; // returns true if game completed
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  getFinalScore?(): number | string;
  isWaiting?(): boolean;
}

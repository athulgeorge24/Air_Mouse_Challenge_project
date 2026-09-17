export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number;
  private dxPrev: number;
  private tPrev: number;

  constructor(t0: number, x0: number, dx0 = 0.0, minCutoff = 0.5, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = x0;
    this.dxPrev = dx0;
    this.tPrev = t0;
  }

  public filter(t: number, x: number): number {
    const tE = t - this.tPrev;
    if (tE <= 0.0) {
      return this.xPrev;
    }

    const aD = this.smoothingFactor(tE, this.dCutoff);
    const dx = (x - this.xPrev) / tE;
    const dxHat = this.exponentialSmoothing(aD, dx, this.dxPrev);

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const aX = this.smoothingFactor(tE, cutoff);
    const xHat = this.exponentialSmoothing(aX, x, this.xPrev);

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;

    return xHat;
  }

  public reset(t0: number, x0: number): void {
    this.xPrev = x0;
    this.dxPrev = 0.0;
    this.tPrev = t0;
  }

  private smoothingFactor(tE: number, cutoff: number): number {
    const r = 2 * Math.PI * cutoff * tE;
    return r / (r + 1);
  }

  private exponentialSmoothing(a: number, x: number, xPrev: number): number {
    return a * x + (1 - a) * xPrev;
  }
}

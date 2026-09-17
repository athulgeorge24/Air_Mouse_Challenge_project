export interface ScoreEntry {
  name: string;
  time: number; // in seconds
  date?: string;
}

let cachedScores: ScoreEntry[] = [];

export class LeaderboardService {
  public static async fetchScores(): Promise<ScoreEntry[]> {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          cachedScores = data;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch scores from JSON', e);
    }
    return cachedScores;
  }

  public static getScores(): ScoreEntry[] {
    return cachedScores;
  }

  public static async addScore(name: string, time: number): Promise<ScoreEntry[]> {
    cachedScores.push({
      name: name.trim() || 'Anonymous',
      time: Math.round(time * 100) / 100,
      date: new Date().toLocaleDateString()
    });

    cachedScores.sort((a, b) => a.time - b.time);
    cachedScores = cachedScores.slice(0, 10);
    
    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedScores, null, 2)
      });
    } catch (e) {
      console.warn('Failed to save scores to JSON', e);
    }
    
    return cachedScores;
  }
}

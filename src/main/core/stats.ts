import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const STATS_FILE = path.join(app.getPath('userData'), 'stats.json');

export interface DailyStats {
  date: string;
  requests: number;
  tokens: number;
}

export interface StatsData {
  daily: DailyStats[];
  totalRequests: number; // processed today
  totalTokens: number; // processed today
}

class StatsManager {
  private data: StatsData = {
    daily: [],
    totalRequests: 0,
    totalTokens: 0,
  };

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(STATS_FILE)) {
      try {
        this.data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save stats:', error);
    }
  }

  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  public trackRequest() {
    this.data.totalRequests += 1;
    this.updateDaily(1, 0);
    this.save();
  }

  public trackTokens(count: number) {
    this.data.totalTokens += count;
    this.updateDaily(0, count);
    this.save();
  }

  private updateDaily(requests: number, tokens: number) {
    const today = this.getTodayStr();
    let dayStats = this.data.daily.find((d) => d.date === today);

    if (!dayStats) {
      dayStats = { date: today, requests: 0, tokens: 0 };
      this.data.daily.push(dayStats);
      // Keep only last 30 days
      if (this.data.daily.length > 30) {
        this.data.daily.shift();
      }
    }

    dayStats.requests += requests;
    dayStats.tokens += tokens;
  }

  public reset() {
    this.data = {
      daily: [],
      totalRequests: 0,
      totalTokens: 0,
    };
    this.save();
  }

  public getStats() {
    const today = this.getTodayStr();
    const dayStats = this.data.daily.find((d) => d.date === today) || {
      date: today,
      requests: 0,
      tokens: 0,
    };

    return {
      todayRequests: dayStats.requests,
      todayTokens: dayStats.tokens,
      history: this.data.daily,
    };
  }
}

export const statsManager = new StatsManager();

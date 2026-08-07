import { App } from "obsidian";

/** 习惯打卡数据（存储于插件 data.json） */
export interface HabitData {
  /** habitName -> 打卡日期数组 */
  [habit: string]: string[];
}

export interface HabitRecord {
  name: string;
  days: string[];      // YYYY-MM-DD 数组
  streak: number;      // 当前连续天数
  today: boolean;      // 今天是否已打卡
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 由打卡日期数组计算当前连续天数 */
export function calcStreak(days: string[], today: Date = new Date()): number {
  const set = new Set(days);
  let streak = 0;
  let cursor = new Date(today);
  if (!set.has(dateStr(cursor))) {
    // 今天未打卡：从昨天开始数（保留连击）
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(dateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildHabitRecords(data: HabitData): HabitRecord[] {
  const today = new Date();
  const todayS = dateStr(today);
  return Object.keys(data)
    .map((name) => {
      const days = (data[name] || []).slice().sort();
      return {
        name,
        days,
        streak: calcStreak(days, today),
        today: days.includes(todayS),
      };
    })
    .sort((a, b) => b.streak - a.streak);
}

export function toggleHabit(data: HabitData, name: string): HabitData {
  const today = dateStr(new Date());
  const days = data[name] || [];
  const idx = days.indexOf(today);
  if (idx >= 0) {
    days.splice(idx, 1);
  } else {
    days.push(today);
  }
  data[name] = days;
  return data;
}

/** 最近 N 天打卡矩阵（用于热力图）：days[] -> boolean[]（从旧到新） */
export function lastNDays(days: string[], n: number, today: Date = new Date()): boolean[] {
  const set = new Set(days);
  const out: boolean[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(set.has(dateStr(d)));
  }
  return out;
}

/** 默认习惯清单（首次使用初始化） */
export function defaultHabits(): HabitData {
  return {
    英语打卡: [],
    播客: [],
  };
}

export type { App };

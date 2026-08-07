import type { WidgetCtx, WorkbenchWidget } from "./types";
import { buildHabitRecords } from "../services/habitService";

/** KPI 统计条：6 张悬赏金数字卡（每个独立可拖拽/缩放） */
const widget: WorkbenchWidget = {
  id: "stat-kpi",
  title: "数据统计",
  icon: "📊",
  accent: "#fbbf24",
  category: "stats",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const s = ctx.data.stats;
    const habits = buildHabitRecords(ctx.habitData());
    const streak = habits.length ? String(habits[0].streak) : "0";

    const items: [string, string, string][] = [
      [String(s.totalNotes), "📝", "全部笔记"],
      [String(s.kcCards), "🎴", "KC 卡片"],
      [String(s.domains), "🧭", "领域"],
      ["+" + s.todayAdded, "✨", "今日新增"],
      [`${s.todayTasksDone}/${s.todayTasksTotal}`, "✅", "今日任务"],
      [streak, "🔥", "连续打卡"],
    ];

    items.forEach(([num, ico, lbl], i) => {
      const card = root.createDiv({ cls: "wb-kpi-card" });
      card.dataset.id = `stat-${i}`;
      card.createDiv({ cls: "wb-ico", text: ico });
      card.createDiv({ cls: "wb-num", text: num });
      card.createDiv({ cls: "wb-lbl", text: lbl });
    });
  },
};

export default widget;

import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";

/** 今日进度：今日任务完成率（大数字 + 双段进度条，Dashboard 风格） */
const widget: WorkbenchWidget = {
  id: "daily-progress",
  title: "今日进度",
  icon: "📊",
  accent: "#22c55e",
  category: "stats",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "daily-progress",
      title: "今日进度",
      icon: "📊",
      accent: "#22c55e",
    });

    const tasks = ctx.data.tasks;
    const done = tasks.doneToday;
    const total = tasks.total || 0;
    const tplDone = done; // 今日已完成（含到期）
    const tplTotal = tasks.today.length + done; // 今日待办 + 已完成
    const pct = tplTotal > 0 ? Math.round((tplDone / tplTotal) * 100) : 0;

    bd.createDiv({ cls: "dash-big", text: `${done} / ${total}` });
    const bar = bd.createDiv({ cls: "dash-bar bar-split" });
    const i1 = bar.createEl("i", { cls: "bar-tpl" });
    i1.style.width = `${pct}%`;
    i1.createSpan({ cls: "bar-pct", text: `${pct}%` });

    const statRow = bd.createDiv({ cls: "dash-stat-grid" });
    const mkStat = (num: string, label: string) => {
      const c = statRow.createDiv({ cls: "dash-stat-cell" });
      c.createDiv({ cls: "dash-stat-num", text: num });
      c.createDiv({ cls: "dash-stat-label", text: label });
    };
    mkStat(String(pct) + "%", "今日完成率");
    mkStat(String(done), "已完成");
    mkStat(String(tasks.overdue.length), "逾期");
    mkStat(String(tasks.open.length), "未排期");

    if (total === 0) emptyState(bd, "今日暂无任务 🎉");
  },
};

export default widget;

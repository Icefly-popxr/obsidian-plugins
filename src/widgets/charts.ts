import type { WidgetCtx, WorkbenchWidget } from "./types";
import { groupByDomain } from "../services/kcService";
import { buildHabitRecords, lastNDays } from "../services/habitService";

/** 图表区：领域分布 / 卡片等级分布 / 打卡近 30 天（3 个 chart 卡，直接挂画布） */
const widget: WorkbenchWidget = {
  id: "charts",
  title: "图表",
  icon: "📈",
  accent: "#8b5cf6",
  category: "stats",
  render(ctx: WidgetCtx, root: HTMLElement) {
    // 领域分布
    const chart1 = root.createDiv({ cls: "wb-chart" });
    chart1.dataset.id = "chart-domains";
    chart1.createSpan({ text: "📈 领域卡片分布" });
    const domains = groupByDomain(ctx.data.kcCards);
    ctx.drawBarChart(chart1, [...domains.entries()].map(([k, v]) => [k, v.length] as [string, number]));

    // 卡片等级分布
    const chart2 = root.createDiv({ cls: "wb-chart" });
    chart2.dataset.id = "chart-levels";
    chart2.createSpan({ text: "📊 卡片等级分布" });
    const lvls = [0, 0, 0];
    ctx.data.kcCards.forEach((c) => {
      if (c.level === "L1") lvls[0]++;
      else if (c.level === "L2") lvls[1]++;
      else lvls[2]++;
    });
    ctx.drawBarChart(chart2, [["L1", lvls[0]], ["L2", lvls[1]], ["L3", lvls[2]]]);

    // 打卡近 30 天
    const chart3 = root.createDiv({ cls: "wb-chart" });
    chart3.dataset.id = "chart-habits";
    chart3.createSpan({ text: "🔥 打卡近 30 天" });
    const habit = buildHabitRecords(ctx.habitData())[0];
    const heat30 = lastNDays(habit?.days || [], 30);
    const doneCount = heat30.filter(Boolean).length;
    chart3.createSpan({ text: ` ${doneCount}/30 天` });
  },
};

export default widget;

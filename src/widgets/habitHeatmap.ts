import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";
import { buildHabitRecords, lastNDays } from "../services/habitService";

/** 打卡热力图：近 N 天矩阵 + 连续天数 */
const widget: WorkbenchWidget = {
  id: "habit-heatmap",
  title: "打卡热力图",
  icon: "🔥",
  accent: "#f59e0b",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const days = Number(ctx.widgetConfig.days) || 30;
    const bd = createPanel(root, {
      id: "habit-heatmap",
      title: "打卡热力图",
      icon: "🔥",
      accent: "#f59e0b",
      moreLabel: `${days} 天`,
      onMore: () => ctx.goto("podcast"),
    });

    const habits = buildHabitRecords(ctx.habitData());
    if (habits.length === 0) {
      emptyState(bd, "暂无打卡习惯");
      return;
    }

    const hs = habits[0].days;
    const heat = bd.createDiv({ cls: "wb-heat" });
    lastNDays(hs, days).forEach((on, i) => {
      // 越靠近今天越亮（c1 深 → c4 亮）
      const lv = i >= days - 3 ? " c4" : i >= days - 9 ? " c3" : i >= days * 0.34 ? " c2" : " c1";
      heat.createDiv({ cls: "wb-cell" + (on ? lv : "") });
    });

    bd.createDiv({ cls: "wb-row" }).createSpan({
      cls: "wb-name",
      text: `🔥 ${habits[0].name} · 连续 ${habits[0].streak} 天`,
    });
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfg = plugin.settings.widgetConfigs || {};
    const inst = cfg[instanceId] || {};
    new Setting(el)
      .setName("显示天数")
      .setDesc("热力图覆盖的天数（默认 30）")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(inst.days ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            cfg[instanceId] = { ...inst, days: isNaN(n) || n <= 0 ? 30 : n };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
  },
};

export default widget;

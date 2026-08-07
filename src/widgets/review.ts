import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";
import { dueCards } from "../services/kcService";

interface ReviewCfg {
  maxItems?: number;
}

/**
 * 复习（review）：由 review-due 升级而来，独立数据源（KC 知识卡片到期复习）。
 *  - 与原「打卡」彻底分离（打卡是 habit 连续天数，复习是卡片 spaced repetition）。
 *  - 点击跳转到对应卡片；可配置显示条数。
 */
const widget: WorkbenchWidget = {
  id: "review",
  title: "复习",
  icon: "🔁",
  accent: "#fbbf24",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = (ctx.widgetConfig || {}) as ReviewCfg;
    const max = Number(cfg.maxItems) || 4;
    const due = dueCards(ctx.data.kcCards);

    const bd = createPanel(root, {
      id: "review",
      title: "复习",
      icon: "🔁",
      accent: "#fbbf24",
      moreLabel: `${due.length} 张`,
      onMore: () => ctx.goto("wiki"),
    });

    if (due.length === 0) {
      emptyState(bd, "暂无到期卡片 🎉");
      return;
    }
    for (const c of due.slice(0, max)) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createDiv({ cls: "wb-dot" }).style.background = "var(--wb-amber)";
      row.createSpan({ cls: "wb-name", text: c.name });
      row.addEventListener("click", () => ctx.openFile(c.path));
    }
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as ReviewCfg;
    new Setting(el)
      .setName("显示条数")
      .setDesc("最多显示多少张到期卡片（默认 4）")
      .addText((t) =>
        t
          .setPlaceholder("4")
          .setValue(String(inst.maxItems ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            const map = cfgMap;
            map[instanceId] = { ...(map[instanceId] || {}), maxItems: isNaN(n) || n <= 0 ? 4 : n };
            plugin.settings.widgetConfigs = map;
            save();
          })
      );
  },
};

export default widget;

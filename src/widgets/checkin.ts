import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, applyTitleFontSize, addTitleConfig } from "./helpers";
import { buildHabitRecords, toggleHabit, lastNDays, HabitRecord } from "../services/habitService";

interface CheckinCfg {
  /** 指定展示的某个习惯；空 = 显示全部习惯（修复原 habit-heatmap 只显首个的 bug） */
  habit?: string;
  days?: number;
  title?: string;
  icon?: string;
  titleFontSize?: number;
}

/**
 * 打卡（checkin）：由 habit-heatmap 升级而来。
 *  - 修复 habits[0] 只显首个的 bug：多习惯同屏（锻炼 / 英语 / 播客…）。
 *  - 每个习惯独立：今日打卡开关 + 连续天数 + 近 N 天热力图。
 */
const widget: WorkbenchWidget = {
  id: "checkin",
  title: "打卡",
  icon: "🔥",
  accent: "#f59e0b",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = (ctx.widgetConfig || {}) as CheckinCfg;
    const days = Number(cfg.days) || 30;

    const bd = createPanel(root, {
      id: "checkin",
      title: String(cfg.title || "打卡"),
      icon: String(cfg.icon || "🔥"),
      accent: "#f59e0b",
      moreLabel: `${days} 天`,
      onMore: () => ctx.goto("board"),
    });
    applyTitleFontSize(bd, Number(cfg.titleFontSize) || 14);

    const all = buildHabitRecords(ctx.habitData());
    if (all.length === 0) {
      emptyState(bd, "暂无打卡习惯");
      return;
    }
    // 指定习惯则只显示该习惯，否则显示全部
    const shown: HabitRecord[] = cfg.habit ? all.filter((h) => h.name === cfg.habit) : all;

    const body = bd.createDiv({ cls: "wb-checkin-body" });
    const renderBody = () => {
      body.empty();
      const habits = buildHabitRecords(ctx.habitData());
      const list = cfg.habit ? habits.filter((h) => h.name === cfg.habit) : habits;
      for (const h of list) {
        const block = body.createDiv({ cls: "wb-habit-block" });
        const head = block.createDiv({ cls: "wb-habit-head" });
        const toggle = head.createDiv({ cls: "wb-habit-toggle" + (h.today ? " on" : "") });
        toggle.setText(h.today ? "✅" : "⬜");
        toggle.addEventListener("click", () => {
          const data = ctx.habitData();
          toggleHabit(data, h.name);
          ctx.saveHabitData(data);
          renderBody();
        });
        head.createSpan({ cls: "wb-name", text: h.name });
        head.createSpan({ cls: "wb-habit-streak", text: `🔥 ${h.streak} 天` });

        const heat = block.createDiv({ cls: "wb-heat" });
        lastNDays(h.days, days).forEach((on, i) => {
          const lv = i >= days - 3 ? " c4" : i >= days - 9 ? " c3" : i >= days * 0.34 ? " c2" : " c1";
          heat.createDiv({ cls: "wb-cell" + (on ? lv : "") });
        });
      }
    };
    renderBody();
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as CheckinCfg;
    const habits = buildHabitRecords(plugin.settings.habits || {});
    const update = (patch: Partial<CheckinCfg>) => {
      const cur = (cfgMap[instanceId] || {}) as CheckinCfg;
      cfgMap[instanceId] = { ...cur, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };
    new Setting(el)
      .setName("显示习惯")
      .setDesc("选择展示哪个打卡习惯，留空 = 全部（多习惯同屏）")
      .addDropdown((dd) => {
        dd.addOption("", "全部");
        habits.forEach((h) => dd.addOption(h.name, h.name));
        dd.setValue(inst.habit || "").onChange((v) => update({ habit: v || undefined }));
      });
    new Setting(el)
      .setName("显示天数")
      .setDesc("热力图覆盖的天数（默认 30）")
      .addText((t) =>
        t
          .setPlaceholder("30")
          .setValue(String(inst.days ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            update({ days: isNaN(n) || n <= 0 ? 30 : n });
          })
      );
    addTitleConfig(el, plugin, instanceId, save, {
      title: "打卡",
      icon: "🔥",
      titleFontSize: 14,
    });
  },
};

export default widget;

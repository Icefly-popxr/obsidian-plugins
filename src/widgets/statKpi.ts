import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";
import { buildHabitRecords, lastNDays } from "../services/habitService";

/**
 * 数据统计组件（配置驱动）
 *  - 自定义 KPI 卡：每张卡 = {指标类型, 图标, 标签}，可增删/排序
 *  - 指标从 vault 数据实时计算（笔记/KC/领域/任务/打卡/金句/收听等）
 *  - 配置右上角 ⚙️ 打开右侧抽屉，支持多实例（#N 后缀）
 */

type KpiMetric =
  | "totalNotes"
  | "kcCards"
  | "domains"
  | "todayAdded"
  | "todayTasks"
  | "streak"
  | "overdue"
  | "openTasks"
  | "quoteFavs"
  | "podcastToday"
  | "habit30";

interface KpiItem {
  metric: KpiMetric;
  icon: string;
  label: string;
}

interface StatKpiCfg {
  /** 单卡指标（单卡片模式） */
  metric?: KpiMetric;
  /** 单卡图标 */
  icon?: string;
  /** 单卡标签 */
  label?: string;
  /** 图标位置：left/right/top/bottom（解决自由组合布局） */
  emojiPos?: "left" | "right" | "top" | "bottom";
  /** 兼容旧配置：多卡 items，取第一张作为单卡显示 */
  items?: KpiItem[];
  titleFontSize?: number;
}

const DEFAULT_ACCENT = "#fbbf24";

const METRIC_LABELS: Record<KpiMetric, string> = {
  totalNotes: "全部笔记",
  kcCards: "KC 卡片",
  domains: "领域数",
  todayAdded: "今日新增",
  todayTasks: "今日任务",
  streak: "连续打卡",
  overdue: "逾期任务",
  openTasks: "未排期任务",
  quoteFavs: "已收藏金句",
  podcastToday: "今日收听",
  habit30: "30天打卡",
};

const DEFAULT_ICONS: Record<KpiMetric, string> = {
  totalNotes: "📝",
  kcCards: "🎴",
  domains: "🧭",
  todayAdded: "✨",
  todayTasks: "✅",
  streak: "🔥",
  overdue: "⚠️",
  openTasks: "🕘",
  quoteFavs: "💬",
  podcastToday: "🎧",
  habit30: "📅",
};

const DEFAULT_METRIC: KpiMetric = "totalNotes";

function readCfg(ctx: WidgetCtx): StatKpiCfg {
  const cfg = (ctx.widgetConfig || {}) as StatKpiCfg;
  // 兼容旧配置：items 第一张作为单卡显示；新配置直接读 metric/icon/label
  const legacy = Array.isArray(cfg.items) && cfg.items.length > 0 ? cfg.items[0] : undefined;
  return {
    metric: cfg.metric || legacy?.metric || DEFAULT_METRIC,
    icon: cfg.icon || legacy?.icon || DEFAULT_ICONS[cfg.metric || legacy?.metric || DEFAULT_METRIC],
    label: cfg.label || legacy?.label || METRIC_LABELS[cfg.metric || legacy?.metric || DEFAULT_METRIC],
    emojiPos: cfg.emojiPos || "left",
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
  };
}

/** 计算单个指标值 */
function computeMetric(ctx: WidgetCtx, metric: KpiMetric): string {
  const s = ctx.data.stats;
  const habits = buildHabitRecords(ctx.habitData());
  const t = ctx.data.tasks;
  switch (metric) {
    case "totalNotes":
      return String(s.totalNotes);
    case "kcCards":
      return String(s.kcCards);
    case "domains":
      return String(s.domains);
    case "todayAdded":
      return "+" + s.todayAdded;
    case "todayTasks":
      return `${s.todayTasksDone}/${s.todayTasksTotal}`;
    case "streak":
      return habits.length ? String(habits[0].streak) : "0";
    case "overdue":
      return String(t.overdue.length);
    case "openTasks":
      return String(t.open.length);
    case "quoteFavs":
      return String(ctx.sharedData.quoteFavs?.length || 0);
    case "podcastToday": {
      const stat = ctx.plugin.settings.podcastStat || {};
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return String(Object.keys(stat[key] || {}).length);
    }
    case "habit30": {
      const h = habits[0];
      const heat = lastNDays(h?.days || [], 30);
      return String(heat.filter(Boolean).length) + "/30";
    }
  }
}

const widget: WorkbenchWidget = {
  id: "stat-kpi",
  title: "数据统计",
  icon: "📊",
  accent: DEFAULT_ACCENT,
  category: "stats",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const titleFontSize = cfg.titleFontSize || 14;

    const bd = createPanel(root, {
      id: "stat-kpi",
      title: "数据统计",
      icon: "📊",
      accent: DEFAULT_ACCENT,
      moreLabel: "⚙️",
      cardStyle: String((ctx.widgetConfig || {}).cardStyle || ""),
      onMore: () => {
        new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
      },
    });

    // 标题栏字号（含图标 emoji 跟随）
    const panel = bd.closest(".wb-panel");
    if (panel) {
      const ico = panel.querySelector<HTMLElement>(".wb-ico");
      const titleEl = panel.querySelector<HTMLElement>(".wb-title");
      if (ico) {
        ico.style.fontSize = `${titleFontSize}px`;
        ico.style.width = `${titleFontSize + 8}px`;
        ico.style.height = `${titleFontSize + 8}px`;
      }
      if (titleEl) titleEl.style.fontSize = `${titleFontSize}px`;
    }

    // 单张大卡：一个 KPI 统计（Emoji + 数值 + 标签），按 emojiPos 切换左右/上下布局
    const posClass = cfg.emojiPos === "right" ? " r" : cfg.emojiPos === "top" ? " t" : cfg.emojiPos === "bottom" ? " b" : "";
    const card = bd.createDiv({ cls: "wb-kpi-single" + posClass });
    card.createDiv({ cls: "wb-ico", text: cfg.icon || DEFAULT_ICONS[cfg.metric || DEFAULT_METRIC] });
    const txt = card.createDiv({ cls: "wb-kpi-txt" });
    txt.createDiv({ cls: "wb-num", text: computeMetric(ctx, cfg.metric || DEFAULT_METRIC) });
    txt.createDiv({ cls: "wb-lbl", text: cfg.label || METRIC_LABELS[cfg.metric || DEFAULT_METRIC] });
    // 内容渲染完成后应用正文字号（KPI 数值/标签）
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as StatKpiCfg;

    const update = (patch: Partial<StatKpiCfg>) => {
      const current = (cfgMap[instanceId] || {}) as StatKpiCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    // 兼容旧配置：items 第一张作为初始单卡配置
    const legacy = Array.isArray(inst.items) && inst.items.length > 0 ? inst.items[0] : undefined;
    const curMetric = inst.metric || legacy?.metric || DEFAULT_METRIC;

    // ── 单卡 KPI 配置 ──
    el.createEl("h4", {
      text: "🎴 统计卡片",
      attr: { style: "margin:14px 0 6px;font-size:13px;font-weight:700;" },
    });
    el.createEl("p", {
      text: "单卡片 = 指标 + 图标 + 标签；可添加多个「数据统计」实例自由组合布局。",
      cls: "setting-item-description",
    });

    // 指标选择
    const metricSetting = new Setting(el).setName("统计指标");
    metricSetting.addDropdown((dd) => {
      (Object.keys(METRIC_LABELS) as KpiMetric[]).forEach((k) => {
        dd.addOption(k, METRIC_LABELS[k]);
      });
      dd.setValue(curMetric).onChange((v) => {
        const m = v as KpiMetric;
        update({ metric: m, icon: DEFAULT_ICONS[m], label: METRIC_LABELS[m] });
      });
    });

    // 图标
    new Setting(el)
      .setName("图标")
      .setDesc("卡片大图标 emoji")
      .addText((t) =>
        t
          .setPlaceholder("例如：📝")
          .setValue(String(inst.icon || legacy?.icon || DEFAULT_ICONS[curMetric]))
          .onChange((v) => update({ icon: v.trim() }))
      );

    // 标签
    new Setting(el)
      .setName("标签")
      .setDesc("数值下方的说明文字")
      .addText((t) =>
        t
          .setPlaceholder("例如：全部笔记")
          .setValue(String(inst.label || legacy?.label || METRIC_LABELS[curMetric]))
          .onChange((v) => update({ label: v.trim() }))
      );

    // 图标位置
    new Setting(el)
      .setName("图标位置")
      .setDesc("Emoji 相对文字的位置：左右并排 / 上下排列，方便自由组合布局")
      .addDropdown((dd) =>
        dd
          .addOption("left", "左侧（文字在右）")
          .addOption("right", "右侧（文字在左）")
          .addOption("top", "上方（文字在下）")
          .addOption("bottom", "下方（文字在上）")
          .setValue(inst.emojiPos || "left")
          .onChange((v) => update({ emojiPos: v as "left" | "right" | "top" | "bottom" }))
      );

    el.createEl("p", {
      text: "💡 提示：添加多个「数据统计」实例（+ 新建），各自配置不同指标/图标位置，即可自由组合 KPI 布局。",
      cls: "setting-item-description",
    });
  },
};

export default widget;

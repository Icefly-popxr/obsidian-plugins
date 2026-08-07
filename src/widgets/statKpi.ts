import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { addFontSizeControls, WidgetConfigDrawer } from "./helpers";
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

const DEFAULT_ITEMS: KpiItem[] = [
  { metric: "totalNotes", icon: "📝", label: "全部笔记" },
  { metric: "kcCards", icon: "🎴", label: "KC 卡片" },
  { metric: "domains", icon: "🧭", label: "领域" },
  { metric: "todayAdded", icon: "✨", label: "今日新增" },
  { metric: "todayTasks", icon: "✅", label: "今日任务" },
  { metric: "streak", icon: "🔥", label: "连续打卡" },
];

function readCfg(ctx: WidgetCtx): StatKpiCfg {
  const cfg = (ctx.widgetConfig || {}) as StatKpiCfg;
  return {
    items: Array.isArray(cfg.items) && cfg.items.length > 0 ? cfg.items : DEFAULT_ITEMS,
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

    // 标题栏字号（含图标 emoji 跟随）
    const titleFontSize = cfg.titleFontSize || 14;
    const items = cfg.items || DEFAULT_ITEMS;

    // 标题栏：左上角统计图标 + 右上角 ⚙️ 入口
    const head = root.createDiv({ cls: "wb-kpi-head" });
    const headLeft = head.createDiv({ cls: "wb-kpi-head-left" });
    const ico = headLeft.createDiv({ cls: "wb-ico", text: "📊" });
    const titleEl = headLeft.createSpan({ cls: "wb-title", text: "数据统计" });
    ico.style.fontSize = `${titleFontSize}px`;
    ico.style.width = `${titleFontSize + 8}px`;
    ico.style.height = `${titleFontSize + 8}px`;
    titleEl.style.fontSize = `${titleFontSize}px`;
    const gear = head.createDiv({ cls: "wb-more", text: "⚙️" });
    gear.addEventListener("click", () => {
      new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
    });

    items.slice(0, 9).forEach((it, i) => {
      const card = root.createDiv({ cls: "wb-kpi-card" });
      card.dataset.id = `stat-${i}`;
      card.createDiv({ cls: "wb-ico", text: it.icon || DEFAULT_ICONS[it.metric] });
      card.createDiv({ cls: "wb-num", text: computeMetric(ctx, it.metric) });
      card.createDiv({ cls: "wb-lbl", text: it.label || METRIC_LABELS[it.metric] });
    });
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

    // 标题字号
    const sizeSetting = new Setting(el).setName("字号").setDesc("标题与卡片文字大小（px）");
    addFontSizeControls(sizeSetting, {
      value:
        typeof inst.titleFontSize === "number" && inst.titleFontSize > 0 ? inst.titleFontSize : 14,
      onChange: (v) => update({ titleFontSize: v }),
    });

    // ── KPI 卡条目编辑器 ──
    el.createEl("h4", {
      text: "🎴 统计卡片",
      attr: { style: "margin:14px 0 6px;font-size:13px;font-weight:700;" },
    });
    el.createEl("p", {
      text: "每张卡片 = 指标 + 图标 + 标签，可增删；最多 9 张。",
      cls: "setting-item-description",
    });

    const items = Array.isArray(inst.items) && inst.items.length > 0
      ? inst.items.map((x) => ({ ...x }))
      : DEFAULT_ITEMS.map((x) => ({ ...x }));
    const listWrap = el.createDiv({ cls: "wb-list-editor" });

    const renderEditor = () => {
      listWrap.empty();
      items.forEach((it, i) => {
        const row = listWrap.createDiv({
          attr: { style: "display:flex;align-items:center;gap:6px;margin-bottom:6px;" },
        });
        // 指标选择
        const metricSel = row.createEl("select");
        (Object.keys(METRIC_LABELS) as KpiMetric[]).forEach((k) => {
          const opt = metricSel.createEl("option", { text: METRIC_LABELS[k] });
          opt.value = k;
        });
        metricSel.value = it.metric;
        metricSel.style.flex = "1";
        metricSel.style.padding = "4px 6px";
        metricSel.style.fontSize = "12px";
        metricSel.style.borderRadius = "6px";
        metricSel.style.border = "1px solid var(--background-modifier-border)";
        metricSel.addEventListener("change", () => {
          items[i].metric = metricSel.value as KpiMetric;
          items[i].icon = DEFAULT_ICONS[items[i].metric];
          iconInput.value = items[i].icon;
          update({ items: [...items] });
        });
        // 图标
        const iconInput = row.createEl("input");
        iconInput.value = it.icon || DEFAULT_ICONS[it.metric];
        iconInput.style.width = "40px";
        iconInput.style.padding = "4px 4px";
        iconInput.style.fontSize = "12px";
        iconInput.style.borderRadius = "6px";
        iconInput.style.border = "1px solid var(--background-modifier-border)";
        iconInput.addEventListener("input", () => {
          items[i].icon = iconInput.value.trim();
          update({ items: [...items] });
        });
        // 标签
        const labelInput = row.createEl("input");
        labelInput.value = it.label || METRIC_LABELS[it.metric];
        labelInput.style.width = "72px";
        labelInput.style.padding = "4px 6px";
        labelInput.style.fontSize = "12px";
        labelInput.style.borderRadius = "6px";
        labelInput.style.border = "1px solid var(--background-modifier-border)";
        labelInput.addEventListener("input", () => {
          items[i].label = labelInput.value.trim();
          update({ items: [...items] });
        });
        // 删除
        const del = row.createEl("button", { text: "🗑" });
        del.style.cursor = "pointer";
        del.style.fontSize = "12px";
        del.addEventListener("click", () => {
          items.splice(i, 1);
          update({ items: [...items] });
          renderEditor();
        });
      });
      // 添加卡片（最多 9 张）
      if (items.length < 9) {
        const addBtn = listWrap.createEl("button", {
          text: "➕ 添加卡片",
          attr: { style: "font-size:12px;padding:4px 12px;border-radius:6px;cursor:pointer;" },
        });
        addBtn.addEventListener("click", () => {
          const m: KpiMetric = "totalNotes";
          items.push({ metric: m, icon: DEFAULT_ICONS[m], label: METRIC_LABELS[m] });
          update({ items: [...items] });
          renderEditor();
        });
      }
    };
    renderEditor();
  },
};

export default widget;

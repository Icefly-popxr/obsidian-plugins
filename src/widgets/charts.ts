import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";
import { groupByDomain } from "../services/kcService";
import { buildHabitRecords, lastNDays } from "../services/habitService";

/**
 * 通用图表组件（配置驱动）
 *  - 图表类型：柱状 / 折线 / 饼图
 *  - 数据源：领域分布 / 卡片等级 / 打卡近30天 / 月度新增 / 今日任务
 *  - 配置：标题/图标/显示数值/显示图例，右上角 ⚙️ 打开右侧抽屉
 *  - 支持多实例（#N 后缀），每实例独立配置
 */

type ChartType = "bar" | "line" | "pie";
type ChartSource = "domains" | "levels" | "habits" | "monthly" | "tasks";

interface ChartCfg {
  chartType?: ChartType;
  dataSource?: ChartSource;
  title?: string;
  icon?: string;
  showValues?: boolean;
  showLegend?: boolean;
  titleFontSize?: number;
}

const DEFAULT_ACCENT = "#8b5cf6";

const SOURCE_LABELS: Record<ChartSource, string> = {
  domains: "领域卡片分布",
  levels: "卡片等级分布",
  habits: "打卡近30天",
  monthly: "月度新增趋势",
  tasks: "今日任务分布",
};

function readCfg(ctx: WidgetCtx): ChartCfg {
  const cfg = (ctx.widgetConfig || {}) as ChartCfg;
  return {
    chartType: cfg.chartType || "bar",
    dataSource: cfg.dataSource || "domains",
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "📈"),
    showValues: cfg.showValues !== false,
    showLegend: cfg.showLegend !== false,
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
  };
}

/** 按数据源计算 [label, value][] */
function computeData(ctx: WidgetCtx, source: ChartSource): [string, number][] {
  switch (source) {
    case "domains": {
      const m = groupByDomain(ctx.data.kcCards);
      return [...m.entries()].map(([k, v]) => [k, v.length] as [string, number]);
    }
    case "levels": {
      const lv = [0, 0, 0];
      ctx.data.kcCards.forEach((c) => {
        if (c.level === "L1") lv[0]++;
        else if (c.level === "L2") lv[1]++;
        else lv[2]++;
      });
      return [
        ["L1", lv[0]],
        ["L2", lv[1]],
        ["L3", lv[2]],
      ];
    }
    case "habits": {
      const h = buildHabitRecords(ctx.habitData())[0];
      const heat = lastNDays(h?.days || [], 30);
      const done = heat.filter(Boolean).length;
      return [
        ["打卡", done],
        ["未打卡", 30 - done],
      ];
    }
    case "monthly": {
      // 最近 6 个月 KC 卡片新增（按 mtime）
      const counts = new Map<string, number>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        counts.set(`${d.getFullYear()}-${d.getMonth() + 1}`, 0);
      }
      ctx.data.kcCards.forEach((c) => {
        const d = new Date(c.mtime);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      });
      return [...counts.entries()].map(([k, v]) => [`${k.split("-")[1]}月`, v]);
    }
    case "tasks": {
      const t = ctx.data.tasks;
      return [
        ["已完成", t.doneToday],
        ["今日待办", t.today.length],
        ["逾期", t.overdue.length],
        ["未排期", t.open.length],
      ];
    }
  }
}

const COLORS = ["#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#e11d2e", "#22d3ee"];

/** 在容器内绘制图表（柱状/折线/饼图共用 canvas），labelFontSize 为正文标签字号 */
function drawChart(
  container: HTMLElement,
  type: ChartType,
  data: [string, number][],
  showValues: boolean,
  showLegend: boolean,
  labelFontSize: number
) {
  if (data.length === 0) return;
  // 布局随正文字号自适应：字号越大，画布越高、留白越大，避免字体重叠/截断
  const w = 300;
  const h = Math.max(140, 90 + labelFontSize * 4);
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.style.maxWidth = "100%";
  container.appendChild(canvas);
  const g = canvas.getContext("2d");
  if (!g) return;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const fs = `${labelFontSize}px sans-serif`;
  const fsSmall = `${Math.max(8, labelFontSize - 1)}px sans-serif`;
  // 行距/偏移随字号
  const lineGap = Math.max(15, labelFontSize + 6);

  const max = Math.max(...data.map(([, v]) => v), 1);

  // ── 饼图 ──
  if (type === "pie") {
    const total = data.reduce((a, [, v]) => a + v, 0);
    if (total <= 0) return;
    // 有图例时饼图右移并增大半径，缩小饼图与图例之间的留白
    const cx = showLegend ? 125 : w / 2;
    const cy = h / 2;
    const r = Math.min(cx - 16, cy - 12, 62);
    let start = -Math.PI / 2;
    data.forEach(([, v], i) => {
      if (v <= 0) return;
      const ang = (v / total) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, r, start, start + ang);
      g.closePath();
      g.fillStyle = COLORS[i % COLORS.length];
      g.fill();
      if (showValues) {
        const mid = start + ang / 2;
        g.fillStyle = "#fff";
        g.font = fs;
        g.textAlign = "center";
        // 数值更靠近圆心，缩小文字与图形边缘的留白
        g.fillText(String(v), cx + Math.cos(mid) * r * 0.45, cy + Math.sin(mid) * r * 0.45 + 3);
      }
      start += ang;
    });
    if (showLegend) {
      let ly = 18;
      // 图例文字可用宽度：起点 w-54，画布右缘留 2px 边距
      const legendX = w - 54;
      const availW = w - legendX - 2;
      data.forEach(([label, v], i) => {
        g.fillStyle = COLORS[i % COLORS.length];
        g.fillRect(w - 66, ly - 8, 8, 8);
        g.fillStyle = "#8d9ab0";
        g.font = fs;
        g.textAlign = "left";
        // 按实际可用宽度动态截断：measureText 逐字缩短到适配，避免末字被裁剪
        const full = `${label} ${v}`;
        let shown = full;
        if (g.measureText(full).width > availW) {
          let cut = full;
          while (cut.length > 0 && g.measureText(cut + "…").width > availW) {
            cut = cut.slice(0, -1);
          }
          shown = cut + "…";
        }
        g.fillText(shown, legendX, ly);
        ly += lineGap;
      });
    }
    return;
  }

  // ── 柱状 / 折线共用坐标系 ──
  const padL = Math.max(32, labelFontSize + 20);
  const padT = Math.max(12, labelFontSize + 2);
  const plotW = w - padL - 8;
  const bw = plotW / data.length;
  // 每个柱宽可容纳的字符数（汉字≈字号宽），据此把标签拆成多行，避免一行平铺重叠
  const charsPerLine = Math.max(1, Math.floor((bw - 4) / Math.max(7, labelFontSize)));
  const maxLabelLines = data.reduce(
    (m, [label]) => Math.max(m, Math.ceil(String(label).length / charsPerLine)),
    1
  );
  const padB = Math.max(20, labelFontSize + 8 + (maxLabelLines - 1) * lineGap);
  const plotH = h - padT - padB;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = Math.round((max / ticks) * i);
    const y = padT + plotH - (i / ticks) * plotH;
    g.strokeStyle = "rgba(125,139,161,.15)";
    g.beginPath();
    g.moveTo(padL, y);
    g.lineTo(w, y);
    g.stroke();
    g.fillStyle = "#7d8ba1";
    g.font = fsSmall;
    g.textAlign = "right";
    g.fillText(String(v), padL - 4, y + 3);
  }

  /** 把标签按每行字数拆成多行（居中分行显示） */
  const wrapLabel = (text: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += charsPerLine) {
      out.push(text.slice(i, i + charsPerLine));
    }
    return out.length ? out : [""];
  };

  if (type === "bar") {
    data.forEach(([label, v], i) => {
      const hgt = Math.max(2, (v / max) * plotH);
      const x = padL + i * bw + bw * 0.15;
      const y = padT + plotH - hgt;
      const grad = g.createLinearGradient(0, y, 0, padT + plotH);
      grad.addColorStop(0, COLORS[i % COLORS.length]);
      grad.addColorStop(1, COLORS[i % COLORS.length] + "88");
      g.fillStyle = grad;
      g.fillRect(x, y, bw * 0.7, hgt);
      if (showValues) {
        g.fillStyle = "#c3cbd8";
        g.font = fsSmall;
        g.textAlign = "center";
        g.fillText(String(v), x + bw * 0.35, y - 2);
      }
      g.fillStyle = "#8d9ab0";
      g.font = fsSmall;
      g.textAlign = "center";
      // 标签分行绘制：每行 charsPerLine 字，垂直居中于柱宽
      const lines = wrapLabel(String(label));
      lines.forEach((ln, li) => {
        g.fillText(ln, padL + i * bw + bw / 2, padT + plotH + labelFontSize + 4 + li * lineGap);
      });
    });
  } else {
    // 折线
    g.strokeStyle = "#8b5cf6";
    g.lineWidth = 2;
    g.beginPath();
    data.forEach(([, v], i) => {
      const x = padL + i * bw + bw / 2;
      const y = padT + plotH - (v / max) * plotH;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
    data.forEach(([label, v], i) => {
      const x = padL + i * bw + bw / 2;
      const y = padT + plotH - (v / max) * plotH;
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fillStyle = "#8b5cf6";
      g.fill();
      if (showValues) {
        g.fillStyle = "#c3cbd8";
        g.font = fsSmall;
        g.textAlign = "center";
        g.fillText(String(v), x, y - 6);
      }
      g.fillStyle = "#8d9ab0";
      g.font = fsSmall;
      g.textAlign = "center";
      // 标签分行绘制
      const lines = wrapLabel(String(label));
      lines.forEach((ln, li) => {
        g.fillText(ln, x, padT + plotH + labelFontSize + 4 + li * lineGap);
      });
    });
  }
}

const widget: WorkbenchWidget = {
  id: "charts",
  title: "图表统计",
  icon: "📈",
  accent: DEFAULT_ACCENT,
  category: "stats",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);

    const bd = createPanel(root, {
      id: "charts",
      title: cfg.title || SOURCE_LABELS[cfg.dataSource || "domains"],
      icon: cfg.icon || "📈",
      accent: DEFAULT_ACCENT,
      moreLabel: "⚙️",
      cardStyle: String((ctx.widgetConfig || {}).cardStyle || ""),
      onMore: () => {
        new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
      },
    });

    // 标题栏字号（含图标 emoji 跟随）
    const titleFontSize = cfg.titleFontSize || 14;
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

    const data = computeData(ctx, cfg.dataSource || "domains");
    if (data.length === 0 || data.every(([, v]) => v === 0)) {
      emptyState(bd, "暂无数据");
      return;
    }

    const chartBox = bd.createDiv({ cls: "wb-chart-box" });
    drawChart(chartBox, cfg.chartType || "bar", data, cfg.showValues !== false, cfg.showLegend !== false, bodyFontSizeOf(ctx.widgetConfig));
    // 内容渲染完成后应用正文字号
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as ChartCfg;

    const update = (patch: Partial<ChartCfg>) => {
      const current = (cfgMap[instanceId] || {}) as ChartCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    new Setting(el)
      .setName("图表类型")
      .addDropdown((dd) =>
        dd
          .addOption("bar", "📊 柱状图")
          .addOption("line", "📈 折线图")
          .addOption("pie", "🥧 饼图")
          .setValue(inst.chartType || "bar")
          .onChange((v) => update({ chartType: v as ChartType }))
      );

    new Setting(el)
      .setName("数据源")
      .addDropdown((dd) => {
        (Object.keys(SOURCE_LABELS) as ChartSource[]).forEach((k) =>
          dd.addOption(k, SOURCE_LABELS[k])
        );
        dd.setValue(inst.dataSource || "domains").onChange((v) =>
          update({ dataSource: v as ChartSource })
        );
        return dd;
      });

    // 标题：输入框独占一行（拉长），字号控件放下一行
    const titleSetting = new Setting(el).setName("标题").setDesc("卡片标题（留空 = 数据源名）");
    titleSetting.addText((t) => {
      t
        .setPlaceholder("例如：我的知识地图")
        .setValue(String(inst.title || ""))
        .onChange((v) => update({ title: v.trim() }));
      t.inputEl.style.width = "100%";
      t.inputEl.style.boxSizing = "border-box";
      t.inputEl.style.minWidth = "200px";
    });

    new Setting(el)
      .setName("图标")
      .setDesc("标题栏 emoji 图标")
      .addText((t) =>
        t
          .setPlaceholder("例如：📈")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );

    new Setting(el)
      .setName("显示数值")
      .addToggle((tg) => tg.setValue(inst.showValues !== false).onChange((v) => update({ showValues: v })));

    new Setting(el)
      .setName("显示图例")
      .addToggle((tg) => tg.setValue(inst.showLegend !== false).onChange((v) => update({ showLegend: v })));
  },
};

export default widget;

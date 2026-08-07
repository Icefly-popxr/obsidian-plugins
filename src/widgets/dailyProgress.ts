import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";
import { buildHabitRecords, lastNDays } from "../services/habitService";

/**
 * 通用进度组件（配置驱动，替代写死的今日进度）
 *  - 进度来源：今日任务 / 项目进度 / 自定义目标 / 打卡连续率
 *  - 大数字 + 进度条 + 可选统计格，右上角 ⚙️ 打开右侧抽屉
 *  - 支持多实例（#N 后缀），每实例独立配置
 */

type ProgressSource = "tasks" | "project" | "custom" | "habit";

interface ProgressCfg {
  source?: ProgressSource;
  title?: string;
  icon?: string;
  showStats?: boolean;
  titleFontSize?: number;
  /** 自定义目标：当前值 / 目标值 / 单位 */
  customValue?: number;
  customTarget?: number;
  customUnit?: string;
}

const DEFAULT_ACCENT = "#22c55e";

const SOURCE_LABELS: Record<ProgressSource, string> = {
  tasks: "今日任务",
  project: "项目进度",
  custom: "自定义目标",
  habit: "打卡连续率",
};

function readCfg(ctx: WidgetCtx): ProgressCfg {
  const cfg = (ctx.widgetConfig || {}) as ProgressCfg;
  return {
    source: cfg.source || "tasks",
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "📊"),
    showStats: cfg.showStats !== false,
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
    customValue: typeof cfg.customValue === "number" ? cfg.customValue : 0,
    customTarget: typeof cfg.customTarget === "number" && cfg.customTarget > 0 ? cfg.customTarget : 0,
    customUnit: String(cfg.customUnit || ""),
  };
}

/** 计算 {big, pct, stats?: [num, label][]} */
function compute(ctx: WidgetCtx, cfg: ProgressCfg): { big: string; pct: number; stats: [string, string][] } {
  const tasks = ctx.data.tasks;
  const source = cfg.source || "tasks";

  switch (source) {
    case "tasks": {
      const done = tasks.doneToday;
      const total = tasks.total || 0;
      const tplDone = done;
      const tplTotal = tasks.today.length + done;
      const pct = tplTotal > 0 ? Math.round((tplDone / tplTotal) * 100) : 0;
      return {
        big: `${done} / ${total}`,
        pct,
        stats: [
          [String(pct) + "%", "今日完成率"],
          [String(done), "已完成"],
          [String(tasks.overdue.length), "逾期"],
          [String(tasks.open.length), "未排期"],
        ],
      };
    }
    case "project": {
      const p = ctx.data.projects[0];
      if (!p) return { big: "0%", pct: 0, stats: [["0", "项目数"]] };
      return {
        big: `${p.progress}%`,
        pct: p.progress,
        stats: [
          [String(p.progress) + "%", "进度"],
          [p.name || "项目", "当前项目"],
          [p.nextStep || "—", "下一步"],
        ],
      };
    }
    case "custom": {
      const target = cfg.customTarget || 0;
      const value = cfg.customValue || 0;
      const unit = cfg.customUnit || "";
      const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
      return {
        big: `${value}${unit ? " " + unit : ""} / ${target}${unit ? " " + unit : ""}`,
        pct,
        stats: [
          [String(pct) + "%", "完成率"],
          [String(value) + (unit || ""), "当前"],
          [String(target) + (unit || ""), "目标"],
        ],
      };
    }
    case "habit": {
      const h = buildHabitRecords(ctx.habitData())[0];
      const heat = lastNDays(h?.days || [], 30);
      const done = heat.filter(Boolean).length;
      const pct = Math.round((done / 30) * 100);
      return {
        big: `${done} / 30 天`,
        pct,
        stats: [
          [String(pct) + "%", "完成率"],
          [String(done), "打卡天数"],
          [String(h?.streak || 0), "连续天数"],
          [h?.name || "—", "习惯"],
        ],
      };
    }
  }
}

const widget: WorkbenchWidget = {
  id: "daily-progress",
  title: "进度统计",
  icon: "📊",
  accent: DEFAULT_ACCENT,
  category: "stats",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const source = cfg.source || "tasks";

    const bd = createPanel(root, {
      id: "daily-progress",
      title: cfg.title || SOURCE_LABELS[source],
      icon: cfg.icon || "📊",
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

    const { big, pct, stats } = compute(ctx, cfg);

    if (source === "tasks" && (ctx.data.tasks.total || 0) === 0) {
      emptyState(bd, "今日暂无任务 🎉");
      return;
    }

    bd.createDiv({ cls: "dash-big", text: big });
    const bar = bd.createDiv({ cls: "dash-bar bar-split" });
    const fill = bar.createEl("i", { cls: "bar-tpl" });
    fill.style.width = `${Math.min(100, pct)}%`;
    fill.createSpan({ cls: "bar-pct", text: `${pct}%` });

    if (cfg.showStats !== false) {
      const statRow = bd.createDiv({ cls: "dash-stat-grid" });
      const mkStat = (num: string, label: string) => {
        const c = statRow.createDiv({ cls: "dash-stat-cell" });
        c.createDiv({ cls: "dash-stat-num", text: num });
        c.createDiv({ cls: "dash-stat-label", text: label });
      };
      stats.forEach(([num, label]) => mkStat(num, label));
    }
    // 内容渲染完成后应用正文字号（bar-pct / 统计数字标签等）
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as ProgressCfg;

    const update = (patch: Partial<ProgressCfg>) => {
      const current = (cfgMap[instanceId] || {}) as ProgressCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    new Setting(el)
      .setName("进度来源")
      .addDropdown((dd) => {
        (Object.keys(SOURCE_LABELS) as ProgressSource[]).forEach((k) =>
          dd.addOption(k, SOURCE_LABELS[k])
        );
        dd.setValue(inst.source || "tasks").onChange((v) => {
          update({ source: v as ProgressSource });
          renderCustom(); // 切换来源时同步刷新自定义目标区块
        });
        return dd;
      });

    // 标题：输入框独占一行（拉长），字号控件放下一行
    const titleSetting = new Setting(el).setName("标题").setDesc("卡片标题（留空 = 来源名）");
    titleSetting.addText((t) => {
      t
        .setPlaceholder("例如：读书进度")
        .setValue(String(inst.title || ""))
        .onChange((v) => update({ title: v.trim() }));
      t.inputEl.style.width = "100%";
      t.inputEl.style.boxSizing = "border-box";
      t.inputEl.style.minWidth = "200px";
    });
    const titleSizeSetting = new Setting(el)
      .setName("标题字号")
      .setDesc("标题文字与图标 emoji 大小（px）");
    addFontSizeControls(titleSizeSetting, {
      value:
        typeof inst.titleFontSize === "number" && inst.titleFontSize > 0 ? inst.titleFontSize : 14,
      onChange: (v) => update({ titleFontSize: v }),
    });

    new Setting(el)
      .setName("图标")
      .setDesc("标题栏 emoji 图标")
      .addText((t) =>
        t
          .setPlaceholder("例如：📊")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );

    new Setting(el)
      .setName("显示统计格")
      .addToggle((tg) => tg.setValue(inst.showStats !== false).onChange((v) => update({ showStats: v })));

    // 自定义目标：仅当来源 = custom 时显示
    const customSection = el.createDiv();
    const renderCustom = () => {
      customSection.empty();
      if ((inst.source || "tasks") !== "custom") return;
      const mkNum = (label: string, value: number, key: "customValue" | "customTarget") => {
        new Setting(customSection)
          .setName(label)
          .addText((t) =>
            t
              .setPlaceholder("0")
              .setValue(String(value || ""))
              .onChange((v) => {
                const n = parseFloat(v);
                update({ [key]: isNaN(n) ? 0 : n } as Partial<ProgressCfg>);
              })
          );
      };
      mkNum("当前值", inst.customValue ?? 0, "customValue");
      mkNum("目标值", inst.customTarget ?? 0, "customTarget");
      new Setting(customSection)
        .setName("单位")
        .addText((t) =>
          t
            .setPlaceholder("例如：本 / 篇 / 次")
            .setValue(inst.customUnit || "")
            .onChange((v) => update({ customUnit: v.trim() }))
        );
    };
    renderCustom();
    // 来源变化时同步渲染自定义区块
    customSection.setAttribute("data-role", "custom");
  },
};

export default widget;

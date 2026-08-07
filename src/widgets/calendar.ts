import { App, Modal, Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";

/**
 * 通用日历组件（分类通用组件第三类）
 *  - 配置：标题 / 图标 / 周起始（周日或周一）
 *  - 标题字号在「标题」行内调整，日期字号独立配置
 *  - 日期标记：点击日历上的日期弹窗输入标记文字（emoji/备注），存 widgetConfigs[instId].marks
 *  - 今天高亮描边，有标记的日期显示角标
 *  - 支持多实例（#N 后缀），每实例独立标记
 */

interface CalendarCfg {
  title?: string;
  icon?: string;
  weekStart?: "sunday" | "monday";
  /** 标题栏字号（含图标 emoji 跟随） */
  titleFontSize?: number;
  /** 日期格文字字号 */
  cellFontSize?: number;
  /** YYYY-MM-DD -> 标记文字 */
  marks?: Record<string, string>;
}

const DEFAULT_ACCENT = "#38bdf8";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readCfg(ctx: WidgetCtx): CalendarCfg {
  const cfg = (ctx.widgetConfig || {}) as CalendarCfg;
  return {
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "📅"),
    weekStart: cfg.weekStart || "sunday",
    marks: cfg.marks || {},
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
    cellFontSize:
      typeof cfg.cellFontSize === "number" && cfg.cellFontSize > 0 ? cfg.cellFontSize : 12,
  };
}

/** 日期标记编辑弹窗 */
class CalendarMarkModal extends Modal {
  private dateStr: string;
  private initial: string;
  private onSubmit: (mark: string | null) => void;

  constructor(app: App, dateStr: string, initial: string, onSubmit: (mark: string | null) => void) {
    super(app);
    this.dateStr = dateStr;
    this.initial = initial;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: `📅 ${this.dateStr}` });

    const input = contentEl.createEl("input", {
      attr: { value: this.initial, placeholder: "输入标记（如：🎂 生日 / 交稿日）" },
    });
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.padding = "8px 10px";
    input.style.marginBottom = "12px";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid var(--background-modifier-border)";
    input.style.fontSize = "14px";

    const btnRow = contentEl.createDiv({
      attr: { style: "display:flex;gap:8px;justify-content:flex-end;" },
    });
    const save = btnRow.createEl("button", {
      cls: "wb-add-btn",
      text: "保存",
      attr: { style: "padding:5px 16px;border-radius:8px;" },
    });
    save.addEventListener("click", () => {
      const v = input.value.trim();
      this.onSubmit(v || null);
      this.close();
    });
    if (this.initial) {
      const clear = btnRow.createEl("button", {
        text: "清除标记",
        attr: {
          style:
            "font-size:12px;padding:5px 12px;border-radius:8px;cursor:pointer;background:var(--background-modifier-form-field);color:#f87171;border:1px solid var(--background-modifier-border);",
        },
      });
      clear.addEventListener("click", () => {
        this.onSubmit(null);
        this.close();
      });
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save.click();
    });
    input.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

const widget: WorkbenchWidget = {
  id: "calendar",
  title: "日历",
  icon: "📅",
  accent: DEFAULT_ACCENT,
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);

    const bd = createPanel(root, {
      id: "calendar",
      title: cfg.title || "日历",
      icon: cfg.icon || "📅",
      accent: DEFAULT_ACCENT,
      moreLabel: "⚙️",
      cardStyle: String((ctx.widgetConfig || {}).cardStyle || ""),
      onMore: () => {
        new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
      },
    });

    const marks = cfg.marks || {};
    const weekStart = cfg.weekStart || "sunday";
    const today = new Date();
    const todayKeyStr = dateKey(today);
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth(); // 0-11

    // 标题栏字号：应用到标题文字 + 图标 emoji（跟随自适应）
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
    // 日期格文字字号
    const cellFontSize = cfg.cellFontSize || 12;

    // 保存 marks
    const saveMarks = (next: Record<string, string>) => {
      const map = ctx.plugin.settings.widgetConfigs || {};
      map[ctx.instanceId] = { ...(map[ctx.instanceId] || {}), marks: next };
      ctx.plugin.settings.widgetConfigs = map;
      ctx.plugin.saveSettings();
      ctx.plugin.app.workspace.getLeavesOfType("knowledge-workbench-view").forEach((leaf) => {
        const v = leaf.view as { reload?: () => void };
        if (typeof v.reload === "function") v.reload();
      });
    };

    const renderGrid = () => {
      const grid = bd.querySelector<HTMLElement>(".wb-cal-grid");
      if (!grid) return;
      grid.empty();

      // 星期表头
      const weekLabels =
        weekStart === "monday"
          ? ["一", "二", "三", "四", "五", "六", "日"]
          : ["日", "一", "二", "三", "四", "五", "六"];
      weekLabels.forEach((l) => {
        const h = grid.createDiv({ cls: "wb-cal-dow", text: l });
        void h;
      });

      // 当月第一天 / 天数
      const first = new Date(viewYear, viewMonth, 1);
      let lead = first.getDay(); // 0=周日
      if (weekStart === "monday") lead = (lead + 6) % 7;
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

      // 前导空白
      for (let i = 0; i < lead; i++) {
        grid.createDiv({ cls: "wb-cal-cell empty" });
      }
      // 日期格
      for (let d = 1; d <= daysInMonth; d++) {
        const key = dateKey(new Date(viewYear, viewMonth, d));
        const cell = grid.createDiv({
          cls:
            "wb-cal-cell" +
            (key === todayKeyStr ? " today" : "") +
            (marks[key] ? " marked" : ""),
          text: String(d),
          attr: { title: marks[key] ? marks[key] : "点击添加标记" },
        });
        cell.style.fontSize = `${cellFontSize}px`;
        if (marks[key]) {
          const badge = cell.createDiv({ cls: "wb-cal-badge", text: marks[key].slice(0, 3) });
          void badge;
        }
        cell.addEventListener("click", () => {
          new CalendarMarkModal(ctx.app, key, marks[key] || "", (mark) => {
            const next = { ...marks };
            if (mark === null) delete next[key];
            else next[key] = mark;
            saveMarks(next);
          }).open();
        });
      }
      // 内容渲染完成后应用正文字号（星期表头/日期/标记）
      applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
    };

    // 标题行：上/下月切换 + 年月
    const nav = bd.createDiv({ cls: "wb-cal-nav" });
    const prev = nav.createEl("button", { text: "‹" });
    prev.addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      refresh();
    });
    const label = nav.createSpan({ cls: "wb-cal-label" });
    const next = nav.createEl("button", { text: "›" });
    next.addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      refresh();
    });

    const refresh = () => {
      label.setText(`${viewYear} 年 ${viewMonth + 1} 月`);
      renderGrid();
    };

    bd.createDiv({ cls: "wb-cal-grid" });
    refresh();
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as CalendarCfg;

    const update = (patch: Partial<CalendarCfg>) => {
      const current = (cfgMap[instanceId] || {}) as CalendarCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    // 标题：输入框独占一行（拉长），字号控件放下一行
    const titleSetting = new Setting(el)
      .setName("标题")
      .setDesc("卡片标题栏文字（留空显示「日历」）");
    titleSetting.addText((t) => {
      t
        .setPlaceholder("例如：重要日期")
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
          .setPlaceholder("例如：📅")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );

    new Setting(el)
      .setName("周起始")
      .addDropdown((dd) =>
        dd
          .addOption("sunday", "周日")
          .addOption("monday", "周一")
          .setValue(inst.weekStart || "sunday")
          .onChange((v) => update({ weekStart: v as CalendarCfg["weekStart"] }))
      );

    // 日期字号（日历格专属，正文统一字号见「🔤 字号」分区）
    const cellSizeSetting = new Setting(el)
      .setName("日期字号")
      .setDesc("日历日期格文字大小（px）");
    addFontSizeControls(cellSizeSetting, {
      value:
        typeof inst.cellFontSize === "number" && inst.cellFontSize > 0 ? inst.cellFontSize : 12,
      onChange: (v) => update({ cellFontSize: v }),
    });

    el.createEl("p", {
      text: "💡 点击日历上的日期即可添加/清除标记（如 🎂 生日、📝 交稿日）。标记跟随本实例独立保存。",
      cls: "setting-item-description",
    });
  },
};

export default widget;

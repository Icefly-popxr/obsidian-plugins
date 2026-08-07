import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";

/**
 * 采集汇总组件（配置驱动）
 *  - 配置：显示行数 / 标题 / 图标 / 标题字号
 *  - 右上角 ⚙️ 打开右侧抽屉配置
 */

interface ClippingsCfg {
  maxRows?: number;
  title?: string;
  icon?: string;
  titleFontSize?: number;
}

const DEFAULT_ACCENT = "#f472b6";

function readCfg(ctx: WidgetCtx): ClippingsCfg {
  const cfg = (ctx.widgetConfig || {}) as ClippingsCfg;
  return {
    maxRows: typeof cfg.maxRows === "number" && cfg.maxRows > 0 ? cfg.maxRows : 3,
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "📚"),
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
  };
}

const widget: WorkbenchWidget = {
  id: "clippings",
  title: "采集汇总",
  icon: "📚",
  accent: DEFAULT_ACCENT,
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const maxRows = cfg.maxRows || 3;

    const bd = createPanel(root, {
      id: "clippings",
      title: cfg.title || "采集汇总",
      icon: cfg.icon || "📚",
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
    const rows: [string, number][] = [
      ["网页剪藏", ctx.data.clippings.length],
      ["待学素材", ctx.data.inbox.length],
      ["全部资源", ctx.data.stats.totalNotes],
    ];
    const shown = rows.slice(0, maxRows);
    if (shown.length === 0) {
      emptyState(bd, "暂无采集数据");
      return;
    }
    for (const [name, n] of shown) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createSpan({ cls: "wb-name", text: name });
      row.createSpan({ cls: "wb-meta", text: String(n) });
    }
    // 内容渲染完成后应用正文字号（此时 .wb-name/.wb-meta 元素已存在）
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as ClippingsCfg;

    const update = (patch: Partial<ClippingsCfg>) => {
      const current = (cfgMap[instanceId] || {}) as ClippingsCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    new Setting(el)
      .setName("显示行数")
      .setDesc("汇总行最多显示多少行（默认 3）")
      .addText((t) =>
        t
          .setPlaceholder("3")
          .setValue(String(inst.maxRows ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            update({ maxRows: isNaN(n) || n <= 0 ? 3 : n });
          })
      );

    // 标题：输入框独占一行（拉长），字号控件放下一行
    const titleSetting = new Setting(el).setName("标题").setDesc("卡片标题（留空显示「采集汇总」）");
    titleSetting.addText((t) => {
      t
        .setPlaceholder("例如：素材统计")
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
          .setPlaceholder("例如：📚")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );
  },
};

export default widget;

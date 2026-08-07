import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";

/**
 * 灵感 Inbox 组件（配置驱动）
 *  - 配置：显示条数 / 标题 / 图标 / 标题字号
 *  - 右上角 ⚙️ 打开右侧抽屉配置
 */

interface InboxCfg {
  maxItems?: number;
  title?: string;
  icon?: string;
  titleFontSize?: number;
}

const DEFAULT_ACCENT = "#22d3ee";

function readCfg(ctx: WidgetCtx): InboxCfg {
  const cfg = (ctx.widgetConfig || {}) as InboxCfg;
  return {
    maxItems: typeof cfg.maxItems === "number" && cfg.maxItems > 0 ? cfg.maxItems : 4,
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "📥"),
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
  };
}

const widget: WorkbenchWidget = {
  id: "inbox",
  title: "灵感 Inbox",
  icon: "📥",
  accent: DEFAULT_ACCENT,
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const maxItems = cfg.maxItems || 4;

    const bd = createPanel(root, {
      id: "inbox",
      title: cfg.title || "灵感 Inbox",
      icon: cfg.icon || "📥",
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
    const files = ctx.data.inbox.slice(0, maxItems);
    if (files.length === 0) {
      emptyState(bd, "收件箱空空如也 ⛵");
      return;
    }
    for (const f of files) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createDiv({ cls: "wb-dot" }).style.background = "#22d3ee";
      row.createSpan({ cls: "wb-name", text: f.basename });
      row.addEventListener("click", () => ctx.openFile(f.path));
    }
    // 内容渲染完成后应用正文字号（此时 .wb-name 元素已存在）
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as InboxCfg;

    const update = (patch: Partial<InboxCfg>) => {
      const current = (cfgMap[instanceId] || {}) as InboxCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    new Setting(el)
      .setName("显示条数")
      .setDesc("灵感最多显示多少条（默认 4）")
      .addText((t) =>
        t
          .setPlaceholder("4")
          .setValue(String(inst.maxItems ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            update({ maxItems: isNaN(n) || n <= 0 ? 4 : n });
          })
      );

    // 标题：输入框独占一行（拉长），字号控件放下一行
    const titleSetting = new Setting(el).setName("标题").setDesc("卡片标题（留空显示「灵感 Inbox」）");
    titleSetting.addText((t) => {
      t
        .setPlaceholder("例如：待处理灵感")
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
          .setPlaceholder("例如：📥")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );
  },
};

export default widget;

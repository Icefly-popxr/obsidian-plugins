import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addFontSizeControls, WidgetConfigDrawer, applyBodyFontSize, bodyFontSizeOf } from "./helpers";

/**
 * 最近更新组件（配置驱动）
 *  - 配置：显示条数 / 标题 / 图标 / 标题字号
 *  - 右上角 ⚙️ 打开右侧抽屉配置
 */

interface RecentFilesCfg {
  maxItems?: number;
  title?: string;
  icon?: string;
  titleFontSize?: number;
}

const DEFAULT_ACCENT = "#38bdf8";

function readCfg(ctx: WidgetCtx): RecentFilesCfg {
  const cfg = (ctx.widgetConfig || {}) as RecentFilesCfg;
  return {
    maxItems: typeof cfg.maxItems === "number" && cfg.maxItems > 0 ? cfg.maxItems : 8,
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "🕒"),
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
  };
}

const widget: WorkbenchWidget = {
  id: "recent-files",
  title: "最近更新",
  icon: "🕒",
  accent: DEFAULT_ACCENT,
  category: "files",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const maxItems = cfg.maxItems || 8;

    const bd = createPanel(root, {
      id: "recent-files",
      title: cfg.title || "最近更新",
      icon: cfg.icon || "🕒",
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

    const recent = ctx.data.recent.slice(0, maxItems);
    if (recent.length === 0) {
      emptyState(bd, "暂无更新");
      return;
    }
    for (const f of recent) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createDiv({ cls: "wb-dot" }).style.background = "var(--wb-blue)";
      row.createSpan({ cls: "wb-name", text: f.name });
      row.createSpan({ cls: "wb-meta", text: ctx.fmtDate(f.mtime) });
      row.addEventListener("click", () => ctx.openFile(f.path));
    }
    // 内容渲染完成后应用正文字号（此时 .wb-name/.wb-meta 元素已存在）
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as RecentFilesCfg;

    const update = (patch: Partial<RecentFilesCfg>) => {
      const current = (cfgMap[instanceId] || {}) as RecentFilesCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    new Setting(el)
      .setName("显示条数")
      .setDesc("最近更新最多显示多少条（默认 8）")
      .addText((t) =>
        t
          .setPlaceholder("8")
          .setValue(String(inst.maxItems ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            update({ maxItems: isNaN(n) || n <= 0 ? 8 : n });
          })
      );

    // 标题：输入框独占一行（拉长），字号控件放下一行
    const titleSetting = new Setting(el).setName("标题").setDesc("卡片标题（留空显示「最近更新」）");
    titleSetting.addText((t) => {
      t
        .setPlaceholder("例如：最近动态")
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
          .setPlaceholder("例如：🕒")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );
  },
};

export default widget;

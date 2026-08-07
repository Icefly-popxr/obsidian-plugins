import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { emptyState, WidgetConfigDrawer, applyTitleFontSize, addTitleConfig } from "./helpers";

/** KC 卡片库：最近卡片列表 */
const widget: WorkbenchWidget = {
  id: "kc-library",
  title: "KC 卡片库",
  icon: "🎴",
  accent: "#a78bfa",
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = (ctx.widgetConfig || {}) as { maxItems?: number; title?: string; icon?: string; titleFontSize?: number };
    const maxItems = Number(cfg.maxItems) || 5;
    const titleFontSize =
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14;
    const p = root.createDiv({ cls: "wb-panel wb-w kc-library" });
    p.dataset.id = "kc-library";
    p.style.setProperty("--w-accent", "#a78bfa");

    const hd = p.createDiv({ cls: "wb-hd" });
    const ico = hd.createDiv({ cls: "wb-ico", text: cfg.icon || "🎴" });
    const titleEl = hd.createSpan({ cls: "wb-title", text: cfg.title || "KC 卡片库" });
    ico.style.fontSize = `${titleFontSize}px`;
    ico.style.width = `${titleFontSize + 8}px`;
    ico.style.height = `${titleFontSize + 8}px`;
    titleEl.style.fontSize = `${titleFontSize}px`;
    const more = hd.createDiv({ cls: "wb-more", text: "⚙️" });
    more.addEventListener("click", () => {
      new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
    });

    const bd = p.createDiv({ cls: "wb-bd" });
    const cards = ctx.data.kcCards;
    const recentCards = [...cards].sort((a, b) => b.mtime - a.mtime).slice(0, maxItems);
    if (recentCards.length === 0) {
      emptyState(bd, "暂无知识卡片");
    } else {
      for (const c of recentCards) {
        const row = bd.createDiv({ cls: "wb-row" });
        row.createSpan({ cls: "wb-badge " + ctx.levelCls(c.level), text: c.level });
        row.createSpan({ cls: "wb-name", text: c.name });
        row.createSpan({ cls: "wb-tag", text: c.domain });
        row.addEventListener("click", () => ctx.openFile(c.path));
      }
    }

    const handle = p.createDiv({ cls: "wb-resize-handle" });
    handle.dataset.for = "kc-card";
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfg = plugin.settings.widgetConfigs || {};
    const inst = cfg[instanceId] || {};
    new Setting(el)
      .setName("显示卡片数")
      .setDesc("最近更新卡片最多显示多少张（默认 5）")
      .addText((text) =>
        text
          .setPlaceholder("5")
          .setValue(String(inst.maxItems ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            cfg[instanceId] = { ...inst, maxItems: isNaN(n) || n <= 0 ? 5 : n };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    addTitleConfig(el, plugin, instanceId, save, {
      title: "KC 卡片库",
      icon: "🎴",
      titleFontSize: 14,
    });
  },
};

export default widget;

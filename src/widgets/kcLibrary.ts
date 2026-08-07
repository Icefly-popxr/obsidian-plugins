import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { emptyState } from "./helpers";

/** KC 卡片库：最近卡片列表 */
const widget: WorkbenchWidget = {
  id: "kc-library",
  title: "KC 卡片库",
  icon: "🎴",
  accent: "#a78bfa",
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const maxItems = Number(ctx.widgetConfig.maxItems) || 5;
    const p = root.createDiv({ cls: "wb-panel wb-w kc-library" });
    p.dataset.id = "kc-library";
    p.style.setProperty("--w-accent", "#a78bfa");

    const hd = p.createDiv({ cls: "wb-hd" });
    hd.createDiv({ cls: "wb-ico", text: "🎴" });
    hd.createSpan({ cls: "wb-title", text: "KC 卡片库" });
    const more = hd.createDiv({ cls: "wb-more", text: "看板" });
    more.addEventListener("click", () => ctx.goto("board"));

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
  },
};

export default widget;

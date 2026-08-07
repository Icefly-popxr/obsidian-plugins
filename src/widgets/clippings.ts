import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel } from "./helpers";

/** 采集汇总：网页剪藏/待学素材/全部资源计数 */
const widget: WorkbenchWidget = {
  id: "clippings",
  title: "采集汇总",
  icon: "📚",
  accent: "#f472b6",
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "clippings",
      title: "采集汇总",
      icon: "📚",
      accent: "#f472b6",
      moreLabel: "查看",
      onMore: () => ctx.goto("config"),
    });

    const rows: [string, number][] = [
      ["网页剪藏", ctx.data.clippings.length],
      ["待学素材", ctx.data.inbox.length],
      ["全部资源", ctx.data.stats.totalNotes],
    ];
    for (const [name, n] of rows) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createSpan({ cls: "wb-name", text: name });
      row.createSpan({ cls: "wb-meta", text: String(n) });
    }
  },
};

export default widget;

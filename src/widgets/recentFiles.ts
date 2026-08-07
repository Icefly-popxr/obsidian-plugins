import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";

/** 最近更新：时间戳列表 */
const widget: WorkbenchWidget = {
  id: "recent-files",
  title: "最近更新",
  icon: "🕒",
  accent: "#38bdf8",
  category: "files",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "recent-files",
      title: "最近更新",
      icon: "🕒",
      accent: "#38bdf8",
    });

    const recent = ctx.data.recent;
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
  },
};

export default widget;

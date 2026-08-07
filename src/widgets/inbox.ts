import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";

/** 灵感 Inbox：待处理灵感列表 */
const widget: WorkbenchWidget = {
  id: "inbox",
  title: "灵感 Inbox",
  icon: "📥",
  accent: "#22d3ee",
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "inbox",
      title: "灵感 Inbox",
      icon: "📥",
      accent: "#22d3ee",
      moreLabel: `${ctx.data.inbox.length} 条`,
      onMore: () => ctx.goto("domains"),
    });

    const files = ctx.data.inbox.slice(0, 4);
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
  },
};

export default widget;

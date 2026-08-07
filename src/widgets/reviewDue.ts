import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";
import { dueCards } from "../services/kcService";

/** 复习到期：KC 卡到期列表 */
const widget: WorkbenchWidget = {
  id: "review-due",
  title: "复习到期",
  icon: "🔁",
  accent: "#fbbf24",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const due = dueCards(ctx.data.kcCards);
    const bd = createPanel(root, {
      id: "review-due",
      title: "复习到期",
      icon: "🔁",
      accent: "#fbbf24",
      moreLabel: `${due.length} 张`,
      onMore: () => ctx.goto("board"),
    });

    if (due.length === 0) {
      emptyState(bd, "暂无到期卡片 🎉");
      return;
    }
    for (const c of due.slice(0, 4)) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createDiv({ cls: "wb-dot" }).style.background = "var(--wb-amber)";
      row.createSpan({ cls: "wb-name", text: c.name });
      row.addEventListener("click", () => ctx.openFile(c.path));
    }
  },
};

export default widget;

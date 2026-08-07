import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";

/** 项目进度：多项目进度条列表 */
const widget: WorkbenchWidget = {
  id: "projects",
  title: "项目进度",
  icon: "🚀",
  accent: "#3b82f6",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "projects",
      title: "项目进度",
      icon: "🚀",
      accent: "#3b82f6",
      moreLabel: `${ctx.data.projects.length} 个`,
    });

    if (ctx.data.projects.length === 0) {
      emptyState(bd, "暂无项目");
      return;
    }
    for (const p of ctx.data.projects) {
      bd.createDiv({ cls: "wb-row" }).createSpan({
        cls: "wb-name",
        text: `${p.name} · ${p.progress}%`,
      });
      const bar = bd.createDiv({ cls: "wb-bar" });
      bar.createDiv({ cls: "wb-fill", text: "" }).style.width = p.progress + "%";
    }
  },
};

export default widget;

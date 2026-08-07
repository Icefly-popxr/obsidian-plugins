import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";

/** 目标与复盘：当前项目进度 + 下一步 */
const widget: WorkbenchWidget = {
  id: "goals",
  title: "目标与复盘",
  icon: "🎯",
  accent: "#8b5cf6",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "goals",
      title: "目标与复盘",
      icon: "🎯",
      accent: "#8b5cf6",
      moreLabel: "复盘",
      onMore: () => ctx.goto("wiki"),
    });

    const p = ctx.data.projects[0];
    if (!p) {
      emptyState(bd, "暂无项目");
      return;
    }
    bd.createDiv({ cls: "wb-row" }).createSpan({
      cls: "wb-name",
      text: `${p.name} · ${p.progress}%`,
    });
    const bar = bd.createDiv({ cls: "wb-bar" });
    const fill = bar.createDiv({ cls: "wb-fill wave" });
    fill.style.width = p.progress + "%";
    if (p.nextStep) {
      bd.createDiv({ cls: "wb-row" }).createSpan({
        cls: "wb-name",
        text: `⏭ ${p.nextStep}`,
      });
    }
  },
};

export default widget;

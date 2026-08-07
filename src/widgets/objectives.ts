import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, applyTitleFontSize, addTitleConfig } from "./helpers";
import type { Project } from "../services/projectService";
import { openFile } from "../services/vaultService";

type ObjFilter = "all" | "active" | "done";
interface ObjCfg {
  filter?: ObjFilter;
  maxItems?: number;
  title?: string;
  icon?: string;
  titleFontSize?: number;
}

/**
 * 目标与项目（objectives）：合并原 goals + projects。
 *  - 项目列表 + 进度条，按状态筛选（全部 / 进行中 / 已完成）。
 *  - 复盘做成真动作：打开项目复盘笔记（不存在则打开项目文件）。
 *  - 不再只取 projects[0]，分离「目标(goal)」与「项目(执行)」信息。
 */
const widget: WorkbenchWidget = {
  id: "objectives",
  title: "目标与项目",
  icon: "🎯",
  accent: "#8b5cf6",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = (ctx.widgetConfig || {}) as ObjCfg;
    const filter = cfg.filter || "all";
    const maxItems = Number(cfg.maxItems) || 0;

    const bd = createPanel(root, {
      id: "objectives",
      title: String(cfg.title || "目标与项目"),
      icon: String(cfg.icon || "🎯"),
      accent: "#8b5cf6",
      moreLabel: `${ctx.data.projects.length} 个`,
    });
    applyTitleFontSize(bd, Number(cfg.titleFontSize) || 14);

    let projects = ctx.data.projects.slice();
    if (filter === "active") projects = projects.filter((p) => p.progress < 100);
    else if (filter === "done") projects = projects.filter((p) => p.progress >= 100);
    if (maxItems > 0) projects = projects.slice(0, maxItems);

    if (projects.length === 0) {
      emptyState(bd, filter === "done" ? "暂无已完成项目" : "暂无项目");
      return;
    }

    for (const p of projects as Project[]) {
      const card = bd.createDiv({ cls: "wb-obj" });
      const head = card.createDiv({ cls: "wb-obj-head" });
      head.createSpan({ cls: "wb-name", text: p.name });
      if (p.goal) head.createSpan({ cls: "wb-obj-goal", text: p.goal });

      const bar = card.createDiv({ cls: "wb-bar" });
      const fill = bar.createDiv({ cls: "wb-fill wave" });
      fill.style.width = p.progress + "%";
      card.createSpan({ cls: "wb-obj-pct", text: `${p.progress}%` });

      if (p.nextStep) {
        card.createDiv({ cls: "wb-row" }).createSpan({ cls: "wb-name", text: `⏭ ${p.nextStep}` });
      }

      // 复盘：打开项目复盘笔记（若存在），否则打开项目文件
      const actions = card.createDiv({ cls: "wb-obj-actions" });
      const reviewBtn = actions.createEl("button", { cls: "wb-obj-review", text: "📝 复盘" });
      reviewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const folder = p.path.split("/").slice(0, -1).join("/");
        const reviewPath = `${folder}/复盘.md`;
        const f = ctx.app.vault.getAbstractFileByPath(reviewPath);
        openFile(ctx.app, f ? reviewPath : p.path);
      });
      card.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".wb-obj-review")) return;
        openFile(ctx.app, p.path);
      });
    }
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as ObjCfg;
    const update = (patch: Partial<ObjCfg>) => {
      const cur = (cfgMap[instanceId] || {}) as ObjCfg;
      cfgMap[instanceId] = { ...cur, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };
    new Setting(el)
      .setName("筛选")
      .setDesc("按状态筛选项目")
      .addDropdown((dd) => {
        dd.addOption("all", "全部");
        dd.addOption("active", "进行中");
        dd.addOption("done", "已完成");
        dd.setValue(inst.filter || "all").onChange((v) => update({ filter: v as ObjFilter }));
      });
    new Setting(el)
      .setName("显示条数")
      .setDesc("0 = 不限制")
      .addText((t) =>
        t
          .setPlaceholder("0")
          .setValue(String(inst.maxItems ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            update({ maxItems: isNaN(n) ? 0 : n });
          })
      );
    addTitleConfig(el, plugin, instanceId, save, {
      title: "目标与项目",
      icon: "🎯",
      titleFontSize: 14,
    });
  },
};

export default widget;

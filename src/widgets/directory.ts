import { Setting, TFolder, TAbstractFile, TFile } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, WidgetConfigDrawer, applyTitleFontSize, addTitleConfig, applyBodyFontSize, bodyFontSizeOf } from "./helpers";

/**
 * 目录组件（移植自 modular-theme-dashboard 的 directory）
 *  - 树形目录：文件夹展开/折叠、文件图标、点击打开
 *  - 展开状态持久化到 widgetConfigs.expandedNodes（以文件夹 path 为 key）
 *  - 根目录 = knowledgeBasePath（可配置），无保存状态时默认展开
 */

const FILE_ICONS: Record<string, string> = {
  md: "📝",
  markdown: "📝",
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  gif: "🖼️",
  webp: "🖼️",
  svg: "🖼️",
  mp4: "🎬",
  webm: "🎬",
  mov: "🎬",
  mp3: "🎵",
  wav: "🎵",
  flac: "🎵",
  pdf: "📄",
  doc: "📄",
  docx: "📄",
  xls: "📊",
  xlsx: "📊",
  ppt: "📽️",
  pptx: "📽️",
  zip: "🗜️",
  txt: "📄",
  csv: "📊",
  json: "🧾",
  yaml: "🧾",
  excalidraw: "✏️",
};

function getFileIcon(file: TAbstractFile): string {
  const name = file.name || "";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return FILE_ICONS[ext] || "📄";
}

/** 统计文件夹内的 md 文件数 */
function countFiles(folder: TFolder): number {
  let n = 0;
  for (const child of folder.children) {
    if (isFolder(child)) n += countFiles(child as TFolder);
    else if ((child as TFile).extension === "md") n += 1;
  }
  return n;
}

/** 判断是否为文件夹：TFolder 有 children 属性（兼容 Obsidian 代理对象） */
function isFolder(f: TAbstractFile): boolean {
  return f instanceof TFolder || "children" in f;
}

const widget: WorkbenchWidget = {
  id: "directory",
  title: "目录",
  icon: "📂",
  accent: "#38bdf8",
  category: "files",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = ctx.widgetConfig || {};
    const instKey = ctx.instanceId;
    const expandedNodes: string[] = Array.isArray(cfg.expandedNodes) ? [...cfg.expandedNodes] : [];

    const save = () => {
      const map = ctx.plugin.settings.widgetConfigs || {};
      map[instKey] = { ...(map[instKey] || {}), expandedNodes };
      ctx.plugin.settings.widgetConfigs = map;
      ctx.plugin.saveSettings();
    };

    const bd = createPanel(root, {
      id: "directory",
      title: String(cfg.title || "目录"),
      icon: String(cfg.icon || "📂"),
      accent: "#38bdf8",
      moreLabel: "⚙️",
      cardStyle: String((ctx.widgetConfig || {}).cardStyle || ""),
      onMore: () => {
        new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
      },
    });
    bd.addClass("dir-wrap");
    applyTitleFontSize(bd, Number(cfg.titleFontSize) || 14);

    const tree = bd.createDiv({ cls: "dir-tree" });

    // 递归渲染目录树
    const renderFolder = (container: HTMLElement, folder: TFolder) => {
      if (!folder || !folder.children || folder.children.length === 0) return;

      const arr = [...folder.children].sort((a, b) => {
        const aDir = isFolder(a);
        const bDir = isFolder(b);
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
        return (a.name || "").localeCompare(b.name || "", "zh-CN");
      });

      arr.forEach((child) => {
        const node = container.createDiv({ cls: "dir-node" });

        if (isFolder(child)) {
          const folder = child as TFolder;
          const nodePath = folder.path;
          const isExpanded =
            expandedNodes.length === 0 || expandedNodes.indexOf(nodePath) >= 0;

          const header = node.createDiv({ cls: "dir-node-header" });
          const toggle = header.createEl("span", {
            text: isExpanded ? "▼" : "▶",
            cls: "dir-toggle",
          });
          header.createEl("span", { text: "📁", cls: "dir-icon" });
          header.createEl("span", { text: folder.name || "", cls: "dir-label" });
          const cnt = countFiles(folder);
          if (cnt > 0) header.createEl("span", { text: String(cnt), cls: "dir-count" });

          const childContainer = node.createDiv({
            cls: "dir-children" + (isExpanded ? "" : " collapsed"),
          });
          renderFolder(childContainer, folder);

          header.addEventListener("click", () => {
            const nowCollapsed = childContainer.classList.contains("collapsed");
            if (nowCollapsed) {
              childContainer.removeClass("collapsed");
              toggle.setText("▼");
              if (expandedNodes.indexOf(nodePath) < 0) expandedNodes.push(nodePath);
            } else {
              childContainer.addClass("collapsed");
              toggle.setText("▶");
              expandedNodes.splice(expandedNodes.indexOf(nodePath), 1);
            }
            save();
          });
        } else {
          const header2 = node.createDiv({ cls: "dir-node-header" });
          header2.createEl("span", { cls: "dir-toggle" });
          header2.createEl("span", { text: getFileIcon(child), cls: "dir-icon" });
          header2.createEl("span", { text: child.name || "", cls: "dir-label" });
          header2.addEventListener("click", () => ctx.openFile(child.path));
        }
      });
    };

    // 根目录：优先组件配置 rootFolder，其次 knowledgeBasePath，最后库根
    const rootFolderPath = String(cfg.rootFolder || "") || ctx.plugin.settings.knowledgeBasePath || "";
    let rootFolder: TAbstractFile | null = null;
    if (rootFolderPath) {
      rootFolder = ctx.app.vault.getAbstractFileByPath(rootFolderPath);
    } else {
      rootFolder = ctx.app.vault.getRoot();
    }
    if (!rootFolder || !isFolder(rootFolder)) {
      emptyState(tree, "未找到根目录");
      return;
    }
    renderFolder(tree, rootFolder as TFolder);
    // 内容渲染完成后应用正文字号（目录标签/计数）
    applyBodyFontSize(bd, bodyFontSizeOf(ctx.widgetConfig));
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfg = plugin.settings.widgetConfigs || {};
    const inst = cfg[instanceId] || {};
    new Setting(el)
      .setName("根目录")
      .setDesc("目录树起始文件夹（相对库根，留空 = 库根）")
      .addText((t) =>
        t
          .setPlaceholder("例如：知识库")
          .setValue(String(inst.rootFolder || ""))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, rootFolder: v.trim() };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    addTitleConfig(el, plugin, instanceId, save, {
      title: "目录",
      icon: "📂",
      titleFontSize: 14,
    });
  },
};

export default widget;

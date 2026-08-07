/**
 * 公共外壳 helper：统一的可拖拽/缩放面板
 * 结构保持 .wb-panel + .wb-hd(.wb-ico/.wb-title/.wb-more) + .wb-bd + .wb-resize-handle，
 * 布局系统（initDashboardLayout）按这些 class 自动接管拖拽/缩放/位置持久化。
 */

import { App, Modal, Setting, TextComponent } from "obsidian";
import type KnowledgeWorkbenchPlugin from "../main";
import type { WorkbenchWidget } from "./types";

/**
 * 通用右侧抽屉配置弹窗：把某组件的 renderSettings 全部配置项
 * 渲染到右侧边栏（Modal 靠右停靠），改配置即保存并刷新工作台。
 * 所有通用组件共用，入口 = 组件右上角 ➕ / ⚙️。
 */
export class WidgetConfigDrawer extends Modal {
  private plugin: KnowledgeWorkbenchPlugin;
  private instanceId: string;
  private widget: WorkbenchWidget;

  constructor(
    app: App,
    plugin: KnowledgeWorkbenchPlugin,
    instanceId: string,
    widget: WorkbenchWidget
  ) {
    super(app);
    this.plugin = plugin;
    this.instanceId = instanceId;
    this.widget = widget;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass("wb-drawer");
    contentEl.addClass("wb-config-drawer");

    // 上沿对齐左菜单栏（.wb-sidebar）顶部，不占满整屏
    const leaves = this.app.workspace.getLeavesOfType("knowledge-workbench-view");
    const leaf = leaves[0];
    if (leaf) {
      const sidebar = leaf.view.containerEl.querySelector<HTMLElement>(".wb-sidebar");
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        this.modalEl.style.top = `${Math.max(8, rect.top)}px`;
      }
    }

    contentEl.createEl("h3", { text: `⚙️ ${this.widget.icon} ${this.widget.title} 配置` });

    const saveCb = () => {
      this.plugin.saveSettings();
      // 刷新已打开的工作台视图，让卡片立即更新
      this.app.workspace.getLeavesOfType("knowledge-workbench-view").forEach((leaf) => {
        const v = leaf.view as { reload?: () => void };
        if (typeof v.reload === "function") v.reload();
      });
    };

    if (typeof this.widget.renderSettings === "function") {
      try {
        this.widget.renderSettings(contentEl, this.plugin, this.instanceId, saveCb);
      } catch (e) {
        console.error(`[workbench] ${this.widget.id} renderSettings 失败`, e);
        contentEl.createEl("p", { text: `配置渲染失败：${String(e)}` });
      }
    } else {
      contentEl.createEl("p", { text: "该组件没有可配置项" });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export interface PanelOpts {
  id: string;
  title: string;
  icon: string;
  accent: string;
  moreLabel?: string;
  onMore?: () => void;
}

/** 创建面板外壳，返回内容区（.wb-bd），widget 往内容区填充 DOM */
export function createPanel(root: HTMLElement, opts: PanelOpts): HTMLElement {
  const p = root.createDiv({ cls: `wb-panel wb-w ${opts.id}` });
  p.dataset.id = opts.id;
  p.style.setProperty("--w-accent", opts.accent);

  const hd = p.createDiv({ cls: "wb-hd" });
  hd.createDiv({ cls: "wb-ico", text: opts.icon });
  hd.createSpan({ cls: "wb-title", text: opts.title });
  if (opts.moreLabel) {
    const more = hd.createDiv({ cls: "wb-more", text: opts.moreLabel });
    if (opts.onMore) more.addEventListener("click", opts.onMore);
  }

  const bd = p.createDiv({ cls: "wb-bd" });
  const handle = p.createDiv({ cls: "wb-resize-handle" });
  handle.dataset.for = opts.id;
  return bd;
}

/** 空状态 */
export function emptyState(bd: HTMLElement, text: string): HTMLElement {
  return bd.createDiv({ cls: "wb-empty", text });
}

export interface FontSizeControlsOpts {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

/**
 * 统一字号控件：在 Setting 内追加 − / 数值输入 / ＋ 三个控件。
 * 所有通用组件（文字/清单/日历等）的标题与正文字号共用同一套 UI。
 */
export function addFontSizeControls(setting: Setting, opts: FontSizeControlsOpts): void {
  const min = opts.min ?? 10;
  const max = opts.max ?? 32;
  let size = opts.value;
  let sizeText: TextComponent;

  setting.addText((t) => {
    sizeText = t;
    t.setValue(String(size));
    t.inputEl.style.width = "48px";
    t.inputEl.style.textAlign = "center";
    t.onChange((v) => {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= min && n <= max) {
        size = n;
        opts.onChange(n);
      }
    });
  });
  setting.addButton((b) =>
    b.setButtonText("−").onClick(() => {
      size = Math.max(min, size - 1);
      sizeText.setValue(String(size));
      opts.onChange(size);
    })
  );
  setting.addButton((b) =>
    b.setButtonText("＋").onClick(() => {
      size = Math.min(max, size + 1);
      sizeText.setValue(String(size));
      opts.onChange(size);
    })
  );
}

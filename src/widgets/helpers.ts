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
  /** 防止重复触发关闭动画 */
  private closing = false;

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

    // 滑入动画：先定位到屏幕右侧外（translateX(100%)），下一帧过渡回原位
    this.modalEl.addClass("wb-drawer-enter");
    requestAnimationFrame(() => {
      this.modalEl.removeClass("wb-drawer-enter");
    });

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

    // 标题：优先用实例配置的 title（widgetConfigs[instId].title），缺省回退组件名
    const instCfg = (this.plugin.settings.widgetConfigs || {})[this.instanceId] || {};
    const instTitle = String(instCfg.title || "");
    const drawerTitle = instTitle ? instTitle : this.widget.title;
    contentEl.createEl("h3", { text: `⚙️ ${this.widget.icon} ${drawerTitle} 配置` });

    const saveCb = () => {
      this.plugin.saveSettings();
      // 刷新已打开的工作台视图，让卡片立即更新
      this.app.workspace.getLeavesOfType("knowledge-workbench-view").forEach((leaf) => {
        const v = leaf.view as { reload?: () => void };
        if (typeof v.reload === "function") v.reload();
      });
    };

    // 通用外观：主色（所有组件统一入口，与设置面板一致）
    this.renderAccentColor(contentEl, saveCb);
    // 通用外观：卡片风格（可切换不同卡片样式）
    this.renderCardStyle(contentEl, saveCb);
    // 通用外观：光圈效果开关（光标驱动的边框光晕，可独立关闭）
    this.renderGlowToggle(contentEl, saveCb);

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

  /** 外观主色配置（与设置面板 renderCommonColorSetting 同一套逻辑） */
  private renderAccentColor(target: HTMLElement, saveCb: () => void) {
    const PRESET = [
      "#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#f59e0b",
      "#f472b6", "#e11d2e", "#22d3ee", "#a78bfa", "#6ee7b7",
    ];
    const cfg = this.plugin.settings.widgetConfigs || {};
    const inst = cfg[this.instanceId] || {};
    const current = String(inst.color || "");

    target.createEl("h4", {
      text: "🎨 外观颜色",
      attr: { style: "margin:10px 0 4px;font-size:13px;font-weight:700;" },
    });
    const swatchWrap = target.createDiv({
      attr: { style: "display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px;" },
    });
    const paint = (hex: string) => {
      swatchWrap.querySelectorAll<HTMLElement>("button").forEach((b) => {
        b.style.borderColor = "var(--background-modifier-border)";
        b.style.boxShadow = "none";
      });
      if (hex) {
        const sel = swatchWrap.querySelector<HTMLElement>(`[data-c="${hex}"]`);
        if (sel) {
          sel.style.borderColor = "var(--interactive-accent)";
          sel.style.boxShadow = "0 0 0 2px var(--interactive-accent)";
        }
      }
      cfg[this.instanceId] = { ...inst, color: hex };
      this.plugin.settings.widgetConfigs = cfg;
      this.plugin.saveSettings();
      saveCb();
    };

    PRESET.forEach((c) => {
      const sw = swatchWrap.createEl("button", {
        attr: {
          "data-c": c,
          style: `width:24px;height:24px;border-radius:6px;cursor:pointer;padding:0;border:2px solid var(--background-modifier-border);background:${c};`,
        },
      });
      sw.addEventListener("click", () => paint(c));
    });

    // 自定义取色器 + 恢复默认
    const row = target.createDiv({
      attr: { style: "display:flex;align-items:center;gap:8px;margin-bottom:6px;" },
    });
    const colorInput = row.createEl("input", {
      attr: { type: "color", value: current || this.widget.accent },
    });
    colorInput.style.width = "36px";
    colorInput.style.height = "24px";
    colorInput.style.padding = "0";
    colorInput.style.border = "none";
    colorInput.style.cursor = "pointer";
    colorInput.addEventListener("input", () => paint(colorInput.value));
    const reset = row.createEl("button", {
      text: "恢复默认",
      attr: { style: "font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;background:var(--background-modifier-form-field);color:var(--text-normal);border:1px solid var(--background-modifier-border);" },
    });
    reset.addEventListener("click", () => paint(""));
    saveCb();
  }

  /** 卡片风格配置（所有组件统一入口，可选不同卡片样式） */
  private renderCardStyle(target: HTMLElement, saveCb: () => void) {
    const STYLES: { id: string; label: string }[] = [
      { id: "", label: "默认卡片" },
      { id: "flat", label: "简约扁平" },
      { id: "glass", label: "玻璃拟态" },
      { id: "shadow", label: "立体阴影" },
      { id: "bare", label: "无边框融入" },
    ];
    const cfg = this.plugin.settings.widgetConfigs || {};
    const inst = cfg[this.instanceId] || {};
    const current = String(inst.cardStyle || "");

    target.createEl("h4", {
      text: "🃏 卡片风格",
      attr: { style: "margin:10px 0 4px;font-size:13px;font-weight:700;" },
    });
    const dd = target.createEl("select");
    dd.style.width = "100%";
    dd.style.padding = "4px 8px";
    dd.style.fontSize = "12px";
    dd.style.borderRadius = "6px";
    dd.style.border = "1px solid var(--background-modifier-border)";
    STYLES.forEach((s) => {
      const opt = dd.createEl("option", { text: s.label });
      opt.value = s.id;
    });
    dd.value = current;
    dd.addEventListener("change", () => {
      cfg[this.instanceId] = { ...inst, cardStyle: dd.value };
      this.plugin.settings.widgetConfigs = cfg;
      this.plugin.saveSettings();
      saveCb();
    });
    const desc = target.createEl("p", {
      text: "切换卡片外观：默认 / 简约扁平 / 玻璃拟态 / 立体阴影 / 无边框融入",
      attr: { style: "font-size:11px;color:var(--wb-sub);margin:4px 0 8px;" },
    });
    void desc;
  }

  /** 光圈效果开关（光标驱动的边框光晕；默认开启，可独立关闭） */
  private renderGlowToggle(target: HTMLElement, saveCb: () => void) {
    const cfg = this.plugin.settings.widgetConfigs || {};
    const inst = cfg[this.instanceId] || {};
    const enabled = inst.glow !== false;

    target.createEl("h4", {
      text: "💡 光圈效果",
      attr: { style: "margin:10px 0 4px;font-size:13px;font-weight:700;" },
    });
    const row = target.createDiv({
      attr: { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;" },
    });
    row.createSpan({ text: "启用（光标接近时卡片边缘发光）" });
    const sw = row.createEl("button", {
      attr: {
        style: "position:relative;width:34px;height:18px;border-radius:999px;border:none;cursor:pointer;transition:background .2s;",
      },
    });
    const knob = sw.createEl("span", {
      attr: {
        style: "position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s;",
      },
    });
    void knob;

    // 同步开关视觉状态（背景色 + knob 位置）
    const syncVisual = (on: boolean) => {
      sw.style.background = on
        ? "var(--interactive-accent)"
        : "var(--background-modifier-border)";
      knob.style.left = on ? "16px" : "2px";
    };
    syncVisual(enabled);

    sw.addEventListener("click", () => {
      const next = !((cfg[this.instanceId] || {}).glow !== false); // 取反：关 → 开，开 → 关
      cfg[this.instanceId] = { ...(cfg[this.instanceId] || {}), glow: next };
      this.plugin.settings.widgetConfigs = cfg;
      syncVisual(next);
      this.plugin.saveSettings();
      saveCb();
    });
    target.createEl("p", {
      text: "关闭后卡片不再有光标光圈效果（风格/主色不受影响）",
      attr: { style: "font-size:11px;color:var(--wb-sub);margin:0 0 8px;" },
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  /** 滑出动画后真正关闭：加 exit class → 等过渡结束 → 调用父类 close */
  close() {
    if (this.closing) return;
    this.closing = true;
    this.modalEl.addClass("wb-drawer-exit");
    window.setTimeout(() => {
      super.close();
    }, 260); // 与 styles.css 中 .wb-drawer transition 时长一致
  }
}

export interface PanelOpts {
  id: string;
  title: string;
  icon: string;
  accent: string;
  moreLabel?: string;
  onMore?: () => void;
  /** 卡片风格：flat / glass / shadow / bare（空 = 默认），应用 .wb-style-* 类 */
  cardStyle?: string;
}

/** 创建面板外壳，返回内容区（.wb-bd），widget 往内容区填充 DOM */
export function createPanel(root: HTMLElement, opts: PanelOpts): HTMLElement {
  const p = root.createDiv({ cls: `wb-panel wb-w ${opts.id}` });
  p.dataset.id = opts.id;
  p.style.setProperty("--w-accent", opts.accent);
  // 卡片风格类（默认不额外加类）
  if (opts.cardStyle) p.addClass(`wb-style-${opts.cardStyle}`);

  const hd = p.createDiv({ cls: "wb-hd" });
  hd.createDiv({ cls: "wb-ico", text: opts.icon });
  hd.createSpan({ cls: "wb-title", text: opts.title });
  // 折叠/展开按钮（所有面板统一支持，状态持久化到 dashboardLayout）
  const collapse = hd.createDiv({ cls: "wb-collapse", text: "▾" });
  collapse.addEventListener("click", (e) => {
    e.stopPropagation();
    const collapsed = p.classList.toggle("collapsed");
    collapse.setText(collapsed ? "▸" : "▾");
    const bd = p.querySelector<HTMLElement>(".wb-bd");
    if (bd) bd.style.display = collapsed ? "none" : "";
  });
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

/**
 * 统一的标题配置区：标题输入框（独占一行拉长）+ 标题字号（下一行）+ 图标。
 * 所有组件共用同一套标题字号 UI，与图表统计/进度统计一致。
 */
export function addTitleConfig(
  el: HTMLElement,
  plugin: KnowledgeWorkbenchPlugin,
  instanceId: string,
  save: () => void,
  defaults: { title: string; icon: string; titleFontSize: number }
): void {
  const cfgMap = plugin.settings.widgetConfigs || {};
  const cur = () => (cfgMap[instanceId] || {}) as Record<string, unknown>;
  const update = (patch: Record<string, unknown>) => {
    cfgMap[instanceId] = { ...cur(), ...patch };
    plugin.settings.widgetConfigs = cfgMap;
    save();
  };

  const titleSetting = new Setting(el)
    .setName("标题")
    .setDesc(`卡片标题（留空显示「${defaults.title}」）`);
  titleSetting.addText((t) => {
    t
      .setPlaceholder(defaults.title)
      .setValue(String(cur().title ?? ""))
      .onChange((v) => update({ title: v.trim() }));
    t.inputEl.style.width = "100%";
    t.inputEl.style.boxSizing = "border-box";
    t.inputEl.style.minWidth = "200px";
  });
  const sizeSetting = new Setting(el)
    .setName("标题字号")
    .setDesc("标题文字与图标 emoji 大小（px）");
  addFontSizeControls(sizeSetting, {
    value:
      typeof cur().titleFontSize === "number" && (cur().titleFontSize as number) > 0
        ? (cur().titleFontSize as number)
        : defaults.titleFontSize,
    onChange: (v) => update({ titleFontSize: v }),
  });
  new Setting(el)
    .setName("图标")
    .setDesc("标题栏 emoji 图标")
    .addText((t) =>
      t
        .setPlaceholder(defaults.icon)
        .setValue(String(cur().icon ?? ""))
        .onChange((v) => update({ icon: v.trim() }))
    );
}

/** 渲染侧：把标题字号应用到面板标题栏（标题 + 图标 emoji 跟随） */
export function applyTitleFontSize(bd: HTMLElement, titleFontSize: number): void {
  const panel = bd.closest(".wb-panel");
  if (!panel) return;
  const ico = panel.querySelector<HTMLElement>(".wb-ico");
  const titleEl = panel.querySelector<HTMLElement>(".wb-title");
  if (ico) {
    ico.style.fontSize = `${titleFontSize}px`;
    ico.style.width = `${titleFontSize + 8}px`;
    ico.style.height = `${titleFontSize + 8}px`;
  }
  if (titleEl) titleEl.style.fontSize = `${titleFontSize}px`;
}

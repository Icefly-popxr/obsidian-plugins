import { Modal, App, Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { MaskedHeading } from "../components/MaskedHeading";
import { WidgetConfigDrawer, addFontSizeControls } from "./helpers";

/**
 * 遮罩标题组件（V4）：
 *  - SVG 字形裁剪 + 鼠标视差 + drift 漂移 + rise 入场动画
 *  - 内置渐变背景（SVG data URI，不依赖头图/外链）
 *  - 双击文字弹窗编辑：文字内容 / 文字颜色（预设色板 + 自定义）/ 字号
 *  - 配置按实例保存到 settings.maskedHeadingConfig
 *  - 整卡可拖拽/缩放（无标题栏，整卡即拖拽手柄）
 */

/** 预设文字色调（hex） */
const PRESET_COLORS = [
  "#ffffff", // 白
  "#fbbf24", // 金
  "#e11d2e", // 红
  "#38bdf8", // 蓝
  "#34d399", // 绿
  "#8b5cf6", // 紫
  "#ec4899", // 粉
  "#f59e0b", // 橙
  "#22d3ee", // 青
  "#f8fafc", // 亮白
];

/**
 * 内置流动背景：多层斜向渐变带（深蓝 → 紫 → 金），平移时呈持续流动感。
 * 媒体放大过扫描后由 drift/视差驱动，文字笔画内始终有流动效果。
 */
function gradientBgDataUri(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#1e1b4b'/><stop offset='.25' stop-color='#4338ca'/><stop offset='.5' stop-color='#8b5cf6'/><stop offset='.75' stop-color='#ec4899'/><stop offset='1' stop-color='#fbbf24'/></linearGradient></defs><rect width='800' height='400' fill='url(#g)'/><g opacity='.5'><rect x='-200' y='-100' width='260' height='600' transform='rotate(28 300 200)' fill='#ffffff' opacity='.12'/><rect x='120' y='-120' width='180' height='640' transform='rotate(28 300 200)' fill='#ffffff' opacity='.1'/><rect x='420' y='-80' width='220' height='560' transform='rotate(28 300 200)' fill='#ffffff' opacity='.14'/></g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

export interface MaskedHeadingEditResult {
  text: string;
  color: string;
  fontSize: number;
}

/** 双击编辑弹窗：文字内容 / 颜色 / 字号 */
class MaskedHeadingEditModal extends Modal {
  private onSubmit: (result: MaskedHeadingEditResult) => void;
  private initialText: string;
  private initialColor: string;
  private initialFontSize: number;
  private color = "";
  private fontSize = 44;

  constructor(
    app: App,
    initial: { text: string; color?: string; fontSize?: number },
    onSubmit: (result: MaskedHeadingEditResult) => void
  ) {
    super(app);
    this.initialText = initial.text;
    this.initialColor = initial.color || "";
    this.initialFontSize = initial.fontSize || 44;
    this.color = this.initialColor;
    this.fontSize = this.initialFontSize;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "🖼️ 编辑遮罩标题" });

    // ── 文字内容 ──
    const input = contentEl.createEl("input", {
      cls: "wb-mh-edit-input",
      attr: { value: this.initialText },
    });
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.padding = "8px 10px";
    input.style.marginBottom = "12px";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid var(--background-modifier-border)";
    input.style.fontSize = "15px";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit(input.value);
      }
    });

    // ── 文字颜色 ──
    contentEl.createEl("p", {
      text: "🎨 文字颜色",
      attr: { style: "margin:4px 0 6px;font-size:13px;color:var(--text-muted);" },
    });
    const swatches = contentEl.createDiv({
      attr: { style: "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;" },
    });
    const makeSwatch = (hex: string) => {
      const sw = swatches.createEl("button", {
        attr: { style: "width:24px;height:24px;border-radius:6px;cursor:pointer;padding:0;border:2px solid var(--background-modifier-border);" },
      });
      sw.style.background = hex;
      if (hex === this.color) {
        sw.style.borderColor = "var(--interactive-accent)";
        sw.style.boxShadow = "0 0 0 2px var(--interactive-accent)";
      }
      sw.addEventListener("click", () => {
        this.color = hex;
        // 刷新选中态
        swatches.querySelectorAll("button").forEach((b) => {
          (b as HTMLElement).style.borderColor = "var(--background-modifier-border)";
          (b as HTMLElement).style.boxShadow = "none";
        });
        sw.style.borderColor = "var(--interactive-accent)";
        sw.style.boxShadow = "0 0 0 2px var(--interactive-accent)";
      });
    };
    PRESET_COLORS.forEach(makeSwatch);

    // 自定义取色器 + 原色按钮
    const colorRow = contentEl.createDiv({
      attr: { style: "display:flex;align-items:center;gap:8px;margin-bottom:14px;" },
    });
    const colorInput = colorRow.createEl("input", {
      attr: { type: "color", value: this.color || "#fbbf24" },
    });
    colorInput.style.width = "40px";
    colorInput.style.height = "26px";
    colorInput.style.padding = "0";
    colorInput.style.border = "none";
    colorInput.style.cursor = "pointer";
    colorInput.addEventListener("input", () => {
      this.color = colorInput.value;
    });
    const clearBtn = colorRow.createEl("button", {
      text: "恢复媒体原色",
      attr: { style: "font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;background:var(--background-modifier-form-field);color:var(--text-normal);border:1px solid var(--background-modifier-border);" },
    });
    clearBtn.addEventListener("click", () => {
      this.color = "";
      colorInput.value = "#fbbf24";
      swatches.querySelectorAll("button").forEach((b) => {
        (b as HTMLElement).style.borderColor = "var(--background-modifier-border)";
        (b as HTMLElement).style.boxShadow = "none";
      });
    });

    // ── 字号 ──
    contentEl.createEl("p", {
      text: "🔠 字号",
      attr: { style: "margin:4px 0 6px;font-size:13px;color:var(--text-muted);" },
    });
    const sizeRow = contentEl.createDiv({
      attr: { style: "display:flex;align-items:center;gap:10px;margin-bottom:14px;" },
    });
    const sizeSlider = sizeRow.createEl("input", {
      attr: { type: "range", min: "16", max: "120", step: "1", value: String(this.fontSize) },
    });
    sizeSlider.style.flex = "1";
    const sizeLabel = sizeRow.createSpan({
      text: `${this.fontSize}px`,
      attr: { style: "font-size:13px;min-width:44px;text-align:right;font-family:var(--wb-mono, monospace);" },
    });
    sizeSlider.addEventListener("input", () => {
      this.fontSize = parseInt(sizeSlider.value, 10) || 44;
      sizeLabel.setText(`${this.fontSize}px`);
    });

    // ── 保存 ──
    const btn = contentEl.createEl("button", {
      cls: "wb-add-btn",
      text: "保存",
    });
    btn.style.marginTop = "4px";
    btn.style.width = "100%";
    btn.style.padding = "8px 0";
    btn.addEventListener("click", () => this.submit(input.value));
  }

  private submit(text: string) {
    this.onSubmit({
      text: text.trim(),
      color: this.color,
      fontSize: this.fontSize,
    });
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

const instances = new Map<HTMLElement, MaskedHeading>();

const widget: WorkbenchWidget = {
  id: "masked-heading",
  title: "遮罩标题",
  icon: "🖼️",
  accent: "#e11d2e",
  category: "decor",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const instKey = ctx.instanceId || "masked-heading";
    const cfg = ctx.plugin.settings.maskedHeadingConfig?.[instKey];

    const p = root.createDiv({ cls: "wb-panel wb-w masked-heading" });
    p.dataset.id = "masked-heading";
    p.style.setProperty("--w-accent", "#e11d2e");

    // 右上角 ⚙️ 配置入口（打开右侧抽屉）
    const gear = p.createDiv({ cls: "wb-more wb-mh-gear", text: "⚙️" });
    gear.addEventListener("click", (e) => {
      e.stopPropagation();
      new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
    });

    // 背景：实例配置的 bgUrl（图片/视频 URL）或内置渐变
    const src = cfg?.bgUrl || gradientBgDataUri();
    const mediaType = cfg?.bgUrl && /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(cfg.bgUrl) ? "video" : "image";
    const fontSize = cfg?.fontSize || 44;
    const mh = new MaskedHeading(p, {
      text: cfg?.text || "双击编辑标题",
      src,
      mediaType,
      fixedFontSize: fontSize,
      color: cfg?.color || "",
      fillScale: 1.45,
      parallax: 42,
      drift: 34,
      brightness: 1.15,
      saturation: 1.1,
      reveal: "rise",
      trigger: "view",
    });
    instances.set(p, mh);

    // ── 双击弹窗编辑（文字/颜色/字号） ──
    const rootEl = mh.getRootEl();
    rootEl.title = "双击编辑";
    rootEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      new MaskedHeadingEditModal(
        ctx.app,
        { text: cfg?.text || "双击编辑标题", color: cfg?.color, fontSize: cfg?.fontSize },
        (result) => {
          if (!result.text) return;
          mh.setText(result.text);
          mh.setColor(result.color);
          mh.setFontSize(result.fontSize);
          // 保存到 settings（按实例隔离）
          const cfgMap = ctx.plugin.settings.maskedHeadingConfig || {};
          const prev = cfgMap[instKey];
          cfgMap[instKey] = {
            text: result.text,
            color: result.color,
            fontSize: result.fontSize,
            bgUrl: prev?.bgUrl,
          };
          ctx.plugin.settings.maskedHeadingConfig = cfgMap;
          ctx.plugin.saveSettings();
        }
      ).open();
    });

    const handle = p.createDiv({ cls: "wb-resize-handle" });
    handle.dataset.for = "masked-heading";
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.maskedHeadingConfig || {};
    const inst = cfgMap[instanceId] || {};

    const update = (patch: Record<string, unknown>) => {
      cfgMap[instanceId] = { ...(cfgMap[instanceId] || {}), ...patch };
      plugin.settings.maskedHeadingConfig = cfgMap;
      save();
    };

    // 文字内容
    const textSetting = new Setting(el).setName("标题文字").setDesc("遮罩标题的文字内容");
    textSetting.addText((t) => {
      t
        .setPlaceholder("双击编辑标题")
        .setValue(String(inst.text || ""))
        .onChange((v) => update({ text: v.trim() }));
      t.inputEl.style.width = "100%";
      t.inputEl.style.boxSizing = "border-box";
      t.inputEl.style.minWidth = "200px";
    });

    // 字号（含图标 emoji 跟随）
    const sizeSetting = new Setting(el)
      .setName("标题字号")
      .setDesc("标题文字大小（px）");
    addFontSizeControls(sizeSetting, {
      value: typeof inst.fontSize === "number" && inst.fontSize > 0 ? inst.fontSize : 44,
      onChange: (v) => update({ fontSize: v }),
    });

    // 文字颜色（预设色板）
    el.createEl("h4", {
      text: "🎨 文字颜色",
      attr: { style: "margin:12px 0 4px;font-size:13px;font-weight:700;" },
    });
    const swatchWrap = el.createDiv({
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
      update({ color: hex });
    };
    PRESET_COLORS.forEach((c) => {
      const sw = swatchWrap.createEl("button", {
        attr: {
          "data-c": c,
          style: `width:24px;height:24px;border-radius:6px;cursor:pointer;padding:0;border:2px solid var(--background-modifier-border);background:${c};`,
        },
      });
      sw.addEventListener("click", () => paint(c));
    });
  },
  onunload() {
    for (const mh of instances.values()) {
      try {
        mh.destroy();
      } catch (e) {
        console.error("[workbench] masked-heading 清理失败", e);
      }
    }
    instances.clear();
  },
};

export default widget;

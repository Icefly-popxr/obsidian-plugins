import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";

/**
 * 通用文字内容组件（分类通用组件第一类，验证"配置驱动"模式）
 *  - 配置：标题 / 正文（多行）/ 图标 / 字号 / 对齐方式
 *  - 内容全部存 settings.widgetConfigs[instId]，改配置即改内容，无需改代码
 *  - 支持多实例（#N 后缀），每实例独立配置
 *  - 点击正文可快速打开设置面板（便于发现配置入口）
 */

interface TextContentCfg {
  title?: string;
  text?: string;
  icon?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
}

const DEFAULT_ACCENT = "#8b5cf6";

function readCfg(ctx: WidgetCtx): TextContentCfg {
  const cfg = (ctx.widgetConfig || {}) as TextContentCfg;
  return {
    title: String(cfg.title || ""),
    text: String(cfg.text || ""),
    icon: String(cfg.icon || "📝"),
    fontSize: typeof cfg.fontSize === "number" && cfg.fontSize > 0 ? cfg.fontSize : 14,
    align: cfg.align || "left",
  };
}

const widget: WorkbenchWidget = {
  id: "text-content",
  title: "文字内容",
  icon: "📝",
  accent: DEFAULT_ACCENT,
  category: "universal",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const instKey = ctx.instanceId;

    const bd = createPanel(root, {
      id: "text-content",
      title: cfg.title || "文字内容",
      icon: cfg.icon || "📝",
      accent: DEFAULT_ACCENT,
    });

    const text = String(cfg.text || "").trim();
    if (!text) {
      emptyState(bd, "未配置内容，点「配置」填写文字");
      return;
    }

    const body = bd.createDiv({
      cls: "wb-text-content",
      attr: {
        style: `font-size:${cfg.fontSize}px;text-align:${cfg.align};white-space:pre-wrap;line-height:1.7;word-break:break-word;`,
      },
      text,
    });

    // 点击正文 → 打开 Obsidian 设置页（快速找到配置入口）
    body.addEventListener("click", (e) => {
      e.stopPropagation();
      // @ts-ignore
      const setting = ctx.app.setting;
      if (!setting) return;
      try {
        setting.open();
        if (typeof setting.openTabById === "function") {
          setting.openTabById("knowledge-workbench");
        }
      } catch (err) {
        console.error("[workbench] 打开设置面板失败", err);
      }
    });
    body.title = "点击打开配置";

    void instKey;
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as TextContentCfg;

    const update = (patch: Partial<TextContentCfg>) => {
      cfgMap[instanceId] = { ...inst, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    new Setting(el)
      .setName("标题")
      .setDesc("卡片标题栏文字（留空显示「文字内容」）")
      .addText((t) =>
        t
          .setPlaceholder("例如：本周目标")
          .setValue(String(inst.title || ""))
          .onChange((v) => update({ title: v.trim() }))
      );

    new Setting(el)
      .setName("图标")
      .setDesc("标题栏 emoji 图标")
      .addText((t) =>
        t
          .setPlaceholder("例如：🎯")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );

    new Setting(el)
      .setName("正文")
      .setDesc("支持多行文字，直接输入即可（空内容时卡片显示占位提示）")
      .addTextArea((ta) => {
        ta.setPlaceholder("在这里输入你想展示的文字…");
        ta.setValue(String(inst.text || ""));
        ta.inputEl.rows = 5;
        ta.inputEl.style.width = "100%";
        ta.inputEl.style.fontSize = "13px";
        ta.onChange((v) => update({ text: v }));
      });

    new Setting(el)
      .setName("字号")
      .setDesc("正文字号（px）")
      .addSlider((sl) =>
        sl
          .setLimits(10, 32, 1)
          .setValue(typeof inst.fontSize === "number" && inst.fontSize > 0 ? inst.fontSize : 14)
          .setDynamicTooltip()
          .onChange((v) => update({ fontSize: v }))
      );

    new Setting(el)
      .setName("对齐")
      .addDropdown((dd) =>
        dd
          .addOption("left", "左对齐")
          .addOption("center", "居中")
          .addOption("right", "右对齐")
          .setValue(inst.align || "left")
          .onChange((v) => update({ align: v as TextContentCfg["align"] }))
      );
  },
};

export default widget;

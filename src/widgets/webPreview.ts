import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, WidgetConfigDrawer, applyTitleFontSize, addTitleConfig } from "./helpers";

/**
 * 网页预览组件（移植自 modular-theme-dashboard 的 web-preview）
 *  - 三层架构：viewport(overflow hidden) > wrapper(transform) > iframe
 *  - 缩放 / 偏移（posX/posY）实时生效，配置持久化到 widgetConfigs
 *  - 工具栏：URL 输入 + 缩放 +/- + 刷新
 */
const widget: WorkbenchWidget = {
  id: "web-preview",
  title: "网页预览",
  icon: "🌐",
  accent: "#38bdf8",
  category: "web",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = ctx.widgetConfig || {};
    const instKey = ctx.instanceId;
    const url = String(cfg.url || "https://www.bing.com");
    let zoom = Number(cfg.zoom) || 1;
    let posX = Number(cfg.posX) || 0;
    let posY = Number(cfg.posY) || 0;

    const save = () => {
      const map = ctx.plugin.settings.widgetConfigs || {};
      map[instKey] = { ...(map[instKey] || {}), url, zoom, posX, posY };
      ctx.plugin.settings.widgetConfigs = map;
      ctx.plugin.saveSettings();
    };

    const bd = createPanel(root, {
      id: "web-preview",
      title: String(cfg.title || "网页预览"),
      icon: String(cfg.icon || "🌐"),
      accent: "#38bdf8",
      moreLabel: "⚙️",
      onMore: () => {
        new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
      },
    });
    bd.addClass("wp-wrap");
    applyTitleFontSize(bd, Number(cfg.titleFontSize) || 14);

    // ── 工具栏 ──
    const bar = bd.createDiv({ cls: "wp-toolbar" });
    const urlInput = bar.createEl("input", {
      cls: "wp-url",
      attr: { placeholder: "https://…", value: url, spellcheck: "false" },
    });
    const zoomLabel = bar.createSpan({ cls: "wp-zoom", text: `${Math.round(zoom * 100)}%` });
    const zoomOut = bar.createEl("button", { cls: "wp-btn", text: "−" });
    const zoomIn = bar.createEl("button", { cls: "wp-btn", text: "+" });
    const refresh = bar.createEl("button", { cls: "wp-btn", text: "⟳" });

    // ── 视口 ──
    const viewport = bd.createDiv({ cls: "wp-viewport" });
    const wrapper = viewport.createDiv({ cls: "wp-wrapper" });
    const iframe = wrapper.createEl("iframe", {
      cls: "wp-frame",
      attr: { src: url, allow: "fullscreen; autoplay", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups" },
    });

    const applyTransform = () => {
      const scale = zoom;
      wrapper.style.transform = `translate(${-posX}px, ${-posY}px) scale(${scale})`;
      const w = viewport.offsetWidth || 400;
      wrapper.style.width = `${(w * 2) / scale}px`;
      wrapper.style.height = `${(w * 2) / scale}px`;
    };

    const updateZoom = (delta: number) => {
      zoom = Math.max(0.1, Math.min(3, zoom + delta));
      zoomLabel.setText(`${Math.round(zoom * 100)}%`);
      applyTransform();
      save();
    };
    zoomOut.addEventListener("click", () => updateZoom(-0.1));
    zoomIn.addEventListener("click", () => updateZoom(0.1));

    const load = () => {
      const u = urlInput.value.trim() || "https://www.bing.com";
      urlInput.value = u;
      iframe.src = u;
      save();
    };
    refresh.addEventListener("click", load);
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load();
    });

    // 位置输入（右下角小控件）
    const posRow = bd.createDiv({ cls: "wp-pos-row" });
    posRow.createSpan({ cls: "wp-pos-label", text: "X" });
    const posXInput = posRow.createEl("input", {
      cls: "wp-pos-input",
      attr: { type: "number", value: String(posX) },
    });
    posRow.createSpan({ cls: "wp-pos-label", text: "Y" });
    const posYInput = posRow.createEl("input", {
      cls: "wp-pos-input",
      attr: { type: "number", value: String(posY) },
    });
    const updatePos = () => {
      posX = parseInt(posXInput.value, 10) || 0;
      posY = parseInt(posYInput.value, 10) || 0;
      applyTransform();
      save();
    };
    posXInput.addEventListener("change", updatePos);
    posYInput.addEventListener("change", updatePos);

    applyTransform();
    // 等待布局完成后再计算一次（视口宽度此时才可用）
    requestAnimationFrame(applyTransform);
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfg = plugin.settings.widgetConfigs || {};
    const inst = cfg[instanceId] || {};

    new Setting(el)
      .setName("网址")
      .setDesc("要预览的网页地址")
      .addText((t) =>
        t
          .setPlaceholder("https://example.com")
          .setValue(String(inst.url || ""))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, url: v.trim() };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("缩放")
      .setDesc("预览缩放比例（0.1–3，默认 1）")
      .addSlider((s) =>
        s
          .setLimits(0.1, 3, 0.1)
          .setValue(Number(inst.zoom) || 1)
          .setDynamicTooltip()
          .onChange((v) => {
            cfg[instanceId] = { ...inst, zoom: v };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("水平偏移 (X)")
      .setDesc("预览内容水平偏移像素")
      .addText((t) =>
        t
          .setValue(String(inst.posX || 0))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, posX: parseInt(v, 10) || 0 };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("垂直偏移 (Y)")
      .setDesc("预览内容垂直偏移像素")
      .addText((t) =>
        t
          .setValue(String(inst.posY || 0))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, posY: parseInt(v, 10) || 0 };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    addTitleConfig(el, plugin, instanceId, save, {
      title: "网页预览",
      icon: "🌐",
      titleFontSize: 14,
    });
  },
};

export default widget;

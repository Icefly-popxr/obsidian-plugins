import { Setting, TFile } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel } from "./helpers";

/**
 * 媒体画廊组件（移植自 modular-theme-dashboard 的 media-gallery）
 *  - 扫描 vault 指定文件夹的图片/视频/音频文件
 *  - 三种展示模式：正方形(grid) / 瀑布流(masonry) / 全智能(auto)
 *  - 点击打开灯箱：图片放大、视频/音频内联播放、键盘 ←→ 导航
 *  - 工具栏：文件夹、媒体类型过滤、显示模式、刷新
 */

const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);
const VID_EXT = new Set(["mp4", "webm", "ogg", "mov", "m4v"]);
const AUD_EXT = new Set(["mp3", "wav", "flac", "m4a", "aac", "ogg"]);

function extOf(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

function typeOf(ext: string): "image" | "video" | "audio" | "other" {
  if (IMG_EXT.has(ext)) return "image";
  if (VID_EXT.has(ext)) return "video";
  if (AUD_EXT.has(ext)) return "audio";
  return "other";
}

function iconOf(type: string): string {
  return type === "video" ? "🎬" : type === "audio" ? "🎵" : "📄";
}

const widget: WorkbenchWidget = {
  id: "media-gallery",
  title: "媒体画廊",
  icon: "🎬",
  accent: "#ec4899",
  category: "media",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = ctx.widgetConfig || {};
    const instKey = ctx.instanceId;
    let scanFolder = String(cfg.scanFolder || "");
    let limit = Number(cfg.limit) || 50;
    let mediaType = String(cfg.mediaType || "all"); // all | image | video | audio
    let displayMode = String(cfg.displayMode || "square"); // square | masonry | auto

    const save = () => {
      const map = ctx.plugin.settings.widgetConfigs || {};
      map[instKey] = { ...(map[instKey] || {}), scanFolder, limit, mediaType, displayMode };
      ctx.plugin.settings.widgetConfigs = map;
      ctx.plugin.saveSettings();
    };

    const bd = createPanel(root, {
      id: "media-gallery",
      title: "媒体画廊",
      icon: "🎬",
      accent: "#ec4899",
    });
    bd.addClass("mg-wrap");

    // ── 工具栏 ──
    const bar = bd.createDiv({ cls: "mg-toolbar" });
    bar.createSpan({ cls: "mg-label", text: "📁" });
    const folderInput = bar.createEl("input", {
      cls: "mg-folder-input",
      attr: { placeholder: "文件夹（留空=全库）", value: scanFolder, spellcheck: "false" },
    });
    const countLabel = bar.createSpan({ cls: "mg-count", text: "" });

    const typeBtns: Record<string, HTMLButtonElement> = {};
    const types: { v: string; t: string }[] = [
      { v: "all", t: "全部" },
      { v: "image", t: "图片" },
      { v: "video", t: "视频" },
      { v: "audio", t: "音频" },
    ];
    types.forEach((tp) => {
      const b = bar.createEl("button", {
        cls: "mg-btn" + (mediaType === tp.v ? " active" : ""),
        text: tp.t,
      });
      typeBtns[tp.v] = b;
    });

    const modeBtns: Record<string, HTMLButtonElement> = {};
    const modes: { v: string; t: string }[] = [
      { v: "square", t: "▦" },
      { v: "masonry", t: "▥" },
      { v: "auto", t: "▧" },
    ];
    modes.forEach((m) => {
      const b = bar.createEl("button", {
        cls: "mg-btn" + (displayMode === m.v ? " active" : ""),
        text: m.t,
        attr: { title: m.v === "square" ? "正方形网格" : m.v === "masonry" ? "瀑布流" : "全智能" },
      });
      modeBtns[m.v] = b;
    });
    const refreshBtn = bar.createEl("button", { cls: "mg-btn", text: "⟳" });

    // ── 网格容器 ──
    const grid = bd.createDiv({ cls: "mg-grid" });

    const applyDisplayMode = () => {
      grid.removeClass("mg-grid-square");
      grid.removeClass("mg-grid-masonry");
      grid.removeClass("mg-grid-auto");
      if (displayMode === "masonry") grid.addClass("mg-grid-masonry");
      else if (displayMode === "auto") grid.addClass("mg-grid-auto");
      else grid.addClass("mg-grid-square");
    };

    // ── 灯箱 ──
    let lightbox: HTMLElement | null = null;
    let lightboxItems: TFile[] = [];
    let lightboxIdx = 0;

    const closeLightbox = () => {
      lightbox?.remove();
      lightbox = null;
      lightboxItems = [];
    };

    const renderLightbox = () => {
      if (!lightbox) return;
      lightbox.empty();
      const f = lightboxItems[lightboxIdx];
      if (!f) return;
      const type = typeOf(extOf(f.name));
      const src = ctx.app.vault.getResourcePath(f);
      const mediaBox = lightbox.createDiv({ cls: "mg-lb-media" });
      if (type === "image") {
        const img = mediaBox.createEl("img", { attr: { src } });
        img.style.maxWidth = "90vw";
        img.style.maxHeight = "80vh";
        img.style.borderRadius = "8px";
        img.style.objectFit = "contain";
      } else if (type === "video") {
        const v = mediaBox.createEl("video", { attr: { src, controls: "", autoplay: "" } });
        v.style.maxWidth = "90vw";
        v.style.maxHeight = "80vh";
      } else {
        const a = mediaBox.createEl("audio", { attr: { src, controls: "", autoplay: "" } });
        a.style.width = "80vw";
      }
      lightbox.createSpan({ cls: "mg-lb-name", text: f.basename });
      lightbox.createSpan({ cls: "mg-lb-close", text: "✕" }).addEventListener("click", closeLightbox);
      lightbox.createSpan({ cls: "mg-lb-prev", text: "‹" }).addEventListener("click", (e) => {
        e.stopPropagation();
        lightboxIdx = (lightboxIdx - 1 + lightboxItems.length) % lightboxItems.length;
        renderLightbox();
      });
      lightbox.createSpan({ cls: "mg-lb-next", text: "›" }).addEventListener("click", (e) => {
        e.stopPropagation();
        lightboxIdx = (lightboxIdx + 1) % lightboxItems.length;
        renderLightbox();
      });
    };

    const openLightbox = (items: TFile[], idx: number) => {
      closeLightbox();
      lightboxItems = items;
      lightboxIdx = idx;
      lightbox = document.body.createDiv({ cls: "mg-lightbox" });
      lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) closeLightbox();
      });
      renderLightbox();
    };

    // ── 扫描与渲染 ──
    const scanMedia = () => {
      const files = ctx.app.vault.getFiles().filter((f) => {
        const t = typeOf(extOf(f.name));
        if (t === "other") return false;
        if (mediaType !== "all" && t !== mediaType) return false;
        if (scanFolder && !f.path.startsWith(scanFolder)) return false;
        return true;
      });
      const sorted = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);
      const items = sorted.slice(0, limit);
      countLabel.setText(`${items.length}/${files.length}`);

      grid.empty();
      applyDisplayMode();

      if (items.length === 0) {
        grid.createDiv({ cls: "mg-empty", text: "该文件夹暂无媒体文件 🎬" });
        return;
      }

      items.forEach((f, i) => {
        const t = typeOf(extOf(f.name));
        const cell = grid.createDiv({ cls: "mg-item" + (displayMode === "square" ? " mg-square-cell" : "") });
        cell.title = f.basename;
        const src = ctx.app.vault.getResourcePath(f);
        if (t === "image") {
          const img = cell.createEl("img", { attr: { src, loading: "lazy" } });
          img.draggable = false;
        } else {
          cell.createSpan({ cls: "mg-item-icon", text: iconOf(t) });
        }
        const badge = cell.createSpan({ cls: "mg-item-type", text: t === "image" ? "" : t.toUpperCase() });
        if (t !== "image") badge.style.display = "block";
        cell.addEventListener("click", () => openLightbox(items, i));
      });
    };

    // ── 事件绑定 ──
    folderInput.addEventListener("change", () => {
      scanFolder = folderInput.value.trim();
      save();
      scanMedia();
    });
    folderInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        scanFolder = folderInput.value.trim();
        save();
        scanMedia();
      }
    });
    types.forEach((tp) => {
      typeBtns[tp.v].addEventListener("click", () => {
        mediaType = tp.v;
        Object.keys(typeBtns).forEach((k) => typeBtns[k].classList.toggle("active", k === tp.v));
        save();
        scanMedia();
      });
    });
    modes.forEach((m) => {
      modeBtns[m.v].addEventListener("click", () => {
        displayMode = m.v;
        Object.keys(modeBtns).forEach((k) => modeBtns[k].classList.toggle("active", k === m.v));
        save();
        scanMedia();
      });
    });
    refreshBtn.addEventListener("click", scanMedia);

    // 键盘导航（灯箱打开时）
    const onKey = (e: KeyboardEvent) => {
      if (!lightbox) return;
      if (e.key === "ArrowLeft") {
        lightboxIdx = (lightboxIdx - 1 + lightboxItems.length) % lightboxItems.length;
        renderLightbox();
      } else if (e.key === "ArrowRight") {
        lightboxIdx = (lightboxIdx + 1) % lightboxItems.length;
        renderLightbox();
      } else if (e.key === "Escape") {
        closeLightbox();
      }
    };
    window.addEventListener("keydown", onKey);
    // 组件卸载时清理（通过 DOM 关联标记）
    (grid as HTMLElement & { __mgCleanup?: () => void }).__mgCleanup = () => {
      window.removeEventListener("keydown", onKey);
      closeLightbox();
    };

    applyDisplayMode();
    // 延迟扫描，等布局完成
    setTimeout(scanMedia, 200);
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfg = plugin.settings.widgetConfigs || {};
    const inst = cfg[instanceId] || {};

    new Setting(el)
      .setName("扫描文件夹")
      .setDesc("要展示的媒体文件夹（相对库根，留空 = 全库）")
      .addText((t) =>
        t
          .setPlaceholder("例如：Attachments")
          .setValue(String(inst.scanFolder || ""))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, scanFolder: v.trim() };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("显示数量")
      .setDesc("最多展示多少条媒体（默认 50）")
      .addText((t) =>
        t
          .setPlaceholder("50")
          .setValue(String(inst.limit ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            cfg[instanceId] = { ...inst, limit: isNaN(n) || n <= 0 ? 50 : n };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("媒体类型")
      .setDesc("all=全部 / image=图片 / video=视频 / audio=音频")
      .addDropdown((dd) =>
        dd
          .addOption("all", "全部")
          .addOption("image", "图片")
          .addOption("video", "视频")
          .addOption("audio", "音频")
          .setValue(String(inst.mediaType || "all"))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, mediaType: v };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("展示模式")
      .setDesc("square=正方形网格 / masonry=瀑布流 / auto=全智能")
      .addDropdown((dd) =>
        dd
          .addOption("square", "正方形网格")
          .addOption("masonry", "瀑布流")
          .addOption("auto", "全智能")
          .setValue(String(inst.displayMode || "square"))
          .onChange((v) => {
            cfg[instanceId] = { ...inst, displayMode: v };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
  },
};

export default widget;

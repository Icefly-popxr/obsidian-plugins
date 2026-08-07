import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addTitleConfig, WidgetConfigDrawer } from "./helpers";

/**
 * 快捷入口组件（icon-grid）：图标入口矩阵
 *  - 每条目 = {图标 emoji, 文字, 动作}
 *  - 动作：page:页面（跳转工作台子页）/ file:路径（打开笔记）/ url:http（打开网页）
 *  - 配置右上角 ⚙️ 打开右侧抽屉，支持多实例（#N 后缀）
 */

interface IconItem {
  icon: string;
  label: string;
  action: string;
}

interface IconGridCfg {
  title?: string;
  icon?: string;
  titleFontSize?: number;
  items?: IconItem[];
  cols?: number;
}

const DEFAULT_ACCENT = "#0ea5e9";

const DEFAULT_ITEMS: IconItem[] = [
  { icon: "📚", label: "知识库", action: "page:domains" },
  { icon: "🗺️", label: "概念库", action: "page:wiki" },
  { icon: "🎧", label: "播客", action: "page:podcast" },
  { icon: "✅", label: "打卡", action: "page:board" },
];

function readCfg(ctx: WidgetCtx): IconGridCfg {
  const cfg = (ctx.widgetConfig || {}) as IconGridCfg;
  return {
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "🧭"),
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
    items: Array.isArray(cfg.items) && cfg.items.length > 0 ? cfg.items : DEFAULT_ITEMS,
    cols: typeof cfg.cols === "number" && cfg.cols > 0 ? cfg.cols : 4,
  };
}

/** 执行条目动作 */
function runAction(ctx: WidgetCtx, action: string) {
  const a = (action || "").trim();
  if (!a) return;
  if (a.startsWith("page:")) {
    ctx.goto(a.slice(5));
  } else if (a.startsWith("file:")) {
    ctx.openFile(a.slice(5));
  } else if (a.startsWith("url:")) {
    const url = a.slice(4);
    if (url) window.open(url, "_blank");
  }
}

const widget: WorkbenchWidget = {
  id: "icon-grid",
  title: "快捷入口",
  icon: "🧭",
  accent: DEFAULT_ACCENT,
  category: "universal",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const items = cfg.items || DEFAULT_ITEMS;

    const bd = createPanel(root, {
      id: "icon-grid",
      title: cfg.title || "快捷入口",
      icon: cfg.icon || "🧭",
      accent: DEFAULT_ACCENT,
      moreLabel: "⚙️",
      onMore: () => {
        new WidgetConfigDrawer(ctx.app, ctx.plugin, ctx.instanceId, widget).open();
      },
    });

    // 标题栏字号（含图标 emoji 跟随）
    const titleFontSize = cfg.titleFontSize || 14;
    const panel = bd.closest(".wb-panel");
    if (panel) {
      const ico = panel.querySelector<HTMLElement>(".wb-ico");
      const titleEl = panel.querySelector<HTMLElement>(".wb-title");
      if (ico) {
        ico.style.fontSize = `${titleFontSize}px`;
        ico.style.width = `${titleFontSize + 8}px`;
        ico.style.height = `${titleFontSize + 8}px`;
      }
      if (titleEl) titleEl.style.fontSize = `${titleFontSize}px`;
    }

    if (items.length === 0) {
      emptyState(bd, "暂无入口，点 ⚙️ 添加");
      return;
    }

    const cols = Math.min(6, Math.max(2, cfg.cols || 4));
    const grid = bd.createDiv({ cls: "wb-icon-grid" });
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    items.forEach((it) => {
      const cell = grid.createDiv({ cls: "wb-icon-cell" });
      const ico = cell.createDiv({ cls: "wb-icon-cell-ico", text: it.icon || "🔗" });
      ico.style.fontSize = "22px";
      cell.createDiv({ cls: "wb-icon-cell-label", text: it.label || "" });
      cell.addEventListener("click", () => runAction(ctx, it.action));
    });
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as IconGridCfg;

    const update = (patch: Partial<IconGridCfg>) => {
      const current = (cfgMap[instanceId] || {}) as IconGridCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    addTitleConfig(el, plugin, instanceId, save, {
      title: "快捷入口",
      icon: "🧭",
      titleFontSize: 14,
    });

    new Setting(el)
      .setName("每行数量")
      .setDesc("网格每行显示几个入口（2-6）")
      .addText((t) =>
        t
          .setPlaceholder("4")
          .setValue(String(inst.cols ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            update({ cols: isNaN(n) || n < 2 || n > 6 ? 4 : n });
          })
      );

    // ── 条目编辑器 ──
    el.createEl("h4", {
      text: "🔗 快捷入口",
      attr: { style: "margin:14px 0 6px;font-size:13px;font-weight:700;" },
    });
    el.createEl("p", {
      text: "每条 = 图标 + 文字 + 动作；动作格式：page:页面 / file:笔记路径 / url:https://…",
      cls: "setting-item-description",
    });

    const items = Array.isArray(inst.items) ? inst.items.map((x) => ({ ...x })) : DEFAULT_ITEMS.map((x) => ({ ...x }));
    const listWrap = el.createDiv({ cls: "wb-list-editor" });

    const renderEditor = () => {
      listWrap.empty();
      items.forEach((it, i) => {
        const row = listWrap.createDiv({
          attr: { style: "display:flex;align-items:center;gap:6px;margin-bottom:6px;" },
        });
        const iconInput = row.createEl("input");
        iconInput.value = it.icon;
        iconInput.placeholder = "emoji";
        iconInput.style.width = "44px";
        iconInput.style.padding = "4px 4px";
        iconInput.style.fontSize = "12px";
        iconInput.style.borderRadius = "6px";
        iconInput.style.border = "1px solid var(--background-modifier-border)";
        iconInput.addEventListener("input", () => {
          items[i].icon = iconInput.value.trim();
          update({ items: [...items] });
        });
        const labelInput = row.createEl("input");
        labelInput.value = it.label;
        labelInput.placeholder = "文字";
        labelInput.style.width = "70px";
        labelInput.style.padding = "4px 6px";
        labelInput.style.fontSize = "12px";
        labelInput.style.borderRadius = "6px";
        labelInput.style.border = "1px solid var(--background-modifier-border)";
        labelInput.addEventListener("input", () => {
          items[i].label = labelInput.value.trim();
          update({ items: [...items] });
        });
        const actionInput = row.createEl("input");
        actionInput.value = it.action;
        actionInput.placeholder = "page:domains / file:… / url:…";
        actionInput.style.flex = "1";
        actionInput.style.padding = "4px 6px";
        actionInput.style.fontSize = "12px";
        actionInput.style.borderRadius = "6px";
        actionInput.style.border = "1px solid var(--background-modifier-border)";
        actionInput.addEventListener("input", () => {
          items[i].action = actionInput.value.trim();
          update({ items: [...items] });
        });
        const del = row.createEl("button", { text: "🗑" });
        del.style.cursor = "pointer";
        del.style.fontSize = "12px";
        del.addEventListener("click", () => {
          items.splice(i, 1);
          update({ items: [...items] });
          renderEditor();
        });
      });
      const addBtn = listWrap.createEl("button", {
        text: "➕ 添加入口",
        attr: { style: "font-size:12px;padding:4px 12px;border-radius:6px;cursor:pointer;" },
      });
      addBtn.addEventListener("click", () => {
        items.push({ icon: "🔗", label: "", action: "" });
        update({ items: [...items] });
        renderEditor();
      });
    };
    renderEditor();
  },
};

export default widget;

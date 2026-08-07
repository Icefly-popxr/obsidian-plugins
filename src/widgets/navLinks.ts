import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addTitleConfig, WidgetConfigDrawer } from "./helpers";

/**
 * 页面导航组件（nav-links）：页面导航列表
 *  - 每条目 = {图标 emoji, 标题, 目标页}，点击跳转工作台子页
 *  - 配置右上角 ⚙️ 打开右侧抽屉，支持多实例（#N 后缀）
 */

interface NavItem {
  icon: string;
  title: string;
  page: string;
}

interface NavLinksCfg {
  title?: string;
  icon?: string;
  titleFontSize?: number;
  items?: NavItem[];
}

const DEFAULT_ACCENT = "#8b5cf6";

const PAGES: { id: string; label: string }[] = [
  { id: "home", label: "🏠 首页" },
  { id: "domains", label: "🧭 领域" },
  { id: "wiki", label: "🗺️ 概念库" },
  { id: "podcast", label: "🎧 播客" },
  { id: "board", label: "✅ 打卡" },
  { id: "news", label: "📰 行业新闻" },
  { id: "stocks", label: "📈 股票池" },
  { id: "topics", label: "🎯 选题池" },
  { id: "config", label: "⚙️ 系统配置" },
];

const DEFAULT_ITEMS: NavItem[] = [
  { icon: "🏠", title: "首页", page: "home" },
  { icon: "🧭", title: "领域", page: "domains" },
  { icon: "🗺️", title: "概念库", page: "wiki" },
  { icon: "✅", title: "打卡", page: "board" },
];

function readCfg(ctx: WidgetCtx): NavLinksCfg {
  const cfg = (ctx.widgetConfig || {}) as NavLinksCfg;
  return {
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "🧭"),
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
    items: Array.isArray(cfg.items) && cfg.items.length > 0 ? cfg.items : DEFAULT_ITEMS,
  };
}

const widget: WorkbenchWidget = {
  id: "nav-links",
  title: "页面导航",
  icon: "🧭",
  accent: DEFAULT_ACCENT,
  category: "universal",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);
    const items = cfg.items || DEFAULT_ITEMS;

    const bd = createPanel(root, {
      id: "nav-links",
      title: cfg.title || "页面导航",
      icon: cfg.icon || "🧭",
      accent: DEFAULT_ACCENT,
      moreLabel: "⚙️",
      cardStyle: String((ctx.widgetConfig || {}).cardStyle || ""),
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
      emptyState(bd, "暂无导航项，点 ⚙️ 添加");
      return;
    }

    items.forEach((it) => {
      const row = bd.createDiv({ cls: "wb-row wb-nav-row" });
      const ico = row.createDiv({ cls: "wb-ico", text: it.icon || "🔗" });
      ico.style.width = "22px";
      ico.style.height = "22px";
      ico.style.fontSize = "12px";
      row.createSpan({ cls: "wb-name", text: it.title || it.page });
      const go = row.createSpan({ cls: "wb-meta", text: "›" });
      void go;
      row.addEventListener("click", () => ctx.goto(it.page || "home"));
    });
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as NavLinksCfg;

    const update = (patch: Partial<NavLinksCfg>) => {
      const current = (cfgMap[instanceId] || {}) as NavLinksCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    addTitleConfig(el, plugin, instanceId, save, {
      title: "页面导航",
      icon: "🧭",
      titleFontSize: 14,
    });

    // ── 导航条目编辑器 ──
    el.createEl("h4", {
      text: "🧭 导航项",
      attr: { style: "margin:14px 0 6px;font-size:13px;font-weight:700;" },
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
        const titleInput = row.createEl("input");
        titleInput.value = it.title;
        titleInput.placeholder = "标题";
        titleInput.style.width = "80px";
        titleInput.style.padding = "4px 6px";
        titleInput.style.fontSize = "12px";
        titleInput.style.borderRadius = "6px";
        titleInput.style.border = "1px solid var(--background-modifier-border)";
        titleInput.addEventListener("input", () => {
          items[i].title = titleInput.value.trim();
          update({ items: [...items] });
        });
        const pageSel = row.createEl("select");
        PAGES.forEach((p) => {
          const opt = pageSel.createEl("option", { text: p.label });
          opt.value = p.id;
        });
        pageSel.value = it.page;
        pageSel.style.flex = "1";
        pageSel.style.padding = "4px 6px";
        pageSel.style.fontSize = "12px";
        pageSel.style.borderRadius = "6px";
        pageSel.style.border = "1px solid var(--background-modifier-border)";
        pageSel.addEventListener("change", () => {
          items[i].page = pageSel.value;
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
        text: "➕ 添加导航",
        attr: { style: "font-size:12px;padding:4px 12px;border-radius:6px;cursor:pointer;" },
      });
      addBtn.addEventListener("click", () => {
        items.push({ icon: "🔗", title: "", page: "home" });
        update({ items: [...items] });
        renderEditor();
      });
    };
    renderEditor();
  },
};

export default widget;

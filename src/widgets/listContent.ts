import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState, addFontSizeControls } from "./helpers";

/**
 * 通用清单组件（分类通用组件第二类）
 *  - 配置：标题 / 图标 / 清单条目（可勾选持久化）/ 是否显示勾选框
 *  - 标题字号在「标题」行内调整，条目字号在「清单条目」编辑区调整
 *  - 条目存 settings.widgetConfigs[instId]，改配置即改内容，无需改代码
 *  - 支持多实例（#N 后缀），每实例独立配置
 */

interface ListItem {
  text: string;
  done: boolean;
  tag?: string;
}

interface ListContentCfg {
  title?: string;
  icon?: string;
  items?: ListItem[];
  showCheckbox?: boolean;
  /** 标题栏字号（含图标 emoji 跟随） */
  titleFontSize?: number;
  /** 条目文字字号 */
  itemFontSize?: number;
}

const DEFAULT_ACCENT = "#34d399";

function readCfg(ctx: WidgetCtx): ListContentCfg {
  const cfg = (ctx.widgetConfig || {}) as ListContentCfg;
  return {
    title: String(cfg.title || ""),
    icon: String(cfg.icon || "☑️"),
    items: Array.isArray(cfg.items) ? cfg.items : [],
    showCheckbox: cfg.showCheckbox !== false,
    titleFontSize:
      typeof cfg.titleFontSize === "number" && cfg.titleFontSize > 0 ? cfg.titleFontSize : 14,
    itemFontSize:
      typeof cfg.itemFontSize === "number" && cfg.itemFontSize > 0 ? cfg.itemFontSize : 13,
  };
}

const widget: WorkbenchWidget = {
  id: "list-content",
  title: "清单列表",
  icon: "☑️",
  accent: DEFAULT_ACCENT,
  category: "universal",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const cfg = readCfg(ctx);

    const bd = createPanel(root, {
      id: "list-content",
      title: cfg.title || "清单列表",
      icon: cfg.icon || "☑️",
      accent: DEFAULT_ACCENT,
      moreLabel: "0/0",
    });

    // 标题栏字号：应用到标题文字 + 图标 emoji（跟随自适应）
    const titleFontSize = cfg.titleFontSize || 14;
    const itemFontSize = cfg.itemFontSize || 13;
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

    const items = cfg.items || [];
    // 右上角进度元素（done/total，勾选时实时更新）
    const moreEl = panel?.querySelector<HTMLElement>(".wb-more") || null;
    const updateProgress = () => {
      const done = items.filter((i) => i.done).length;
      if (moreEl) moreEl.setText(`${done}/${items.length}`);
    };

    // 保存条目到 widgetConfigs
    const saveItems = () => {
      const map = ctx.plugin.settings.widgetConfigs || {};
      map[ctx.instanceId] = { ...(map[ctx.instanceId] || {}), items: [...items] };
      ctx.plugin.settings.widgetConfigs = map;
      ctx.plugin.saveSettings();
    };

    const renderList = () => {
      listEl.empty();
      updateProgress();
      if (items.length === 0) {
        emptyState(listEl, "暂无条目，在下方添加第一条吧 ✍️");
        return;
      }
      items.forEach((it, i) => {
        const row = listEl.createDiv({ cls: "wb-task" + (it.done ? " done" : "") });
        if (cfg.showCheckbox) {
          const box = row.createDiv({ cls: "wb-box" + (it.done ? " on" : "") });
          box.addEventListener("click", () => {
            items[i].done = !items[i].done;
            saveItems();
            renderList();
          });
        }
        const nameEl = row.createSpan({ cls: "wb-name", text: it.text });
        nameEl.style.fontSize = `${itemFontSize}px`;
        if (it.tag) {
          const tagEl = row.createSpan({ cls: "wb-due", text: it.tag });
          tagEl.style.fontSize = `${Math.max(10, itemFontSize - 2)}px`;
        }
      });
    };

    const listEl = bd.createDiv({ cls: "wb-list-items" });
    renderList();

    // 组件内直接添加条目
    const inputRow = bd.createDiv({ cls: "dash-form" });
    const input = inputRow.createEl("input", { attr: { placeholder: "添加条目…" } });
    const addBtn = inputRow.createEl("button", { text: "➕" });
    const doAdd = () => {
      const text = input.value.trim();
      if (!text) return;
      items.push({ text, done: false });
      saveItems();
      input.value = "";
      renderList();
    };
    addBtn.addEventListener("click", doAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });

    void listEl;
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfgMap = plugin.settings.widgetConfigs || {};
    const inst = (cfgMap[instanceId] || {}) as ListContentCfg;

    // 基于当前已存配置合并（避免先填字段被后填覆盖）
    const update = (patch: Partial<ListContentCfg>) => {
      const current = (cfgMap[instanceId] || {}) as ListContentCfg;
      cfgMap[instanceId] = { ...current, ...patch };
      plugin.settings.widgetConfigs = cfgMap;
      save();
    };

    // 标题：输入框 + 同一行字号控件（标题文字与图标 emoji 跟随）
    const titleSetting = new Setting(el)
      .setName("标题")
      .setDesc("卡片标题栏文字（留空显示「清单列表」）");
    titleSetting.addText((t) =>
      t
        .setPlaceholder("例如：本周清单")
        .setValue(String(inst.title || ""))
        .onChange((v) => update({ title: v.trim() }))
    );
    addFontSizeControls(titleSetting, {
      value:
        typeof inst.titleFontSize === "number" && inst.titleFontSize > 0 ? inst.titleFontSize : 14,
      onChange: (v) => update({ titleFontSize: v }),
    });

    new Setting(el)
      .setName("图标")
      .setDesc("标题栏 emoji 图标")
      .addText((t) =>
        t
          .setPlaceholder("例如：☑️")
          .setValue(String(inst.icon || ""))
          .onChange((v) => update({ icon: v.trim() }))
      );

    new Setting(el)
      .setName("显示勾选框")
      .setDesc("关闭后只展示文字，不可勾选（纯清单展示）")
      .addToggle((tg) =>
        tg
          .setValue(inst.showCheckbox !== false)
          .onChange((v) => update({ showCheckbox: v }))
      );

    // ── 清单条目编辑器 ──
    el.createEl("h4", {
      text: "📋 清单条目",
      attr: { style: "margin:14px 0 6px;font-size:13px;font-weight:700;" },
    });

    // 条目字号：放在条目编辑区上方
    const itemSizeSetting = new Setting(el)
      .setName("条目字号")
      .setDesc("清单条目文字大小（px）");
    addFontSizeControls(itemSizeSetting, {
      value:
        typeof inst.itemFontSize === "number" && inst.itemFontSize > 0 ? inst.itemFontSize : 13,
      onChange: (v) => update({ itemFontSize: v }),
    });

    const items = Array.isArray(inst.items) ? inst.items.map((x) => ({ ...x })) : [];
    const listWrap = el.createDiv({ cls: "wb-list-editor" });

    const renderEditor = () => {
      listWrap.empty();
      items.forEach((it, i) => {
        const row = listWrap.createDiv({
          attr: { style: "display:flex;align-items:center;gap:6px;margin-bottom:6px;" },
        });
        const textInput = row.createEl("input");
        textInput.placeholder = "条目文字";
        textInput.value = it.text;
        textInput.style.flex = "1";
        textInput.style.padding = "4px 8px";
        textInput.style.fontSize = "12px";
        textInput.style.borderRadius = "6px";
        textInput.style.border = "1px solid var(--background-modifier-border)";
        textInput.addEventListener("input", () => {
          items[i].text = textInput.value;
          update({ items: [...items] });
        });
        const tagInput = row.createEl("input");
        tagInput.placeholder = "标签";
        tagInput.value = it.tag || "";
        tagInput.style.width = "64px";
        tagInput.style.padding = "4px 8px";
        tagInput.style.fontSize = "12px";
        tagInput.style.borderRadius = "6px";
        tagInput.style.border = "1px solid var(--background-modifier-border)";
        tagInput.addEventListener("input", () => {
          items[i].tag = tagInput.value.trim();
          update({ items: [...items] });
        });
        const doneBtn = row.createEl("button", {
          text: it.done ? "✓" : "○",
          attr: { title: "默认勾选状态" },
        });
        doneBtn.style.cursor = "pointer";
        doneBtn.style.fontSize = "13px";
        doneBtn.addEventListener("click", () => {
          items[i].done = !items[i].done;
          doneBtn.setText(items[i].done ? "✓" : "○");
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
      // 添加条目按钮
      const addBtn = listWrap.createEl("button", {
        text: "➕ 添加条目",
        attr: { style: "font-size:12px;padding:4px 12px;border-radius:6px;cursor:pointer;" },
      });
      addBtn.addEventListener("click", () => {
        items.push({ text: "", done: false });
        update({ items: [...items] });
        renderEditor();
      });
    };
    renderEditor();
  },
};

export default widget;

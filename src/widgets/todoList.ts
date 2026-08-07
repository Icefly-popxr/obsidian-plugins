import { Setting } from "obsidian";
import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel, emptyState } from "./helpers";
import { loadSharedData, saveSharedData } from "../services/sharedStore";

interface TodayTodo {
  text: string;
  done: boolean;
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** 今日待办：vault 任务 + 手动添加（跨天自动重置/勾选/删除） */
const widget: WorkbenchWidget = {
  id: "todo-list",
  title: "今日待办",
  icon: "✅",
  accent: "#34d399",
  category: "schedule",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const maxItems = Number(ctx.widgetConfig.maxItems) || 8;
    const bd = createPanel(root, {
      id: "todo-list",
      title: "今日待办",
      icon: "✅",
      accent: "#34d399",
      moreLabel: "查看全部",
      onMore: () => ctx.goto("board"),
    });

    // 今日手动待办（跨天自动重置：非今天的 key 不显示）
    const key = todayKey();
    const todos = ctx.sharedData.todayTodos[key] || [];
    const saveTodos = (list: TodayTodo[]) => {
      const map = { ...(ctx.sharedData.todayTodos || {}) };
      map[key] = list;
      ctx.sharedData.todayTodos = map;
      ctx.saveShared();
    };

    const renderList = () => {
      listEl.empty();
      const vaultTasks = ctx.data.tasks.today.slice(0, maxItems);
      if (vaultTasks.length === 0 && todos.length === 0) {
        emptyState(listEl, "今日无待办 ⛵");
      }
      // 手动待办（可勾选/删除）
      todos.forEach((t, i) => {
        const row = listEl.createDiv({ cls: "wb-task" + (t.done ? " done" : "") });
        const box = row.createDiv({ cls: "wb-box" });
        row.createSpan({ cls: "wb-name", text: t.text });
        box.addEventListener("click", () => {
          todos[i].done = !todos[i].done;
          saveTodos(todos);
          renderList();
        });
        row.createSpan({
          cls: "wb-meta",
          text: "✕",
          attr: { style: "cursor:pointer;color:var(--wb-sub);" },
        }).addEventListener("click", () => {
          todos.splice(i, 1);
          saveTodos(todos);
          renderList();
        });
      });
      // vault 任务（点击打开）
      for (const t of vaultTasks) {
        const row = listEl.createDiv({ cls: "wb-task" });
        row.createDiv({ cls: "wb-box" });
        row.createSpan({ cls: "wb-name", text: t.text });
        if (t.due) row.createSpan({ cls: "wb-due", text: t.due.slice(5) });
        row.addEventListener("click", () => ctx.openFile(t.path));
      }
      const overdue = ctx.data.tasks.overdue.length;
      if (overdue > 0) {
        listEl.createDiv({ cls: "wb-row" }).createSpan({
          cls: "wb-name",
          text: `⚠️ ${overdue} 个逾期任务`,
        });
      }
    };

    // 添加输入框
    const inputRow = bd.createDiv({ cls: "dash-form" });
    const input = inputRow.createEl("input", {
      attr: { placeholder: "添加今日待办…" },
    });
    const addBtn = inputRow.createEl("button", { text: "➕" });
    const doAdd = () => {
      const text = input.value.trim();
      if (!text) return;
      todos.push({ text, done: false });
      saveTodos(todos);
      input.value = "";
      renderList();
    };
    addBtn.addEventListener("click", doAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });

    const listEl = bd.createDiv();
    renderList();
  },
  renderSettings(el, plugin, instanceId, save) {
    const cfg = plugin.settings.widgetConfigs || {};
    const inst = cfg[instanceId] || {};
    new Setting(el)
      .setName("显示条数")
      .setDesc("vault 待办最多显示多少条（默认 8）")
      .addText((text) =>
        text
          .setPlaceholder("8")
          .setValue(String(inst.maxItems ?? ""))
          .onChange((v) => {
            const n = parseInt(v, 10);
            cfg[instanceId] = { ...inst, maxItems: isNaN(n) || n <= 0 ? 8 : n };
            plugin.settings.widgetConfigs = cfg;
            save();
          })
      );
    new Setting(el)
      .setName("清空今日手动待办")
      .setDesc("删除今天添加的全部手动待办")
      .addButton((b) =>
        b.setButtonText("清空").setWarning().onClick(async () => {
          const shared = await loadSharedData(plugin.app);
          const map = { ...(shared.todayTodos || {}) };
          map[todayKey()] = [];
          shared.todayTodos = map;
          await saveSharedData(plugin.app, shared);
          save();
        })
      );
  },
};

export default widget;

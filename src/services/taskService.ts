import { App } from "obsidian";
import { filesUnder } from "./vaultService";

export interface TaskItem {
  path: string;
  line: number;
  text: string;
  done: boolean;
  due: string;    // YYYY-MM-DD（可空）
}

const TASK_RE = /^\s*[-*] \[([ xX])\]\s+(.*)$/;
const DUE_RE = /(?:📅|due)\s*[（(]?\s*(\d{4}-\d{2}-\d{2})/i;

function parseDue(text: string): string {
  const m = text.match(DUE_RE);
  return m ? m[1] : "";
}

function todayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 扫描指定目录下所有 md 中的任务行 */
export async function scanTasks(app: App, basePath: string): Promise<TaskItem[]> {
  const files = basePath
    ? filesUnder(app, basePath)
    : app.vault.getMarkdownFiles();

  const out: TaskItem[] = [];
  for (const f of files) {
    // 跳过备份/归档
    if (f.path.includes("_bak") || f.path.includes("/04 - Archive 归档/")) continue;
    const content = await app.vault.cachedRead(f);
    const lines = content.split("\n");
    lines.forEach((raw, idx) => {
      const m = raw.match(TASK_RE);
      if (!m) return;
      out.push({
        path: f.path,
        line: idx + 1,
        text: m[2].trim(),
        done: m[1].toLowerCase() === "x",
        due: parseDue(m[2]),
      });
    });
  }
  return out;
}

export interface TaskSummary {
  today: TaskItem[];       // 今天到期或未标记到期未完成
  overdue: TaskItem[];     // 已过期的未完成任务
  open: TaskItem[];        // 未完成（无日期）
  doneToday: number;
  total: number;
}

export async function summarizeTasks(app: App, basePath: string): Promise<TaskSummary> {
  const tasks = await scanTasks(app, basePath);
  const today = todayStr(new Date());
  const doneTasks = tasks.filter((t) => t.done);
  const openTasks = tasks.filter((t) => !t.done);

  const overdue = openTasks.filter((t) => t.due && t.due < today);
  const todayList = openTasks.filter(
    (t) => !t.due || t.due === today
  );
  const open = openTasks.filter((t) => !t.due);

  return {
    today: todayList,
    overdue,
    open,
    doneToday: doneTasks.filter((t) => t.due === today).length,
    total: tasks.length,
  };
}

import { App, TFile, TFolder } from "obsidian";

/** 工作台统计数据 */
export interface WorkbenchStats {
  totalNotes: number;
  kcCards: number;
  domains: number;
  todayAdded: number;
  todayTasksDone: number;
  todayTasksTotal: number;
}

export interface RecentFile {
  path: string;
  name: string;
  mtime: number;
  folder: string;
}

/** 工具：过滤指定目录下所有 md 文件（相对库根） */
export function filesUnder(app: App, folderPath: string): TFile[] {
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder || !(folder instanceof TFolder)) return [];
  const out: TFile[] = [];
  const walk = (f: TFolder) => {
    for (const child of f.children) {
      if (child instanceof TFolder) walk(child);
      else if (child instanceof TFile && child.extension === "md") out.push(child);
    }
  };
  walk(folder);
  return out;
}

/** 全库扫描统计 */
export async function computeStats(app: App, basePath: string): Promise<WorkbenchStats> {
  const files = app.vault.getMarkdownFiles();
  const base = basePath ? filesUnder(app, basePath) : files;
  const areas = basePath
    ? filesUnder(app, basePath + "/02 - Areas 领域")
    : files.filter((f) => f.path.includes("/02 - Areas 领域/"));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayStart = new Date(todayStr).getTime();

  const kcCards = areas.filter((f) => f.basename.startsWith("KC-")).length;
  const domains = new Set(
    base.filter((f) => f.path.includes("/02 - Areas 领域/"))
        .map((f) => {
          const seg = f.path.split("/02 - Areas 领域/")[1] || "";
          return seg.split("/")[0];
        })
        .filter(Boolean)
  ).size;

  const todayAdded = base.filter((f) => f.stat.ctime >= todayStart).length;

  return {
    totalNotes: base.length,
    kcCards,
    domains,
    todayAdded,
    todayTasksDone: 0,
    todayTasksTotal: 0,
  };
}

/** 最近更新文件 */
export function recentFiles(app: App, basePath: string, n = 5): RecentFile[] {
  const files = basePath ? filesUnder(app, basePath) : app.vault.getMarkdownFiles();
  return files
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .slice(0, n)
    .map((f) => ({
      path: f.path,
      name: f.basename,
      mtime: f.stat.mtime,
      folder: f.path.split("/").slice(0, -1).join("/") || "/",
    }));
}

/** 打开文件（在工作区新标签打开） */
export function openFile(app: App, path: string): void {
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    app.workspace.getLeaf(true).openFile(file);
  }
}

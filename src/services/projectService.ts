import { App, TFile } from "obsidian";
import { filesUnder } from "./vaultService";

export interface Project {
  path: string;
  name: string;
  goal: string;
  keyResults: string[];
  nextStep: string;
  progress: number;   // 0-100，从 _项目.md frontmatter 或估算
  updated: number;
}

function readStr(fm: Record<string, unknown> | undefined, key: string): string {
  if (!fm) return "";
  const v = fm[key];
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return (v as unknown[]).map(String).join(" / ");
  return String(v).trim();
}

function readList(fm: Record<string, unknown> | undefined, key: string): string[] {
  if (!fm) return [];
  const v = fm[key];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.split("\n").filter(Boolean);
  return [];
}

/** 扫描 01 - Projects 下各项目的 _项目.md */
export function scanProjects(app: App, basePath: string): Project[] {
  const root = basePath ? basePath + "/01 - Projects 项目" : "01 - Projects 项目";
  const projectFiles = filesUnder(app, root).filter(
    (f) => f.basename === "_项目" || f.basename.startsWith("_项目")
  );

  return projectFiles.map((f: TFile): Project => {
    const cache = app.metadataCache.getFileCache(f);
    const fm = cache?.frontmatter as Record<string, unknown> | undefined;
    const folder = f.path.split("/").slice(0, -1).pop() || f.basename;
    const krs = readList(fm, "keyResults");
    const done = readList(fm, "keyResultsDone");
    const progress =
      krs.length > 0 ? Math.round((done.length / krs.length) * 100) : 0;

    return {
      path: f.path,
      name: folder,
      goal: readStr(fm, "goal") || readStr(fm, "目标") || "",
      keyResults: krs,
      nextStep: readStr(fm, "nextStep") || readStr(fm, "下一步") || "",
      progress: Math.min(100, Math.max(0, progress)),
      updated: f.stat.mtime,
    };
  });
}

import { App, TFile } from "obsidian";
import { filesUnder } from "./vaultService";

export interface KcCard {
  path: string;
  id: string;        // frontmatter id 或文件名
  name: string;      // 文件名（去扩展名）
  level: string;     // L1/L2/L3
  gates: string;     // 通过 / 未通过
  domain: string;    // 领域
  review: string;    // 复习日期 YYYY-MM-DD（可为空）
  mtime: number;
  tags: string[];
}

function readField(fm: Record<string, unknown> | undefined, key: string): string {
  if (!fm) return "";
  const v = fm[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/** 扫描 KC-* 知识卡片 */
export function scanKcCards(app: App, basePath: string): KcCard[] {
  const areas = basePath
    ? filesUnder(app, basePath + "/02 - Areas 领域")
    : app.vault
        .getMarkdownFiles()
        .filter((f) => f.path.includes("/02 - Areas 领域/"));

  return areas
    .filter((f) => f.basename.startsWith("KC-"))
    .map((f: TFile): KcCard => {
      const cache = app.metadataCache.getFileCache(f);
      const fm = cache?.frontmatter as Record<string, unknown> | undefined;
      const domain = f.path.split("/02 - Areas 领域/")[1]?.split("/")[0] || "未分类";
      return {
        path: f.path,
        id: readField(fm, "id") || f.basename,
        name: f.basename,
        level: readField(fm, "level") || "L1",
        gates: readField(fm, "gates") || "",
        domain,
        review: readField(fm, "review"),
        mtime: f.stat.mtime,
        tags: Array.isArray(fm?.tags) ? (fm!.tags as string[]).map(String) : [],
      };
    });
}

/** 按领域分组 */
export function groupByDomain(cards: KcCard[]): Map<string, KcCard[]> {
  const m = new Map<string, KcCard[]>();
  for (const c of cards) {
    const arr = m.get(c.domain) || [];
    arr.push(c);
    m.set(c.domain, arr);
  }
  return m;
}

/** 到期复习卡片（review 日期 < 今天） */
export function dueCards(cards: KcCard[], today: Date = new Date()): KcCard[] {
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return cards
    .filter((c) => c.review && c.review <= todayStr)
    .sort((a, b) => (a.review < b.review ? -1 : 1));
}

import type { WorkbenchWidget } from "./types";
import statKpi from "./statKpi";
import checkin from "./checkin";
import recentFiles from "./recentFiles";
import objectives from "./objectives";
import inbox from "./inbox";
import review from "./review";
import clippings from "./clippings";
import kcLibrary from "./kcLibrary";
import charts from "./charts";
import maskedHeading from "./maskedHeading";
import webPreview from "./webPreview";
import mediaGallery from "./mediaGallery";
import directory from "./directory";
import dailyProgress from "./dailyProgress";
import dailyQuote from "./dailyQuote";
import textContent from "./textContent";
import listContent from "./listContent";
import calendar from "./calendar";
import iconGrid from "./iconGrid";
import navLinks from "./navLinks";

/** 工作台首页 widget 注册表：按此顺序渲染 */
export const WIDGETS: WorkbenchWidget[] = [
  statKpi,
  checkin,
  recentFiles,
  objectives,
  inbox,
  review,
  clippings,
  kcLibrary,
  charts,
  maskedHeading,
  webPreview,
  mediaGallery,
  directory,
  dailyProgress,
  dailyQuote,
  textContent,
  listContent,
  calendar,
  iconGrid,
  navLinks,
];

/** 按 id 查找 widget */
export function getWidget(id: string): WorkbenchWidget | undefined {
  return WIDGETS.find((w) => w.id === id);
}

/** 组件分类定义（参考 modular-theme-dashboard 的 CATEGORIES） */
export interface WidgetCategory {
  id: string;
  icon: string;
  name: string;
}

export const CATEGORIES: WidgetCategory[] = [
  { id: "schedule", icon: "📅", name: "计划" },
  { id: "stats", icon: "📊", name: "统计" },
  { id: "notes", icon: "📝", name: "笔记" },
  { id: "files", icon: "📂", name: "文件" },
  { id: "web", icon: "🌐", name: "网络" },
  { id: "media", icon: "🎬", name: "媒体" },
  { id: "decor", icon: "🎨", name: "装饰" },
  { id: "universal", icon: "🧭", name: "导航" },
];

/** 获取组件所属分类（未匹配归入 other） */
export function getCategoryOf(w: WorkbenchWidget): WidgetCategory {
  return CATEGORIES.find((c) => c.id === w.category) || {
    id: "other",
    icon: "📦",
    name: "其他",
  };
}

/** 按分类分组（返回分类 → 组件数组，保留注册顺序） */
export function groupWidgetsByCategory(): Map<string, WorkbenchWidget[]> {
  const map = new Map<string, WorkbenchWidget[]>();
  for (const w of WIDGETS) {
    const catId = getCategoryOf(w).id;
    const arr = map.get(catId) || [];
    arr.push(w);
    map.set(catId, arr);
  }
  return map;
}

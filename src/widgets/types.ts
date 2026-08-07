import type { App, TFile } from "obsidian";
import type KnowledgeWorkbenchPlugin from "../main";
import type { KcCard } from "../services/kcService";
import type { Project } from "../services/projectService";
import type { TaskSummary } from "../services/taskService";
import type { HabitData } from "../services/habitService";
import type { WorkbenchStats, RecentFile } from "../services/vaultService";
import type { SharedData } from "../services/sharedStore";

/** 工作台首页所需的全量数据 */
export interface LoadedData {
  stats: WorkbenchStats;
  kcCards: KcCard[];
  projects: Project[];
  tasks: TaskSummary;
  recent: RecentFile[];
  inbox: TFile[];
  clippings: TFile[];
}

/** 渲染上下文：widget 可用的全部能力（由 WorkbenchView 构造注入） */
export interface WidgetCtx {
  app: App;
  plugin: KnowledgeWorkbenchPlugin;
  data: LoadedData;
  /** 当前实例 id（如 "todo-list" / "todo-list#1"），多实例时用于配置隔离 */
  instanceId: string;
  /** 当前实例的通用配置（settings.widgetConfigs[instanceId]），无则空对象 */
  widgetConfig: Record<string, unknown>;
  /** 共享数据（vault 00_工具/工作台数据.json，与 Web 端共用） */
  sharedData: SharedData;
  /** 保存共享数据到 vault 共享文件 */
  saveShared: () => void;
  /** 跳转到指定页面 */
  goto: (page: string) => void;
  /** 打开文件（新标签） */
  openFile: (path: string) => void;
  /** 格式化时间戳为 MM-DD */
  fmtDate: (ts: number) => string;
  /** 等级 → CSS 类（l1/l2/l3） */
  levelCls: (level: string) => string;
  /** 打卡数据读取/保存 */
  habitData: () => HabitData;
  saveHabitData: (data: HabitData) => void;
  /** 简化柱状图 */
  drawBarChart: (container: HTMLElement, data: [string, number][]) => void;
}

/**
 * 工作台 Widget 协议（参考 modular-theme-dashboard 的模块协议，
 * 改为 TS 静态注册，无 eval、可类型检查）。
 *
 * render() 负责创建**完整卡片**（含 .wb-panel / .wb-kpi-card / .wb-chart 外壳
 * 与 .wb-resize-handle），布局系统会自动接管拖拽/缩放/位置持久化。
 */
export interface WorkbenchWidget {
  /** 唯一 id（用于 dashboardLayout 持久化与 data-id） */
  id: string;
  /** 显示标题 */
  title: string;
  /** 标题图标（emoji） */
  icon: string;
  /** 主色调（十六进制，注入 --w-accent） */
  accent: string;
  /** 分类 id（对应 registry.CATEGORIES 的 id，未匹配归入 other） */
  category?: string;
  /** 渲染入口 */
  render(ctx: WidgetCtx, root: HTMLElement): void;
  /** 卸载清理（定时器等），可选 */
  onunload?(): void;
  /**
   * 渲染该组件实例的设置面板（插件设置页"组件管理"中手风琴展开）。
   * el 为设置容器；instanceId 为当前实例（含 #N 后缀）；save 用于保存 settings。
   */
  renderSettings?(
    el: HTMLElement,
    plugin: KnowledgeWorkbenchPlugin,
    instanceId: string,
    save: () => void
  ): void;
}

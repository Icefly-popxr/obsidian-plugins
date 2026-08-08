import { ItemView, WorkspaceLeaf, Notice, Modal, setIcon, App, MarkdownRenderer } from "obsidian";
import type KnowledgeWorkbenchPlugin from "../main";
import { DEFAULT_HERO_ACTIONS, openHeroMediaPicker } from "../main";
import {
  computeStats,
  recentFiles,
  openFile,
  filesUnder,
} from "../services/vaultService";
import { scanKcCards, groupByDomain, dueCards } from "../services/kcService";
import { scanProjects } from "../services/projectService";
import { summarizeTasks } from "../services/taskService";
import {
  buildHabitRecords,
  toggleHabit,
  lastNDays,
  HabitData,
  defaultHabits,
} from "../services/habitService";
import {
  EnglishRecord,
  englishGroupForToday,
  findTodayRecord,
  calcEnglishTotal,
  calcEnglishStreak,
  calcMasteredWords,
  last30Days as englishLast30,
  ENGLISH_MILESTONES,
} from "../services/englishService";
import {
  fetchNewsByCategory,
  fetchAllNews,
  NewsItem,
  NEWS_CAT_TITLES,
} from "../services/newsService";
import { TFile } from "obsidian";
import { WIDGETS, getWidget, CATEGORIES, groupWidgetsByCategory } from "../widgets/registry";
import { loadSharedData, saveSharedData, SharedData, defaultSharedData } from "../services/sharedStore";
import { DashboardLayoutManager } from "./dashboardLayout";
import { buildEffects } from "./effects";
import type { WidgetCtx, LoadedData } from "../widgets/types";

export const WORKBENCH_VIEW_TYPE = "knowledge-workbench-view";

/** 播客收听统计 → 最近 30 天是否有收听的布尔数组（旧 → 新） */
function podcastLast30Days(stat: Record<string, Record<string, number>>): boolean[] {
  const out: boolean[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayStat = stat[key];
    out.push(!!dayStat && Object.keys(dayStat).length > 0);
  }
  return out;
}

type Page = "home" | "domains" | "wiki" | "podcast" | "board" | "config" | "news" | "stocks" | "topics" | "skills";

export class WorkbenchView extends ItemView {
  plugin: KnowledgeWorkbenchPlugin;
  private page: Page = "home";
  private data: LoadedData | null = null;
  /** 已构建动效的清理函数（重渲染 / 关闭视图时统一释放，如 WebGL 上下文） */
  private effectDisposers: Array<() => void> = [];
  private bgLayer: HTMLElement | null = null;
  /** 共享数据（vault 00_工具/工作台数据.json，与 Web 端共用一份） */
  private sharedData: SharedData = defaultSharedData();
  /** 自由布局管理器（拖拽/缩放/参考线，E1 拆分独立模块） */
  private layoutMgr: DashboardLayoutManager;

  constructor(leaf: WorkspaceLeaf, plugin: KnowledgeWorkbenchPlugin) {
    super(leaf);
    this.plugin = plugin;
    // 布局管理器：文档级事件交给 registerDomEvent（视图关闭自动注销）
    this.layoutMgr = new DashboardLayoutManager(this.plugin, (type, cb) =>
      this.registerDomEvent(document, type as keyof DocumentEventMap, cb)
    );
  }

  getViewType(): string {
    return WORKBENCH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "🏴‍☠️ 知识库工作台";
  }

  getIcon(): string {
    return "anchor";
  }

  async onOpen() {
    await this.reload();
  }

  async onClose() {
    this.disposeEffects();
    this.cleanupWidgets();
    this.bgLayer = null;
    this.containerEl.empty();
  }

  /** 释放已构建的背景动效资源 */
  private disposeEffects() {
    for (const dispose of this.effectDisposers) {
      try {
        dispose();
      } catch (e) {
        console.error("[workbench] 动效释放失败", e);
      }
    }
    this.effectDisposers = [];
  }

  /** 清理所有已启用 widget 的实例资源（window 监听 / observer 等） */
  private cleanupWidgets() {
    const active = this.plugin.settings.activeWidgets?.length
      ? this.plugin.settings.activeWidgets
      : WIDGETS.map((w) => w.id);
    for (const instId of active) {
      const [baseId] = instId.split("#");
      const w = getWidget(baseId);
      if (!w || typeof w.onunload !== "function") continue;
      try {
        w.onunload();
      } catch (e) {
        console.error(`[workbench] widget ${baseId} onunload 失败`, e);
      }
    }
  }

  /** 全量扫描结果缓存（TTL 60s，避免频繁重复全库扫描） */
  private scanCache: { data: LoadedData; ts: number } | null = null;

  /** 全量加载数据并渲染（force=true 强制重新扫描，跳过缓存） */
  async reload(force = false) {
    const now = Date.now();
    // 缓存命中（60s 内）且非强制刷新 → 直接用缓存数据，不重复扫描
    if (!force && this.scanCache && now - this.scanCache.ts < 60_000) {
      this.data = this.scanCache.data;
      this.sharedData = await loadSharedData(this.app);
      this.render();
      return;
    }
    // 首次加载（尚无数据）时先显示骨架屏，数据就绪后 render() 替换
    if (!this.data) this.renderSkeleton();

    const base = this.plugin.settings.knowledgeBasePath;
    const [stats, kcCards, projects, tasks, recent] = await Promise.all([
      computeStats(this.app, base),
      Promise.resolve(scanKcCards(this.app, base)),
      Promise.resolve(scanProjects(this.app, base)),
      summarizeTasks(this.app, base),
      Promise.resolve(recentFiles(this.app, base, 6)),
    ]);

    const inboxRoot = base ? `${base}/00 - Inbox 灵感库` : "00 - Inbox 灵感库";
    const clipRoot = base ? `${base}/03 - Resources 参考资料` : "03 - Resources 参考资料";
    const inbox = filesUnder(this.app, inboxRoot);
    const clippings = filesUnder(this.app, clipRoot).filter(
      (f) => f.path.includes("Clipping") || f.path.includes("剪藏")
    );

    const data: LoadedData = { stats, kcCards, projects, tasks, recent, inbox, clippings };
    this.data = data;
    this.scanCache = { data, ts: now };
    // 加载共享数据（vault 00_工具/工作台数据.json，与 Web 端共用）
    this.sharedData = await loadSharedData(this.app);
    this.render();
  }

  /** 骨架屏：加载中的占位布局（hero 条 + KPI 块 + 列表行） */
  private renderSkeleton() {
    this.containerEl.empty();
    const wrap = this.containerEl.createDiv({ cls: "workbench-container" });

    // 侧边栏占位
    const sb = wrap.createDiv({ cls: "wb-sidebar wb-sk-sidebar" });
    for (let i = 0; i < 6; i++) {
      sb.createDiv({ cls: "wb-sk-row" });
    }

    const main = wrap.createDiv({ cls: "wb-main" });
    // hero 占位
    const hero = main.createDiv({ cls: "wb-sk-hero" });
    hero.createDiv({ cls: "wb-sk-line w70" });
    hero.createDiv({ cls: "wb-sk-line w40" });
    // KPI 块
    const kpi = main.createDiv({ cls: "wb-sk-grid" });
    for (let i = 0; i < 6; i++) {
      kpi.createDiv({ cls: "wb-sk-card" });
    }
    // 列表行
    const list = main.createDiv({ cls: "wb-sk-list" });
    for (let i = 0; i < 5; i++) {
      const row = list.createDiv({ cls: "wb-sk-row" });
      void row;
    }
  }

  /** 主渲染入口：按当前页绘制 */
  render() {
    this.containerEl.empty();
    const wrap = this.containerEl.createDiv({ cls: "workbench-container" });

    // 每次渲染重建（DOM 已清空，旧引用失效），先释放旧 WebGL 上下文与 widget 资源
    this.disposeEffects();
    this.cleanupWidgets();
    this.bgLayer = null;

    // 左侧竖栏 + 主内容区（首页与子页共用骨架）
    this.buildSidebar(wrap);
    const main = wrap.createDiv({ cls: "wb-main" });
    this.buildHero(main);

    // 页面级动效（气泡 / 海浪 / 罗盘）：按注册表分项开关构建
    this.effectDisposers.push(
      ...buildEffects(wrap, "page", this.plugin.settings.effects, this.plugin.settings.showEffects)
    );

    if (!this.data) {
      main.createDiv({ cls: "wb-empty", text: "⛵ 正在探索海域…" });
      return;
    }

    if (this.page === "home") {
      this.renderHome(main);
      // 首页自由布局：位置初始化 + 视口揭示（光圈效果按实例配置在 renderWidgetCanvas 内处理）
      this.layoutMgr.init(main);
      this.attachRevealObserver(main);
    } else {
      this.renderPage(main);
      // 子页面组件画布：渲染该页组件并启用自由布局（选择器限定画布内，固定面板不受影响）
      const canvas = this.renderWidgetCanvas(main, this.page);
      if (canvas) {
        this.layoutMgr.init(main);
        this.attachRevealObserver(main);
      }
    }
  }

  /** 侧边栏菜单：Logo + 分组（概览/知识库/雷达追踪/系统）+ 底部收起按钮，点击切换当前页 */
  private buildSidebar(wrap: HTMLElement) {
    const sb = wrap.createDiv({ cls: "wb-sidebar" });
    const collapsed = !!this.plugin.settings.sidebarCollapsed;
    if (collapsed) sb.addClass("collapsed");

    // 顶部 Logo
    const logo = sb.createDiv({ cls: "wb-sidebar-logo" });
    logo.createSpan({ cls: "wb-sidebar-logo__icon", text: "⚓" });
    logo.createSpan({ cls: "wb-sidebar-logo__text", text: "Workbench" });

    // 分组定义（行业新闻暂留，拆分后再删）
    const groups: { title: string; system?: boolean; items: [string, string, Page][] }[] = [
      { title: "概览", items: [["🏠", "首页", "home"]] },
      {
        title: "知识库",
        items: [
          ["🌌", "星空图", "wiki"], // 原概念库
          ["🃏", "卡片集", "domains"], // 原知识领域
          ["🎧", "播客集", "podcast"],
          ["✅", "日迹录", "board"],
          ["🛠️", "技能库", "skills"], // 新增占位页
        ],
      },
      {
        title: "雷达追踪",
        items: [
          ["📈", "股票池", "stocks"],
          ["🎯", "选题池", "topics"],
          ["📰", "行业新闻", "news"],
        ],
      },
      { title: "系统", system: true, items: [["⚙️", "系统配置", "config"]] },
    ];

    for (const g of groups) {
      const group = sb.createDiv({
        cls: "wb-side-group" + (g.system ? " wb-side-group--system" : ""),
      });
      group.createDiv({ cls: "wb-side-group__title", text: g.title });
      for (const [icon, label, page] of g.items) {
        const item = group.createDiv({
          cls: "wb-side-item" + (this.page === page ? " active" : ""),
        });
        item.createSpan({ cls: "wb-side-icon", text: icon });
        item.createSpan({ cls: "wb-side-label", text: label });
        item.addEventListener("click", () => this.goto(page));
      }
    }

    // 收起/展开按钮（置底）
    const toggle = sb.createDiv({ cls: "wb-side-toggle" });
    toggle.createSpan({ cls: "wb-side-icon", text: collapsed ? "▶" : "◀" });
    toggle.createSpan({ cls: "wb-side-label", text: collapsed ? "展开" : "收起" });
    toggle.addEventListener("click", () => {
      const nowCollapsed = sb.classList.toggle("collapsed");
      this.plugin.settings.sidebarCollapsed = nowCollapsed;
      this.plugin.saveSettings();
      toggle.children[0].setText(nowCollapsed ? "▶" : "◀");
      toggle.children[1].setText(nowCollapsed ? "展开" : "收起");
    });
  }

  /** 顶部 hero 头图：海贼全员图 + MoltenMetal 熔岩动态（网页头图/轮播风格） */
  private buildHero(wrap: HTMLElement) {
    const hero = wrap.createDiv({ cls: "wb-hero" });
    this.bgLayer = hero;

    // 默认头图 = 纯 MoltenMetal 动态背景（原版观感）。
    // 用户主动自定义头图（image / GIF 动图 / video）时渲染图/视频层，熔岩仍叠加作氛围。
    const media = this.plugin.settings.heroMedia;
    if (media) {
      const heroSrc = media.src;
      if (media.kind === "video") {
        const v = hero.createEl("video", {
          cls: "wb-hero-crew",
          attr: { src: heroSrc, autoplay: "", loop: "", muted: "", playsinline: "" },
        }) as HTMLVideoElement;
        v.muted = true; // 确保自动播放静音（部分浏览器仅设属性不生效）
      } else {
        hero.createEl("img", {
          cls: "wb-hero-crew",
          attr: { src: heroSrc, alt: "" },
        });
      }
    }

    // 悬浮上传按钮（右上角，hover 显示）：支持图片 / GIF 动图 / 视频
    const uploadBtn = hero.createDiv({ cls: "wb-hero-upload" });
    uploadBtn.innerHTML = "🖼️ 更换头图";
    uploadBtn.title = "支持图片、GIF 动图、视频（≤25MB）";
    uploadBtn.addEventListener("click", async () => {
      const media = await openHeroMediaPicker();
      if (!media) return;
      this.plugin.settings.heroMedia = media;
      await this.plugin.saveSettings();
      new Notice(media.kind === "video" ? "✅ 头图视频已更新" : "✅ 头图已更新");
      this.reload();
    });

    // 头图级动效（熔岩 WebGL）：始终叠加在头图区。
    // 有自定义头图时给 hero 加标记，CSS 把熔岩降透明度作半透明氛围层（底图仍可见）。
    if (media) hero.classList.add("wb-hero--has-media");
    this.effectDisposers.push(
      ...buildEffects(hero, "hero", this.plugin.settings.effects, this.plugin.settings.showEffects)
    );

    // 右下角固定功能按钮（参考图胶囊样式，按钮显隐/布局可配置）
    const ha = { ...DEFAULT_HERO_ACTIONS, ...(this.plugin.settings.heroActions || {}) };
    const actions = hero.createDiv({
      cls: "wb-hero-actions" + (ha.layout === "col" ? " wb-hero-actions-col" : ""),
    });
    const makeAction = (label: string, onClick: () => void) => {
      const btn = actions.createSpan({ cls: "wb-hero-action", text: label });
      btn.addEventListener("click", onClick);
    };

    // 搜索：打开 Obsidian 全局搜索
    if (ha.search) {
      makeAction("🔍 搜索", () => {
        // @ts-ignore
        this.app.commands.executeCommandById("global-search:open");
      });
    }
    // 新建：添加组件（打开 AddWidgetModal）
    if (ha.create) {
      makeAction("➕ 新建", () => {
        new AddWidgetModal(this.app, (widgetId) => this.addWidgetInstance(widgetId)).open();
      });
    }
    // 刷新：强制重新扫描（跳过缓存）
    if (ha.refresh) {
      makeAction("🔄 刷新", () => {
        this.reload(true);
      });
    }
    // 设置：打开工作台设置面板
    if (ha.settings) {
      makeAction("⚙️ 设置", () => {
        this.openDashboardSettings();
      });
    }
    // 主题切换
    if (ha.theme) {
      const themeBtn = actions.createSpan({ cls: "wb-hero-action wb-theme-toggle" });
      const moon = themeBtn.createSpan({ cls: "wb-theme-moon", text: "🌙" });
      const sun = themeBtn.createSpan({ cls: "wb-theme-sun", text: "☀️" });
      const applyThemeIconState = () => {
        const isDark = document.body.classList.contains("theme-dark");
        moon.classList.toggle("active", isDark);
        sun.classList.toggle("active", !isDark);
      };
      applyThemeIconState();
      themeBtn.addEventListener("click", () => this.toggleTheme());
    }
  }

  /** 切换明暗主题（功能胶囊的「🌙/☀️」按钮调用） */
  private toggleTheme() {
    const isDark = document.body.classList.contains("theme-dark");
    const goDark = !isDark; // 目标明暗：当前深则切浅，否则切深
    const base = goDark ? "obsidian" : "mink";
    // 1) 持久化 Obsidian 基础明暗配置
    try {
      // @ts-ignore baseTheme 是 Obsidian 内置明暗设置项
      this.app.vault.setConfig("baseTheme", base);
    } catch (e) { /* 某些版本不容忍未知 key，忽略 */ }
    // 2) 触发 Obsidian 真正刷新外观（命令方式最确定生效，会让 --background-primary 等原生变量重算 → 工作台自动跟随）
    try {
      // @ts-ignore 运行时存在 commands，但 obsidian 类型未声明
      this.app.commands.executeCommandById(goDark ? "theme:use-dark" : "theme:use-light");
    } catch (e) { /* 忽略 */ }
    // 3) 兜底：同步 body 明暗类（驱动任何 body.theme-* 自定义样式）
    document.body.classList.toggle("theme-dark", goDark);
    document.body.classList.toggle("theme-light", !goDark);
    new Notice(goDark ? "🌙 已切换到深色主题" : "☀️ 已切换到浅色主题");
  }

  /** Border Glow 光标驱动：计算边缘接近度与光标角度（React Bits 移植） */
  private attachGlow(el: HTMLElement) {
    if (!el.querySelector(":scope > .edge-light")) {
      el.createDiv({ cls: "edge-light" });
    }
    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;

      // 边缘接近度：光标越靠边缘 → 越接近 100
      let kx = Infinity;
      let ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      // 光标角度（0-360）
      let angle = 0;
      if (dx !== 0 || dy !== 0) {
        const radians = Math.atan2(dy, dx);
        let degrees = radians * (180 / Math.PI) + 90;
        if (degrees < 0) degrees += 360;
        angle = degrees;
      }

      el.style.setProperty("--edge-proximity", `${(edge * 100).toFixed(3)}`);
      el.style.setProperty("--cursor-angle", `${angle.toFixed(3)}deg`);
    });
  }

  /** 进入视口触发：wipe reveal + 面板淡入 */
  private attachRevealObserver(container: HTMLElement) {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    container.querySelectorAll<HTMLElement>("[data-reveal='wipe']").forEach((el) => {
      observer.observe(el);
    });
    container.querySelectorAll<HTMLElement>(".wb-panel").forEach((el) => {
      observer.observe(el);
    });

    // 立即检查一次：避免首屏元素因为已经在视口内而永远不触发
    requestAnimationFrame(() => {
      container.querySelectorAll<HTMLElement>("[data-reveal='wipe'], .wb-panel").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      });
    });

    // 安全网：1 秒后仍未触发的面板强制显示，避免 observer 失效导致内容丢失
    setTimeout(() => {
      container.querySelectorAll<HTMLElement>(".wb-panel:not(.is-visible)").forEach((el) => {
        el.classList.add("is-visible");
      });
    }, 1000);
  }

  /* ═══════════════════════════ 聚合页 ═══════════════════════════ */

  private renderHome(container: HTMLElement) {
    const d = this.data!;

    // 顶栏
    const topbar = container.createDiv({ cls: "wb-topbar" });
    const title = topbar.createDiv({ cls: "wb-title" });
    title.createSpan({ text: "🏴‍☠️ 草帽航海工作台" });
    // 头图胶囊已提供 搜索/新建/刷新/设置/主题 功能，顶栏只保留标题

    // widget 画布：按当前页组件列表渲染（自由布局由 initDashboardLayout 接管）
    this.renderWidgetCanvas(container, "home");
  }

  /**
   * 渲染 widget 画布：按页面组件列表渲染每个实例。
   * 子页面（非 home）的卡片 data-id 加页面前缀，避免与首页布局 key 冲突。
   * 无组件时返回 null（不创建空画布）。
   */
  private renderWidgetCanvas(container: HTMLElement, page: Page): HTMLElement | null {
    const d = this.data!;
    const active = this.getPageWidgets(page);
    if (active.length === 0) return null;

    const canvas = container.createDiv({ cls: "wb-widgets" });
    const ctx: WidgetCtx = {
      app: this.app,
      plugin: this.plugin,
      data: d,
      instanceId: "",
      widgetConfig: {},
      sharedData: this.sharedData,
      saveShared: () => {
        saveSharedData(this.app, this.sharedData);
      },
      goto: (p) => this.goto(p as Page),
      openFile: (path) => openFile(this.app, path),
      fmtDate: (ts) => this.fmtDate(ts),
      levelCls: (l) => this.levelCls(l),
      habitData: () => this.habitData(),
      saveHabitData: (data) => this.saveHabitData(data),
      drawBarChart: (c, data) => this.drawBarChart(c, data),
    };
    const configs = this.plugin.settings.widgetConfigs || {};
    const prefix = page === "home" ? "" : `${page}-`;
    for (const instId of active) {
      const [baseId, suffix] = instId.split("#");
      const w = getWidget(baseId);
      if (!w) continue;
      // 跳过被禁用的实例（设置面板 Toggle 关闭）
      const instCfg = configs[instId] || {};
      if (instCfg.enabled === false) continue;
      // 每个实例用独立 ctx 副本：闭包（如 ⚙️ 打开配置抽屉）捕获的 instanceId
      // 必须是当前实例，不能共享同一个 ctx 对象（否则所有实例都指向最后一个）
      const instCtx: WidgetCtx = { ...ctx, instanceId: instId, widgetConfig: instCfg };
      const host = canvas.createDiv({ cls: "wb-widget-host", attr: { "data-widget": instId } });
      try {
        w.render(instCtx, host);
        // 通用外观：自定义主色覆盖（widgetConfigs[instId].color，所有组件统一入口）
        if (instCfg.color) {
          host.querySelectorAll<HTMLElement>(".wb-panel, .wb-kpi-card, .wb-chart").forEach((el) => {
            el.style.setProperty("--w-accent", String(instCfg.color));
          });
        }
        // data-id：加页面前缀（子页面）+ 多实例后缀，保证布局持久化 key 唯一
        host.querySelectorAll<HTMLElement>(".wb-panel, .wb-kpi-card, .wb-chart").forEach((el) => {
          const base = el.dataset.id || (el.classList.contains("wb-kpi-card") ? "stat" : "card");
          el.dataset.id = prefix + base + (suffix ? `-${suffix}` : "");
          // 光圈效果：全局统一开关（所有组件一致，避免按实例导致互相影响）
          if (this.plugin.settings.showGlow) {
            el.classList.add("wb-glow");
            this.attachGlow(el);
          }
        });
      } catch (e) {
        console.error(`[workbench] widget ${w.id} 渲染失败`, e);
      }
    }
    return canvas;
  }

  /* ═══════════════════════════ 详情子页 ═══════════════════════════ */

  private pageTitle(): string {
    switch (this.page) {
      case "domains": return "🃏 卡片集";
      case "wiki": return "🌌 星空图";
      case "podcast": return "🎧 播客集";
      case "board": return "✅ 日迹录";
      case "config": return "⚙️ 系统配置";
      case "news": return "📰 行业新闻";
      case "stocks": return "📈 股票池";
      case "topics": return "🎯 选题池";
      case "skills": return "🛠️ 技能库";
      default: return "工作台";
    }
  }

  private renderPage(container: HTMLElement) {
    const d = this.data!;
    const page = container.createDiv({ cls: "wb-page" });

    // 统一头部胶囊：标题在左，返回工作台在右（所有子页共用）
    const header = page.createDiv({ cls: "wb-page-header" });
    header.createDiv({ cls: "wb-page-title", text: this.pageTitle() });
    const back = header.createSpan({ cls: "wb-back", text: "返回工作台" });
    back.addEventListener("click", () => this.goto("home"));

    switch (this.page) {
      case "domains":
        this.renderDomains(page, d);
        break;
      case "wiki":
        this.renderWiki(page, d);
        break;
      case "podcast":
        this.renderPodcast(page);
        break;
      case "board":
        this.renderBoard(page, d);
        break;
      case "config":
        this.renderConfig(page);
        break;
      case "news":
        this.renderNews(page);
        break;
      case "stocks":
        this.renderStocks(page);
        break;
      case "topics":
        this.renderTopics(page);
        break;
      case "skills":
        this.renderSkills(page);
        break;
    }
  }

  /** 技能库：占位页（待补充真实内容） */
  private renderSkills(page: HTMLElement) {
    const ph = page.createDiv({ cls: "wb-placeholder" });
    ph.createDiv({ cls: "wb-placeholder__icon", text: "🛠️" });
    ph.createDiv({ cls: "wb-placeholder__title", text: "技能库" });
    ph.createDiv({
      cls: "wb-placeholder__desc",
      text: "占位页 · 即将上线。这里将整理你的技能、方法论与可复用模板。",
    });
  }

  private renderDomains(page: HTMLElement, d: LoadedData) {

    // 统计格
    const due = dueCards(d.kcCards);
    const statGrid = page.createDiv({ cls: "dash-stat-grid" });
    const mkStat = (num: string, label: string) => {
      const c = statGrid.createDiv({ cls: "dash-stat-cell" });
      c.createDiv({ cls: "dash-stat-num", text: num });
      c.createDiv({ cls: "dash-stat-label", text: label });
    };
    mkStat(String(d.kcCards.length), "知识卡片");
    mkStat(String(d.stats.domains), "领域数");
    mkStat(String(due.length), "到期复习");
    mkStat("+" + d.stats.todayAdded, "今日新增");

    // Tab：总览 / 按领域
    const tabs = page.createDiv({ cls: "dash-tabs" });
    const tabOverview = tabs.createEl("button", { cls: "dash-tab on", text: "📊 总览" });
    const tabByDomain = tabs.createEl("button", { cls: "dash-tab", text: "📂 按领域" });
    const content = page.createDiv({ cls: "dash-panel" });

    const renderOverview = () => {
      content.empty();

      // 🎯 抽 5 张复习
      const drawCard = content.createDiv({ cls: "dash-review-card" });
      const drawMeta = drawCard.createDiv({ cls: "dash-meta" });
      drawMeta.createSpan({ text: "🎯 抽 5 张复习" });
      drawMeta.createSpan({ text: `${d.kcCards.length} 张可选` });
      const drawBtn = drawCard.createEl("button", {
        cls: "wb-add-btn",
        text: "🎲 抽 5 张",
        attr: { style: "margin-bottom:10px;" },
      });
      const drawResult = drawCard.createDiv();
      const doDraw = () => {
        drawResult.empty();
        const pool = due.length >= 5 ? due : d.kcCards;
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
        if (shuffled.length === 0) {
          drawResult.createDiv({ cls: "dash-empty", text: "暂无卡片可抽" });
          return;
        }
        for (const c of shuffled) {
          const row = drawResult.createDiv({ cls: "dash-kb-row" });
          row.createSpan({ cls: "dash-badge " + this.levelCls(c.level), text: c.level });
          row.createSpan({ cls: "dash-name", text: c.name });
          row.createSpan({ cls: "dash-tag", text: c.review || (c.domain || "") });
          row.addEventListener("click", () => {
            const tf = this.app.vault.getAbstractFileByPath(c.path);
            if (tf instanceof TFile) new CardContentModal(this.app, tf).open();
          });
        }
      };
      drawBtn.addEventListener("click", doDraw);
      doDraw();

      // 📊 月度新增趋势
      const trendCard = content.createDiv({ cls: "dash-review-card" });
      trendCard.createDiv({ cls: "dash-meta", text: "📊 月度新增趋势" });
      const trendChart = trendCard.createDiv({ cls: "dash-month-chart" });
      const monthMap = new Map<string, number>();
      d.kcCards.forEach((c) => {
        const d0 = new Date(c.mtime);
        const key = `${d0.getMonth() + 1}月`;
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      });
      const entries = [...monthMap.entries()].slice(-8);
      const max = Math.max(...entries.map(([, v]) => v), 1);
      entries.forEach(([label, v]) => {
        const b = trendChart.createDiv({ cls: "dash-month-bar" });
        b.createDiv({ cls: "dash-month-bar val", text: String(v) });
        const fill = b.createDiv({ cls: "fill" });
        fill.style.height = `${(v / max) * 100}%`;
        b.createDiv({ cls: "dash-month-bar label", text: label });
      });

      // 🥧 领域分布饼图
      const domains = groupByDomain(d.kcCards);
      const pieCard = content.createDiv({ cls: "dash-review-card" });
      pieCard.createDiv({ cls: "dash-meta", text: "🥧 领域分布" });
      if (domains.size > 0) {
        const pieWrap = pieCard.createDiv({
          attr: { style: "display:flex;align-items:center;gap:16px;flex-wrap:wrap;" },
        });
        const total = d.kcCards.length || 1;
        const colors = ["#fbbf24", "#8b5cf6", "#38bdf8", "#34d399", "#f472b6", "#f59e0b", "#e11d2e", "#22d3ee"];
        let acc = 0;
        const segs: string[] = [];
        [...domains.entries()].forEach(([, cards], i) => {
          const cnt = cards.length;
          const from = (acc / total) * 360;
          acc += cnt;
          const to = (acc / total) * 360;
          segs.push(`${colors[i % colors.length]} ${from.toFixed(1)}deg ${to.toFixed(1)}deg`);
        });
        const pie = pieWrap.createDiv({
          attr: {
            style: `width:110px;height:110px;border-radius:50%;flex-shrink:0;background:conic-gradient(${segs.join(",")});box-shadow:0 2px 8px rgba(0,0,0,.25);`,
          },
        });
        const legend = pieWrap.createDiv({
          attr: { style: "display:flex;flex-direction:column;gap:4px;font-size:12px;" },
        });
        [...domains.entries()].forEach(([name, cards], i) => {
          const row = legend.createDiv({ attr: { style: "display:flex;align-items:center;gap:6px;" } });
          row.createSpan({
            attr: {
              style: `width:10px;height:10px;border-radius:3px;background:${colors[i % colors.length]};flex-shrink:0;`,
            },
          });
          row.createSpan({ text: `${name} ${cards.length}` });
        });
      } else {
        pieCard.createDiv({ cls: "dash-empty", text: "暂无知识卡片" });
      }

      // 到期复习
      if (due.length > 0) {
        const card = content.createDiv({ cls: "dash-review-card" });
        const meta = card.createDiv({ cls: "dash-meta" });
        meta.createSpan({ text: "🔁 到期复习" });
        meta.createSpan({ text: `${due.length} 张` });
        for (const c of due.slice(0, 8)) {
          const row = card.createDiv({ cls: "dash-kb-row" });
          row.createSpan({ cls: "dash-badge " + this.levelCls(c.level), text: c.level });
          row.createSpan({ cls: "dash-name", text: c.name });
          row.createSpan({ cls: "dash-tag", text: c.review || "" });
          row.addEventListener("click", () => {
            const tf = this.app.vault.getAbstractFileByPath(c.path);
            if (tf instanceof TFile) new CardContentModal(this.app, tf).open();
          });
        }
      }
    };

    const renderByDomain = () => {
      content.empty();
      const domains = groupByDomain(d.kcCards);
      const list = [...domains.entries()];
      // 翻页：每页 3 个领域
      const perPage = 3;
      let pageNum = 0;
      const pages = Math.max(1, Math.ceil(list.length / perPage));
      const pagerWrap = content.createDiv();
      const renderPage = () => {
        pagerWrap.empty();
        const slice = list.slice(pageNum * perPage, (pageNum + 1) * perPage);
        for (const [name, cards] of slice) {
          const card = pagerWrap.createDiv({ cls: "dash-review-card" });
          const meta = card.createDiv({ cls: "dash-meta" });
          meta.createSpan({ text: name });
          meta.createSpan({ text: `${cards.length} 张` });
          for (const c of cards.slice(0, 6)) {
            const row = card.createDiv({ cls: "dash-kb-row" });
            row.createSpan({ cls: "dash-badge " + this.levelCls(c.level), text: c.level });
            row.createSpan({ cls: "dash-name", text: c.name });
            row.addEventListener("click", () => {
            const tf = this.app.vault.getAbstractFileByPath(c.path);
            if (tf instanceof TFile) new CardContentModal(this.app, tf).open();
          });
          }
          const indexFile = this.app.vault.getAbstractFileByPath(
            `02 - Areas 领域/${name}/00_索引.md`
          );
          if (indexFile instanceof TFile) {
            const row = card.createDiv({ cls: "dash-kb-row" });
            row.createSpan({ cls: "dash-name", text: "📖 打开领域索引 →" });
            row.addEventListener("click", () => new CardContentModal(this.app, indexFile).open());
          }
        }
        // 翻页器
        if (pages > 1) {
          const pager = pagerWrap.createDiv({ cls: "dash-pager" });
          const prev = pager.createEl("button", { text: "‹ 上一页" });
          const info = pager.createSpan({ cls: "dash-page-info", text: `${pageNum + 1} / ${pages}` });
          const next = pager.createEl("button", { text: "下一页 ›" });
          prev.addEventListener("click", () => {
            pageNum = Math.max(0, pageNum - 1);
            renderPage();
          });
          next.addEventListener("click", () => {
            pageNum = Math.min(pages - 1, pageNum + 1);
            renderPage();
          });
        }
      };
      renderPage();
    };

    tabOverview.addEventListener("click", () => {
      tabOverview.addClass("on");
      tabByDomain.removeClass("on");
      renderOverview();
    });
    tabByDomain.addEventListener("click", () => {
      tabByDomain.addClass("on");
      tabOverview.removeClass("on");
      renderByDomain();
    });
    renderOverview();
  }

  private renderWiki(page: HTMLElement, d: LoadedData) {

    // 概念入口卡片
    const links: [string, string][] = [
      ["👤 个人画像", "05 - Wikis 概念库/个人画像/00_个人画像.md"],
      ["📈 迭代线追踪", "05 - Wikis 概念库/迭代线追踪"],
    ];
    const linkCard = page.createDiv({ cls: "dash-review-card" });
    linkCard.createDiv({ cls: "dash-meta", text: "📚 概念入口" });
    for (const [label, path] of links) {
      const row = linkCard.createDiv({ cls: "dash-kb-row" });
      row.createSpan({ cls: "dash-name", text: label });
      row.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(path);
        if (f instanceof TFile) openFile(this.app, f.path);
        else new Notice(`未找到：${path}`);
      });
    }

    // 项目目标卡片
    const g = page.createDiv({ cls: "dash-review-card" });
    g.createDiv({ cls: "dash-meta", text: "🎯 项目目标" });
    for (const pr of d.projects) {
      const row = g.createDiv({ cls: "dash-kb-row" });
      row.createSpan({ cls: "dash-name", text: `${pr.name} · 进度 ${pr.progress}%` });
      const bar = g.createDiv({ cls: "dash-bar" });
      const fill = bar.createEl("i", { cls: "bar-tpl" });
      fill.style.width = pr.progress + "%";
      fill.createSpan({ cls: "bar-pct", text: `${pr.progress}%` });
      if (pr.nextStep) {
        const nextRow = g.createDiv({ cls: "dash-kb-row" });
        nextRow.createSpan({ cls: "dash-name", text: `⏭ 下一步：${pr.nextStep}` });
      }
    }
  }

  private renderPodcast(page: HTMLElement) {

    const habits = buildHabitRecords(this.habitData());
    const habit = habits.find((h) => h.name.includes("播客")) || habits[0];
    const days = habit?.days || [];

    // 收听统计格
    const statGrid = page.createDiv({ cls: "dash-stat-grid" });
    const mkStat = (num: string, label: string) => {
      const c = statGrid.createDiv({ cls: "dash-stat-cell" });
      c.createDiv({ cls: "dash-stat-num", text: num });
      c.createDiv({ cls: "dash-stat-label", text: label });
    };
    mkStat(String(habit?.streak || 0), "🔥 连续收听");
    mkStat(String(days.length), "累计收听");
    mkStat(String(habit?.today ? "已听" : "待听"), "今日状态");
    mkStat(String(habits.length), "打卡习惯");

    // 全部语音（扫描 vault 音频）
    const audioFiles = this.app.vault
      .getFiles()
      .filter((f) => ["mp3", "m4a", "wav", "flac", "ogg", "m4b"].includes(f.extension))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 50);

    // ── 内嵌播放器卡片 ──
    const playerCard = page.createDiv({ cls: "dash-review-card" });
    playerCard.createDiv({ cls: "dash-meta", text: "🎧 播放器" });
    const nowTitle = playerCard.createDiv({
      cls: "dash-pool-title",
      text: audioFiles.length ? audioFiles[0].basename : "库中暂无音频",
      attr: { style: "text-align:center;font-size:15px;margin:6px 0;" },
    });
    const audio = new Audio();

    // 进度条 + 时间
    const seekRow = playerCard.createDiv({
      attr: { style: "display:flex;align-items:center;gap:8px;margin:8px 0;" },
    });
    const seek = seekRow.createEl("input", {
      attr: { type: "range", min: "0", max: "100", value: "0" },
    });
    seek.style.flex = "1";
    const posLabel = seekRow.createSpan({
      text: "00:00",
      attr: { style: "font-size:11px;font-family:var(--wb-mono);color:var(--wb-sub);min-width:38px;text-align:right;" },
    });
    const durLabel = seekRow.createSpan({
      text: "/ 00:00",
      attr: { style: "font-size:11px;font-family:var(--wb-mono);color:var(--wb-sub);min-width:46px;" },
    });

    const fmt = (s: number) =>
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

    audio.addEventListener("timeupdate", () => {
      if (audio.duration) {
        seek.value = String((audio.currentTime / audio.duration) * 100);
        posLabel.setText(fmt(audio.currentTime));
      }
      // 续播记忆：节流保存（每 5 秒一次）
      if (audio.currentTime > 0 && Math.floor(audio.currentTime) % 5 === 0) {
        this.savePodcastProgress(currentFile?.path || "", audio.currentTime);
      }
    });
    audio.addEventListener("loadedmetadata", () => {
      durLabel.setText("/ " + fmt(audio.duration || 0));
    });
    audio.addEventListener("ended", nextTrack);

    let currentIdx = 0;
    let currentFile: { path: string; basename: string } | null = null;
    const playTrack = (idx: number) => {
      const f = audioFiles[idx];
      if (!f) return;
      currentIdx = idx;
      currentFile = { path: f.path, basename: f.basename };
      nowTitle.setText(f.basename);
      audio.src = this.app.vault.getResourcePath(f);
      // 续播记忆：恢复到上次播放位置
      const prog = (this.plugin.settings.podcastProgress || {})[f.path];
      const onLoaded = () => {
        if (prog && prog.pos > 3 && audio.duration && audio.currentTime === 0) {
          audio.currentTime = Math.min(prog.pos, audio.duration - 1);
        }
        audio.removeEventListener("loadedmetadata", onLoaded);
      };
      audio.addEventListener("loadedmetadata", onLoaded);
      audio.play().catch(() => {});
      playBtn.setText("⏸");
      // 收听统计：当天记录一次
      this.markPodcastStat(f.path);
    };
    function nextTrack() {
      playTrack((currentIdx + 1) % Math.max(1, audioFiles.length));
    }

    seek.addEventListener("input", () => {
      if (audio.duration) audio.currentTime = (parseFloat(seek.value) / 100) * audio.duration;
    });

    // 控制条
    const controls = playerCard.createDiv({ cls: "dash-timer-controls" });
    const prevBtn = controls.createEl("button", { text: "⏮" });
    const playBtn = controls.createEl("button", { text: "▶" });
    const nextBtn = controls.createEl("button", { text: "⏭" });
    prevBtn.addEventListener("click", () => playTrack((currentIdx - 1 + audioFiles.length) % Math.max(1, audioFiles.length)));
    playBtn.addEventListener("click", () => {
      if (audio.paused) {
        if (!audio.src) playTrack(currentIdx);
        audio.play().catch(() => {});
        playBtn.setText("⏸");
      } else {
        audio.pause();
        playBtn.setText("▶");
      }
    });
    nextBtn.addEventListener("click", nextTrack);

    // 倍速
    const rateRow = playerCard.createDiv({ cls: "dash-timer-options" });
    const rates = [0.75, 1, 1.25, 1.5, 2];
    rates.forEach((r) => {
      const b = rateRow.createEl("button", { text: `${r}x`, cls: r === 1 ? "on" : "" });
      b.addEventListener("click", () => {
        audio.playbackRate = r;
        rateRow.querySelectorAll("button").forEach((el) => el.removeClass("on"));
        b.addClass("on");
      });
    });

    // 近 30 天收听热力图（真实收听统计 podcastStat，替代习惯打卡天数）
    const heatCard = page.createDiv({ cls: "dash-review-card" });
    const heatMeta = heatCard.createDiv({ cls: "dash-meta" });
    heatMeta.createSpan({ text: "🔥 近 30 天收听" });
    heatMeta.createSpan({ text: "真实收听记录" });
    const heat = heatCard.createDiv({ cls: "dash-heat-grid" });
    const stat = this.plugin.settings.podcastStat || {};
    const heatCells = podcastLast30Days(stat);
    heatCells.forEach((on, i) => {
      heat.createDiv({ cls: "dash-heat-cell" + (on ? " on " + this.heatLevel(i) : "") });
    });

    // 全部语音列表
    const audioCard = page.createDiv({ cls: "dash-review-card" });
    audioCard.createDiv({ cls: "dash-meta", text: "🗂 全部语音" });
    if (audioFiles.length === 0) {
      audioCard.createDiv({ cls: "dash-empty", text: "库中暂无音频文件 🎧" });
    } else {
      const list = audioCard.createDiv({ cls: "dash-list" });
      audioFiles.forEach((f, i) => {
        const item = list.createDiv({ cls: "dash-item" });
        item.createSpan({ cls: "dash-item-num", text: String(i + 1) });
        const main = item.createDiv({ cls: "dash-item-main" });
        main.createDiv({ cls: "dash-item-title", text: f.basename });
        main.createDiv({ cls: "dash-item-sub", text: this.fmtDate(f.stat.mtime) + " · " + (f.path.split("/").slice(0, -1).join("/") || "根目录") });
        item.addEventListener("click", () => playTrack(i));
      });
    }

    // 今日收听打卡
    const btnRow = page.createDiv({ attr: { style: "display:flex;gap:10px;margin-top:12px;" } });
    const checkBtn = btnRow.createEl("button", {
      cls: "dash-timer-controls",
      text: habit?.today ? "✅ 今日已收听（点击取消）" : "⬜ 今日收听打卡",
      attr: { style: "padding:10px 24px;" },
    });
    checkBtn.addEventListener("click", () => {
      const data = this.habitData();
      const name = habit?.name || "播客";
      toggleHabit(data, name);
      this.saveHabitData(data);
      new Notice(habit?.today ? "已取消今日打卡" : "收听打卡成功！🎧");
      this.render();
    });
  }

  private renderBoard(page: HTMLElement, d: LoadedData) {

    const habits = buildHabitRecords(this.habitData());
    const habit = habits[0];
    const days = habit?.days || [];

    // 今日累计（从共享数据 workoutSessions 统计今日分钟）
    const sessions = this.sharedData.workoutSessions || [];
    const todayKey = (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })();
    const todaySessions = sessions.filter((s) => s.date === todayKey);
    const todayMin = todaySessions.reduce((acc, s) => acc + s.min, 0);

    // 累计统计格
    const statGrid = page.createDiv({ cls: "dash-stat-grid" });
    const mkStat = (num: string, label: string) => {
      const c = statGrid.createDiv({ cls: "dash-stat-cell" });
      c.createDiv({ cls: "dash-stat-num", text: num });
      c.createDiv({ cls: "dash-stat-label", text: label });
    };
    mkStat(String(habit?.streak || 0), "🔥 连续打卡");
    mkStat(String(habit?.today ? "已打卡" : "待打卡"), "今日状态");
    mkStat(`${todaySessions.length} 组`, "今日累计");
    mkStat(`${todayMin} 分钟`, "今日时长");

    // ⏱️ 时长倒计时（跟练计时器）
    const timerCard = page.createDiv({ cls: "dash-review-card" });
    timerCard.createDiv({ cls: "dash-meta", text: "⏱️ 跟练计时器" });

    // 时长选项
    const durations = [5, 15, 30, 45, 60];
    let selectedMin = 15;
    const optRow = timerCard.createDiv({ cls: "dash-timer-options" });
    const optBtns: HTMLButtonElement[] = [];
    durations.forEach((m) => {
      const b = optRow.createEl("button", {
        text: `${m} 分`,
        cls: m === selectedMin ? "on" : "",
      });
      optBtns.push(b);
      b.addEventListener("click", () => {
        if (timerRunning) return;
        selectedMin = m;
        optBtns.forEach((ob) => ob.removeClass("on"));
        b.addClass("on");
        display.setText(fmt(selectedMin * 60));
      });
    });

    const fmt = (sec: number) =>
      `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    const display = timerCard.createDiv({ cls: "dash-timer-big", text: fmt(selectedMin * 60) });
    const state = timerCard.createDiv({
      attr: { style: "text-align:center;font-size:12px;color:var(--wb-sub);" },
      text: "未开始",
    });

    let timerHandle: number | null = null;
    let remainingSec = selectedMin * 60;
    let timerRunning = false;

    const saveWorkout = () => {
      const all = [...(this.sharedData.workoutSessions || [])];
      all.push({ date: todayKey, min: selectedMin });
      this.sharedData.workoutSessions = all;
      saveSharedData(this.app, this.sharedData);
      new Notice(`✓ 完成 ${selectedMin} 分钟跟练`);
      this.render();
    };

    const tick = () => {
      remainingSec--;
      display.setText(fmt(Math.max(0, remainingSec)));
      state.setText(`进行中 · 还剩 ${remainingSec} 秒`);
      if (remainingSec <= 0) {
        if (timerHandle) window.clearInterval(timerHandle);
        timerHandle = null;
        timerRunning = false;
        saveWorkout();
      }
    };

    const startBtn = timerCard.createDiv({ cls: "dash-timer-controls" });
    const playBtn = startBtn.createEl("button", { text: "▶ 开始" });
    const stopBtn = startBtn.createEl("button", {
      text: "放弃",
      attr: { style: "background:var(--background-modifier-form-field);color:#f87171;" },
    });
    stopBtn.style.display = "none";

    playBtn.addEventListener("click", () => {
      if (timerRunning) return;
      timerRunning = true;
      playBtn.style.display = "none";
      stopBtn.style.display = "";
      remainingSec = selectedMin * 60;
      timerHandle = window.setInterval(tick, 1000);
      // 开始锻炼 → 自动播放背景音乐
      playMusic();
    });
    stopBtn.addEventListener("click", () => {
      if (timerHandle) window.clearInterval(timerHandle);
      timerHandle = null;
      timerRunning = false;
      playBtn.style.display = "";
      stopBtn.style.display = "none";
      display.setText(fmt(selectedMin * 60));
      state.setText("未开始");
      pauseMusic();
    });

    // ── 背景音乐播放器（移植自 Web 端 dashboard Checkin） ──
    const musicCard = page.createDiv({ cls: "dash-review-card" });
    musicCard.createDiv({ cls: "dash-meta", text: "🎵 背景音乐" });
    const musicRow = musicCard.createDiv({ cls: "dash-music-row" });
    const musicUrlIn = musicRow.createEl("input", {
      cls: "dash-music-url",
      attr: {
        type: "text",
        placeholder: "音乐 URL（留空 = 默认）",
        value: this.plugin.settings.workoutMusicUrl || "",
      },
    });
    const musicToggle = musicRow.createEl("button", {
      cls: "dash-timer-controls",
      text: this.plugin.settings.workoutMusicState === "playing" ? "⏸️ 暂停" : "🎵 播放",
    });
    musicRow.createSpan({ text: "音量" });
    const musicVol = musicRow.createEl("input", {
      cls: "dash-music-vol",
      attr: {
        type: "range",
        min: "0",
        max: "1",
        step: "0.05",
        value: String(this.plugin.settings.workoutMusicVol ?? 0.6),
      },
    });
    const workoutAudio = page.createEl("audio", { attr: { hidden: "true" } });
    workoutAudio.volume = Number(this.plugin.settings.workoutMusicVol ?? 0.6);

    const resolveMusicUrl = () => {
      const raw = musicUrlIn.value.trim();
      let saved = this.plugin.settings.workoutMusicUrl || "";
      // 兼容旧数据：失效的 pixabay 直链忽略，回退默认
      if (saved.includes("cdn.pixabay.com")) saved = "";
      const url = raw || saved || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      this.plugin.settings.workoutMusicUrl = url;
      this.plugin.saveSettings();
      return url;
    };
    const syncMusicUI = () => {
      musicToggle.setText(
        this.plugin.settings.workoutMusicState === "playing" ? "⏸️ 暂停" : "🎵 播放"
      );
    };
    const playMusic = () => {
      const url = resolveMusicUrl();
      workoutAudio.src = url;
      workoutAudio.volume = Number(musicVol.value || 0.6);
      workoutAudio.play().catch(() => new Notice("音乐播放失败，检查网络或 URL"));
      this.plugin.settings.workoutMusicState = "playing";
      this.plugin.saveSettings();
      syncMusicUI();
    };
    const pauseMusic = () => {
      workoutAudio.pause();
      this.plugin.settings.workoutMusicState = "paused";
      this.plugin.saveSettings();
      syncMusicUI();
    };
    musicToggle.addEventListener("click", () => {
      if (this.plugin.settings.workoutMusicState === "playing") pauseMusic();
      else playMusic();
    });
    musicVol.addEventListener("input", () => {
      workoutAudio.volume = Number(musicVol.value || 0.6);
      this.plugin.settings.workoutMusicVol = Number(musicVol.value || 0.6);
      this.plugin.saveSettings();
    });
    musicUrlIn.addEventListener("change", () => {
      const val = musicUrlIn.value.trim();
      this.plugin.settings.workoutMusicUrl = val;
      this.plugin.saveSettings();
      if (this.plugin.settings.workoutMusicState === "playing" && val) {
        workoutAudio.src = val;
        workoutAudio.play().catch(() => {});
      }
      new Notice(val ? "音乐链接已保存" : "已清空，将使用默认音乐");
    });
    // 恢复上次播放状态（render 重建页面后自动续播）
    if (this.plugin.settings.workoutMusicState === "playing") {
      playMusic();
    }

    // 30 天热力图
    const heatCard = page.createDiv({ cls: "dash-review-card" });
    const heatMeta = heatCard.createDiv({ cls: "dash-meta" });
    heatMeta.createSpan({ text: "🔥 最近 30 天" });
    heatMeta.createSpan({ text: habit?.name || "打卡" });
    const heat = heatCard.createDiv({ cls: "dash-heat-grid" });
    lastNDays(days, 30).forEach((on, i) => {
      heat.createDiv({ cls: "dash-heat-cell" + (on ? " on " + this.heatLevel(i) : "") });
    });

    // 本周柱状图（近 7 天打卡次数）
    const weekCard = page.createDiv({ cls: "dash-review-card" });
    weekCard.createDiv({ cls: "dash-meta", text: "📅 本周" });
    const chart = weekCard.createDiv({ cls: "dash-month-chart" });
    const last7 = lastNDays(days, 7);
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const todayDow = new Date().getDay();
    for (let i = 6; i >= 0; i--) {
      const dow = (todayDow - i + 7) % 7;
      const on = last7[6 - i];
      const b = chart.createDiv({ cls: "dash-month-bar" });
      b.createDiv({ cls: "dash-month-bar val", text: on ? "✓" : "" });
      const fill = b.createDiv({ cls: "fill" });
      fill.style.height = on ? "100%" : "8%";
      b.createDiv({ cls: "dash-month-bar label", text: weekDays[dow] });
    }

    // 今日打卡按钮
    const btnRow = page.createDiv({ attr: { style: "display:flex;gap:10px;margin-top:12px;" } });
    const checkBtn = btnRow.createEl("button", {
      cls: "dash-timer-controls",
      text: habit?.today ? "✅ 今日已打卡（点击取消）" : "⬜ 点击今日打卡",
      attr: { style: "padding:10px 24px;" },
    });
    checkBtn.addEventListener("click", () => {
      const data = this.habitData();
      const name = habit?.name || "打卡";
      toggleHabit(data, name);
      this.saveHabitData(data);
      new Notice(habit?.today ? "已取消今日打卡" : "打卡成功！🔥");
      this.render();
    });

    // 英语打卡（移植自 Web 端 dashboard Checkin 模块）
    this.renderEnglish(page);
  }

  /** 英语打卡：今日 3 词 + 跟读/录音 + 统计 + 热力图 */
  private renderEnglish(page: HTMLElement) {
    const records: EnglishRecord[] = this.plugin.settings.englishRecords || [];
    const words = englishGroupForToday();
    const todayRec = findTodayRecord(records);
    const doneWords = todayRec ? todayRec.words : [];
    const legacyDone = !!todayRec && !Array.isArray(todayRec.words);

    const card = page.createDiv({ cls: "dash-review-card" });
    card.createDiv({ cls: "dash-meta", text: "🇬🇧 英语打卡" });

    // 累计统计格
    const statGrid = card.createDiv({ cls: "dash-stat-grid" });
    const mkStat = (num: string, label: string) => {
      const c = statGrid.createDiv({ cls: "dash-stat-cell" });
      c.createDiv({ cls: "dash-stat-num", text: num });
      c.createDiv({ cls: "dash-stat-label", text: label });
    };
    mkStat(String(calcEnglishTotal(records)), "累计天数");
    mkStat(String(calcEnglishStreak(records)), "当前连续");
    mkStat(String(calcMasteredWords(records)), "已掌握单词");

    // 里程碑
    const msRow = card.createDiv({ cls: "english-milestones" });
    ENGLISH_MILESTONES.forEach((m) => {
      msRow.createSpan({
        cls: "english-milestone" + (records.length >= m.n ? " on" : ""),
        text: `${m.icon} ${m.n} 天`,
      });
    });

    // 今日 3 个单词
    const dateLabel = new Date();
    const dayLabel = card.createDiv({
      cls: "dash-meta",
      text: `📅 今日 3 词 · ${dateLabel.getMonth() + 1}月${dateLabel.getDate()}日`,
      attr: { style: "margin-top:10px;" },
    });
    void dayLabel;
    const list = card.createDiv({ cls: "english-word-list" });

    words.forEach((w, i) => {
      const done = legacyDone || doneWords.includes(w[0]);
      const item = list.createDiv({ cls: "english-word" + (done ? " done" : "") });
      // 勾选
      const check = item.createEl("button", {
        cls: "english-word-check",
        text: done ? "✓" : "",
      });
      check.addEventListener("click", () => this.toggleEnglishWord(i));
      // 主体
      const main = item.createDiv({ cls: "english-word-main" });
      const textRow = main.createDiv({ cls: "english-word-text" });
      textRow.createSpan({ text: w[0] });
      textRow.createSpan({ cls: "english-word-pos", text: w[2] });
      textRow.createSpan({ cls: "english-word-phon", text: w[1] });
      main.createDiv({ cls: "english-word-mean", text: w[3] });
      main.createDiv({ cls: "english-word-ex", text: w[4] });
      main.createDiv({ cls: "english-word-ex-cn", text: w[5] });
      const rt = main.createDiv({ cls: "english-word-rt", attr: { id: `english-rt-${i}` } });
      void rt;
      // 按钮
      const btns = item.createDiv({ cls: "english-word-btns" });
      const speak = btns.createEl("button", {
        cls: "english-word-speak",
        text: "🔊",
        attr: { title: "标准发音" },
      });
      speak.addEventListener("click", () => this.speakEnglishWord(i));
      const rec = btns.createEl("button", {
        cls: "english-word-record",
        text: "🎤",
        attr: { id: `english-rec-${i}`, title: "跟读录音" },
      });
      rec.addEventListener("click", () => this.recordEnglishWord(i));
    });

    // 30 天热力图
    const heatCard = page.createDiv({ cls: "dash-review-card" });
    heatCard.createDiv({ cls: "dash-meta", text: "🔥 英语打卡 · 最近 30 天" });
    const heat = heatCard.createDiv({ cls: "dash-heat-grid" });
    englishLast30(records).forEach((c, i) => {
      const cell = heat.createDiv({
        cls: "dash-heat-cell" + (c.on ? " on " + this.heatLevel(i) : "") + (c.isToday ? " today" : ""),
      });
      void cell;
    });
  }

  /** 勾选/取消今天第 i 个单词；3 个全勾 = 今日打卡完成 */
  private toggleEnglishWord(i: number) {
    const words = englishGroupForToday();
    const word = words[i][0];
    const records: EnglishRecord[] = this.plugin.settings.englishRecords || [];
    const today = this.todayStr();
    let rec = records.find((r) => r.date === today);
    if (!rec) {
      rec = { date: today, words: [] };
      records.push(rec);
    }
    if (!Array.isArray(rec.words)) rec.words = [];
    const idx = rec.words.indexOf(word);
    if (idx >= 0) rec.words.splice(idx, 1);
    else rec.words.push(word);
    this.plugin.settings.englishRecords = records;
    this.plugin.saveSettings();

    const allDone = words.every((w) => rec!.words.includes(w[0]));
    if (allDone) {
      new Notice("🎉 今日 3 个单词全部完成！");
    } else if (rec.words.length === 0) {
      new Notice("已取消今天的单词");
    }
    this.render();
  }

  /** 跟读发音：优先 speechSynthesis 美音 */
  private speakEnglishWord(i: number) {
    const words = englishGroupForToday();
    const word = words[i][0];
    if (!("speechSynthesis" in window)) {
      new Notice("当前环境缺少语音朗读功能（speechSynthesis）");
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.8;
    const voices = speechSynthesis.getVoices();
    if (voices && voices.length) {
      const pick =
        voices.find((v) => v.lang === "en-US" && /google us english|zira|samantha|natural|aria|jenny|guy/i.test(v.name)) ||
        voices.find((v) => v.lang === "en-US") ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
      if (pick) u.voice = pick;
    }
    speechSynthesis.speak(u);
  }

  /** 跟读录音：MediaRecorder，录完回放 */
  private async recordEnglishWord(i: number) {
    const btn = document.getElementById(`english-rec-${i}`);
    const rtBox = document.getElementById(`english-rt-${i}`);
    if (!btn || !rtBox) return;

    const audioEl = rtBox.querySelector("audio") as HTMLAudioElement | null;
    if (audioEl && audioEl.dataset.recording === "1") {
      // 正在录这个词 → 停止
      if (this._recorder && this._recorder.state === "recording") {
        this._recorder.stop();
      }
      return;
    }
    if (this._recorder && this._recorder.state === "recording") {
      this._recorder.stop();
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      new Notice("当前环境不支持录音（getUserMedia），请在 Obsidian 桌面端使用");
      return;
    }
    if (!window.MediaRecorder) {
      new Notice("当前环境不支持录音（MediaRecorder）");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._recChunks = [];
      this._recIdx = i;
      const rec = new MediaRecorder(stream);
      this._recorder = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) this._recChunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this._recChunks, { type: rec.mimeType || "audio/webm" });
        this.showEnglishRecording(i, blob);
        if (btn) {
          btn.setText("🎤");
          btn.removeClass("recording");
        }
        this._recIdx = -1;
      };
      rec.start();
      btn.setText("⏹");
      btn.addClass("recording");
      rtBox.empty();
      rtBox.createDiv({ cls: "english-rt-hint", text: "🎙 录音中… 再点一次 🎤 停止" });
      // 标记正在录音（stop 按钮判定）
      const marker = rtBox.createEl("audio", { attr: { hidden: "true", "data-recording": "1" } });
      void marker;
    } catch (e) {
      const name = (e as { name?: string })?.name || "";
      if (name === "NotAllowedError") new Notice("❌ 麦克风权限被拒绝——请在系统设置中允许");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") new Notice("❌ 没检测到麦克风设备");
      else if (name === "NotReadableError") new Notice("❌ 麦克风被其他应用占用");
      else new Notice("❌ 无法录音：" + ((e as { message?: string })?.message || "未知错误"));
    }
  }

  /** 录音完成 → 回放 */
  private showEnglishRecording(i: number, blob: Blob) {
    const rtBox = document.getElementById(`english-rt-${i}`);
    if (!rtBox) return;
    const url = URL.createObjectURL(blob);
    rtBox.empty();
    const audio = rtBox.createEl("audio", {
      cls: "english-rt-audio",
      attr: { controls: "true", src: url },
    });
    audio.style.width = "100%";
    audio.style.height = "34px";
    rtBox.createDiv({ cls: "english-rt-tip", text: "▶ 回放你的跟读" });
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** 保存播客续播进度（audioPath -> pos） */
  private savePodcastProgress(path: string, pos: number) {
    if (!path) return;
    const prog = this.plugin.settings.podcastProgress || {};
    prog[path] = { pos, updatedAt: new Date().toISOString() };
    this.plugin.settings.podcastProgress = prog;
    this.plugin.saveSettings();
  }

  /** 标记当天收听一次（podcastStat: date -> {path: count}） */
  private markPodcastStat(path: string) {
    if (!path) return;
    const key = this.todayStr();
    const stat = this.plugin.settings.podcastStat || {};
    const day = stat[key] || {};
    day[path] = (day[path] || 0) + 1;
    stat[key] = day;
    this.plugin.settings.podcastStat = stat;
    this.plugin.saveSettings();
  }

  private _recorder: MediaRecorder | null = null;
  private _recChunks: Blob[] = [];
  private _recIdx = -1;

  /** 直接弹出知识库工作台后台面板（Obsidian 设置 → 插件设置 Tab），与 config 页"打开工作台 Dashboard"一致 */
  private openDashboardSettings() {
    try {
      const setting = (this.app as unknown as {
        setting: {
          open(): void;
          openTabById?(id: string): void;
          tabs: { id?: string; name?: string }[];
          pluginTabs: { id?: string; name?: string }[];
          openTab(t: { id?: string }): void;
        };
      }).setting;
      setting.open();
      if (typeof setting.openTabById === "function") {
        setting.openTabById("knowledge-workbench");
      } else {
        const tab = [...setting.tabs, ...setting.pluginTabs].find(
          (t) => t.id === "knowledge-workbench" || t.name === "知识库工作台"
        );
        if (tab) setting.openTab(tab);
      }
    } catch (e) {
      console.error("[workbench] 打开设置面板失败", e);
    }
  }

  private renderConfig(page: HTMLElement) {
    // ── 🚀 知识库工作台快捷入口 ──
    const entryCard = page.createDiv({ cls: "dash-review-card" });
    const entryMeta = entryCard.createDiv({ cls: "dash-meta" });
    entryMeta.createSpan({ text: "🚀 知识库工作台" });
    const entryBtn = entryCard.createDiv({
      cls: "dash-timer-controls",
      attr: { style: "justify-content:center;" },
    });
    const openDashboard = entryBtn.createEl("button", {
      text: "📊 打开工作台 Dashboard",
      attr: { style: "padding:10px 28px;font-size:15px;" },
    });
    openDashboard.addEventListener("click", () => this.openDashboardSettings());

    // ── 🎨 主题外观 ──
    const themeCard = page.createDiv({ cls: "dash-review-card" });
    themeCard.createDiv({ cls: "dash-meta", text: "🎨 主题外观" });
    themeCard.createDiv({
      attr: { style: "font-size:12px;color:var(--wb-sub);margin:4px 0 10px;" },
      text: "深色模式适合夜间使用 · 跟随系统会随设备自动切换",
    });
    const themeTabs = themeCard.createDiv({ cls: "dash-tabs" });
    const themes: { id: string; icon: string; label: string }[] = [
      { id: "light", icon: "☀️", label: "浅色" },
      { id: "dark", icon: "🌙", label: "深色" },
      { id: "auto", icon: "🔄", label: "跟随系统" },
    ];
    const isDark = () => document.body.classList.contains("theme-dark");
    const currentTheme = () => this.plugin.settings.themeMode || (isDark() ? "dark" : "light");
    themes.forEach((t) => {
      const b = themeTabs.createEl("button", {
        cls: "dash-tab" + (currentTheme() === t.id ? " on" : ""),
        text: `${t.icon} ${t.label}`,
      });
      b.addEventListener("click", () => {
        this.plugin.settings.themeMode = t.id;
        this.plugin.saveSettings();
        themeTabs.querySelectorAll(".dash-tab").forEach((el) => el.removeClass("on"));
        b.addClass("on");
        // Obsidian 标准 baseTheme 值：light / dark / system
        const applyBase = (v: string) => {
          try {
            // @ts-ignore
            this.app.vault.setConfig("baseTheme", v);
          } catch (e) {
            console.error("[workbench] 设置 baseTheme 失败", e);
          }
        };
        const applyBody = (dark: boolean) => {
          document.body.classList.toggle("theme-dark", dark);
          document.body.classList.toggle("theme-light", !dark);
        };
        if (t.id === "light") {
          applyBase("light");
          applyBody(false);
        } else if (t.id === "dark") {
          applyBase("dark");
          applyBody(true);
        } else {
          const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          applyBase("system");
          applyBody(dark);
        }
      });
    });

    // ── 💾 数据备份 ──
    const backupCard = page.createDiv({ cls: "dash-review-card" });
    backupCard.createDiv({ cls: "dash-meta", text: "💾 数据备份" });
    backupCard.createDiv({
      attr: { style: "font-size:12px;color:var(--wb-sub);margin:4px 0 10px;line-height:1.5;" },
      text: "你的所有数据都存放在本地 vault 与浏览器中。换设备、清理数据前，记得先导出备份。",
    });
    const backupRow = backupCard.createDiv({
      attr: { style: "display:flex;gap:10px;margin-bottom:6px;" },
    });
    const exportBtn = backupRow.createEl("button", {
      cls: "wb-add-btn",
      text: "📤 导出备份",
      attr: { style: "padding:8px 18px;" },
    });
    const importBtn = backupRow.createEl("button", {
      cls: "wb-add-btn",
      text: "📥 恢复备份",
      attr: { style: "padding:8px 18px;background:var(--background-modifier-form-field);color:var(--text-normal);" },
    });
    const backupInfo = backupCard.createDiv({
      cls: "dash-empty",
      attr: { style: "padding:6px;font-size:11px;text-align:left;" },
      text: "",
    });

    exportBtn.addEventListener("click", async () => {
      const shared = await loadSharedData(this.app);
      const payload = {
        exportedAt: new Date().toISOString(),
        plugin: this.plugin.settings,
        shared: shared,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `知识库工作台备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      backupInfo.setText("✓ 已导出备份（含插件设置 + 共享数据）");
    });

    importBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.plugin) {
            this.plugin.settings = { ...this.plugin.settings, ...data.plugin };
            await this.plugin.saveSettings();
          }
          if (data.shared) {
            await saveSharedData(this.app, data.shared as SharedData);
            this.sharedData = data.shared as SharedData;
          }
          backupInfo.setText("✓ 备份已恢复，正在刷新…");
          new Notice("✅ 备份恢复成功");
          this.reload();
        } catch (e) {
          console.error(e);
          backupInfo.setText("❌ 恢复失败：文件格式不正确");
        }
      };
      input.click();
    });

    // ── ⚠️ 危险操作 ──
    const dangerCard = page.createDiv({ cls: "dash-review-card" });
    dangerCard.createDiv({ cls: "dash-meta", text: "⚠️ 危险操作" });
    const wipeBtn = dangerCard.createEl("button", {
      cls: "wb-add-btn",
      text: "🧹 清空所有数据",
      attr: { style: "padding:8px 18px;background:#7f1d1d;color:#fecaca;border:1px solid #b91c1c;" },
    });
    dangerCard.createDiv({
      attr: { style: "font-size:12px;color:var(--wb-sub);margin-top:8px;" },
      text: "清空前请确认已经导出过备份，这个操作无法撤销。",
    });
    wipeBtn.addEventListener("click", async () => {
      const ok = confirm("确定清空所有数据？此操作无法撤销！");
      if (!ok) return;
      this.plugin.settings = {
        ...this.plugin.settings,
        habits: defaultHabits(),
        dashboardLayout: {},
        activeWidgets: WIDGETS.map((w) => w.id),
        widgetConfigs: {},
        pageWidgets: {},
        maskedHeadingConfig: {},
      };
      await this.plugin.saveSettings();
      await saveSharedData(this.app, defaultSharedData());
      this.sharedData = defaultSharedData();
      new Notice("已清空所有数据");
      this.reload();
    });

    // ── 📚 系统引导 ──
    const guideCard = page.createDiv({ cls: "dash-review-card" });
    guideCard.createDiv({ cls: "dash-meta", text: "📚 系统引导" });
    const guideRows: [string, string][] = [
      ["📄 系统引导 CLAUDE.md", "CLAUDE.md"],
      ["📖 知识库流程规则手册", "03 - Resources 参考资料/知识库流程规则手册.md"],
      ["🎴 复习面板", "03 - Resources 参考资料/Dashboard/复习面板.md"],
      ["🏠 总览面板", "03 - Resources 参考资料/Dashboard/总览面板.md"],
    ];
    for (const [label, path] of guideRows) {
      const row = guideCard.createDiv({ cls: "dash-kb-row" });
      row.createSpan({ cls: "dash-name", text: label });
      row.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(
          this.plugin.settings.knowledgeBasePath
            ? `${this.plugin.settings.knowledgeBasePath}/${path}`
            : path
        );
        if (f instanceof TFile) openFile(this.app, f.path);
        else new Notice(`未找到：${path}`);
      });
    }

    // ── ⌨️ 快捷键卡片 ──
    const card2 = page.createDiv({ cls: "dash-review-card" });
    card2.createDiv({ cls: "dash-meta", text: "⌨️ 快捷键" });
    const shortcuts: [string, string][] = [
      ["命令面板", "Ctrl+P"],
      ["快速切换", "Ctrl+O"],
      ["全局搜索", "Ctrl+Shift+F"],
      ["图谱", "Ctrl+G"],
    ];
    for (const [name, key] of shortcuts) {
      const row = card2.createDiv({ cls: "dash-kb-row" });
      row.createSpan({ cls: "dash-name", text: name });
      row.createSpan({ cls: "dash-tag gold", text: key });
    }
  }

  /** 按关键词扫描笔记（文件名/路径匹配），渲染为列表页 */
  private renderKeywordList(page: HTMLElement, title: string, keywords: string[]) {
    page.createDiv({ cls: "wb-page-title", text: title });
    const base = this.plugin.settings.knowledgeBasePath;
    const files = this.app.vault.getMarkdownFiles().filter((f) => {
      if (base && !f.path.startsWith(base)) return false;
      const name = f.basename + " " + f.path;
      return keywords.some((k) => name.includes(k));
    });
    const sorted = files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    const p = page.createDiv({ cls: "wb-panel" });
    const hd = p.createDiv({ cls: "wb-hd" });
    hd.createSpan({ text: title });
    hd.createSpan({ cls: "wb-more", text: `${sorted.length} 篇` });
    const bd = p.createDiv({ cls: "wb-bd" });
    if (sorted.length === 0) {
      bd.createDiv({ cls: "wb-empty", text: "暂无内容，可在笔记标题中加入关键词" });
      return;
    }
    for (const f of sorted.slice(0, 30)) {
      const row = bd.createDiv({ cls: "wb-row" });
      row.createSpan({ cls: "wb-name", text: f.basename });
      row.createSpan({ cls: "wb-meta", text: this.fmtDate(f.stat.mtime) });
      row.addEventListener("click", () => openFile(this.app, f.path));
    }
  }

  /** 行业新闻页：真实采集（人民网/中新网/知乎热榜/36kr/aihot），替代关键词扫描 */
  private renderNews(page: HTMLElement) {
    const cats: { id: string; icon: string; label: string }[] = [
      { id: "all", icon: "🗞️", label: "全部" },
      { id: "politics", icon: "🏛️", label: "时政" },
      { id: "finance", icon: "💰", label: "财经" },
      { id: "ai", icon: "🤖", label: "AI" },
    ];

    const tabs = page.createDiv({ cls: "dash-tabs" });
    const listWrap = page.createDiv();
    const tip = page.createDiv({
      cls: "dash-meta",
      text: "来源：人民网 · 中新网 · 知乎热榜 · 36kr · aihot（实时拉取）",
      attr: { style: "margin-bottom:8px;" },
    });

    let currentCat = "all";
    const setLoading = () => {
      listWrap.empty();
      const loading = listWrap.createDiv({ cls: "dash-empty", text: "⏳ 正在拉取…" });
      void loading;
    };

    const renderItems = (items: NewsItem[]) => {
      listWrap.empty();
      if (items.length === 0) {
        listWrap.createDiv({ cls: "dash-empty", text: "暂无内容，稍后刷新试试" });
        return;
      }
      const list = listWrap.createDiv({ cls: "dash-list" });
      items.forEach((f, i) => {
        const item = list.createDiv({ cls: "dash-item" });
        item.createSpan({ cls: "dash-item-num", text: String(i + 1) });
        const main = item.createDiv({ cls: "dash-item-main" });
        main.createDiv({ cls: "dash-item-title", text: f.title });
        const sub = [f.source, f.summary].filter(Boolean).join(" · ");
        main.createDiv({ cls: "dash-item-sub", text: sub.slice(0, 120) });
        if (f.url) {
          item.addEventListener("click", () => window.open(f.url, "_blank"));
        }
      });
    };

    const load = async (cat: string) => {
      setLoading();
      try {
        const items =
          cat === "all"
            ? await fetchAllNews(10)
            : await fetchNewsByCategory(cat as "politics" | "finance" | "ai", 10);
        renderItems(items);
      } catch (e) {
        console.error("[workbench] 新闻采集失败", e);
        listWrap.empty();
        listWrap.createDiv({ cls: "dash-empty", text: "采集失败，请检查网络后重试" });
      }
    };

    cats.forEach((g, i) => {
      const t = tabs.createEl("button", {
        cls: "dash-tab" + (i === 0 ? " on" : ""),
        text: `${g.icon} ${g.label}`,
      });
      t.addEventListener("click", () => {
        if (currentCat === g.id) return;
        currentCat = g.id;
        tabs.querySelectorAll(".dash-tab").forEach((el) => el.removeClass("on"));
        t.addClass("on");
        load(g.id);
      });
    });
    void tip;
    void NEWS_CAT_TITLES;
    void load("all");
  }

  private renderStocks(page: HTMLElement) {

    const pool = this.sharedData.stockPool || [];
    const save = () => {
      this.sharedData.stockPool = pool;
      saveSharedData(this.app, this.sharedData);
    };

    const renderList = () => {
      listEl.empty();
      if (pool.length === 0) {
        listEl.createDiv({ cls: "dash-empty", text: "暂无股票，加入第一只吧 📈" });
        return;
      }
      pool.forEach((s, i) => {
        const item = listEl.createDiv({ cls: "dash-pool-item" });
        const main = item.createDiv({ cls: "dash-pool-main" });
        main.createDiv({ cls: "dash-pool-title", text: `${s.name} ${s.code ? "(" + s.code + ")" : ""}` });
        const tags = main.createDiv({ cls: "dash-pool-tags" });
        if (s.tag) tags.createSpan({ cls: "dash-tag", text: s.tag });
        if (s.status) tags.createSpan({ cls: "dash-tag gold", text: s.status });
        if (s.driver) tags.createSpan({ cls: "dash-tag purple", text: s.driver });
        if (s.horizon) tags.createSpan({ cls: "dash-tag green", text: s.horizon });
        if (s.position) tags.createSpan({ cls: "dash-tag red", text: s.position });
        if (s.label) tags.createSpan({ cls: "dash-tag", text: s.label });
        if (s.reason) main.createDiv({ cls: "dash-pool-sub", text: s.reason });
        const actions = item.createDiv({ cls: "dash-pool-actions" });
        const edit = actions.createEl("button", { text: "编辑" });
        edit.addEventListener("click", () => {
          // 填充表单并切到编辑模式
          editingIdx = i;
          codeIn.value = s.code || "";
          nameIn.value = s.name || "";
          tagIn.value = s.tag || "";
          reasonIn.value = s.reason || "";
          labelIn.value = s.label || "";
          statusSel.value = s.status || "观察";
          driverSel.value = s.driver || "";
          horizonSel.value = s.horizon || "";
          positionSel.value = s.position || "";
          addBtn.setText("💾 保存修改");
          form.scrollIntoView({ block: "nearest", behavior: "instant" });
        });
        const del = actions.createEl("button", { text: "删除", cls: "del" });
        del.addEventListener("click", () => {
          pool.splice(i, 1);
          save();
          renderList();
        });
      });
    };

    // 添加/编辑表单
    let editingIdx = -1;
    const form = page.createDiv({ cls: "dash-form" });
    const codeIn = form.createEl("input", { attr: { placeholder: "代码" } });
    const nameIn = form.createEl("input", { attr: { placeholder: "名称（必填）" } });
    const tagIn = form.createEl("input", { attr: { placeholder: "行业/题材" } });
    const reasonIn = form.createEl("input", { attr: { placeholder: "入选理由" } });
    const labelIn = form.createEl("input", { attr: { placeholder: "自定义标签" } });
    const statusSel = form.createEl("select");
    ["观察", "已买", "已卖"].forEach((o) => statusSel.createEl("option", { text: o }));
    const driverSel = form.createEl("select");
    ["", "政策导向", "事件题材", "基本面逻辑", "技术支撑"].forEach((o) =>
      driverSel.createEl("option", { text: o || "驱动类型" })
    );
    const horizonSel = form.createEl("select");
    ["", "短线", "波段", "中线", "长线"].forEach((o) =>
      horizonSel.createEl("option", { text: o || "时间敏感度" })
    );
    const positionSel = form.createEl("select");
    ["", "轻仓", "标准", "重点"].forEach((o) =>
      positionSel.createEl("option", { text: o || "仓位档" })
    );
    const addBtn = form.createEl("button", { text: "➕ 加入" });
    addBtn.addEventListener("click", () => {
      const name = nameIn.value.trim();
      if (!name) return;
      const data = {
        code: codeIn.value.trim(),
        name,
        tag: tagIn.value.trim(),
        status: statusSel.value,
        driver: driverSel.value,
        horizon: horizonSel.value,
        position: positionSel.value,
        reason: reasonIn.value.trim(),
        label: labelIn.value.trim(),
      };
      if (editingIdx >= 0 && editingIdx < pool.length) {
        pool[editingIdx] = data;
        editingIdx = -1;
        addBtn.setText("➕ 加入");
      } else {
        pool.push(data);
      }
      save();
      codeIn.value = nameIn.value = tagIn.value = reasonIn.value = labelIn.value = "";
      driverSel.value = horizonSel.value = positionSel.value = "";
      renderList();
    });

    const listEl = page.createDiv();
    renderList();
  }

  private renderTopics(page: HTMLElement) {

    const pool = this.sharedData.topicPool || [];
    const save = () => {
      this.sharedData.topicPool = pool;
      saveSharedData(this.app, this.sharedData);
    };

    const renderList = () => {
      listEl.empty();
      if (pool.length === 0) {
        listEl.createDiv({ cls: "dash-empty", text: "暂无选题，添加第一个吧 🎯" });
        return;
      }
      pool.forEach((s, i) => {
        const item = listEl.createDiv({ cls: "dash-pool-item" });
        const main = item.createDiv({ cls: "dash-pool-main" });
        main.createDiv({ cls: "dash-pool-title", text: s.title });
        const tags = main.createDiv({ cls: "dash-pool-tags" });
        if (s.tag) tags.createSpan({ cls: "dash-tag purple", text: s.tag });
        if (s.status) tags.createSpan({ cls: "dash-tag gold", text: s.status });
        const actions = item.createDiv({ cls: "dash-pool-actions" });
        const edit = actions.createEl("button", { text: "编辑" });
        edit.addEventListener("click", () => {
          editingIdx = i;
          titleIn.value = s.title || "";
          tagIn.value = s.tag || "";
          statusSel.value = s.status || "待写";
          addBtn.setText("💾 保存修改");
          form.scrollIntoView({ block: "nearest", behavior: "instant" });
        });
        const del = actions.createEl("button", { text: "删除", cls: "del" });
        del.addEventListener("click", () => {
          pool.splice(i, 1);
          save();
          renderList();
        });
      });
    };

    // 添加/编辑表单
    let editingIdx = -1;
    const form = page.createDiv({ cls: "dash-form" });
    const titleIn = form.createEl("input", { attr: { placeholder: "选题标题（必填）" } });
    const tagIn = form.createEl("input", { attr: { placeholder: "标签（如：AI/财经）" } });
    const statusSel = form.createEl("select");
    ["待写", "写作中", "已发布"].forEach((o) => statusSel.createEl("option", { text: o }));
    const addBtn = form.createEl("button", { text: "➕ 添加" });
    addBtn.addEventListener("click", () => {
      const title = titleIn.value.trim();
      if (!title) return;
      const data = { title, tag: tagIn.value.trim(), status: statusSel.value };
      if (editingIdx >= 0 && editingIdx < pool.length) {
        pool[editingIdx] = data;
        editingIdx = -1;
        addBtn.setText("➕ 添加");
      } else {
        pool.push(data);
      }
      save();
      titleIn.value = tagIn.value = "";
      renderList();
    });

    const listEl = page.createDiv();
    renderList();
  }

  /* ═══════════════════════════ 工具方法 ═══════════════════════════ */

  private goto(page: Page) {
    this.page = page;
    this.render();
  }

  /** 获取某页面的组件实例列表（首页兼容 activeWidgets 旧数据） */
  private getPageWidgets(page: Page): string[] {
    if (page === "home") {
      return this.plugin.settings.activeWidgets?.length
        ? this.plugin.settings.activeWidgets
        : WIDGETS.map((w) => w.id);
    }
    return this.plugin.settings.pageWidgets?.[page] || [];
  }

  /** 添加组件实例：写入当前页组件列表并刷新（同组件可多实例，id 追加 #N） */
  private addWidgetInstance(widgetId: string) {
    const page = this.page;
    const list = [...this.getPageWidgets(page)];
    const count = list.filter((id) => id.split("#")[0] === widgetId).length;
    const instId = count === 0 ? widgetId : `${widgetId}#${count}`;
    list.push(instId);
    if (page === "home") {
      this.plugin.settings.activeWidgets = list;
    } else {
      const pw = { ...(this.plugin.settings.pageWidgets || {}) };
      pw[page] = list;
      this.plugin.settings.pageWidgets = pw;
    }
    this.plugin.saveSettings();
    new Notice(`已添加组件：${widgetId}`);
    this.reload();
  }

  private habitData(): HabitData {
    return this.plugin.settings.habits || {};
  }

  private saveHabitData(data: HabitData) {
    this.plugin.settings.habits = data;
    this.plugin.saveSettings();
  }

  private heatLevel(i: number): string {
    // 近 30 天热力：越靠近今天越亮（c1 深 → c4 亮）
    if (i >= 27) return " c4";
    if (i >= 21) return " c3";
    if (i >= 10) return " c2";
    return " c1";
  }

  private levelCls(level: string): string {
    const l = (level || "L1").toUpperCase();
    if (l === "L3") return "l3";
    if (l === "L2") return "l2";
    return "l1";
  }

  private fmtDate(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private drawBarChart(container: HTMLElement, data: [string, number][]) {
    if (data.length === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 80;
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const max = Math.max(...data.map(([, v]) => v), 1);
    const bw = 200 / data.length;
    data.forEach(([label, v], i) => {
      const h = Math.max(2, (v / max) * 70);
      const grad = ctx.createLinearGradient(0, 80 - h, 0, 80);
      grad.addColorStop(0, "#8b5cf6");
      grad.addColorStop(1, "#fbbf24");
      ctx.fillStyle = grad;
      ctx.fillRect(i * bw + bw * 0.15, 80 - h, bw * 0.7, h);
      ctx.fillStyle = "#7d8ba1";
      ctx.font = "8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, i * bw + bw / 2, 78);
    });
  }
}

/** 选择添加组件的弹窗：按分类折叠列出所有可用 widget，点击添加 */
class AddWidgetModal extends Modal {
  private onPick: (widgetId: string) => void;

  constructor(app: App, onPick: (widgetId: string) => void) {
    super(app);
    this.onPick = onPick;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "➕ 选择要添加的组件" });

    const grouped = groupWidgetsByCategory();
    const catOrder = new Map<string, number>();
    CATEGORIES.forEach((c, i) => catOrder.set(c.id, i));

    // 按分类定义顺序渲染（未匹配分类的归入 other，排最后）
    const sortedCats = [...grouped.keys()].sort((a, b) => {
      const ai = catOrder.get(a) ?? 999;
      const bi = catOrder.get(b) ?? 999;
      return ai - bi;
    });

    for (const catId of sortedCats) {
      const widgets = grouped.get(catId)!;
      const cat = CATEGORIES.find((c) => c.id === catId) || { id: "other", icon: "📦", name: "其他" };

      // 分类头（可折叠）
      const header = contentEl.createDiv({ cls: "wb-cat-header" });
      header.createSpan({ cls: "wb-cat-icon", text: cat.icon });
      header.createSpan({ cls: "wb-cat-label", text: cat.name });
      header.createSpan({ cls: "wb-cat-count", text: String(widgets.length) });
      header.createSpan({ cls: "wb-cat-arrow", text: "▾" });

      const body = contentEl.createDiv({ cls: "wb-cat-body" });
      header.addEventListener("click", () => {
        const collapsed = body.classList.toggle("collapsed");
        header.querySelector(".wb-cat-arrow")?.setText(collapsed ? "▸" : "▾");
      });

      // 组件行
      for (const w of widgets) {
        const row = body.createDiv({ cls: "wb-add-widget" });
        row.createSpan({ cls: "wb-add-icon", text: w.icon });
        row.createSpan({ cls: "wb-add-title", text: w.title });
        const btn = row.createEl("button", { cls: "wb-add-btn", text: "添加" });
        btn.addEventListener("click", () => {
          this.onPick(w.id);
          this.close();
        });
      }
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/** 知识卡片内容阅读 Modal：点击卡片弹出，渲染笔记正文，不直接跳转文档 */
class CardContentModal extends Modal {
  private file: TFile;

  constructor(app: App, file: TFile) {
    super(app);
    this.file = file;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("wb-card-modal");

    contentEl.createEl("h3", { text: this.file.basename, cls: "wb-card-modal-title" });
    const body = contentEl.createDiv({ cls: "wb-card-modal-body" });
    this.app.vault.read(this.file).then((content) => {
      MarkdownRenderer.renderMarkdown(content, body, this.file.path, this as any);
      // 关联卡片链接：在 body（祖先）上挂捕获监听，先于 Obsidian 默认 wikilink 处理器触发，
      // 拦截后在本 Modal 内继续阅读（嵌套弹 CardContentModal），避免默认跳转失效/双开。
      body.addEventListener(
        "click",
        (ev: MouseEvent) => {
          const a = (ev.target as HTMLElement)?.closest?.("a.internal-link") as HTMLAnchorElement | null;
          if (!a) return;
          ev.preventDefault();
          ev.stopPropagation();
          const raw = (a.getAttribute("data-href") || a.getAttribute("href") || "").trim();
          const linkpath = raw.split("#")[0].split("|")[0].trim();
          const target = this.app.metadataCache.getFirstLinkpathDest(linkpath, this.file.path);
          if (target instanceof TFile) {
            new CardContentModal(this.app, target).open();
          } else {
            new Notice("未找到关联笔记：" + linkpath);
          }
        },
        true
      );
    });

    const footer = contentEl.createDiv({ cls: "wb-card-modal-footer" });

    // 已复习按钮：记录复习状态（写入笔记 frontmatter: reviewed / reviewedAt）
    const reviewedBtn = footer.createEl("button", { cls: "wb-add-btn wb-reviewed-btn" });
    // 用局部变量作为状态真相来源，避免 metadataCache 异步刷新滞后导致按钮文案与状态错位（差一拍）
    let reviewed = !!(this.app.metadataCache.getFileCache(this.file)?.frontmatter?.reviewed);
    const syncReviewed = () => {
      reviewedBtn.textContent = reviewed ? "✅ 已复习" : "✓ 标记已复习";
      reviewedBtn.classList.toggle("is-done", reviewed);
    };
    syncReviewed();
    reviewedBtn.addEventListener("click", () => {
      reviewed = !reviewed;
      this.app.fileManager
        .processFrontMatter(this.file, (fm: any) => {
          if (reviewed) {
            fm.reviewed = true;
            fm.reviewedAt = new Date().toISOString();
          } else {
            delete fm.reviewed;
            delete fm.reviewedAt;
          }
        })
        .then(() => {
          syncReviewed();
          new Notice(reviewed ? "✅ 已记录复习状态" : "已取消复习标记");
        });
    });

    const openBtn = footer.createEl("button", { cls: "wb-add-btn", text: "📄 在 Obsidian 中打开" });
    openBtn.addEventListener("click", () => {
      openFile(this.app, this.file.path);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

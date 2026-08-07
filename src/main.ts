import { Plugin, WorkspaceLeaf, Notice, PluginSettingTab, App, Setting } from "obsidian";
import { WorkbenchView, WORKBENCH_VIEW_TYPE } from "./views/WorkbenchView";
import { HabitData, defaultHabits } from "./services/habitService";
import { EnglishRecord } from "./services/englishService";
import { WIDGETS, getWidget } from "./widgets/registry";
import { migrateSharedFromDataJson } from "./services/sharedStore";

interface WorkbenchSettings {
  /** 知识库根目录（相对库根的路径，留空 = 库根） */
  knowledgeBasePath: string;
  /** 是否显示背景动效（气泡/海浪/罗盘） */
  showEffects: boolean;
  /** 复习字段名（KC 卡 frontmatter 中的复习日期字段） */
  reviewField: string;
  /** 打卡存储：英语/播客写入的笔记目录 */
  habitNoteFolder: string;
  /** 习惯打卡数据（插件私有存储） */
  habits: HabitData;
  /** 英语打卡记录（每日勾选单词，与 Web 端 english_records 同构） */
  englishRecords: EnglishRecord[];
  /** 锻炼背景音乐 URL（空 = 默认 SoundHelix） */
  workoutMusicUrl?: string;
  /** 锻炼背景音乐音量 0-1 */
  workoutMusicVol?: number;
  /** 锻炼背景音乐播放状态：playing / paused */
  workoutMusicState?: string;
  /** 播客续播记忆：audioPath -> {pos 秒, updatedAt} */
  podcastProgress?: Record<string, { pos: number; updatedAt: string }>;
  /** 播客收听统计：date(YYYY-MM-DD) -> {audioPath: count}（30 天热力图用） */
  podcastStat?: Record<string, Record<string, number>>;
  /** 自定义 hero 头图（base64 data URL，空 = 默认内置图） */
  heroImageDataUrl: string;
  /** 仪表盘布局：key = 元素 data-id，value = {x, y, w, h} */
  dashboardLayout: Record<string, { x: number; y: number; w: number; h: number }>;
  /** 首页已启用的组件实例列表（可含 #N 后缀表示同一组件的多个实例） */
  activeWidgets: string[];
  /** MaskedHeading 组件实例配置：instId -> { text, bgUrl?, color?, fontSize? } */
  maskedHeadingConfig?: Record<
    string,
    { text: string; bgUrl?: string; color?: string; fontSize?: number }
  >;
  /** 组件实例通用配置：instId -> { enabled?, ...组件自定义配置 } */
  widgetConfigs?: Record<string, Record<string, unknown>>;
  /** 子页面组件列表：page -> 组件实例 id 数组（首页用 activeWidgets 兼容旧数据） */
  pageWidgets?: Record<string, string[]>;
  /** 侧边栏是否收起（仅图标） */
  sidebarCollapsed?: boolean;
  /** 主题模式：light / dark / auto（跟随系统） */
  themeMode?: string;
}

const DEFAULT_SETTINGS: WorkbenchSettings = {
  knowledgeBasePath: "",
  showEffects: true,
  reviewField: "review",
  habitNoteFolder: "01 - Projects 项目/打卡",
  habits: defaultHabits(),
  englishRecords: [],
  heroImageDataUrl: "",
  dashboardLayout: {},
  activeWidgets: WIDGETS.map((w) => w.id),
  maskedHeadingConfig: {},
  widgetConfigs: {},
  pageWidgets: {},
  sidebarCollapsed: false,
};

/** 旧组件 id → 新组件 id（重构 schedule 类时迁移） */
const WIDGET_ID_MIGRATION: Record<string, string> = {
  "todo-list": "agenda",
  "habit-heatmap": "checkin",
  "goals": "objectives",
  "projects": "objectives",
  "review-due": "review",
};

/** 旧 id → 新 id（保留 #N 多实例后缀，并去重） */
function migrateWidgetList(list?: string[]): string[] | undefined {
  if (!list) return list;
  const out: string[] = [];
  for (const id of list) {
    const [base, suffix] = id.split("#");
    const mapped = WIDGET_ID_MIGRATION[base];
    const newId = mapped ? (suffix ? `${mapped}#${suffix}` : mapped) : id;
    if (!out.includes(newId)) out.push(newId);
  }
  return out;
}

/** 迁移已保存的组件列表 / 子页列表 / 实例配置键（幂等） */
function migrateAllWidgetIds(settings: WorkbenchSettings) {
  settings.activeWidgets = migrateWidgetList(settings.activeWidgets)!;
  const pw = settings.pageWidgets || {};
  const newPw: Record<string, string[]> = {};
  for (const [page, list] of Object.entries(pw)) {
    newPw[page] = migrateWidgetList(list) || [];
  }
  settings.pageWidgets = newPw;
  const wc = settings.widgetConfigs || {};
  const newWc: Record<string, Record<string, unknown>> = {};
  for (const [id, val] of Object.entries(wc)) {
    const [base, suffix] = id.split("#");
    const mapped = WIDGET_ID_MIGRATION[base];
    const newId = mapped ? (suffix ? `${mapped}#${suffix}` : mapped) : id;
    newWc[newId] = val;
  }
  settings.widgetConfigs = newWc;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default class KnowledgeWorkbenchPlugin extends Plugin {
  settings: WorkbenchSettings;

  async onload() {
    await this.loadSettings();
    // 一次性迁移：旧 data.json 里的共享字段 → vault 共享文件，并清空 data.json 冗余
    await migrateSharedFromDataJson(this.app, this);
    this.addSettingTab(new WorkbenchSettingTab(this.app, this));

    // 注册工作台视图
    this.registerView(
      WORKBENCH_VIEW_TYPE,
      (leaf) => new WorkbenchView(leaf, this)
    );

    // 命令：打开工作台
    this.addCommand({
      id: "open-workbench",
      name: "打开知识库工作台",
      callback: () => this.activateWorkbench(),
    });

    // 侧边栏图标
    try {
      this.addRibbonIcon("anchor", "打开知识库工作台", () => {
        this.activateWorkbench();
      });
    } catch (e) {
      console.error("工作台图标注册失败（不影响命令）", e);
    }

    // 启动时自动打开（可选：仅当没有工作台视图时）
    this.app.workspace.onLayoutReady(() => {
      if (!this.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).length) {
        // 不自动打开，由用户命令触发
      }
    });
  }

  onunload() {
    // 视图随插件卸载自动销毁
  }

  async activateWorkbench() {
    const existing = this.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    migrateAllWidgetIds(this.settings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class WorkbenchSettingTab extends PluginSettingTab {
  plugin: KnowledgeWorkbenchPlugin;

  constructor(app: App, plugin: KnowledgeWorkbenchPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "🏴‍☠️ 知识库工作台设置" });

    new Setting(containerEl)
      .setName("知识库根目录")
      .setDesc("工作台扫描的根路径（相对库根，留空 = 整个库）")
      .addText((text) =>
        text
          .setPlaceholder("例如：知识库")
          .setValue(this.plugin.settings.knowledgeBasePath)
          .onChange(async (value) => {
            this.plugin.settings.knowledgeBasePath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("背景动效")
      .setDesc("是否显示气泡上浮 / 海浪 / 罗盘摆动等背景动效")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showEffects)
          .onChange(async (value) => {
            this.plugin.settings.showEffects = value;
            await this.plugin.saveSettings();
            new Notice("动效设置已更新，重新打开工作台生效");
          })
      );

    new Setting(containerEl)
      .setName("复习字段")
      .setDesc("KC 卡 frontmatter 中的复习日期字段名")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.reviewField)
          .onChange(async (value) => {
            this.plugin.settings.reviewField = value.trim() || "review";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("打卡笔记目录")
      .setDesc("英语/播客打卡写入的笔记目录（相对库根）")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.habitNoteFolder)
          .onChange(async (value) => {
            this.plugin.settings.habitNoteFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hero 头图")
      .setDesc("上传自定义头图（PNG/JPG/GIF），留空则使用默认内置图。支持任意尺寸，会自动适配。")
      .addButton((btn) =>
        btn
          .setButtonText("选择图片")
          .setClass("mod-cta")
          .onClick(async () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const dataUrl = await fileToDataUrl(file);
                this.plugin.settings.heroImageDataUrl = dataUrl;
                await this.plugin.saveSettings();
                new Notice("✅ 头图已更新，重新打开工作台生效");
                this.display();
              } catch (e) {
                console.error(e);
                new Notice("❌ 读取图片失败");
              }
            };
            input.click();
          })
      );

    // 显示当前头图预览（如果有自定义图）
    if (this.plugin.settings.heroImageDataUrl) {
      containerEl.createEl("div", { cls: "wb-hero-preview-wrap" }).createEl("img", {
        attr: { src: this.plugin.settings.heroImageDataUrl },
        cls: "wb-hero-preview",
      });
    }

    // ── 组件实例管理（参考 Modular Theme Dashboard 的实例管理） ──
    containerEl.createEl("h3", { text: "🧩 组件管理" });
    containerEl.createEl("p", {
      text: "按页面管理已添加的组件实例：开关 / 配置 / 删除。",
      cls: "setting-item-description",
    });

    // 所有页面（首页 + 子页面），每页一个分组
    const pages: { id: string; label: string }[] = [
      { id: "home", label: "🏠 首页" },
      { id: "domains", label: "🧭 领域" },
      { id: "wiki", label: "🗺️ 概念库" },
      { id: "podcast", label: "🎙️ 播客" },
      { id: "board", label: "🏴 看板" },
      { id: "config", label: "⚙️ 系统配置" },
      { id: "news", label: "📰 行业新闻" },
      { id: "stocks", label: "📈 股票池" },
      { id: "topics", label: "🎯 选题池" },
    ];

    let anyComponent = false;
    for (const page of pages) {
      const list = this.getPageList(page.id);
      if (list.length === 0) continue;
      anyComponent = true;

      containerEl.createEl("h4", {
        text: page.label,
        attr: { style: "margin:14px 0 6px;font-size:15px;font-weight:700;" },
      });

      for (const instId of list) {
        const [baseId, suffix] = instId.split("#");
        const w = getWidget(baseId);
        const label = w
          ? `${w.icon} ${w.title}${suffix ? ` #${suffix}` : ""}`
          : `📦 ${instId}`;
        const cfg = this.getWidgetConfig(instId);

        new Setting(containerEl)
          .setName(label)
          .setDesc(`实例 ID: ${instId}`)
          .addToggle((tg) =>
            tg
              .setValue(cfg.enabled !== false)
              .onChange(async (v) => {
                await this.setWidgetEnabled(instId, v);
              })
          )
          .addButton((btn) =>
            btn.setButtonText("配置").onClick(() => {
              // 手风琴：切换当前行的内联配置面板
              const target = containerEl.querySelector<HTMLElement>(
                `[data-inline-settings="${instId}"]`
              );
              if (!target) return;
              const open = target.style.display !== "none";
              // 收起所有
              containerEl.querySelectorAll<HTMLElement>("[data-inline-settings]").forEach((el) => {
                el.style.display = "none";
                el.empty();
              });
              if (!open) {
                target.style.display = "block";
                target.empty();
                const saveCb = () => {
                  this.plugin.saveSettings();
                  this.refreshWorkbenchViews();
                };
                // 通用外观：主色（所有组件都有）
                this.renderCommonColorSetting(target, instId, w?.accent || "#8b5cf6", saveCb);
                // 组件专属配置（实现了 renderSettings 的组件）
                if (w && typeof w.renderSettings === "function") {
                  target.createEl("h4", {
                    text: "组件设置",
                    attr: { style: "margin:10px 0 4px;font-size:13px;font-weight:700;" },
                  });
                  try {
                    w.renderSettings(target, this.plugin, instId, saveCb);
                  } catch (e) {
                    console.error(`[workbench] ${baseId} renderSettings 失败`, e);
                    target.createEl("p", { text: `配置渲染失败：${String(e)}` });
                  }
                }
              }
            })
          )
          .addButton((btn) =>
            btn.setButtonText("删除").setWarning().onClick(async () => {
              await this.removeWidgetInstance(instId, page.id);
            })
          );
        // 行内配置容器（手风琴展开）
        containerEl.createDiv({
          cls: "wb-inline-settings",
          attr: { "data-inline-settings": instId, style: "display:none;" },
        });
      }
    }

    if (!anyComponent) {
      containerEl.createEl("p", {
        text: "暂无组件，可在任意页面点击 ➕ 新建 添加组件。",
        cls: "setting-item-description",
      });
    }
  }

  /** 获取某页面的组件列表（首页兼容 activeWidgets 旧数据） */
  private getPageList(page: string): string[] {
    if (page === "home") {
      return this.plugin.settings.activeWidgets && this.plugin.settings.activeWidgets.length
        ? this.plugin.settings.activeWidgets
        : WIDGETS.map((w) => w.id);
    }
    return this.plugin.settings.pageWidgets?.[page] || [];
  }

  /** 读取组件实例配置（缺省返回空对象） */
  private getWidgetConfig(instId: string): Record<string, unknown> {
    return this.plugin.settings.widgetConfigs?.[instId] || {};
  }

  /** 设置组件实例启用状态并刷新打开的视图 */
  private async setWidgetEnabled(instId: string, enabled: boolean) {
    const map = this.plugin.settings.widgetConfigs || {};
    map[instId] = { ...(map[instId] || {}), enabled };
    this.plugin.settings.widgetConfigs = map;
    await this.plugin.saveSettings();
    this.refreshWorkbenchViews();
  }

  /** 通用外观配置：主色（所有组件都有） */
  private renderCommonColorSetting(
    target: HTMLElement,
    instId: string,
    defaultAccent: string,
    saveCb: () => void
  ) {
    const PRESET = [
      "#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#f59e0b",
      "#f472b6", "#e11d2e", "#22d3ee", "#a78bfa", "#6ee7b7",
    ];
    const cfg = this.plugin.settings.widgetConfigs || {};
    const inst = cfg[instId] || {};
    const current = String(inst.color || "");

    target.createEl("h4", {
      text: "🎨 外观",
      attr: { style: "margin:6px 0 4px;font-size:13px;font-weight:700;" },
    });
    const swatchWrap = target.createDiv({
      attr: { style: "display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px;" },
    });
    const paint = (hex: string) => {
      swatchWrap.querySelectorAll<HTMLElement>("button").forEach((b) => {
        b.style.borderColor = "var(--background-modifier-border)";
        b.style.boxShadow = "none";
      });
      if (hex) {
        const sel = swatchWrap.querySelector<HTMLElement>(`[data-c="${hex}"]`);
        if (sel) {
          sel.style.borderColor = "var(--interactive-accent)";
          sel.style.boxShadow = "0 0 0 2px var(--interactive-accent)";
        }
      }
      cfg[instId] = { ...inst, color: hex };
      this.plugin.settings.widgetConfigs = cfg;
      this.plugin.saveSettings();
      this.refreshWorkbenchViews();
    };

    PRESET.forEach((c) => {
      const sw = swatchWrap.createEl("button", {
        attr: {
          "data-c": c,
          style: `width:24px;height:24px;border-radius:6px;cursor:pointer;padding:0;border:2px solid var(--background-modifier-border);background:${c};`,
        },
      });
      sw.addEventListener("click", () => paint(c));
    });

    // 自定义取色器 + 恢复默认
    const row = target.createDiv({
      attr: { style: "display:flex;align-items:center;gap:8px;margin-bottom:6px;" },
    });
    const colorInput = row.createEl("input", {
      attr: { type: "color", value: current || defaultAccent },
    });
    colorInput.style.width = "36px";
    colorInput.style.height = "24px";
    colorInput.style.padding = "0";
    colorInput.style.border = "none";
    colorInput.style.cursor = "pointer";
    colorInput.addEventListener("input", () => paint(colorInput.value));
    const reset = row.createEl("button", {
      text: "恢复默认",
      attr: { style: "font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;background:var(--background-modifier-form-field);color:var(--text-normal);border:1px solid var(--background-modifier-border);" },
    });
    reset.addEventListener("click", () => paint(""));
    saveCb();
  }

  /** 刷新已打开的工作台视图 */
  private refreshWorkbenchViews() {
    const leaves = this.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof WorkbenchView) leaf.view.reload();
    }
  }

  /** 删除组件实例：从所属页面列表移除 + 清理布局 + 刷新打开的视图 */
  private async removeWidgetInstance(instId: string, page: string) {
    if (page === "home") {
      const active = this.plugin.settings.activeWidgets || [];
      this.plugin.settings.activeWidgets = active.filter((id) => id !== instId);
    } else {
      const pw = { ...(this.plugin.settings.pageWidgets || {}) };
      pw[page] = (pw[page] || []).filter((id) => id !== instId);
      this.plugin.settings.pageWidgets = pw;
    }

    // 清理该实例产生的卡片布局条目
    // 子页面 data-id 带页面前缀（如 domains-todo-list）；stat-kpi/charts 有特殊前缀
    const [baseId] = instId.split("#");
    const rawPrefixes =
      baseId === "stat-kpi"
        ? ["stat-"]
        : baseId === "charts"
          ? ["chart-"]
          : [baseId];
    const prefixes = page === "home" ? rawPrefixes : rawPrefixes.map((p) => `${page}-${p}`);
    const layout = this.plugin.settings.dashboardLayout || {};
    for (const key of Object.keys(layout)) {
      if (prefixes.some((p) => key === p || key.startsWith(p))) {
        delete layout[key];
      }
    }

    await this.plugin.saveSettings();
    new Notice(`已删除组件：${instId}`);

    // 清理该实例的通用配置
    if (this.plugin.settings.widgetConfigs) {
      delete this.plugin.settings.widgetConfigs[instId];
    }
    if (this.plugin.settings.maskedHeadingConfig) {
      delete this.plugin.settings.maskedHeadingConfig[instId];
    }
    await this.plugin.saveSettings();

    // 刷新已打开的工作台视图
    this.refreshWorkbenchViews();
    this.display();
  }
}

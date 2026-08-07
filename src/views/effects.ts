/**
 * 背景动效注册表（方案 B：统一注册表，页面动效 + 头图熔岩共用一套开关体系）
 *
 * 作用域说明：
 *  - page：挂在整页背景层（.workbench-container）
 *  - hero：挂在头图区（.wb-hero），仅在未自定义头图时构建
 *
 * 新增动效只需往 EFFECTS 数组追加一项，设置面板与渲染逻辑会自动识别，无需改其他文件。
 */

import { MoltenBackground, MoltenParams } from "../backgrounds/MoltenBackground";

/** 动效作用域 */
export type EffectScope = "page" | "hero";

export interface EffectDef {
  /** 唯一 id，用作 settings.effects 的键 */
  id: string;
  /** 设置面板显示名 */
  name: string;
  /** 图标（Emoji） */
  icon: string;
  /** 设置面板描述 */
  desc: string;
  /** 作用域 */
  scope: EffectScope;
  /** 默认是否开启 */
  defaultOn: boolean;
  /** 构建动效；可返回清理函数（释放 WebGL / 定时器等） */
  build: (container: HTMLElement) => (() => void) | void;
}

/** 头图熔岩默认参数（原版 MoltenMetal 配色） */
export const MOLTEN_DEFAULT_PARAMS: MoltenParams = {
  color1: "#5227FF", // 蓝紫
  color2: "#FF9FFC", // 粉
  color3: "#FFFFFF", // 白
  speed: 0.35,
  scale: 4,
  detail: 3,
  glow: 1.6,
  coreSize: 0.1,
  swirl: 1,
  fold: -0.2,
  blackPoint: 0.05,
  brightness: 1.3,
  colorMode: "molten",
  grain: true,
  grainIntensity: 0.05,
  mouseInteraction: true,
  mouseStrength: 0.3,
  opacity: 1.0,
};

/** ───────── 各动效构建函数 ───────── */

/** 气泡：12 个随机大小/位置/时长的浮动气泡 */
function buildBubbles(container: HTMLElement): void {
  for (let i = 0; i < 12; i++) {
    const b = container.createDiv({ cls: "wb-bubble" });
    const size = 6 + Math.random() * 14;
    b.style.width = size + "px";
    b.style.height = size + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 9 + Math.random() * 14 + "s";
    b.style.animationDelay = -Math.random() * 20 + "s";
  }
}

/** 海浪：底部三层 SVG 波浪 */
function buildWaves(container: HTMLElement): void {
  const waves = container.createDiv({ cls: "wb-waves" });
  waves.innerHTML = `<svg viewBox="0 0 1440 120" preserveAspectRatio="none" style="width:100%;height:100%">
      <path d="M0,60 C240,20 480,100 720,60 C960,20 1200,100 1440,60 L1440,120 L0,120 Z"/>
      <path d="M0,80 C240,40 480,120 720,80 C960,40 1200,120 1440,80 L1440,120 L0,120 Z"/>
      <path d="M0,100 C240,60 480,140 720,100 C960,60 1200,140 1440,100 L1440,120 L0,120 Z"/>
    </svg>`;
}

/** 罗盘：左下角指针缓摆 */
function buildCompass(container: HTMLElement): void {
  const compass = container.createDiv({ cls: "wb-compass" });
  compass.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
      <circle class="ring" cx="50" cy="50" r="46"/>
      <circle class="ring2" cx="50" cy="50" r="38"/>
      <g class="tick" stroke-width="1">
        <line x1="50" y1="6" x2="50" y2="14"/>
        <line x1="50" y1="86" x2="50" y2="94"/>
        <line x1="6" y1="50" x2="14" y2="50"/>
        <line x1="86" y1="50" x2="94" y2="50"/>
      </g>
      <g class="wb-compass-needle" style="transform-origin:50px 50px">
        <polygon class="needle-n" points="50,16 56,52 50,58 44,52"/>
        <polygon class="needle-s" points="50,84 56,48 50,42 44,48"/>
      </g>
      <circle class="hub" cx="50" cy="50" r="6"/>
    </svg>`;
}

/** 头图熔岩：MoltenMetal WebGL 动态背景（返回 dispose 释放 GL 上下文） */
function buildMolten(container: HTMLElement): () => void {
  const host = container.createDiv({ cls: "wb-hero-molten" });
  const bg = new MoltenBackground();
  bg.mount(host, MOLTEN_DEFAULT_PARAMS);
  return () => {
    bg.unmount();
    if (host.parentElement) host.parentElement.removeChild(host);
  };
}

/** ───────── 注册表 ───────── */

export const EFFECTS: EffectDef[] = [
  {
    id: "bubbles",
    name: "气泡上浮",
    icon: "🫧",
    desc: "页面底层随机气泡缓慢上浮",
    scope: "page",
    defaultOn: true,
    build: buildBubbles,
  },
  {
    id: "waves",
    name: "海浪",
    icon: "🌊",
    desc: "页面底部三层波浪起伏",
    scope: "page",
    defaultOn: true,
    build: buildWaves,
  },
  {
    id: "compass",
    name: "罗盘",
    icon: "🧭",
    desc: "左下角航海罗盘指针缓摆",
    scope: "page",
    defaultOn: true,
    build: buildCompass,
  },
  {
    id: "molten",
    name: "头图熔岩",
    icon: "🔥",
    desc: "默认头图的 MoltenMetal 熔岩流动背景（自定义头图时自动跳过）",
    scope: "hero",
    defaultOn: true,
    build: buildMolten,
  },
];

/** 按 id 取动效定义 */
export function getEffect(id: string): EffectDef | undefined {
  return EFFECTS.find((e) => e.id === id);
}

/** 全部动效的默认开关表 */
export function defaultEffectFlags(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const e of EFFECTS) out[e.id] = e.defaultOn;
  return out;
}

/** 单项是否开启（未配置时回落到默认值） */
export function isEffectOn(flags: Record<string, boolean> | undefined, id: string): boolean {
  const def = getEffect(id);
  if (!def) return false;
  const v = flags?.[id];
  return typeof v === "boolean" ? v : def.defaultOn;
}

/**
 * 构建指定作用域内所有已开启的动效。
 * @param container 挂载容器
 * @param scope     作用域（page / hero）
 * @param flags     settings.effects 开关表
 * @param master    总开关（false = 全部不构建）
 * @returns 清理函数数组（调用方负责在重渲染/关闭时执行）
 */
export function buildEffects(
  container: HTMLElement,
  scope: EffectScope,
  flags: Record<string, boolean> | undefined,
  master = true
): Array<() => void> {
  const disposers: Array<() => void> = [];
  if (!master) return disposers;
  for (const eff of EFFECTS) {
    if (eff.scope !== scope) continue;
    if (!isEffectOn(flags, eff.id)) continue;
    try {
      const dispose = eff.build(container);
      if (typeof dispose === "function") disposers.push(dispose);
    } catch (e) {
      console.error(`[workbench] 动效 ${eff.id} 构建失败`, e);
    }
  }
  return disposers;
}

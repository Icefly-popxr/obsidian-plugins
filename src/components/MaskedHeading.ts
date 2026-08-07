/**
 * MaskedHeading — 遮罩标题组件（忠实移植 React Bits 原组件，无 React/gsap 依赖）
 *
 * 机制与原版一致：
 *  - SVG clipPath + <text> 字形裁剪：媒体层只显示在文字笔画内部
 *  - fillScale 过扫描：媒体放大超出文字，为视差/漂移留出滑动空间
 *  - 帧循环：drift 漂移（sin/cos 时间驱动）+ 鼠标视差（pointermove → tx/ty，指数缓动逼近）
 *  - reveal 入场：rise（单词上浮 + stagger）/ wipe（clipPath 擦除）/ fade（淡入缩放）
 *  - trigger：view（进入视口）/ mount（立即）/ hover（悬停）
 *  - textScale：字号按容器宽度自适应
 *
 * gsap 动画用 Web Animations API（element.animate）等价实现。
 */

export interface MaskedHeadingOptions {
  text?: string;
  tag?: "h1" | "h2" | "h3" | "h4" | "div" | "p";
  mediaType?: "image" | "video";
  src?: string;
  poster?: string;
  fillScale?: number;
  parallax?: number;
  drift?: number;
  brightness?: number;
  saturation?: number;
  grayscale?: boolean;
  reveal?: "rise" | "wipe" | "fade" | "none";
  duration?: number;
  stagger?: number;
  trigger?: "view" | "mount" | "hover";
  align?: "left" | "center" | "right";
  weight?: number;
  tracking?: number;
  lineHeight?: number;
  textScale?: number;
  /** 固定字号（px）：设置后字号不再随容器宽度自适应，卡片贴合文字内容 */
  fixedFontSize?: number;
  /** 文字色调（hex）：叠加 tint 染色层，默认使用媒体原色 */
  color?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

let clipSeq = 0;

export class MaskedHeading {
  private root: HTMLElement;
  private measureEl: HTMLElement;
  private revealEl: HTMLElement;
  private clipEl: HTMLElement;
  private mediaEl: HTMLElement;
  private tintEl: HTMLElement;
  private svgClipEl: SVGClipPathElement | null = null;
  private wordEls: HTMLElement[] = [];
  private baseEls: HTMLElement[] = [];
  private glyphEls: SVGTextElement[] = [];
  private words: string[] = [];

  private settings: {
    fillScale: number;
    parallax: number;
    drift: number;
    brightness: number;
    saturation: number;
    grayscale: boolean;
    textScale: number;
    fixedFontSize: number;
    color: string;
  };
  private reveal: MaskedHeadingOptions["reveal"];
  private duration: number;
  private stagger: number;
  private trigger: MaskedHeadingOptions["trigger"];
  private clipId: string;

  private offset = { x: 0, y: 0, tx: 0, ty: 0 };
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private enterHandler: (() => void) | null = null;
  private playStarted = false;
  private destroyed = false;
  private animations: Animation[] = [];

  constructor(container: HTMLElement, options: MaskedHeadingOptions = {}) {
    const s = (this.settings = {
      fillScale: options.fillScale ?? 1.25,
      parallax: options.parallax ?? 26,
      drift: options.drift ?? 18,
      brightness: options.brightness ?? 1,
      saturation: options.saturation ?? 1,
      grayscale: options.grayscale ?? false,
      textScale: options.textScale ?? 0.115,
      fixedFontSize: options.fixedFontSize ?? 0,
      color: options.color || "",
    });
    this.reveal = options.reveal ?? "rise";
    this.duration = options.duration ?? 1.1;
    this.stagger = options.stagger ?? 0.09;
    this.trigger = options.trigger ?? "view";
    this.clipId = `mh-clip-${Date.now().toString(36)}-${++clipSeq}`;

    const tag = options.tag ?? "h2";
    this.root = container.createEl(tag as keyof HTMLElementTagNameMap, {
      cls: "masked-heading",
    });
    this.root.style.textAlign = options.align ?? "center";
    this.root.style.fontWeight = String(options.weight ?? 700);
    this.root.style.letterSpacing = `${options.tracking ?? -0.03}em`;
    this.root.style.lineHeight = String(options.lineHeight ?? 1.06);

    // 占位测量层（透明文字，决定排版尺寸与字形位置）
    this.measureEl = this.root.createSpan({ cls: "masked-heading__measure" });

    // SVG defs：clipPath + 每词一个 <text> 字形
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "masked-heading__defs");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;overflow:hidden;";
    const defs = document.createElementNS(SVG_NS, "defs");
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", this.clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    this.root.appendChild(svg);
    this.svgClipEl = clipPath;

    // reveal > clip(字形裁剪) > media + tint(染色层)
    this.revealEl = this.root.createSpan({ cls: "masked-heading__reveal" });
    this.clipEl = this.revealEl.createSpan({ cls: "masked-heading__clip" });
    this.clipEl.style.clipPath = `url(#${this.clipId})`;
    const mediaWrap = this.clipEl.createSpan({ cls: "masked-heading__media" });
    this.mediaEl = mediaWrap;
    // tint 染色层：mix-blend-mode: color，只影响字形内媒体的色相（不改变亮度）
    this.tintEl = this.clipEl.createSpan({ cls: "masked-heading__tint" });
    if (this.settings.color) {
      this.tintEl.style.backgroundColor = this.settings.color;
    } else {
      this.tintEl.style.display = "none";
    }

    if ((options.mediaType ?? "image") === "video") {
      const v = document.createElement("video");
      v.className = "masked-heading__source";
      v.setAttribute("src", options.src ?? "");
      if (options.poster) v.setAttribute("poster", options.poster);
      v.setAttribute("autoplay", "");
      v.setAttribute("muted", "");
      v.setAttribute("loop", "");
      v.setAttribute("playsinline", "");
      this.mediaEl.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.className = "masked-heading__source";
      img.src = options.src ?? "";
      img.alt = "";
      img.draggable = false;
      this.mediaEl.appendChild(img);
    }

    this.setText(options.text ?? "Designed in the details");

    // 测量与响应式
    const sync = () => this.sync();
    this.ro = new ResizeObserver(sync);
    this.ro.observe(this.root);
    if (document.fonts?.ready) document.fonts.ready.then(sync).catch(() => {});
    sync();

    // 帧循环：drift 漂移 + 鼠标视差（指数缓动）
    let last = performance.now();
    let clock = 0;
    const frame = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const dx = Math.sin(clock * 0.21) * s.drift;
      const dy = Math.cos(clock * 0.17) * s.drift * 0.6;
      const ease = 1 - Math.exp(-dt / 0.18);
      this.offset.x += (this.offset.tx + dx - this.offset.x) * ease;
      this.offset.y += (this.offset.ty + dy - this.offset.y) * ease;
      this.place();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);

    const onMove = (e: PointerEvent) => {
      if (s.parallax <= 0) return;
      const r = this.root.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
      const ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
      this.offset.tx = clamp(nx, -1, 1) * -s.parallax;
      this.offset.ty = clamp(ny, -1, 1) * -s.parallax;
    };
    const onLeave = () => {
      this.offset.tx = 0;
      this.offset.ty = 0;
    };
    this.root.addEventListener("pointermove", onMove);
    this.root.addEventListener("pointerleave", onLeave);
  }

  /* ── 文字：重建 words / measure / SVG 字形 ── */
  setText(text: string) {
    this.words = String(text).split(/\s+/).filter(Boolean);

    // 重建占位层
    this.measureEl.empty();
    this.wordEls = [];
    this.baseEls = [];
    for (let i = 0; i < this.words.length; i += 1) {
      const word = this.words[i];
      const w = this.measureEl.createSpan({ cls: "masked-heading__word" });
      w.setText(word);
      if (i < this.words.length - 1) w.appendText(" ");
      const base = w.createEl("i", { cls: "masked-heading__baseline" });
      this.wordEls.push(w);
      this.baseEls.push(base);
    }

    // 重建 SVG 字形
    if (this.svgClipEl) this.svgClipEl.empty();
    this.glyphEls = [];
    for (const word of this.words) {
      const t = document.createElementNS(SVG_NS, "text");
      t.textContent = word;
      this.svgClipEl?.appendChild(t);
      this.glyphEls.push(t);
    }

    // 初始隐藏（view 触发前保持）
    this.applyRest();
    this.sync();
    this.playStarted = false;
    this.setupReveal();
  }

  /** 返回根元素（双击编辑等交互挂这里） */
  getRootEl(): HTMLElement {
    return this.root;
  }

  /** 更换背景媒体 */
  setSrc(src: string, mediaType: "image" | "video" = "image") {
    const old = this.mediaEl.firstElementChild;
    if (old) old.remove();
    if (mediaType === "video") {
      const v = document.createElement("video");
      v.className = "masked-heading__source";
      v.setAttribute("src", src);
      v.setAttribute("autoplay", "");
      v.setAttribute("muted", "");
      v.setAttribute("loop", "");
      v.setAttribute("playsinline", "");
      this.mediaEl.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.className = "masked-heading__source";
      img.src = src;
      img.alt = "";
      img.draggable = false;
      this.mediaEl.appendChild(img);
    }
  }

  /** 设置文字色调（hex）；空字符串 = 使用媒体原色 */
  setColor(color: string) {
    this.settings.color = color || "";
    if (this.tintEl) {
      if (color) {
        this.tintEl.style.backgroundColor = color;
        this.tintEl.style.display = "block";
      } else {
        this.tintEl.style.display = "none";
      }
    }
  }

  /** 设置固定字号（px），并重新同步字形位置 */
  setFontSize(size: number) {
    this.settings.fixedFontSize = Math.max(12, Math.round(size));
    this.sync();
  }

  /* ── 布局测量：字形位置对齐 ── */
  private sync() {
    const root = this.root;
    const measure = this.measureEl;
    if (!root || !measure) return;
    // fixedFontSize > 0 时字号固定（卡片贴合文字）；否则按容器宽度自适应
    root.style.fontSize =
      this.settings.fixedFontSize > 0
        ? `${this.settings.fixedFontSize}px`
        : `${clamp(root.clientWidth * this.settings.textScale, 20, 200).toFixed(1)}px`;

    const cs = window.getComputedStyle(measure);
    for (let i = 0; i < this.wordEls.length; i += 1) {
      const box = this.wordEls[i];
      const base = this.baseEls[i];
      const glyph = this.glyphEls[i];
      if (!box || !base || !glyph) continue;
      glyph.setAttribute("x", `${box.offsetLeft}`);
      glyph.setAttribute("y", `${base.offsetTop}`);
      glyph.style.fontFamily = cs.fontFamily;
      glyph.style.fontSize = cs.fontSize;
      glyph.style.fontWeight = cs.fontWeight;
      glyph.style.fontStyle = cs.fontStyle;
      glyph.style.letterSpacing = cs.letterSpacing;
    }
    this.place();
  }

  /* ── 媒体定位：fillScale + 视差/漂移偏移 ── */
  private place() {
    const media = this.mediaEl;
    if (!media) return;
    const s = this.settings;
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const maxX = Math.max(0, ((s.fillScale - 1) / 2) * W);
    const maxY = Math.max(0, ((s.fillScale - 1) / 2) * H);
    media.style.transform = `translate3d(${clamp(this.offset.x, -maxX, maxX).toFixed(2)}px, ${clamp(this.offset.y, -maxY, maxY).toFixed(2)}px, 0) scale(${s.fillScale})`;
    media.style.filter = `brightness(${s.brightness}) saturate(${s.saturation})${s.grayscale ? " grayscale(1)" : ""}`;
  }

  /* ── 入场动画（WAAPI 等价 gsap） ── */
  private applyRest() {
    const glyphs = this.glyphEls.filter(Boolean);
    if (this.reveal === "rise") {
      const dist = this.riseDistance();
      glyphs.forEach((g) => (g.style.transform = `translateY(${dist}px)`));
    } else if (this.reveal === "wipe") {
      this.revealEl.style.clipPath = "inset(0% 100% 0% 0%)";
    } else if (this.reveal === "fade") {
      this.revealEl.style.opacity = "0";
      this.revealEl.style.transform = "scale(1.08)";
    } else {
      this.revealEl.style.opacity = "1";
      this.revealEl.style.transform = "scale(1)";
      glyphs.forEach((g) => (g.style.transform = "translateY(0)"));
    }
  }

  private riseDistance(): number {
    return (parseFloat(window.getComputedStyle(this.root).fontSize) || 48) * 1.15;
  }

  private settle() {
    const glyphs = this.glyphEls.filter(Boolean);
    glyphs.forEach((g) => (g.style.transform = "translateY(0)"));
    this.revealEl.style.opacity = "1";
    this.revealEl.style.transform = "scale(1)";
    this.revealEl.style.clipPath = "inset(0% 0% 0% 0%)";
  }

  private play() {
    this.animations.forEach((a) => a.cancel());
    this.animations = [];
    const glyphs = this.glyphEls.filter(Boolean);
    const dur = this.duration * 1000;
    const power4Out = "cubic-bezier(0.22, 1, 0.36, 1)";
    const power3InOut = "cubic-bezier(0.65, 0, 0.35, 1)";
    const power3Out = "cubic-bezier(0.33, 1, 0.68, 1)";

    if (this.reveal === "rise") {
      const dist = this.riseDistance();
      glyphs.forEach((g, i) => {
        const a = g.animate(
          [{ transform: `translateY(${dist}px)` }, { transform: "translateY(0)" }],
          {
            duration: dur,
            delay: i * this.stagger * 1000,
            easing: power4Out,
            fill: "both",
          }
        );
        this.animations.push(a);
      });
    } else if (this.reveal === "wipe") {
      glyphs.forEach((g) => (g.style.transform = "translateY(0)"));
      const a = this.revealEl.animate(
        [{ clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }],
        { duration: dur, easing: power3InOut, fill: "both" }
      );
      this.animations.push(a);
    } else if (this.reveal === "fade") {
      glyphs.forEach((g) => (g.style.transform = "translateY(0)"));
      const a = this.revealEl.animate(
        [
          { opacity: 0, transform: "scale(1.08)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: dur, easing: power3Out, fill: "both" }
      );
      this.animations.push(a);
    } else {
      this.settle();
    }
  }

  private setupReveal() {
    // 先清理旧资源：setText 重建时会重复调用，避免 observer/监听堆积
    if (this.io) {
      this.io.disconnect();
      this.io = null;
    }
    if (this.enterHandler) {
      this.root.removeEventListener("pointerenter", this.enterHandler);
      this.enterHandler = null;
    }
    this.animations.forEach((a) => a.cancel());
    this.animations = [];

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.reveal === "none" || reduce) {
      this.settle();
      return;
    }
    if (this.trigger === "hover") {
      this.settle();
      const enter = () => {
        this.playStarted = true;
        this.play();
      };
      this.enterHandler = enter;
      this.root.addEventListener("pointerenter", enter);
      return;
    }
    if (this.trigger === "view") {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.playStarted = true;
            this.play();
            io.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      io.observe(this.root);
      this.io = io;
      return;
    }
    this.play();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    if (this.io) this.io.disconnect();
    if (this.enterHandler) this.root.removeEventListener("pointerenter", this.enterHandler);
    this.animations.forEach((a) => a.cancel());
    this.root.remove();
  }
}

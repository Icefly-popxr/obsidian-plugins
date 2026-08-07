import { Renderer, Program, Mesh, Triangle } from "ogl";

/**
 * FerrofluidBackground — 铁磁流体 / 液态金属 WebGL 动态背景
 * 从 React Bits 的 Ferrofluid 移植为原生 TS 类（无 React 依赖），
 * 供 Obsidian 插件视图使用。Shader 与参数逻辑 verbatim 保留。
 *
 * 与 MoltenBackground 同为「液态流动」视觉家族，但 Ferrofluid 偏暗黑粘稠金属：
 * 背景透明（alpha），银白/彩色流体沿 flowDirection 翻涌，边缘带 rim 高光 + shimmer 微光，
 * 鼠标移动产生涡流扰动。适合作为头图氛围层。
 */

export type FlowDirection = "up" | "down" | "left" | "right";

export interface FerrofluidParams {
  colors?: string[];          // 流体颜色（最多 8 个，不足则末色复用）
  speed?: number;             // 0.5  流动速度
  scale?: number;             // 1    缩放（细节密度）
  turbulence?: number;        // 1    湍流强度
  fluidity?: number;          // 0.1  流动性（粘稠 ↔ 顺滑）
  rimWidth?: number;          // 0.2  边缘高光宽度
  sharpness?: number;         // 3    边缘锐利度
  shimmer?: number;           // 1    微光强度
  glow?: number;              // 2    辉光
  flowDirection?: FlowDirection; // "down"
  opacity?: number;           // 1    不透明度
  mouseInteraction?: boolean;// true
  mouseStrength?: number;     // 1    鼠标扰动强度
  mouseRadius?: number;       // 0.3  鼠标扰动半径
  mouseDampening?: number;    // 0.15 鼠标阻尼（0 = 即时跟随）
  centerHollow?: number;      // 0.35 中间掏空半径（越大中间越空，0 = 不掏空）
}

const MAX_COLORS = 8;

const DEFAULT_PARAMS: Required<Omit<FerrofluidParams, "colors" | "flowDirection">> & {
  colors: string[];
  flowDirection: FlowDirection;
} = {
  colors: ["#ffffff", "#ffffff", "#ffffff"],
  speed: 0.2,
  scale: 1,
  turbulence: 1,
  fluidity: 0.1,
  rimWidth: 0.2,
  sharpness: 3,
  shimmer: 1,
  glow: 2,
  flowDirection: "down",
  opacity: 1,
  mouseInteraction: true,
  mouseStrength: 1,
  mouseRadius: 0.3,
  mouseDampening: 0.15,
  centerHollow: 0.68,
};

function hexToRGB(hex: string): [number, number, number] {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function prepColors(input?: string[]): {
  arr: number[][];
  count: number;
  avg: number[];
} {
  const base = input && input.length ? input : ["#4F46E5", "#06B6D4", "#E0F2FE"];
  const sliced = base.slice(0, MAX_COLORS);
  const count = sliced.length;
  const arr: number[][] = [];
  for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(sliced[Math.min(i, sliced.length - 1)]));
  const avg = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }
  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;
  return { arr, count, avg };
}

function flowVec(d: FlowDirection): [number, number] {
  switch (d) {
    case "up":
      return [0, 1];
    case "down":
      return [0, -1];
    case "left":
      return [-1, 0];
    case "right":
      return [1, 0];
    default:
      return [0, -1];
  }
}

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uMouseColor;
uniform vec2  uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform float uCenterHollow;   // 中间掏空半径（0~1）：中心留空、四周保留流动

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  float t = iTime;

  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  // 径向掏空：中间留空、四周保留流动（校正宽高比，避免椭圆）
  vec2 ruv = fragCoord / iResolution.xy - 0.5;
  ruv.x *= iResolution.x / iResolution.y;
  float rdist = length(ruv) * 2.0;
  float hollow = smoothstep(uCenterHollow, uCenterHollow + 0.15, rdist);
  ltn *= hollow;

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

export class FerrofluidBackground {
  private container: HTMLElement | null = null;
  private renderer: Renderer | null = null;
  private program: Program | null = null;
  private mesh: Mesh | null = null;
  private geometry: Triangle | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private raf = 0;
  private isVisible = true;
  private isPageVisible = true;
  private lastT = 0;
  private dpr = 1;
  private mouseDampening = 0.15;
  private mouseTarget: [number, number] = [0, 0];
  private uniforms: Record<string, { value: unknown }> | null = null;

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.canvas || !this.uniforms) return;
    const rect = this.canvas.getBoundingClientRect();
    const sc = this.dpr;
    const x = (e.clientX - rect.left) * sc;
    const y = rect.height - (e.clientY - rect.top) * sc;
    this.mouseTarget[0] = x;
    this.mouseTarget[1] = y;
    // 无阻尼时即时跟随；有阻尼在 loop 内插值
    if (this.mouseDampening <= 0) {
      const um = this.uniforms.iMouse.value as number[];
      um[0] = x;
      um[1] = y;
    }
  };

  private onVisibility = () => {
    this.isPageVisible = !document.hidden;
    this.isPageVisible ? this.tryStart() : this.tryStop();
  };

  private tryStart = () => {
    if (this.isVisible && this.isPageVisible && this.raf === 0 && this.mesh && this.program) {
      this.raf = requestAnimationFrame(this.loop);
    }
  };
  private tryStop = () => {
    if (this.raf !== 0) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };

  private loop = (t: number) => {
    if (!this.uniforms || !this.mesh || !this.renderer) return;
    this.raf = requestAnimationFrame(this.loop);
    this.uniforms.iTime.value = t * 0.001;

    const damp = this.mouseDampening;
    if (damp > 0) {
      if (!this.lastT) this.lastT = t;
      const dt = (t - this.lastT) / 1000;
      this.lastT = t;
      const tau = Math.max(1e-4, damp);
      let factor = 1 - Math.exp(-dt / tau);
      if (factor > 1) factor = 1;
      const target = this.mouseTarget;
      const cur = this.uniforms.iMouse.value as number[];
      cur[0] += (target[0] - cur[0]) * factor;
      cur[1] += (target[1] - cur[1]) * factor;
    } else {
      this.lastT = t;
    }

    try {
      this.renderer.render({ scene: this.mesh });
    } catch (e) {
      console.error("[workbench] Ferrofluid 渲染异常", e);
    }
  };

  /** 挂载到容器并启动渲染 */
  mount(container: HTMLElement, params: FerrofluidParams = {}): void {
    this.unmount();
    this.container = container;
    const p = { ...DEFAULT_PARAMS, ...params };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new Renderer({
      dpr: this.dpr,
      alpha: true,
      antialias: true,
    });
    this.renderer = renderer;
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    this.canvas = gl.canvas as HTMLCanvasElement;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);

    const { arr, count, avg } = prepColors(p.colors);

    const uniforms: Record<string, { value: unknown }> = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: arr[0] },
      uColor1: { value: arr[1] },
      uColor2: { value: arr[2] },
      uColor3: { value: arr[3] },
      uColor4: { value: arr[4] },
      uColor5: { value: arr[5] },
      uColor6: { value: arr[6] },
      uColor7: { value: arr[7] },
      uColorCount: { value: count },
      uMouseColor: { value: avg },
      uFlow: { value: flowVec(p.flowDirection) },
      uSpeed: { value: p.speed },
      uScale: { value: p.scale },
      uTurbulence: { value: p.turbulence },
      uFluidity: { value: p.fluidity },
      uRimWidth: { value: p.rimWidth },
      uSharpness: { value: p.sharpness },
      uShimmer: { value: p.shimmer },
      uGlow: { value: p.glow },
      uOpacity: { value: p.opacity },
      uMouseEnabled: { value: p.mouseInteraction ? 1 : 0 },
      uMouseStrength: { value: p.mouseStrength },
      uMouseRadius: { value: p.mouseRadius },
      uCenterHollow: { value: p.centerHollow },
    };
    this.uniforms = uniforms;
    this.mouseDampening = p.mouseDampening;

    this.program = new Program(gl, { vertex, fragment, uniforms });
    this.geometry = new Triangle(gl);
    this.mesh = new Mesh(gl, { geometry: this.geometry, program: this.program });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };
    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(container);

    if (p.mouseInteraction) {
      container.addEventListener("pointermove", this.handlePointerMove);
    }

    this.isVisible = true;
    this.isPageVisible = !document.hidden;
    this.io = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        this.isVisible ? this.tryStart() : this.tryStop();
      },
      { threshold: 0 }
    );
    this.io.observe(container);
    document.addEventListener("visibilitychange", this.onVisibility);

    this.tryStart();
  }

  /** 卸载并释放资源 */
  unmount(): void {
    this.tryStop();
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    if (this.io) {
      this.io.disconnect();
      this.io = null;
    }
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.container) {
      this.container.removeEventListener("pointermove", this.handlePointerMove);
    }
    if (this.renderer) {
      try {
        const c = this.container;
        if (this.canvas && c && this.canvas.parentElement === c) {
          c.removeChild(this.canvas);
        }
      } catch {
        /* noop */
      }
      this.renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.renderer = null;
    this.program = null;
    this.mesh = null;
    this.geometry = null;
    this.canvas = null;
    this.uniforms = null;
    this.container = null;
    this.lastT = 0;
    this.mouseTarget = [0, 0];
  }
}

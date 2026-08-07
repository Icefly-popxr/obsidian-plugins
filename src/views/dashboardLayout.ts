import type KnowledgeWorkbenchPlugin from "../main";

/**
 * 仪表盘自由布局管理器（E1 拆分自 WorkbenchView）
 *  - 初始化卡片位置（保存布局恢复 / 初始网格）
 *  - 拖拽 / 缩放 / 折叠状态持久化
 *  - 拖拽对齐参考线（边缘/中线 ≤6px 吸附 + 金色参考线）
 */

interface DragState {
  el: HTMLElement;
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
}

interface ResizeState {
  el: HTMLElement;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
}

export class DashboardLayoutManager {
  private plugin: KnowledgeWorkbenchPlugin;
  /** 注册文档级事件（由 WorkbenchView.registerDomEvent 注入，视图关闭自动注销） */
  private registerDomEvent: (type: string, cb: (e: Event) => void) => void;
  private container: HTMLElement | null = null;

  private _dragBound = false;
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;
  private dragGuides: HTMLElement | null = null;

  constructor(
    plugin: KnowledgeWorkbenchPlugin,
    registerDomEvent: (type: string, cb: (e: Event) => void) => void
  ) {
    this.plugin = plugin;
    this.registerDomEvent = registerDomEvent;
  }

  /** 初始化布局：恢复位置/尺寸/折叠 + 绑定拖拽缩放 + 全局事件（幂等） */
  init(container: HTMLElement) {
    this.container = container;
    const layout = this.plugin.settings.dashboardLayout || {};
    const cards = container.querySelectorAll<HTMLElement>(
      ".wb-widgets .wb-panel, .wb-widgets .wb-kpi-card, .wb-widgets .wb-chart"
    );
    const total = cards.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
    const gap = 12;
    const cellW = Math.max(260, (container.clientWidth - (cols - 1) * gap) / cols);
    const cellH = 180;

    cards.forEach((el, i) => {
      if (!el.dataset.id) {
        el.dataset.id = el.classList.contains("wb-kpi-card") ? `stat-${i}` : `card-${i}`;
      }
      const id = el.dataset.id;
      const saved = layout[id];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const gridLeft = col * (cellW + gap);
      const gridTop = row * (cellH + gap);

      if (saved && saved.x != null && saved.y != null) {
        el.style.left = saved.x + "px";
        el.style.top = saved.y + "px";
        const sizeByCss =
          el.classList.contains("masked-heading") ||
          el.classList.contains("web-preview") ||
          el.classList.contains("media-gallery") ||
          el.classList.contains("directory");
        if (!sizeByCss) {
          if (saved.w) el.style.width = saved.w + "px";
          if (saved.h) el.style.height = saved.h + "px";
        }
      } else {
        el.style.left = gridLeft + "px";
        el.style.top = gridTop + "px";
      }

      // 恢复折叠状态
      if (el.classList.contains("wb-panel") && saved?.collapsed) {
        el.classList.add("collapsed");
        const bd = el.querySelector<HTMLElement>(".wb-bd");
        if (bd) bd.style.display = "none";
        const btn = el.querySelector<HTMLElement>(".wb-collapse");
        if (btn) btn.setText("▸");
      }

      // 拖拽：kpi-card 整卡，其余用标题栏
      const dragHandle = el.classList.contains("wb-kpi-card") ? el : (el.querySelector(".wb-hd") || el);
      dragHandle.addEventListener("mousedown", (e) => {
        const t = e.target as HTMLElement;
        if (t.closest(".wb-more")) return;
        if (t.closest(".wb-collapse")) return;
        this.startDrag(e as MouseEvent, el);
      });

      // 缩放
      const resizeHandle = el.querySelector(".wb-resize-handle");
      if (resizeHandle) {
        resizeHandle.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const ev = e as MouseEvent;
          this.resizeState = {
            el,
            startX: ev.clientX,
            startY: ev.clientY,
            origW: el.offsetWidth,
            origH: el.offsetHeight,
          };
          el.classList.add("resizing");
        });
      }
    });

    // 全局事件（只绑一次）
    if (!this._dragBound) {
      this._dragBound = true;
      this.registerDomEvent("mouseup", () => {
        this.endDrag();
        this.endResize();
      });
      this.registerDomEvent("mousemove", (e) => {
        this.onDrag(e as MouseEvent);
        this.applyResize(e as MouseEvent);
      });
    }

    // 撑开画布高度
    const canvas = this.container.querySelector<HTMLElement>(".wb-widgets");
    if (canvas) {
      const rows = Math.max(1, Math.ceil(total / cols));
      canvas.style.height = rows * (cellH + gap) + gap + "px";
    }
  }

  private startDrag(e: MouseEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    this.dragState = {
      el,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
    };
    el.classList.add("dragging");
    this.ensureDragGuides();
  }

  private ensureDragGuides() {
    if (!this.container) return;
    if (this.dragGuides && this.dragGuides.isConnected) return;
    const canvas = this.container.querySelector<HTMLElement>(".wb-widgets");
    if (!canvas) return;
    this.dragGuides = canvas.createDiv({ cls: "wb-drag-guides" });
  }

  private clearDragGuides() {
    if (this.dragGuides) this.dragGuides.empty();
  }

  private onDrag(e: MouseEvent) {
    if (!this.dragState) return;
    const { el, startX, startY, origLeft, origTop } = this.dragState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const parentRect = el.parentElement!.getBoundingClientRect();
    let left = origLeft + dx - parentRect.left;
    let top = origTop + dy - parentRect.top;

    const guides = this.computeAlignGuides(el, left, top);
    if (guides.x !== null) left = guides.x;
    if (guides.y !== null) top = guides.y;

    el.style.left = left + "px";
    el.style.top = top + "px";
    this.renderDragGuides(guides);
  }

  /** 计算对齐参考线：当前卡片边缘/中线 对齐其他卡片（阈值 6px） */
  private computeAlignGuides(
    el: HTMLElement,
    left: number,
    top: number
  ): { x: number | null; y: number | null } {
    if (!this.container) return { x: null, y: null };
    const canvas = this.container.querySelector<HTMLElement>(".wb-widgets");
    if (!canvas) return { x: null, y: null };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const myX = [left, left + w / 2, left + w];
    const myY = [top, top + h / 2, top + h];
    const othersX: number[] = [];
    const othersY: number[] = [];
    canvas.querySelectorAll<HTMLElement>(".wb-panel, .wb-kpi-card, .wb-chart").forEach((c) => {
      if (c === el || c.contains(el)) return;
      const ow = c.offsetWidth;
      const oh = c.offsetHeight;
      const cl = c.offsetLeft;
      const ct = c.offsetTop;
      othersX.push(cl, cl + ow / 2, cl + ow);
      othersY.push(ct, ct + oh / 2, ct + oh);
    });
    if (othersX.length === 0) return { x: null, y: null };

    const TH = 6;
    let bestX: number | null = null;
    let bestXDist = Infinity;
    for (const mx of myX) {
      for (const ox of othersX) {
        const d = Math.abs(mx - ox);
        if (d <= TH && d < bestXDist) {
          bestXDist = d;
          bestX = ox;
        }
      }
    }
    let bestY: number | null = null;
    let bestYDist = Infinity;
    for (const my of myY) {
      for (const oy of othersY) {
        const d = Math.abs(my - oy);
        if (d <= TH && d < bestYDist) {
          bestYDist = d;
          bestY = oy;
        }
      }
    }
    return { x: bestX, y: bestY };
  }

  private renderDragGuides(guides: { x: number | null; y: number | null }) {
    const layer = this.dragGuides;
    if (!layer) return;
    layer.empty();
    if (guides.x !== null) {
      const v = layer.createDiv({ cls: "wb-guide-v" });
      v.style.left = `${guides.x}px`;
    }
    if (guides.y !== null) {
      const h = layer.createDiv({ cls: "wb-guide-h" });
      h.style.top = `${guides.y}px`;
    }
  }

  private applyResize(e: MouseEvent) {
    if (!this.resizeState) return;
    const { el, startX, startY, origW, origH } = this.resizeState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.width = Math.max(180, origW + dx) + "px";
    el.style.height = Math.max(120, origH + dy) + "px";
  }

  private endDrag() {
    if (!this.dragState) return;
    this.dragState.el.classList.remove("dragging");
    this.clearDragGuides();
    this.saveDashboardLayout();
    this.dragState = null;
  }

  private endResize() {
    if (!this.resizeState) return;
    this.resizeState.el.classList.remove("resizing");
    this.saveDashboardLayout();
    this.resizeState = null;
  }

  private saveDashboardLayout() {
    if (!this.container) return;
    const cards = this.container.querySelectorAll<HTMLElement>(
      ".wb-widgets .wb-panel, .wb-widgets .wb-kpi-card, .wb-widgets .wb-chart"
    );
    const layout: Record<string, { x: number; y: number; w: number; h: number; collapsed?: boolean }> = {};
    cards.forEach((el) => {
      const id = el.dataset.id || `card-${Math.random()}`;
      layout[id] = {
        x: el.offsetLeft,
        y: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
        collapsed:
          (el.classList.contains("wb-panel") && el.classList.contains("collapsed")) || undefined,
      };
    });
    this.plugin.settings.dashboardLayout = layout;
    this.plugin.saveSettings();
  }
}

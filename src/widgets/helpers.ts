/**
 * 公共外壳 helper：统一的可拖拽/缩放面板
 * 结构保持 .wb-panel + .wb-hd(.wb-ico/.wb-title/.wb-more) + .wb-bd + .wb-resize-handle，
 * 布局系统（initDashboardLayout）按这些 class 自动接管拖拽/缩放/位置持久化。
 */

export interface PanelOpts {
  id: string;
  title: string;
  icon: string;
  accent: string;
  moreLabel?: string;
  onMore?: () => void;
}

/** 创建面板外壳，返回内容区（.wb-bd），widget 往内容区填充 DOM */
export function createPanel(root: HTMLElement, opts: PanelOpts): HTMLElement {
  const p = root.createDiv({ cls: `wb-panel wb-w ${opts.id}` });
  p.dataset.id = opts.id;
  p.style.setProperty("--w-accent", opts.accent);

  const hd = p.createDiv({ cls: "wb-hd" });
  hd.createDiv({ cls: "wb-ico", text: opts.icon });
  hd.createSpan({ cls: "wb-title", text: opts.title });
  if (opts.moreLabel) {
    const more = hd.createDiv({ cls: "wb-more", text: opts.moreLabel });
    if (opts.onMore) more.addEventListener("click", opts.onMore);
  }

  const bd = p.createDiv({ cls: "wb-bd" });
  const handle = p.createDiv({ cls: "wb-resize-handle" });
  handle.dataset.for = opts.id;
  return bd;
}

/** 空状态 */
export function emptyState(bd: HTMLElement, text: string): HTMLElement {
  return bd.createDiv({ cls: "wb-empty", text });
}

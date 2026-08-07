/**
 * 背景动效模块（E2 拆分自 WorkbenchView.buildEffects）
 *  - 气泡：12 个随机大小/位置/时长的浮动气泡
 *  - 海浪：底部三层 SVG 波浪
 *  - 罗盘：左下角指针缓摆
 *  - 日月：右上角随主题显示
 */

/** 在容器内构建全部背景动效 */
export function buildEffects(container: HTMLElement): void {
  // 气泡
  for (let i = 0; i < 12; i++) {
    const b = container.createDiv({ cls: "wb-bubble" });
    const size = 6 + Math.random() * 14;
    b.style.width = size + "px";
    b.style.height = size + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 9 + Math.random() * 14 + "s";
    b.style.animationDelay = -Math.random() * 20 + "s";
  }
  // 海浪
  const waves = container.createDiv({ cls: "wb-waves" });
  waves.innerHTML = `<svg viewBox="0 0 1440 120" preserveAspectRatio="none" style="width:100%;height:100%">
      <path d="M0,60 C240,20 480,100 720,60 C960,20 1200,100 1440,60 L1440,120 L0,120 Z"/>
      <path d="M0,80 C240,40 480,120 720,80 C960,40 1200,120 1440,80 L1440,120 L0,120 Z"/>
      <path d="M0,100 C240,60 480,140 720,100 C960,60 1200,140 1440,100 L1440,120 L0,120 Z"/>
    </svg>`;
  // 罗盘（左下角，指针缓摆）
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
  // 日月背景（右上角，随主题显示）
  const sky = container.createDiv({ cls: "wb-sky" });
  sky.innerHTML = `
      <svg class="wb-moon" viewBox="0 0 72 72" style="width:100%;height:100%">
        <circle cx="36" cy="36" r="16" fill="#f4e7c5" opacity=".9"/>
        <circle cx="36" cy="36" r="24" fill="#f4e7c5" opacity=".15"/>
      </svg>
      <svg class="wb-sun" viewBox="0 0 72 72" style="width:100%;height:100%">
        <circle cx="36" cy="36" r="14" fill="#fde68a" opacity=".9"/>
        <circle cx="36" cy="36" r="22" fill="#fde68a" opacity=".2"/>
      </svg>`;
}

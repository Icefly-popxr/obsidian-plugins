import type { WidgetCtx, WorkbenchWidget } from "./types";
import { createPanel } from "./helpers";

/** 每日金句：按日期取一条，可换一句（Dashboard 风格） */
const QUOTES: [string, string][] = [
  ["人生没有白走的路，每一步都算数。", "No step in life is wasted; every single one counts."],
  ["种一棵树最好的时间是十年前，其次是现在。", "The best time to plant a tree was ten years ago. The second best time is now."],
  ["千里之行，始于足下。", "A journey of a thousand miles begins with a single step."],
  ["不积跬步，无以至千里。", "A thousand-mile journey begins with the first step."],
  ["学如逆水行舟，不进则退。", "Learning is like rowing upstream; not to advance is to drop back."],
  ["宝剑锋从磨砺出，梅花香自苦寒来。", "Honing gives a sharp edge to a sword; bitter cold adds keen fragrance to plum blossom."],
  ["少壮不努力，老大徒伤悲。", "If one does not exert oneself in youth, one will regret it in old age."],
  ["读书破万卷，下笔如有神。", "Having read ten thousand books, one writes as if guided by a divine hand."],
  ["坚持就是胜利。", "Perseverance is victory."],
  ["日拱一卒，功不唐捐。", "Advancing a pawn daily, no effort is ever wasted."],
];

function dayIndex(): number {
  const now = new Date();
  return Math.floor(
    now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate()
  );
}

const widget: WorkbenchWidget = {
  id: "daily-quote",
  title: "每日金句",
  icon: "💬",
  accent: "#fbbf24",
  category: "notes",
  render(ctx: WidgetCtx, root: HTMLElement) {
    const bd = createPanel(root, {
      id: "daily-quote",
      title: "每日金句",
      icon: "💬",
      accent: "#fbbf24",
    });

    let idx = dayIndex() % QUOTES.length;
    const cn = bd.createDiv({
      cls: "dash-quote-cn",
      attr: { style: "font-size:14px;line-height:1.6;font-weight:500;" },
      text: QUOTES[idx][0],
    });
    const en = bd.createDiv({
      cls: "dash-quote-en",
      attr: { style: "font-size:11px;color:var(--wb-sub);line-height:1.5;margin-top:6px;" },
      text: QUOTES[idx][1],
    });

    const foot = bd.createDiv({
      attr: { style: "display:flex;justify-content:flex-end;gap:8px;margin-top:10px;" },
    });
    const favBtn = foot.createEl("button", {
      cls: "wb-add-btn",
      text: "☆ 收藏",
      attr: { style: "font-size:11px;padding:3px 12px;background:var(--background-modifier-form-field);color:var(--text-normal);" },
    });
    const btn = foot.createEl("button", {
      cls: "wb-add-btn",
      text: "↻ 换一句",
      attr: { style: "font-size:11px;padding:3px 12px;" },
    });

    // 收藏状态
    const favs = ctx.sharedData.quoteFavs || [];
    const isFav = (i: number) => favs.some((f) => f[0] === QUOTES[i][0] && f[1] === QUOTES[i][1]);
    const refreshFav = () => {
      favBtn.setText(isFav(idx) ? "★ 已收藏" : "☆ 收藏");
      favBtn.style.background = isFav(idx)
        ? "rgba(251,191,36,.25)"
        : "var(--background-modifier-form-field)";
      favBtn.style.color = isFav(idx) ? "var(--wb-gold)" : "var(--text-normal)";
    };

    favBtn.addEventListener("click", () => {
      const list = ctx.sharedData.quoteFavs || [];
      const q = QUOTES[idx];
      const pos = list.findIndex((f) => f[0] === q[0] && f[1] === q[1]);
      if (pos >= 0) list.splice(pos, 1);
      else list.push(q);
      ctx.sharedData.quoteFavs = list;
      ctx.saveShared();
      refreshFav();
    });

    btn.addEventListener("click", () => {
      idx = (idx + 1) % QUOTES.length;
      cn.setText(QUOTES[idx][0]);
      en.setText(QUOTES[idx][1]);
      refreshFav();
    });
    refreshFav();

    // 已收藏列表（折叠显示）
    if (favs.length > 0) {
      const favWrap = bd.createDiv({
        attr: { style: "margin-top:10px;border-top:1px dashed var(--wb-border);padding-top:8px;" },
      });
      const favHead = favWrap.createDiv({
        attr: { style: "font-size:11px;color:var(--wb-sub);margin-bottom:6px;" },
        text: `已收藏 ${favs.length} 条`,
      });
      for (const [fcn, fen] of favs.slice(-5)) {
        const row = favWrap.createDiv({
          cls: "dash-kb-row",
          text: fcn,
          attr: { style: "padding:4px 2px;font-size:12px;" },
        });
        row.title = fen;
        row.addEventListener("click", () => {
          cn.setText(fcn);
          en.setText(fen);
          idx = QUOTES.findIndex((q) => q[0] === fcn);
          if (idx < 0) idx = 0;
          refreshFav();
        });
      }
    }
  },
};

export default widget;

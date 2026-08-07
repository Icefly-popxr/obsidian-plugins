/**
 * 真实新闻采集服务（移植自 Web 端 dashboard 的 scripts/ 采集脚本）
 * 插件端直接拉取公开源，无需 Python 后端：
 *  - politics 时政：人民网 RSS + 中新网 RSS + 知乎热榜（关键词过滤）
 *  - finance 财经：36kr RSS（关键词过滤）
 *  - ai AI 资讯：aihot.virxact.com API
 */

export interface NewsItem {
  id: string;
  category: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  /** ISO 时间字符串 */
  createdAt: string;
}

export type NewsCategory = "politics" | "finance" | "ai";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ZHIHU_HOT_API = "https://api.zhihu.com/topstory/hot-lists/total?limit=30&desktop=true";
const PEOPLE_RSS = "http://www.people.com.cn/rss/politics.xml";
const CHINANEWS_RSS = "https://www.chinanews.com/rss/china.xml";
const KR36_RSS = "https://www.36kr.com/feed";
const AIHOT_API = "https://aihot.virxact.com/api/public/items";

/** 时政关键词（知乎 + 36kr 过滤用） */
const POLITICS_KEYWORDS =
  /国务院|政策|政府|中央|国家|主席|总理|人大|政协|外交|国际|外交部|美国|俄罗斯|欧盟|制裁|战争|党|中共|纪委|监察|巡视|改革|法律|立法|司法|法院|检察|上海|北京|深圳|广州|杭州|成都|重庆|天津|南京/i;

/** 排除词（娱乐/体育等无关） */
const EXCLUDE_KEYWORDS = /娱乐|明星|综艺|电视剧|电影/i;

/** 财经关键词（36kr 过滤用） */
const FINANCE_KEYWORDS =
  /财经|金融|股票|股市|A股|港股|美股|基金|理财|融资|IPO|上市|投资|创投|VC|PE|并购|收购|重组|公司|营收|利润|财报|季报|年报|央行|货币政策|利率|汇率|通胀|消费|零售|电商|订单|品牌|美元|人民币|外汇|黄金|油价|期货|债券/i;

function nowIso(): string {
  return new Date().toISOString();
}

/** 最近 7 天内的日期（用于 RSS 过滤） */
function withinDays(dt: Date, days: number): boolean {
  const cutoff = Date.now() - days * 864e5;
  return dt.getTime() >= cutoff;
}

/** 去重（按 url）并限条数 */
function dedupLimit(items: NewsItem[], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.text();
}

/** 解析 RSS XML → NewsItem[]（近 7 天） */
function parseRss(xml: string, sourceName: string, limit: number): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) return [];
  const items: NewsItem[] = [];
  doc.querySelectorAll("item").forEach((item, i) => {
    const title = item.querySelector("title")?.textContent?.trim() || "";
    const link = item.querySelector("link")?.textContent?.trim() || "";
    const desc = item.querySelector("description")?.textContent?.trim() || "";
    if (!title || !link) return;
    // 时间过滤：pubDate 解析失败则保留（宽松），成功则需在 7 天内
    const pub = item.querySelector("pubDate")?.textContent?.trim() || "";
    const pubDt = pub ? new Date(pub) : null;
    if (pubDt && !isNaN(pubDt.getTime()) && !withinDays(pubDt, 7)) return;
    items.push({
      id: `${sourceName}-${i}-${Date.now()}`,
      category: "",
      title,
      url: link,
      source: sourceName,
      summary: desc.replace(/<[^>]+>/g, "").slice(0, 200),
      createdAt: pubDt && !isNaN(pubDt.getTime()) ? pubDt.toISOString() : nowIso(),
    });
  });
  return items.slice(0, limit);
}

/** 拉取人民网时政 RSS */
async function fetchPeople(limit: number): Promise<NewsItem[]> {
  try {
    return parseRss(await fetchText(PEOPLE_RSS), "人民网", limit);
  } catch (e) {
    console.warn("[workbench] 人民网 RSS 拉取失败", e);
    return [];
  }
}

/** 拉取中新网时政 RSS */
async function fetchChinanews(limit: number): Promise<NewsItem[]> {
  try {
    return parseRss(await fetchText(CHINANEWS_RSS), "中新网", limit);
  } catch (e) {
    console.warn("[workbench] 中新网 RSS 拉取失败", e);
    return [];
  }
}

/** 拉取知乎热榜（时政关键词过滤） */
async function fetchZhihu(limit: number): Promise<NewsItem[]> {
  try {
    const raw = await fetchText(ZHIHU_HOT_API);
    const data = JSON.parse(raw);
    const items: NewsItem[] = [];
    (data.data || []).forEach((it: Record<string, unknown>, i: number) => {
      const target = (it.target || {}) as Record<string, unknown>;
      const title = String(target.title || "").trim();
      if (!title) return;
      const qid = String(target.id || "");
      const url = qid && target.type === "question"
        ? `https://www.zhihu.com/question/${qid}`
        : String(target.url || "");
      if (!url) return;
      if (!POLITICS_KEYWORDS.test(title) || EXCLUDE_KEYWORDS.test(title)) return;
      items.push({
        id: `zhihu-${i}-${Date.now()}`,
        category: "",
        title,
        url,
        source: "知乎热榜",
        summary: "",
        createdAt: nowIso(),
      });
    });
    return items.slice(0, limit);
  } catch (e) {
    console.warn("[workbench] 知乎热榜拉取失败", e);
    return [];
  }
}

/** 拉取 36kr RSS（财经关键词过滤） */
async function fetchKr36Finance(limit: number): Promise<NewsItem[]> {
  try {
    const items = parseRss(await fetchText(KR36_RSS), "36kr", 60).filter(
      (it) => FINANCE_KEYWORDS.test(it.title) && !EXCLUDE_KEYWORDS.test(it.title)
    );
    return items.slice(0, limit);
  } catch (e) {
    console.warn("[workbench] 36kr RSS 拉取失败", e);
    return [];
  }
}

/** 拉取 aihot AI 资讯 */
async function fetchAiHot(limit: number): Promise<NewsItem[]> {
  try {
    const since = new Date(Date.now() - 864e5 * 2).toISOString();
    const url = `${AIHOT_API}?mode=selected&take=${Math.min(limit, 100)}&q=AI&since=${encodeURIComponent(since)}`;
    const raw = await fetchText(url);
    const data = JSON.parse(raw);
    const items: NewsItem[] = [];
    (data.items || []).forEach((it: Record<string, unknown>, i: number) => {
      const title = String(it.title || "").trim();
      const url = String(it.url || "");
      if (!title || !url) return;
      items.push({
        id: `aihot-${i}-${Date.now()}`,
        category: "",
        title,
        url,
        source: String(it.source || "AIHOT"),
        summary: String(it.summary || "").slice(0, 200),
        createdAt: String(it.publishedAt || nowIso()),
      });
    });
    return items.slice(0, limit);
  } catch (e) {
    console.warn("[workbench] aihot 拉取失败", e);
    return [];
  }
}

/** 拉取指定分类的新闻（返回带 category 的条目） */
export async function fetchNewsByCategory(cat: NewsCategory, limit = 10): Promise<NewsItem[]> {
  let items: NewsItem[] = [];
  if (cat === "politics") {
    const [people, chinanews, zhihu] = await Promise.all([
      fetchPeople(limit),
      fetchChinanews(limit),
      fetchZhihu(limit),
    ]);
    items = [...people, ...chinanews, ...zhihu];
  } else if (cat === "finance") {
    items = await fetchKr36Finance(limit);
  } else {
    items = await fetchAiHot(limit);
  }
  return dedupLimit(items, limit).map((it) => ({ ...it, category: cat }));
}

/** 拉取全部分类（news 页 "全部" tab 用） */
export async function fetchAllNews(limitPerCat = 10): Promise<NewsItem[]> {
  const [politics, finance, ai] = await Promise.all([
    fetchNewsByCategory("politics", limitPerCat),
    fetchNewsByCategory("finance", limitPerCat),
    fetchNewsByCategory("ai", limitPerCat),
  ]);
  const all = [...politics, ...finance, ...ai];
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 分类标题映射 */
export const NEWS_CAT_TITLES: Record<string, string> = {
  politics: "时政要闻",
  finance: "财经速递",
  ai: "AI 资讯",
};

/**
 * 英语打卡服务：99 词库（33 天 × 每天 3 个）+ 打卡记录统计
 * 与 Web 端 dashboard 的 Checkin 模块同构（english_records 结构一致）。
 */

export interface EnglishRecord {
  /** YYYY-MM-DD */
  date: string;
  /** 当天勾选完成的单词列表 */
  words: string[];
}

/** 英语单词库：99 个单词（33 天 × 每天 3 个），[单词, 音标, 词性, 中文释义, 例句, 例句翻译] */
export const ENGLISH_WORDS: [string, string, string, string, string, string][] = [
  ['ability', '/əˈbɪləti/', 'n.', '能力', 'She has the ability to solve problems.', '她有解决问题的能力。'],
  ['absorb', '/əbˈzɔːrb/', 'v.', '吸收', 'Plants absorb water from the soil.', '植物从土壤中吸收水分。'],
  ['accent', '/ˈæksent/', 'n.', '口音', 'She speaks English with a strong accent.', '她说英语带很重的口音。'],
  ['accept', '/əkˈsept/', 'v.', '接受', 'I accept your invitation.', '我接受你的邀请。'],
  ['access', '/ˈækses/', 'n.', '进入；使用权', 'Students have free access to the library.', '学生可以免费使用图书馆。'],
  ['accident', '/ˈæksɪdənt/', 'n.', '事故', 'He was late because of a traffic accident.', '他因交通事故迟到了。'],
  ['achieve', '/əˈtʃiːv/', 'v.', '实现', 'You can achieve your goal with hard work.', '通过努力你可以实现目标。'],
  ['active', '/ˈæktɪv/', 'adj.', '积极的', 'She is active in class.', '她在课堂上很积极。'],
  ['actually', '/ˈæktʃuəli/', 'adv.', '实际上', "Actually, I don't know him.", '实际上，我不认识他。'],
  ['address', '/əˈdres/', 'n.', '地址', 'Please write your address here.', '请在这里写下你的地址。'],
  ['advance', '/ədˈvæns/', 'v.', '前进；进步', 'Science has advanced greatly.', '科学已经大大进步了。'],
  ['advice', '/ədˈvaɪs/', 'n.', '建议', 'Can you give me some advice?', '你能给我一些建议吗？'],
  ['afford', '/əˈfɔːrd/', 'v.', '负担得起', "We can't afford a new car.", '我们买不起新车。'],
  ['against', '/əˈɡenst/', 'prep.', '反对；靠着', 'He leaned against the wall.', '他靠在墙上。'],
  ['agree', '/əˈɡriː/', 'v.', '同意', 'I agree with your opinion.', '我同意你的观点。'],
  ['allow', '/əˈlaʊ/', 'v.', '允许', 'My parents allow me to stay up late.', '我父母允许我熬夜。'],
  ['almost', '/ˈɔːlmoʊst/', 'adv.', '几乎', "It's almost time for dinner.", '快到晚饭时间了。'],
  ['already', '/ɔːlˈredi/', 'adv.', '已经', 'I have already finished my homework.', '我已经做完作业了。'],
  ['although', '/ɔːlˈðoʊ/', 'conj.', '虽然', 'Although it rained, we went out.', '虽然下雨了，我们还是出去了。'],
  ['amount', '/əˈmaʊnt/', 'n.', '数量', 'A large amount of money was spent.', '花了一大笔钱。'],
  ['ancient', '/ˈeɪnʃənt/', 'adj.', '古代的', 'We visited an ancient temple.', '我们参观了一座古庙。'],
  ['announce', '/əˈnaʊns/', 'v.', '宣布', 'The school announced the exam results.', '学校公布了考试结果。'],
  ['anxious', '/ˈæŋkʃəs/', 'adj.', '焦虑的', 'She was anxious about the test.', '她为考试感到焦虑。'],
  ['apologize', '/əˈpɑːlədʒaɪz/', 'v.', '道歉', 'He apologized for being late.', '他为迟到道了歉。'],
  ['appear', '/əˈpɪr/', 'v.', '出现', 'A rainbow appeared in the sky.', '天空中出现了彩虹。'],
  ['apply', '/əˈplaɪ/', 'v.', '申请；应用', 'I want to apply for the job.', '我想申请这份工作。'],
  ['approach', '/əˈproʊtʃ/', 'n.', '方法', 'We need a new approach to the problem.', '我们需要解决这个问题的新方法。'],
  ['arrange', '/əˈreɪndʒ/', 'v.', '安排', 'She arranged the meeting for Monday.', '她把会议安排在周一。'],
  ['arrive', '/əˈraɪv/', 'v.', '到达', "The train will arrive at 8 o'clock.", '火车将在8点到达。'],
  ['article', '/ˈɑːrtɪkl/', 'n.', '文章', 'I read an interesting article today.', '我今天读了一篇有趣的文章。'],
  ['attract', '/əˈtrækt/', 'v.', '吸引', 'The museum attracts many visitors.', '博物馆吸引了许多游客。'],
  ['available', '/əˈveɪləbl/', 'adj.', '可用的', 'Is the manager available now?', '经理现在有空吗？'],
  ['average', '/ˈævərɪdʒ/', 'adj.', '平均的', 'The average temperature is 20 degrees.', '平均气温是20度。'],
  ['avoid', '/əˈvɔɪd/', 'v.', '避免', 'You should avoid eating too much sugar.', '你应该避免吃太多糖。'],
  ['aware', '/əˈwer/', 'adj.', '意识到的', 'I was not aware of the mistake.', '我没有意识到这个错误。'],
  ['balance', '/ˈbæləns/', 'n.', '平衡', "It's important to keep a balance between work and life.", '保持工作和生活的平衡很重要。'],
  ['basic', '/ˈbeɪsɪk/', 'adj.', '基本的', 'Food and water are basic needs.', '食物和水是基本需求。'],
  ['behave', '/bɪˈheɪv/', 'v.', '表现', 'The children behaved well today.', '孩子们今天表现很好。'],
  ['benefit', '/ˈbenɪfɪt/', 'n.', '好处', 'Regular exercise has many benefits.', '经常锻炼有很多好处。'],
  ['besides', '/bɪˈsaɪdz/', 'prep.', '此外', 'Besides English, she speaks French.', '除了英语，她还会说法语。'],
  ['beyond', '/bɪˈjɑːnd/', 'prep.', '超出', 'The village is beyond the mountain.', '村庄在山的那边。'],
  ['borrow', '/ˈbɑːroʊ/', 'v.', '借', 'Can I borrow your pen?', '我能借你的笔吗？'],
  ['brain', '/breɪn/', 'n.', '大脑', 'The brain controls our body.', '大脑控制我们的身体。'],
  ['branch', '/bræntʃ/', 'n.', '分支', 'The bank has a branch in our town.', '这家银行在我们镇上有分行。'],
  ['brave', '/breɪv/', 'adj.', '勇敢的', 'The brave firefighter saved the child.', '勇敢的消防员救了那个孩子。'],
  ['breath', '/breθ/', 'n.', '呼吸', 'Take a deep breath and relax.', '深呼吸，放松。'],
  ['breathe', '/briːð/', 'v.', '呼吸', 'Breathe in slowly through your nose.', '用鼻子慢慢吸气。'],
  ['bridge', '/brɪdʒ/', 'n.', '桥', 'They built a new bridge over the river.', '他们在河上建了一座新桥。'],
  ['bright', '/braɪt/', 'adj.', '明亮的', 'The room is bright and clean.', '房间明亮又干净。'],
  ['broad', '/brɔːd/', 'adj.', '宽阔的', 'The river is very broad here.', '这里的河面很宽。'],
  ['build', '/bɪld/', 'v.', '建造', 'They plan to build a new school.', '他们计划建一所新学校。'],
  ['business', '/ˈbɪznəs/', 'n.', '商业', 'He runs a small business.', '他经营着一家小企业。'],
  ['calm', '/kɑːm/', 'adj.', '平静的', 'The sea was calm yesterday.', '昨天海面很平静。'],
  ['cancel', '/ˈkænsl/', 'v.', '取消', 'The game was cancelled because of rain.', '比赛因雨取消了。'],
  ['career', '/kəˈrɪr/', 'n.', '职业', 'She has a successful career in teaching.', '她在教学方面有成功的职业生涯。'],
  ['cause', '/kɔːz/', 'n.', '原因', 'What caused the accident?', '是什么导致了事故？'],
  ['celebrate', '/ˈselɪbreɪt/', 'v.', '庆祝', 'We celebrated her birthday together.', '我们一起庆祝了她的生日。'],
  ['certain', '/ˈsɜːrtn/', 'adj.', '确定的', 'I am certain he will come.', '我确定他会来。'],
  ['challenge', '/ˈtʃælɪndʒ/', 'n.', '挑战', 'Learning a new language is a challenge.', '学一门新语言是个挑战。'],
  ['chance', '/tʃæns/', 'n.', '机会', 'This is your chance to shine.', '这是你发光的机会。'],
  ['charge', '/tʃɑːrdʒ/', 'v.', '收费；负责', 'He charged me 10 dollars.', '他收了我10美元。'],
  ['cheap', '/tʃiːp/', 'adj.', '便宜的', 'The food here is cheap and tasty.', '这里的食物便宜又好吃。'],
  ['choose', '/tʃuːz/', 'v.', '选择', 'You can choose any book you like.', '你可以选任何你喜欢的书。'],
  ['climate', '/ˈklaɪmət/', 'n.', '气候', 'The climate here is warm and wet.', '这里的气候温暖潮湿。'],
  ['collect', '/kəˈlekt/', 'v.', '收集', 'He collects stamps as a hobby.', '他收集邮票作为爱好。'],
  ['comfort', '/ˈkʌmfərt/', 'n.', '舒适', 'The hotel offers great comfort.', '这家酒店非常舒适。'],
  ['common', '/ˈkɑːmən/', 'adj.', '常见的', 'This is a common mistake.', '这是一个常见的错误。'],
  ['communicate', '/kəˈmjuːnɪkeɪt/', 'v.', '交流', 'We communicate by email.', '我们通过电子邮件交流。'],
  ['community', '/kəˈmjuːnəti/', 'n.', '社区', 'She is active in her community.', '她在社区里很活跃。'],
  ['company', '/ˈkʌmpəni/', 'n.', '公司', 'My father works for a big company.', '我父亲在一家大公司工作。'],
  ['compare', '/kəmˈper/', 'v.', '比较', 'Compare these two pictures.', '比较这两张图片。'],
  ['compete', '/kəmˈpiːt/', 'v.', '竞争', 'They will compete in the final.', '他们将在决赛中竞争。'],
  ['complete', '/kəmˈpliːt/', 'v.', '完成', 'Please complete the form.', '请填写这张表格。'],
  ['condition', '/kənˈdɪʃn/', 'n.', '条件', 'The car is in good condition.', '这辆车状况良好。'],
  ['confident', '/ˈkɑːnfɪdənt/', 'adj.', '自信的', 'She is confident about the exam.', '她对考试很有信心。'],
  ['connect', '/kəˈnekt/', 'v.', '连接', 'This road connects the two cities.', '这条路连接两座城市。'],
  ['consider', '/kənˈsɪdər/', 'v.', '考虑', 'Please consider my suggestion.', '请考虑我的建议。'],
  ['contain', '/kənˈteɪn/', 'v.', '包含', 'The box contains old photos.', '盒子里装着旧照片。'],
  ['continue', '/kənˈtɪnjuː/', 'v.', '继续', 'The meeting will continue tomorrow.', '会议明天继续。'],
  ['control', '/kənˈtroʊl/', 'v.', '控制', 'You should control your temper.', '你应该控制自己的脾气。'],
  ['conversation', '/ˌkɑːnvərˈseɪʃn/', 'n.', '对话', 'We had a long conversation.', '我们进行了一次长谈。'],
  ['correct', '/kəˈrekt/', 'adj.', '正确的', 'Your answer is correct.', '你的答案是正确的。'],
  ['create', '/kriˈeɪt/', 'v.', '创造', 'Artists create beautiful works.', '艺术家创作美丽的作品。'],
  ['culture', '/ˈkʌltʃər/', 'n.', '文化', 'China has a rich culture.', '中国有丰富的文化。'],
  ['customer', '/ˈkʌstəmər/', 'n.', '顾客', 'The customer is always right.', '顾客永远是对的。'],
  ['decide', '/dɪˈsaɪd/', 'v.', '决定', 'She decided to study abroad.', '她决定出国留学。'],
  ['describe', '/dɪˈskraɪb/', 'v.', '描述', 'Can you describe the man?', '你能描述一下那个人吗？'],
  ['design', '/dɪˈzaɪn/', 'v.', '设计', 'She designed the new logo.', '她设计了新标志。'],
  ['develop', '/dɪˈveləp/', 'v.', '发展', 'The city is developing quickly.', '这座城市发展很快。'],
  ['difference', '/ˈdɪfrəns/', 'n.', '差异', 'There is a big difference between them.', '他们之间有巨大的差异。'],
  ['difficult', '/ˈdɪfɪkəlt/', 'adj.', '困难的', 'The question is difficult to answer.', '这个问题很难回答。'],
  ['direction', '/dəˈrekʃn/', 'n.', '方向', 'Walk in this direction.', '沿着这个方向走。'],
  ['discover', '/dɪˈskʌvər/', 'v.', '发现', 'We discovered a new star.', '我们发现了一颗新星。'],
  ['discuss', '/dɪˈskʌs/', 'v.', '讨论', "Let's discuss the plan.", '让我们讨论一下这个计划。'],
  ['disease', '/dɪˈziːz/', 'n.', '疾病', 'The disease spreads quickly.', '这种疾病传播很快。'],
  ['distance', '/ˈdɪstəns/', 'n.', '距离', 'The distance is about 5 kilometers.', '距离大约5公里。'],
  ['doubt', '/daʊt/', 'n.', '怀疑', 'I have no doubt about it.', '我对此毫不怀疑。'],
  ['dream', '/driːm/', 'n.', '梦想', 'My dream is to travel the world.', '我的梦想是环游世界。'],
  ['educate', '/ˈedʒukeɪt/', 'v.', '教育', 'Parents educate their children.', '父母教育他们的孩子。'],
];

/** 今日日期 YYYY-MM-DD */
function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 今天该学的 3 个单词（按日期取组，同一天稳定） */
export function englishGroupForToday(): (typeof ENGLISH_WORDS)[number][] {
  const n = Math.floor(ENGLISH_WORDS.length / 3); // 33 组
  const dayIdx = Math.floor((Date.now() - new Date("2026-08-06").getTime()) / 864e5);
  const g = ((Math.floor(dayIdx / 3)) % n + n) % n;
  return ENGLISH_WORDS.slice(g * 3, g * 3 + 3);
}

/** 今日打卡记录（不存在返回 null） */
export function findTodayRecord(records: EnglishRecord[]): EnglishRecord | null {
  const t = todayStr();
  return records.find((r) => r.date === t) || null;
}

/** 累计打卡天数 */
export function calcEnglishTotal(records: EnglishRecord[]): number {
  return records.length;
}

/** 当前连续打卡天数 */
export function calcEnglishStreak(records: EnglishRecord[], today: Date = new Date()): number {
  let streak = 0;
  const set = new Set(records.map((r) => r.date));
  const dd = new Date(today);
  while (set.has(todayStr(dd))) {
    streak++;
    dd.setDate(dd.getDate() - 1);
  }
  return streak;
}

/** 已掌握单词（所有记录中勾选单词的去重数） */
export function calcMasteredWords(records: EnglishRecord[]): number {
  const set = new Set<string>();
  records.forEach((r) => {
    if (Array.isArray(r.words)) r.words.forEach((w) => set.add(w));
  });
  return set.size;
}

/** 最近 30 天打卡矩阵：{on, isToday}[]（旧 → 新） */
export function last30Days(
  records: EnglishRecord[],
  today: Date = new Date()
): { on: boolean; isToday: boolean }[] {
  const set = new Set(records.map((r) => r.date));
  const out: { on: boolean; isToday: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({ on: set.has(todayStr(d)), isToday: i === 0 });
  }
  return out;
}

/** 里程碑定义 */
export const ENGLISH_MILESTONES = [
  { n: 7, icon: "🌱" },
  { n: 30, icon: "🔥" },
  { n: 100, icon: "🏆" },
];

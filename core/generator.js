// 余波生成:组 prompt → 调 LLM → 宽容解析 → 入账。SYSTEM 提示词(A/B/B_GROUP/C/F/G)逐字来自任务书 §5,
// 不得改写/精简——这里只做 {{占位符}} 替换,原文一个字不动。M1 拍板:A/B/B_GROUP 原本写死的
// 语言原则行,改成 {{LANG_RULE}} 占位,运行时按全局语言开关(zh/ja_zh)替换,其余一字未动。
import { foldWorld, uncoveredMessages, monogramFor, colorForContact, resolveSender } from './world.js';

export const PROMPT_A = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」的手机。给你的材料:①故事正文的最新进展 ②这部手机的当前状态(联系人、已有聊天)。请推演:这段进展之后,这部手机上自然会出现哪些新动静。

# 原则
1. 余波,不是复述。正文里发生的事不要转述;写它在人际网络里激起的水纹——当事人的只言片语、身边人的反应、以及与事件无关的日常继续流动。
2. 沉默是最高级的余波。已读不回、看到了却装没看到、隔很久才回一个单字,都比人人热情接话真实。允许部分线程这次毫无动静。
3. 视角纪律。每个人只知道自己视角内能知道的事(在场、被告知、公开可见)。不许任何人未卜先知。
4. 消息像真人打字:短句、口语、省略,贴合各人身份与关系亲疏。不写小说腔,不用书面语转述剧情。
5. {{LANG_RULE}}
6. 克制与规模感:本次共 2〜8 条消息,分布在 1〜3 个线程。通讯录是主人生活的横截面,不是无限清单——总量维持在真人手机的活跃规模(约 6〜12 个线程),接近上限时优先让已有线程发生新动静而不是添人。新联系人必须有名有姓有身份:优先从【人物设定参考】与原著既定事实里挖掘(上级、下属、家人、原著配角——关系疏远、冷淡、常年不联系的家人也是家人,催婚的、只发节日祝福的都很真实);故事开始前主人不是空心人。没有名字的路人不配进通讯录。一次最多新建 1 位(首次生成除外,首次可推断 2〜4 位初始化)。
7. 联系人纪律(最重要,违反即全盘失败)。手机里只能出现主人**在剧情中已经认识、且合理交换过联系方式**的人。判断只看剧情事实,不看叙事结构:正文哪怕通篇是两个人的双线叙事,只要剧情里他们尚未相识,对方就绝不能出现在通讯录——素未谋面的人不会躺在彼此的手机里。不要被任何先验带偏(比如默认两位主角是恋人或熟人)。宁缺勿滥:联系人晚一点出现,永远比过早出现真实。
8. 熟稔度纪律。就算是真联系人,消息的语气亲疏也必须匹配剧情当前的关系阶段:刚认识就客气生分,熟人才随意,恋人才亲昵。关系阶段以正文为准,不许自行升温。
9. 群聊也是余波的舞台,而且群聊有谱系:对上的汇报群、对下的指挥群、家族群、朋友群、同好群——主人在不同群里露出不同的人格面(工作群拘谨、朋友群放松、家族群潜水)。建群要有剧情或原著设定依据,别只盯着一种群造;首次初始化最多 1 个,之后按需。主人可以全程潜水;群成员不必都是通讯录好友,但每个成员要有稳定的 id 和身份感。
10. OOC 纪律。主线人物及其身边人的一切言行,必须符合【人物设定参考】与正文已确立的性格;参考里没有的地方保持克制,不得自行发明重大设定。

# 输出
只输出一个 JSON 对象,不加任何说明文字:
{"worldTime":"YYYY-MM-DD HH:MM","threads":[{"threadId":"已有线程id或新id","newContact":{"contactId":"","name":"","relation":"与主角的关系一句话"},"newGroup":{"groupId":"","name":"群名","members":[{"id":"","name":""}]},"messages":[{"sender":"me 或 联系人id/群成员id","text":"","delayMin":0,"read":true}]}]}
- worldTime = 你从正文推断的故事内「现在」。正文没写明具体时刻就结合场景编一个合理的(深夜就是深夜,放学后就是下午),并与手机既有时间线连贯递进,只许向后走不许倒流
- newContact / newGroup 仅在新建该线程时给出,二选一;同一个人在不同线程里用同一个 id
- delayMin = 距上一条消息的分钟数,用它表达时间流动与迟疑:热聊就密(0〜2),冷场、犹豫、已读不回就拉开
- read:sender 为 me 时表示对方是否已读;sender 为他人时表示主角是否已读。用它演出已读不回。`;

export const PROMPT_B_GROUP = `你是 Orrery,叙事世界观测引擎。用户想继续围观主角「{{char}}」手机里的群聊「{{group}}」(成员:{{members}})。基于最近的聊天走向和各人身份,自然地续写 0〜6 条新消息;允许有人潜水、允许冷场(返回空 messages),不必人人发言。
遵守:消息像真人打字;每个人只知道自己视角内的事;不复述正文;{{LANG_RULE}}
只输出 JSON:{"messages":[{"sender":"me 或成员id","text":"","delayMin":0,"read":true}]}`;

export const PROMPT_B = `你是 Orrery,叙事世界观测引擎。用户想继续围观主角「{{char}}」手机里与「{{contact}}」的这段聊天。基于双方关系、最近的故事进展与聊天走向,自然地续写 0〜5 条新消息。
遵守:消息像真人打字;沉默合理时就沉默(返回空 messages);不复述正文;{{LANG_RULE}}
只输出 JSON:{"messages":[{"sender":"me 或 {{contactId}}","text":"","delayMin":0,"read":true}]}`;

export const PROMPT_C = `把下面这段聊天记录压缩成 5 行以内的中立摘要,保留:关系变化、约定与承诺、未解决的话题、双方情绪基调。只输出摘要正文。`;

export const PROMPT_F = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」手机里的匿名论坛——论坛属于故事世界本身,住民全部真实生活在这个世界里,没有人知道自己身处故事。给你的材料:①故事正文的最新进展 ②论坛当前状态(板块、住民、已有帖子)。请推演论坛上自然会出现的新动静。

# 原则
1. 论坛不是新闻台。正文里的事件,以住民视角的碎片形式荡开:目击帖、八卦帖、吐槽帖、求助帖。不许复述正文,不许全知。
2. 比例律:本批新帖约一半与主线人物/事件沾边;另一半是住民自己的生活(吐槽工作、求助、安利、闲聊)——但其中至少一帖的回复区,安排主线人物或其身边人以住民身份自然路过,不点破身份,让读者自己发现。
3. 视角纪律:每个住民只知道公开可见或自己亲历的事。
4. 匿名文化:住民用网名或名無し式的匿名口吻发言,身份感和口癖跨帖一致;故事人物的小号绝不自曝真身,发言风格要「像但不明说」。
5. 说话像论坛,不像小说:短句、跟风、歪楼、抬杠、冷笑话。热帖才热闹,冷帖没人理。
6. 克制:本批 2〜4 个新帖(每帖 0〜5 楼)+ 0〜6 条对已有帖的新回复;允许有的板块毫无动静。
7. 主线人物纪律。主线人物及其身边人在论坛留下的一切痕迹(小号发言、被目击、被讨论),必须符合【人物设定参考】与正文已确立的性格和关系阶段。正文里尚未发生的关系不许提前暗示——两人尚未相识,就不许出现「看到他们走在一起」这类目击或撮合式讨论。禁止 OOC。
8. {{LANG_RULE}}

# 输出
只输出一个 JSON 对象:
{"worldTime":"YYYY-MM-DD HH:MM","newBoards":[{"boardId":"","name":"","desc":"一句话"}],"newResidents":[{"residentId":"","handle":"网名","persona":"身份与口癖一句话","castName":"仅当是故事人物的小号才写其真名,否则省略"}],"newThreads":[{"boardId":"","title":"","authorId":"","body":"","zh":"","replies":[{"authorId":"","body":"","zh":"","delayMin":0,"replyToFloor":0}]}],"newReplies":[{"threadId":"","replies":[{"authorId":"","body":"","zh":"","delayMin":0,"replyToFloor":0}]}]}
- newBoards 仅首次初始化时给出(3〜4 个,名字贴合这个世界,不要通用模板味);之后为空数组
- 首次初始化同时创建 5〜8 名住民;之后每批最多新建 2 名。authorId 必须是已有或本批新建的 residentId
- replyToFloor 仅在明确回应某楼时给出;delayMin=距上一楼的分钟数
- worldTime 从正文推断,只许向后走`;

export const PROMPT_G = `你是 Orrery,叙事世界观测引擎。用户想继续围观这个帖子的后续。基于帖子走向和各住民的身份口癖,自然地续写 0〜6 楼新回复;热帖才热闹,冷场合理就冷场(返回空 replies)。
遵守:像论坛不像小说;住民口癖跨帖一致;每人只知道自己知道的;故事人物的小号绝不自曝、言行不得OOC(以【人物设定参考】为准);不复述正文。
{{LANG_RULE}}
只输出 JSON:{"replies":[{"authorId":"已有住民id或新id","newResident":{"residentId":"","handle":"","persona":"","castName":"可省略"},"body":"","zh":"","delayMin":0,"replyToFloor":0}]}`;

// ── 全局语言开关:{{LANG_RULE}} 运行时按档替换(任务书 §2,四段文案逐字照抄,不改写)。──
const LANG_RULE = {
    messenger: {
        zh: '消息语言跟随正文语言,不要输出 zh 字段。',
        ja_zh: '消息用日文书写(贴合角色所在世界的语言),每条同时给出中文翻译字段 zh。',
    },
    forum: {
        zh: '所有内容用中文书写,不要输出 zh 字段。',
        ja_zh: '标题与正文用日文书写(这个论坛属于故事世界),每条同时给出中文翻译字段 zh。',
    },
};
function langRule(scope, language) {
    return LANG_RULE[scope][language === 'ja_zh' ? 'ja_zh' : 'zh'];
}

// ── 输出预算 ──
// max_tokens 是上限不是消耗,给多少不等于烧多少,只按实际生成计费。此前各路按经验值分档
// (2400/1500/800/4000/1800),但思考型模型的 reasoning tokens 也吃这个额度,真机上仍被
// finish_reason=length 掐断。统一顶到 Gemini 的输出上限,把「截断」这个失败模式整类消掉;
// 长度仍由 prompt 里的条数规模约束(每次 2〜8 条之类),不靠预算卡。
const RESPONSE_BUDGET = 65500;

// zh 净化:LLM 见字段就填,中文档会把原文抄一遍进 zh(她真机踩中「翻译段重复」)。
// 只有双语档、且译文确实不同于原文时才入账。
function cleanZh(zh, body, language) {
    if (language !== 'ja_zh') return undefined;
    const z = String(zh || '').trim();
    if (!z || z === String(body || '').trim()) return undefined;
    return z;
}

// ── 宽容解析:剥 ```json 围栏、剥前后杂文,失败返回 null 交调用方决定重试。──

export function parseLenientJson(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    const tryParse = (t) => {
        try { const v = JSON.parse(t); return (v && typeof v === 'object') ? v : null; } catch { return null; }
    };
    // 围栏从后往前试。此前是「抢第一个围栏、把 s 覆写成它」,于是模型先摆一段示例/思考再给正文时
    // (思考型模型很常见),真正的 JSON 落在覆写范围之外,连后面的大括号兜底都够不着,必然 parse_failed。
    // 答案通常在最后,所以倒着试;每个围栏各自试各自的,谁也不覆写原文。
    const fences = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    for (let i = fences.length - 1; i >= 0; i--) {
        const hit = tryParse(fences[i][1].trim());
        if (hit) return hit;
    }
    const whole = tryParse(s);
    if (whole) return whole;
    // 最后兜底:回到**原文**取最外层大括号,绝不在被围栏截窄过的子串上找。
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) return tryParse(s.slice(start, end + 1));
    return null;
}

// 楼层引用只认「已经存在的、更早的楼」。模型数楼层会数错——真机 19 条回复里 3 条把 replyToFloor
// 指向自己或后面还没出现的楼(渲染出来就是 8F 挂着「>>8」、13F 挂着「>>14」这种指向虚空的引用)。
// floorNo = 本条自己的楼层号(1F 起)。对不上就当模型没给,整个字段丢掉,不影响正文。
function validReplyToFloor(rf, floorNo) {
    return Number.isFinite(rf) && rf >= 1 && rf < floorNo ? rf : undefined;
}

function stripHtml(text) {
    return String(text || '').replace(/<[^>]+>/g, '').trim();
}

// ── 正文提纯:镜像酒馆自己的做法,本扩展不认识任何预设的标签名 ──
// 她的诘问(真机实测:草稿混进正文):写死 <content>/<draft> 就成了某预设专用,换预设即废。
// 酒馆的答案是——它也不认识标签。送聊天记录进 LLM 前只做两件事(核实于 script.js:4337 coreChat 映射):
//   ① getRegexedString(mes, USER_INPUT|AI_OUTPUT, {isPrompt:true, depth}) —— 跑正则脚本的 isPrompt 档,
//      也就是预设自己声明的「进提示词时该删什么」(她的规矩:净化类双开、美化类单开 markdownOnly)
//   ② 思维链不走正文,而是按 Reasoning 设置里声明的 prefix/suffix 摘出去(add_to_prompts=false 时不回灌)
// 两者都是预设/用户声明的配置,不是硬编码。orrery 照抄这套:预设换了,提纯规则自动跟着换。
// 残留由用户在设置里兜(见 settings.excludeTags),默认空——扩展永远不猜标签。

let regexEngine; // undefined=未加载 / null=不可用 / 对象=可用

// 降级必须可见:引擎是酒馆的非公开模块,路径不保证跨版本稳定。一旦引入失败,提纯静默退回
// 「只去标签壳」——草稿/思维链会重新混进正文,而生成表面照常成功,是最难自查的一类回归。
// 故用 live binding 把降级状态透出去,由 shell 弹一次提示(她才知道该去填「额外剔除标签」兜底)。
export let textPurificationDegraded = false;

export async function ensureRegexEngine() {
    if (regexEngine !== undefined) return regexEngine;
    try {
        // 与 world-info.js 同一条 import 路径,跟着酒馆版本走
        const eng = await import('../../../regex/engine.js');
        regexEngine = (typeof eng.getRegexedString === 'function' && eng.regex_placement)
            ? { get: eng.getRegexedString, place: eng.regex_placement } : null;
    } catch (err) {
        console.warn('[Orrery] 正则引擎引入失败', err);
        regexEngine = null;
    }
    if (!regexEngine) {
        textPurificationDegraded = true;
        console.warn('[Orrery] 正文提纯已降级:预设正则未生效,草稿/思维链可能混入正文。请在设置里用「额外剔除的标签」兜底。');
    }
    return regexEngine;
}

// 思维链:只认 Reasoning 设置里的 prefix/suffix,不认标签名。
// 宽容一格:前缀常被预设写进 assistant prefill(她的用法),不出现在消息体里——
// 这时只要后缀在前半段出现,就把它之前的整段当思维链切掉。
function stripReasoning(ctx, text) {
    const r = ctx.powerUserSettings?.reasoning;
    if (!r?.auto_parse) return text;
    const pre = String(r.prefix || '').trim();
    const suf = String(r.suffix || '').trim();
    if (!suf) return text;
    const end = text.indexOf(suf);
    if (end === -1) return text;
    const start = pre ? text.indexOf(pre) : -1;
    if (start !== -1 && start < end) return text.slice(0, start) + text.slice(end + suf.length);
    if (end < text.length / 2) return text.slice(end + suf.length);
    return text;
}

// 用户兜底:她可在设置里列出自家预设的元信息标签(逗号分隔),整块连内容一起删。
// 默认空 = 完全跟随酒馆。填了也只影响她自己这套,不写进代码。
function dropExcludedTags(text, excludeTags) {
    const tags = String(excludeTags || '').split(/[,，\s]+/).map(t => t.trim().replace(/^<|>$/g, '')).filter(t => /^[A-Za-z_][\w-]*$/.test(t));
    let s = text;
    for (const t of tags) {
        s = s.replace(new RegExp(`<${t}(?:\\s[^>]*)?>[\\s\\S]*?</${t}>`, 'gi'), '');
    }
    return s;
}

/** 一条消息 → 干净正文。depth 同酒馆语义:距末尾的层数(末层=0)。 */
export function cleanMessageText(ctx, msg, depth, excludeTags) {
    let s = String(msg?.mes || '');
    if (regexEngine) {
        s = regexEngine.get(s, msg?.is_user ? regexEngine.place.USER_INPUT : regexEngine.place.AI_OUTPUT,
            { isPrompt: true, depth });
    }
    s = stripReasoning(ctx, s);
    s = dropExcludedTags(s, excludeTags);
    return stripHtml(s);
}

// ── 世界时刻:LLM 从正文推断的叙事内时间(她拍板:时间戳按正文推算,不锚现实时钟)。──

function parseWorldTime(s) {
    if (!s || typeof s !== 'string') return null;
    const t = Date.parse(s.trim().replace(' ', 'T'));
    return Number.isFinite(t) ? t : null;
}

function fmtWorldTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// delayMin 上限:世界时钟只许向前走,且 world.worldNow 取全局最大值——模型某条多打两个零
// (60 → 6000)就能把整个世界的时间地板推到几个月后,之后每批生成都从那里起跳,不可自愈,
// 只能手动反悔删掉那批才修得回来。一周足够表达「很久以后」,超出的一律按一周算。
const MAX_DELAY_MIN = 60 * 24 * 7;

/** 从锚点起按 delayMin 依次排开一批消息的世界时刻。起点不早于线程尾,保证单调。 */
function layoutWorldTimes(messages, anchor, threadTailTs) {
    let clock = Math.max(anchor, threadTailTs || 0);
    return messages.map(m => {
        const d = Number.isFinite(m.delayMin) ? Math.min(Math.max(0, m.delayMin), MAX_DELAY_MIN) : 0;
        clock += d * 60000;
        return clock;
    });
}

// ── LLM 调用优先级:独立 API > 指定 Connection Profile > 酒馆当前连接的裸调用。──

// 端点拼装按 OpenAI 兼容端点的通行写法:已带 /chat/completions 就照用,只到 /v1 就补全,都没有则补 /v1/chat/completions
function buildChatEndpoint(baseUrl) {
    let u = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!u) return null;
    if (u.endsWith('/chat/completions')) return u;
    if (/\/v\d+$/.test(u)) return u + '/chat/completions';
    return u + '/v1/chat/completions';
}

// 有的中转无视 stream:false 强行回 SSE(她真机踩中:ST 服务端 .json() 解析「data: {…」直接炸)。
// 独立 API 通道自带装甲:显式非流式 + 响应嗅探,收到 SSE 也逐行拼装出全文。
function parseSseText(text) {
    let out = '';
    for (const line of text.split('\n')) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') break;
        try {
            const j = JSON.parse(payload);
            out += j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? '';
        } catch { /* 跳过坏行 */ }
    }
    return out;
}

async function callCustomApi(customApi, systemPrompt, userContent, responseLength) {
    const res = await fetch(buildChatEndpoint(customApi.baseUrl), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(customApi.apiKey ? { Authorization: `Bearer ${customApi.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: customApi.model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
            max_tokens: responseLength || RESPONSE_BUDGET,
            stream: false,
        }),
    });
    if (!res.ok) throw new Error(`独立 API HTTP ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith('data:')) return parseSseText(text);
    try {
        const data = JSON.parse(text);
        return data?.choices?.[0]?.message?.content ?? '';
    } catch {
        throw new Error('独立 API 返回了无法解析的响应');
    }
}

// ── 裸调用防污染卫兵 ──
// generateRaw 并不裸:发送前会广播 CHAT_COMPLETION_PROMPT_READY(dryRun:false,核实于
// script.js:3891),记忆表格等插件监听该事件向一切 CC 请求注入自家指令(她真机实锤:表格
// insertRow 教学挤进 orrery 的 prompt,Gemini 3.1 把预算烧在表格上,输出 <tableEdit> 而非
// JSON)。Profile/独立 API 通道不过这个事件、天然干净;裸通道靠这里自卫——发前 makeLast
// 挂监听(保证排在注入插件之后),按首 80 字前缀认领本次请求的 system/user 两条消息,
// 把别家塞进来的剔掉。认不满两条就不动(fail-open:宁可脏,绝不误伤别人的生成)。
let rawGuard = null;
function onPromptReady(eventData) {
    if (!rawGuard || eventData?.dryRun || !Array.isArray(eventData?.chat)) return;
    const ours = eventData.chat.filter(m => typeof m?.content === 'string'
        && (m.content.startsWith(rawGuard.sysHead) || m.content.startsWith(rawGuard.userHead)));
    if (ours.length >= 2 && ours.length < eventData.chat.length) {
        console.warn('[Orrery] 裸调用被注入了', eventData.chat.length - ours.length, '条外来消息,已剔除');
        eventData.chat.splice(0, eventData.chat.length, ...ours);
    }
}

export async function callLLM(ctx, systemPrompt, userContent, { profileId, customApi, responseLength } = {}) {
    if (customApi?.enabled && customApi.baseUrl && customApi.model) {
        return await callCustomApi(customApi, systemPrompt, userContent, responseLength);
    }
    if (profileId && ctx.ConnectionManagerRequestService) {
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }];
        const constructed = ctx.ConnectionManagerRequestService.constructPrompt(messages, profileId);
        const result = await ctx.ConnectionManagerRequestService.sendRequest(profileId, constructed, responseLength || RESPONSE_BUDGET);
        return result?.content ?? '';
    }
    const ev = ctx.eventTypes?.CHAT_COMPLETION_PROMPT_READY ?? ctx.event_types?.CHAT_COMPLETION_PROMPT_READY;
    if (ctx.eventSource && ev) {
        ctx.eventSource.makeLast(ev, onPromptReady); // 幂等:每次重挂保持最后
        rawGuard = { sysHead: systemPrompt.trim().slice(0, 80), userHead: userContent.trim().slice(0, 80) };
    }
    try {
        return await ctx.generateRaw({ prompt: userContent, systemPrompt, responseLength: responseLength || RESPONSE_BUDGET });
    } finally {
        rawGuard = null;
    }
}

async function generateJsonWithRetry(ctx, systemPrompt, userContent, settings) {
    for (let i = 0; i < 2; i++) {
        let raw = '';
        try {
            raw = await callLLM(ctx, systemPrompt, userContent, settings);
        } catch (err) {
            console.error('[Orrery] LLM 调用失败', err);
            continue;
        }
        const parsed = parseLenientJson(raw);
        if (parsed) return parsed;
    }
    return null;
}

// ── 上下文材料拼装 ──

function subParams(ctx, s) {
    try { return typeof ctx.substituteParams === 'function' ? ctx.substituteParams(s) : s; } catch { return s; }
}

// lite 激活:替代不了 ST 完整激活语义(递归/概率/组),但对「设定型绑定书」足够——constant 条目
// 全取,关键词条目按最近楼层文本命中,禁用条目绝不取;内容过宏替换。排序同 ST sortFn(order 大者先)。
async function liteBookEntries(ctx, bookName, scanTexts) {
    if (!bookName || typeof ctx.loadWorldInfo !== 'function') return [];
    try {
        const data = await ctx.loadWorldInfo(bookName);
        if (!data?.entries) return [];
        const scan = scanTexts.filter(Boolean).join('\n').toLowerCase();
        return Object.values(data.entries)
            .filter(e => e && !e.disable && String(e.content || '').trim())
            .filter(e => e.constant || (Array.isArray(e.key) && e.key.some(k => {
                const kk = subParams(ctx, String(k)).trim().toLowerCase();
                return kk && scan.includes(kk);
            })))
            // constant(常驻=通常是身份设定)优先进预算,再按 ST sortFn 的 order 降序
            .sort((a, b) => (b.constant === true) - (a.constant === true) || (b.order ?? 0) - (a.order ?? 0))
            .map(e => subParams(ctx, String(e.content).trim()));
    } catch (err) {
        console.warn('[Orrery] 世界书直读失败,跳过', bookName, err);
        return [];
    }
}

// getWorldInfoPrompt 的第二参是「本次可用上下文」,世界书按它的百分比算预算(world_info_budget)。
// 此前写死 4096,激活串在进门时就被砍成一小截——主流卡把设定全放在绑定世界书里,砍掉的正是人物设定本身。
// ⚠️不能图省事拿 ctx.maxContext:那是 kobold/textgen/novel 那一侧的 max_context,聊天补全用户根本没在用它
// (真机上它是 8192,而这台机器实际的 openai_max_context 是 2000000——照 8192 算等于没修)。
// 照抄酒馆自己的 getMaxContextSize(script.js:5763):openai 档走 openai_max_context - openai_max_tokens,
// 其余档走 max_context。任一环节取不到就给个足够大的数,让预算不再是瓶颈(她拍板:提示词长没关系)。
function maxContextSize(ctx) {
    if (ctx.mainApi === 'openai') {
        const cc = ctx.chatCompletionSettings || {};
        const size = Number(cc.openai_max_context) - Number(cc.openai_max_tokens || 0);
        if (Number.isFinite(size) && size > 0) return size;
    }
    return Number(ctx.maxContext) > 0 ? Number(ctx.maxContext) : 200000;
}

// 人物设定参考:三节有来源标签的材料,主人节永远在前。
// v0.6.7 真机翻车根因(她后台抓包实锤):getWorldInfoPrompt 的激活串不分来源,persona 书条目与
// char 书条目混成一串再被截断——主流卡写法(卡面留空、设定全在绑定世界书)下 char 设定被挤出参考,
// 「权威人物设定」里只剩 user 的过去条目,手机主人身份直接被 user 顶掉。
// 现在:char 绑定书与 persona 绑定书分别经 ctx.loadWorldInfo 直读并各归各节;getWorldInfoPrompt
// (核实于 world-info.js:894,isDryRun=true 纯读无副作用)降级为背景节,兜底覆盖全局书/聊天书,
// 与前两节可能重复、无害。任一环节失败静默降级,不阻塞生成。
export async function buildCastReference(ctx, floorTexts, ownerName) {
    const ch = ctx.characters?.[ctx.characterId];
    const charBook = ch?.data?.extensions?.world;

    // 她的点子:orrery 的整个提示词都是「XX 的手机」,主人的名字必然在自己身份条目的关键词里——
    // 把名字并进扫描文本,身份条目就不再依赖最近几层正文碰巧提到它(纯关键词卡也能稳定激活)。
    // 各归各扫:char 书配主人名,persona 书配 user 名,免得两边互相激活对方的条目。
    const charNames = [ch?.name, ctx.name2, ownerName].filter(Boolean);
    const userNames = [ctx.name1].filter(Boolean);

    const ownerParts = [];
    if (ch) {
        const desc = [ch.description, ch.personality, ch.scenario].filter(Boolean).join('\n').trim();
        if (desc) ownerParts.push(desc);
    }
    ownerParts.push(...await liteBookEntries(ctx, charBook, [...floorTexts, ...charNames]));

    const userParts = [];
    const personaDesc = String(ctx.powerUserSettings?.persona_description || '').trim();
    if (personaDesc) userParts.push(subParams(ctx, personaDesc));
    const personaBook = ctx.powerUserSettings?.persona_description_lorebook;
    if (personaBook && personaBook !== charBook) {
        userParts.push(...await liteBookEntries(ctx, personaBook, [...floorTexts, ...userNames]));
    }

    let wiBlob = '';
    try {
        if (typeof ctx.getWorldInfoPrompt === 'function') {
            const wi = await ctx.getWorldInfoPrompt(floorTexts, maxContextSize(ctx), true);
            wiBlob = (wi?.worldInfoString || '').trim();
        }
    } catch (err) {
        console.warn('[Orrery] 世界书激活串读取失败,跳过背景节', err);
    }

    const cardName = (ch?.name || '').trim();
    const ownerLabel = (ownerName || '').trim() || cardName || ctx.name2 || '主角';
    const userName = (ctx.name1 || '').trim();

    // ⚠️2026-08-13 拆掉了这三节原有的字符截断(2400/700/1400)。她真机实测拍板:酒馆每轮本来就发这么多,
    // 输入长对成本与延迟影响都不大(还吃缓存),而截断砍掉的恰恰是「关系走到哪一步」这类最防 OOC 的材料。
    const sections = [];
    if (ownerParts.length) {
        // 认主名与卡面名一致(常态)直接标「手机主人」;认主给了别名时材料仍按卡面人物标注
        const header = (!cardName || cardName === ownerLabel)
            ? `◆ 手机主人「${ownerLabel}」的设定:`
            : `◆ 主线人物「${cardName}」的设定(这部手机的主人是「${ownerLabel}」):`;
        sections.push(`${header}\n${ownerParts.join('\n')}`);
    }
    if (userParts.length && userName && userName !== ownerLabel) {
        sections.push(`◆ 「${userName}」是叙事另一方(user)——TA **不是**手机主人。以下材料仅供辨认 TA 的身份,绝不能把 TA 的设定、经历、人际安到主人或任何住民头上:\n${userParts.join('\n')}`);
    }
    if (wiBlob) {
        sections.push(`◆ 世界观背景(激活的世界书条目,可能与上文重复;人物身份归属以上文两节为准):\n${wiBlob}`);
    }
    return sections.length ? `【人物设定参考(权威;主线人物言行以此为准,不得OOC)】\n${sections.join('\n\n')}\n\n` : '';
}

// ── 既往摘要与注记:酒馆每轮都会带、而 orrery 此前一条都没读的那一大块材料。──
// 除了正文,酒馆组 prompt 时还会把各扩展的注入材料一起发出去(摘要扩展 1_memory、作者注释
// 2_floating_prompt、向量记忆 3_vectors…统一走 extension_prompts,核实于 script.js:3190
// getExtensionPrompt)。关系史往往就活在这里,而 orrery 一条都没取。
// 做法照旧 = 镜像酒馆、不认具体扩展名:整表取回,谁往里塞过东西就带上谁,新装的扩展自动生效。
const EXT_PROMPT_LABELS = {
    '1_memory': '聊天摘要',
    '2_floating_prompt': '作者注释',
    '3_vectors': '向量记忆',
    'chromadb': '智能上下文',
};

export async function buildInjectedNotes(ctx) {
    const table = ctx.extensionPrompts;
    if (!table || typeof table !== 'object') return { text: '', keys: [] };
    const keys = [];
    const parts = [];
    for (const key of Object.keys(table).sort()) { // 同 ST(script.js:3199)按 key 排序:顺序稳定才吃得到缓存
        const entry = table[key];
        // orrery 自己若将来往里塞东西,不许喂回给自己
        if (!entry || String(key).startsWith('orrery')) continue;
        const raw = String(entry.value || '').trim();
        if (!raw) continue;
        // 扩展可以挂 filter 决定本轮到底注不注入(向量记忆之类按需生效),照它自己的意思办;
        // filter 抛错就当放行——宁可多带一段材料,不可因为别家的异常把摘要整块弄丢。
        if (typeof entry.filter === 'function') {
            try { if (!(await entry.filter())) continue; } catch { /* 放行 */ }
        }
        keys.push(key);
        parts.push(`◆ ${EXT_PROMPT_LABELS[key] || key}:\n${subParams(ctx, raw)}`);
    }
    if (!parts.length) return { text: '', keys: [] };
    const text = `【既往摘要与注记(酒馆本轮同样会带上的材料)】\n这是主人走到「现在」之前的经过。人物关系走到了哪一步、有过什么约定与转折,一律以本节与正文既往楼层为准,不许只凭最新几层反推关系。\n${parts.join('\n\n')}\n\n`;
    return { text, keys };
}

// 上下文自报:她真机验收时得能一眼看出「摘要到底进来了没有」。
// 这个项目在静默失败上栽过太多次(线程整批丢弃、提纯降级、预算被吃),凡是「看起来成功了但材料不对」
// 的失败模式,都要在控制台留下可对账的一行。
function logContextShape(tag, userContent, noteKeys) {
    const floors = (userContent.match(/^\[第\d+层\]/gm) || []).length;
    console.info(`[Orrery] ${tag} 上下文 — 正文 ${floors} 层 / 注记 [${noteKeys.join(', ') || '无'}] / 合计 ${userContent.length} 字符`);
}

// user 侧硬防线:提示词纪律 Gemini 屡教不改(她真机三抓),消化层直接拒收名字匹配叙事另一方的
// 联系人/群成员/住民小号。剧情真到相识时,设置里「允许叙事另一方登场」手动解禁——导演权在她。
function isUserSide(name, ctx) {
    const u = (ctx.name1 || '').trim();
    if (!u || !name) return false;
    const n = String(name).trim();
    return n === u || n.includes(u) || u.includes(n);
}

// ── 楼层序列:与酒馆同源的 depth。──
// 酒馆算 depth 用的是 coreChat(script.js:4332:先滤掉 is_system 楼层),而 orrery 此前直接拿
// `tip - i` 在原始 chat 上算。聊天里只要有一条系统消息(欢迎语、/sys 提示),后面每一层的 depth
// 就整体错位——过去只喂尾部 8 层时无所谓(全在浅档),现在 depth 决定了每层旧楼层被预设正则
// 压成摘要还是留全文,错一格就能让整段历史退回全文,或反过来被压空。照抄酒馆的算法。
function* coreFloors(ctx) {
    const chat = ctx.chat || [];
    const core = [];
    for (let i = 0; i < chat.length; i++) {
        if (chat[i] && !chat[i].is_system) core.push(i);
    }
    for (let k = 0; k < core.length; k++) {
        yield { index: core[k], depth: core.length - k - 1, msg: chat[core[k]] };
    }
}

function recentFloorTexts(ctx, excludeTags, count = 6) {
    // 与 ST 自身调用习惯一致(script.js:4455):带发言人名(可命中世界书人名关键词)、新→旧倒序
    const out = [];
    for (const { depth, msg } of coreFloors(ctx)) {
        if (depth >= count) continue;
        const t = `${msg?.name ? msg.name + ': ' : ''}${cleanMessageText(ctx, msg, depth, excludeTags)}`;
        if (t.trim()) out.push(t);
    }
    return out.reverse();
}

// ── 正文上下文:默认整本聊天(floorWindow=0)。2026-08-13 拍板的改法。──
// 病象:长聊天里关系早已走过很多阶段,生成出来的余波却总把关系写回原点(OOC)。
// 病根:此前只取尾部一小窗(pending + 前 floorWindow 层,实测约 8 层),模型看不到关系史,
// 只能凭当前几层正文反推「他们是什么关系」,反推错是必然而不是偶然。
// ⭐关键机制:酒馆每轮**本来就发整本聊天**,长度靠预设自己的正则按 depth 收敛——这是社区
// 长篇预设的通行工法(实际抽查过两套互不相干的预设,都是同一形状:一条 minDepth≈5 的脚本把旧楼层
// 压成只剩摘要块,一条 maxDepth≈4 的脚本让最近几层保留全文,另一条 minDepth≈1 把旧的 user 楼层整条清空)。
// 所以「最近几层正文 + 更早只剩摘要」不是酒馆截出来的,是预设正则做出来的。
// orrery 的 cleanMessageText 一直在传真实 depth,只要把范围放开到整本,同一套正则就会自动完成收敛
// ——不需要 orrery 自己发明任何截断,也不需要认识任何预设的标签名,换预设自动跟着换。
// 反过来说,过去只喂尾部 8 层,等于这 8 层全部落在「最近几层」这一档,摘要恰好全被删掉:
// orrery 从来没有见过一条摘要。
// floorWindow > 0 时保留旧的窗口行为(等价于旧版的 pending fw 层 + 前 fw 层 = 2fw 层),
// 留给没有这类摘要正则、又不想每轮发整本的用户。
// 正文小节的抬头。SYSTEM 提示词写的是「①故事正文的最新进展」,而现在喂进去的是整本聊天——
// 不点破结构的话,模型会把几百层历史整个当成刚发生的事,给早就过去的情节现造一轮余波。
// SYSTEM 那几段有「逐字不改」的铁律,所以把结构说明放在 user 内容侧的抬头里,效果一样、不动原文。
const FLOOR_HEADERS = {
    // 有分界线:线之前是历史背景,线之后才是这次要生成余波的新进展
    divided: '【故事正文(从开头到现在的完整经过。越早的楼层越简略——那是既往摘要,只作为背景;分界线之后才是这次要生成余波的新进展。分界线之前的事早已过去,不要为它们新造动静)】',
    // 首次生成:还没有水位,整段都算新的
    allNew: '【故事正文(从开头到现在的完整经过。越早的楼层越简略——那是既往摘要。这是第一次生成,请从整段经过里长出这部手机此刻该有的样子)】',
    // 二刷:没有新进展,在同一段进展上再看一圈
    regrow: '【故事正文(从开头到现在的完整经过。越早的楼层越简略——那是既往摘要。自上次生成以来正文没有新进展,这次是在同一段进展上再看一圈涟漪)】',
    // 续聊/盖楼:正文全程只作背景,余波由这条线程/这个帖子自己往下长
    background: '【故事正文(从开头到现在的完整经过,仅作背景:交代主人是谁、关系走到了哪一步。不要复述,也不要为正文里的事新造动静)】',
};

/** 正文小节(含抬头)。空聊天返回空串。 */
function buildFloorSection(ctx, { newFrom, floorWindow, excludeTags, background = false }) {
    const { text, divided } = buildFloorContextText(ctx, { newFrom, floorWindow, excludeTags });
    if (!text) return '';
    const key = background ? 'background'
        : !Number.isFinite(newFrom) ? 'regrow'
            : divided ? 'divided' : 'allNew';
    return `${FLOOR_HEADERS[key]}\n${text}\n\n`;
}

function buildFloorContextText(ctx, { newFrom, floorWindow, excludeTags }) {
    const lines = [];
    let marked = false, divided = false;
    for (const { index, depth, msg } of coreFloors(ctx)) {
        if (floorWindow > 0 && depth > 2 * floorWindow - 1) continue;
        const speaker = msg.name || (msg.is_user ? ctx.name1 : ctx.name2);
        const text = cleanMessageText(ctx, msg, depth, excludeTags);
        if (!text) continue; // 被预设正则整层压空的旧楼层(没有摘要可留)——照酒馆的意思,它本来就不该发
        if (!marked && Number.isFinite(newFrom) && index >= newFrom) {
            marked = true;
            if (lines.length) { lines.push('—— 以上是既往经过,以下是上次生成之后的新进展 ——'); divided = true; }
        }
        lines.push(`[第${index}层] ${speaker}: ${text}`);
    }
    // divided:分界线真的画出来了(首次生成时新进展就是第一层,画不出线,抬头要换一种说法)
    return { text: lines.join('\n'), divided };
}

function senderNameFn(world, thread) {
    return (senderId) => senderId === 'me' ? '我' : (resolveSender(world, thread, senderId)?.name || senderId);
}

function buildWorldDigestText(world) {
    if (!world.contacts.size && !world.groups.size) return '(手机是空的,这是第一次生成)';
    const parts = [];
    if (world.worldNow) parts.push(`[手机当前世界时刻] ${fmtWorldTime(world.worldNow)}(新的 worldTime 不得早于它)`);
    parts.push('[联系人名册]');
    for (const c of world.contacts.values()) {
        parts.push(`- id=${c.contactId} name=${c.name} relation=${c.relation || ''}`);
    }
    for (const g of world.groups.values()) {
        parts.push(`- 群聊 id=${g.groupId} name=${g.name} 成员=${(g.members || []).map(m => `${m.name}(${m.id})`).join('/')}`);
    }
    for (const t of world.threads.values()) {
        const label = t.kind === 'group'
            ? (t.group ? `群聊 ${t.group.name}` : null)
            : (world.contacts.get(t.contactId)?.name || null);
        if (!label) continue;
        parts.push(`\n[线程 ${label}(id=${t.threadId})]`);
        if (t.summaries.length) parts.push(`既往摘要: ${t.summaries.map(s => s.text).join(' / ')}`);
        const nameOf = senderNameFn(world, t);
        for (const m of t.messages.slice(-6)) {
            parts.push(`${nameOf(m.sender)}: ${m.text}${m.read === false ? '(未读)' : ''}`);
        }
    }
    return parts.join('\n');
}

function buildThreadDigestText(thread, nameOf) {
    const parts = [];
    if (thread.summaries.length) parts.push(`既往摘要: ${thread.summaries.map(s => s.text).join(' / ')}`);
    for (const m of uncoveredMessages(thread)) {
        parts.push(`${nameOf(m.sender)}: ${m.text}`);
    }
    if (thread.lastMessage?.displayTs) parts.push(`(最后一条消息的时刻: ${fmtWorldTime(thread.lastMessage.displayTs)})`);
    return parts.join('\n');
}

// ── 论坛材料拼装(主生成用【论坛当前状态】+ 盖楼用单帖全文;castName 只在这里流动,UI 绝不读它)。──

function residentRosterLine(r) {
    return `- id=${r.residentId} handle=${r.handle} persona=${r.persona || ''}${r.castName ? ` castName=${r.castName}` : ''}`;
}

function buildForumDigestText(world) {
    if (!world.boards.size) return '(论坛是空的,首次生成:请先创建 3〜4 个贴合这个世界的板块并初始化 5〜8 名住民)';
    const parts = [];
    if (world.forumNow) parts.push(`[论坛当前世界时刻] ${fmtWorldTime(world.forumNow)}(新的 worldTime 不得早于它)`);
    parts.push('[板块列表]');
    for (const b of world.boards.values()) parts.push(`- id=${b.boardId} name=${b.name} desc=${b.desc || ''}`);
    parts.push('[住民名册]');
    for (const r of world.residents.values()) parts.push(residentRosterLine(r));
    const recentThreads = [...world.forumThreads.values()]
        .filter(t => t.title)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0))
        .slice(0, 5);
    for (const t of recentThreads) {
        const authorHandle = world.residents.get(t.authorId)?.handle || t.authorId;
        parts.push(`\n[帖 ${t.threadId}] ${t.title}(作者 ${authorHandle})`);
        for (const r of t.replies.slice(-2)) {
            parts.push(`  ${world.residents.get(r.authorId)?.handle || r.authorId}: ${r.body}`);
        }
    }
    return parts.join('\n');
}

function buildForumThreadDigestText(world, thread) {
    const parts = [];
    const authorHandle = world.residents.get(thread.authorId)?.handle || thread.authorId;
    parts.push(`[帖子] ${thread.title}`);
    parts.push(`${authorHandle}: ${thread.body}`);
    thread.replies.forEach((r, i) => {
        const h = world.residents.get(r.authorId)?.handle || r.authorId;
        parts.push(`${i + 1}F ${h}${r.replyToFloor ? `(回复>>${r.replyToFloor})` : ''}: ${r.body}`);
    });
    parts.push('\n[住民名册]');
    for (const r of world.residents.values()) parts.push(residentRosterLine(r));
    return parts.join('\n');
}

// ── 水位 → 本批「新进展」的起点(messenger/forum 共用)。──
// M1 水位重构后不靠事件累积,完全推导——冷启动的存量楼层、流式丢事件的楼层都自动补上。
// 2026-08-13 起「新进展」与「上下文范围」彻底分家:上下文默认是整本聊天(见 buildFloorContextText),
// 这里只回答「哪一层之后算新的」,用来在正文里画那条分界线、并决定本批水位推到哪。
// 返回本批「新进展」的起始层;没有新进展返回 null(交给二刷)。
// floorWindow>0 时保留旧的上限:即便水位很旧,一次也只把最后 fw 层算作新进展。
function deriveNewFrom(watermark, tip, floorWindow) {
    if (tip < 0) return null;
    let start = watermark + 1;
    if (floorWindow > 0) start = Math.max(start, tip - (floorWindow - 1));
    start = Math.max(0, start);
    return start <= tip ? start : null;
}

/**
 * 二刷:楼层没有新进展时,刷新退化为「再涨一批」——同一扇正文窗口再看一圈涟漪
 * (她的用法:反复测试/想在同层多长内容——家人线程、新群、新帖)。靠世界状态差异+明示 hint 防重复。
 * 返回 { newFrom, batchFloor, hint };真空聊天 batchFloor 为 null。
 */
function pendingOrRegrow(watermark, tip, floorWindow) {
    if (tip < 0) return { newFrom: null, batchFloor: null, hint: '' };
    const newFrom = deriveNewFrom(watermark, tip, floorWindow);
    if (newFrom !== null) return { newFrom, batchFloor: tip, hint: '' };
    return {
        newFrom: null, batchFloor: tip,
        hint: '(正文自上次生成后没有新进展。请基于同样的进展,让小世界继续自然生长——本次优先自问:主人的既定人际网里,还有谁没在这部手机上登场?从【人物设定参考】和原著既定事实里挖:上级、下属、家人(关系差的也算)、旧友、原著配角;群聊谱系里还缺哪种群(汇报群/指挥群/家族群/朋友群)?有合理人选就让 TA 登场;实在没有,再自然续写已有内容。纪律照旧且最优先:叙事另一方仍然绝对不许出现;通讯录规模守住真人手机的量级;不要为了新而新,不要重复已有内容。)\n\n',
    };
}

// ── 主生成:楼层事件触发,批量产出多线程条目。──

async function runMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'messenger');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 点名警示:酒馆正文永远是双人叙事结构,模型极易先验地把 user 侧当成主人的恋人/熟人,
    // 哪怕剧情里两人素未谋面(她真机实测踩中)。指名道姓比抽象原则有效。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。除非剧情明确显示 TA 已与「${charName}」相识并交换了联系方式,否则「${userSideName}」不得出现在这部手机里;若现有联系人名册中没有 TA,大概率就是还不该有。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    // regrowHint 从队首挪到队尾:它是「本次这一趟怎么做」的临时指令,贴着输出更有效;
    // 更要紧的是队首要留给不变的材料——前缀稳定,连续几次生成才吃得到 provider 的缓存。
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【手机当前状态】\n${buildWorldDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('消息生成', userContent, notes.keys);
    const systemPrompt = PROMPT_A.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('messenger', language));

    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.threads)) return { ok: false, error: 'parse_failed' };
    // 生成动辄几十秒,期间用户完全可能在酒馆里删楼/swipe。这批内容是照着回滚前的正文写的,
    // 而 batchFloor 也是那时的快照——照写不误的话,末尾那句 setWatermark 会把回滚刚夹紧的水位
    // 又拍回去,这段楼层从此再不会被生成。回滚代表用户更晚的意图,整批作废。
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    const touchedThreads = new Set();
    let addedCount = 0;
    const anchor = parseWorldTime(parsed.worldTime) ?? world.worldNow ?? Date.now();
    // 批内线程尾时刻:world.threads 是批次开始前的静态快照,循环里从不更新。同一次响应里
    // 两个块落到同一条线程时(模型重复同一 threadId,或经身份归一后被合并),第二块若仍读旧快照,
    // 排出来的世界时刻会早于第一块刚写进去的消息,同线程内出现时间倒挂。
    const batchTail = new Map();

    for (const t of parsed.threads) {
        if (!t || !t.threadId) continue;
        let threadId = String(t.threadId);

        if (t.newContact?.name && !allowUserContact && isUserSide(t.newContact.name, ctx)) {
            console.warn('[Orrery] 已拦下叙事另一方越界进通讯录:', t.newContact.name);
        } else if (t.newContact?.contactId && t.newContact?.name && !world.contacts.has(String(t.newContact.contactId))) {
            const contactId = String(t.newContact.contactId);
            const payload = {
                contactId, name: String(t.newContact.name), relation: t.newContact.relation || '',
                monogram: monogramFor(t.newContact.name), color: colorForContact(contactId),
            };
            const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'contact', payload });
            world.contacts.set(contactId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
        }

        if (t.newGroup?.groupId && t.newGroup?.name && !world.groups.has(String(t.newGroup.groupId))) {
            const groupId = String(t.newGroup.groupId);
            const members = (Array.isArray(t.newGroup.members) ? t.newGroup.members : [])
                .filter(m => m?.id && m?.name)
                .filter(m => allowUserContact || !isUserSide(m.name, ctx))
                .map(m => ({ id: String(m.id), name: String(m.name) }));
            if (members.length >= 2) { // 一个人不成群
                const payload = { groupId, name: String(t.newGroup.name), members };
                const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'group', payload });
                world.groups.set(groupId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
            }
        }

        // ── 线程身份归一 ──
        // 私聊线程的身份「就是」联系人 id 本身(world.js:111 dm 的 contactId = threadId),群聊同理。
        // 但提示词只说 threadId="已有线程id或新id",从没要求它等于 contactId,模型于是很自然地
        // 给一个装饰性的线程名(chat_xxx)配一个不同的联系人 id(xxx_1)。此前这种线程会被下面
        // 的存在性检查整批丢掉,而联系人已在上面建好——症状就是「通讯录里有人、点进去聊天是空的」
        // (真机实锤:后端 JSON 完整、finish_reason=stop,前端整段空白且无报错)。
        // 认线程一律以本批声明的 contactId/groupId 为准,threadId 只当模型的临时标签。
        if (!world.contacts.has(threadId) && !world.groups.has(threadId)) {
            const gid = t.newGroup?.groupId ? String(t.newGroup.groupId) : null;
            const cid = t.newContact?.contactId ? String(t.newContact.contactId) : null;
            if (gid && world.groups.has(gid)) threadId = gid;
            else if (cid && world.contacts.has(cid)) threadId = cid;
            else if (!t.newGroup) {
                // 再兜一层:没声明新身份(联系人早已存在)但线程名又对不上时,看消息发送者——
                // 私聊里非 me 的发送者只会是对面那位,唯一且已知就认它。
                // ⚠️必须排除「本想建群但没建成」的情况(比如成员被 user 侧防线滤到不足两人):
                // 提示词明写「同一个人在不同线程里用同一个 id」,群友多半同时也是私聊联系人,
                // 不设这道闸就会把一批群聊消息错投进那个人的私聊里——比丢弃更难发现。
                const senders = [...new Set((Array.isArray(t.messages) ? t.messages : [])
                    .map(m => m?.sender).filter(s => s && s !== 'me').map(String))];
                if (senders.length === 1 && world.contacts.has(senders[0])) threadId = senders[0];
            }
        }

        const isGroup = world.groups.has(threadId);
        if ((!isGroup && !world.contacts.has(threadId)) || !Array.isArray(t.messages)) {
            // 静默丢弃是最难自查的失败:后端明明返回了消息,前端一片空白且无任何报错。
            if (Array.isArray(t.messages) && t.messages.length) {
                console.warn('[Orrery] 线程', threadId, '认不出对应的联系人/群组,', t.messages.length, '条消息被丢弃');
            }
            continue;
        }
        const valid = t.messages.filter(m => m && m.text);
        // 线程尾优先取批内已写入的最后时刻(见上方 batchTail),没有才回落到批前快照
        const tail = batchTail.get(threadId) ?? world.threads.get(threadId)?.lastMessage?.displayTs;
        const times = layoutWorldTimes(valid, anchor, tail);
        if (times.length) batchTail.set(threadId, times[times.length - 1]);
        for (let i = 0; i < valid.length; i++) {
            const m = valid[i];
            const payload = {
                // 私聊里非 me 一律归位成对面那位;群聊保留成员 id
                threadId, sender: m.sender === 'me' ? 'me' : (isGroup ? String(m.sender) : threadId),
                text: String(m.text),
                delayMin: Number.isFinite(m.delayMin) ? m.delayMin : 0, read: m.read !== false,
                worldTime: times[i],
            };
            { const z = cleanZh(m.zh, m.text, language); if (z) payload.zh = z; } // ja_zh 档才要求 LLM 给,zh 档天然缺失,渲染层容错
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'chat_message', payload });
            addedCount++;
        }
        touchedThreads.add(threadId);
    }

    await store.setWatermark(worldKey, 'messenger', batchFloor);
    return { ok: true, changed: true, added: addedCount, touchedThreads: [...touchedThreads] };
}

// ── 线程内续聊:定向生成,允许返回空。──

async function runThreadContinue(ctx, store, { worldKey, threadId, floorWindow, profileId, customApi, owner, language, excludeTags }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.threads.get(threadId);
    if (!thread) return { ok: false, error: 'no_thread' };
    const isGroup = thread.kind === 'group';
    const contact = isGroup ? null : world.contacts.get(threadId);
    if (!isGroup && !contact) return { ok: false, error: 'no_thread' };
    if (isGroup && !thread.group) return { ok: false, error: 'no_thread' };

    const charName = owner || ctx.name2 || '主角';
    const systemPrompt = isGroup
        ? PROMPT_B_GROUP
            .replaceAll('{{char}}', charName)
            .replaceAll('{{group}}', thread.group.name)
            .replaceAll('{{members}}', (thread.group.members || []).map(m => `${m.name}(id=${m.id})`).join('、'))
            .replaceAll('{{LANG_RULE}}', langRule('messenger', language))
        : PROMPT_B
            .replaceAll('{{char}}', charName)
            .replaceAll('{{contact}}', contact.name)
            .replaceAll('{{contactId}}', threadId)
            .replaceAll('{{LANG_RULE}}', langRule('messenger', language));
    // 续聊此前只有【人物设定参考】+ 线程记录,连正文和摘要都看不到——比主生成还盲,
    // 于是「点进去续几句」永远停在关系的原点(她 2026-08-13 报的 OOC,这条路是重灾区)。
    // 现在与主生成同一套底料:设定 → 摘要注记 → 正文近况,最后才是这条线程自己的上下文。
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const recent = buildFloorSection(ctx, { newFrom: null, floorWindow: floorWindow ?? 0, excludeTags, background: true });
    const userContent = `${castRef}${notes.text}${recent}【这段聊天的记录】\n${buildThreadDigestText(thread, senderNameFn(world, thread)) || '(还没有聊天记录)'}`;
    logContextShape('消息续聊', userContent, notes.keys);

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.messages)) return { ok: false, error: 'parse_failed' };
    if (!parsed.messages.length) return { ok: true, added: 0 };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    const anchor = thread.lastMessage?.displayTs ?? world.worldNow ?? Date.now();
    const valid = parsed.messages.filter(m => m && m.text);
    const times = layoutWorldTimes(valid, anchor, thread.lastMessage?.displayTs);
    for (let i = 0; i < valid.length; i++) {
        const m = valid[i];
        const payload = {
            threadId, sender: m.sender === 'me' ? 'me' : (isGroup ? String(m.sender) : threadId),
            text: String(m.text),
            delayMin: Number.isFinite(m.delayMin) ? m.delayMin : 0, read: m.read !== false,
            worldTime: times[i],
        };
        { const z = cleanZh(m.zh, m.text, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor, app: 'messenger', type: 'chat_message', payload });
    }
    return { ok: true, added: valid.length };
}

// ── 总结:超阈值时把最旧一半压缩,只影响 LLM 上下文,不隐藏 UI 消息。──

async function maybeSummarizeThread(ctx, store, { worldKey, threadId, summaryThreshold, profileId, customApi, owner }) {
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.threads.get(threadId);
    if (!thread) return;

    const uncovered = uncoveredMessages(thread);
    if (uncovered.length <= summaryThreshold) return;

    const half = uncovered.slice(0, Math.ceil(uncovered.length / 2));
    const charName = owner || ctx.name2 || '主角';
    const nameOf = senderNameFn(world, thread);
    const text = half.map(m => `${m.sender === 'me' ? charName : nameOf(m.sender)}: ${m.text}`).join('\n');

    let summary = '';
    try {
        summary = await callLLM(ctx, PROMPT_C, text, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    } catch (err) {
        console.error('[Orrery] 总结生成失败', err);
        return;
    }
    summary = (summary || '').trim();
    if (!summary) return;

    const last = half[half.length - 1];
    await store.addEntry({
        worldKey, sourceFloor: last.sourceFloor, app: 'messenger', type: 'summary',
        payload: { threadId, text: summary, coversUntilTs: last.ts },
    });
}

// ── 论坛主生成:独立水位、独立触发(app 内「刷新」),消化 newBoards/newResidents/newThreads/newReplies。──

async function runForumMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'forum');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同 messenger 的点名警示,换成论坛语境的措辞(住民注册发言而非通讯录出现)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得作为住民注册发言(除非剧情确实如此);更不得在任何帖子或回复中暗示 TA 与「${charName}」的关系——两人尚未相识/尚未交往时,连目击式的并排出现都不许写。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【论坛当前状态】\n${buildForumDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('论坛生成', userContent, notes.keys);
    const systemPrompt = PROMPT_F.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('forum', language));

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };

    const anchor = parseWorldTime(parsed.worldTime) ?? world.forumNow ?? Date.now();
    let addedCount = 0;

    for (const b of Array.isArray(parsed.newBoards) ? parsed.newBoards : []) {
        if (!b?.boardId || !b?.name || world.boards.has(String(b.boardId))) continue;
        const boardId = String(b.boardId);
        const payload = { boardId, name: String(b.name), desc: b.desc || '' };
        const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'board', payload });
        world.boards.set(boardId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
    }

    for (const r of Array.isArray(parsed.newResidents) ? parsed.newResidents : []) {
        if (!allowUserContact && r?.castName && isUserSide(r.castName, ctx)) {
            console.warn('[Orrery] 已拦下叙事另一方越界注册住民小号:', r.castName);
            continue;
        }
        if (!r?.residentId || !r?.handle || world.residents.has(String(r.residentId))) continue;
        const residentId = String(r.residentId);
        const payload = { residentId, handle: String(r.handle), persona: r.persona || '' };
        if (r.castName) payload.castName = String(r.castName); // 小号真名——只进账本/LLM 上下文,UI 绝不读它
        const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'resident', payload });
        world.residents.set(residentId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
    }

    const validAuthor = (id) => !!id && world.residents.has(String(id)); // 查无此人的楼丢弃(任务书 §4)

    // newThreads 的 schema(PROMPT_F §5)没有 threadId 字段——新帖的 id 由模型现造是天然不稳定的,
    // Orrery 自己发一个(同 store.js 的 makeId 哲学,不查重,碰撞概率低到可以不管)。
    // newReplies 引用的 threadId 才是"已有帖",从 buildForumDigestText 给模型看的名册里来。
    function makeForumThreadId() {
        return `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    for (const t of Array.isArray(parsed.newThreads) ? parsed.newThreads : []) {
        if (!t?.boardId || !t?.title || !validAuthor(t.authorId) || !world.boards.has(String(t.boardId))) {
            // 丢弃是既定策略(查无此人/查无此板的帖不入账),但必须留声——否则又是「后端有、前端空」
            if (t?.title) console.warn('[Orrery] 新帖', t.title, '因板块或作者查无此项被丢弃');
            continue;
        }
        const threadId = makeForumThreadId();
        const payload = {
            threadId, boardId: String(t.boardId), title: String(t.title), authorId: String(t.authorId),
            body: String(t.body || ''), worldTime: anchor,
        };
        { const z = cleanZh(t.zh, t.body, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_thread', payload });
        addedCount++;
        world.forumThreads.set(threadId, { ...payload, replies: [] });

        const replies = (Array.isArray(t.replies) ? t.replies : []).filter(rp => rp?.body && validAuthor(rp.authorId));
        const times = layoutWorldTimes(replies, anchor, anchor);
        for (let i = 0; i < replies.length; i++) {
            const rp = replies[i];
            const rpayload = { threadId, authorId: String(rp.authorId), body: String(rp.body), worldTime: times[i] };
            { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
            { const rf = validReplyToFloor(rp.replyToFloor, i + 1); if (rf !== undefined) rpayload.replyToFloor = rf; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
            addedCount++;
        }
    }

    for (const nr of Array.isArray(parsed.newReplies) ? parsed.newReplies : []) {
        if (!nr?.threadId) continue;
        const thread = world.forumThreads.get(String(nr.threadId));
        if (!thread?.title) continue; // 帖不存在,丢弃
        const threadId = thread.threadId;
        const replies = (Array.isArray(nr.replies) ? nr.replies : []).filter(rp => rp?.body && validAuthor(rp.authorId));
        const tailTs = thread.replies.length ? thread.replies[thread.replies.length - 1].worldTime : thread.worldTime;
        const times = layoutWorldTimes(replies, anchor, tailTs);
        for (let i = 0; i < replies.length; i++) {
            const rp = replies[i];
            const rpayload = { threadId, authorId: String(rp.authorId), body: String(rp.body), worldTime: times[i] };
            { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
            { const rf = validReplyToFloor(rp.replyToFloor, thread.replies.length + 1); if (rf !== undefined) rpayload.replyToFloor = rf; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
            addedCount++;
            thread.replies.push(rpayload);
        }
    }

    await store.setWatermark(worldKey, 'forum', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── 论坛盖楼:定向续写单帖,允许返回空;newResident 一批最多新建 2 名(任务书 §4)。──

async function runForumThreadContinue(ctx, store, { worldKey, threadId, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.forumThreads.get(threadId);
    if (!thread?.title) return { ok: false, error: 'no_thread' };

    const systemPrompt = PROMPT_G.replaceAll('{{LANG_RULE}}', langRule('forum', language));
    // 同 runThreadContinue:盖楼也补上摘要与正文近况,否则住民只能凭一个帖子的字面意思接话,
    // 主线人物的小号一开口就回到关系原点。
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), owner || ctx.name2);
    const notes = await buildInjectedNotes(ctx);
    const recent = buildFloorSection(ctx, { newFrom: null, floorWindow: floorWindow ?? 0, excludeTags, background: true });
    const userContent = `${castRef}${notes.text}${recent}${buildForumThreadDigestText(world, thread)}`;
    logContextShape('论坛盖楼', userContent, notes.keys);

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.replies)) return { ok: false, error: 'parse_failed' };
    if (!parsed.replies.length) return { ok: true, added: 0 };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    let newResidentBudget = 2;
    const valid = [];
    for (const rp of parsed.replies) {
        if (!rp?.body) continue;
        const authorId = rp.authorId ? String(rp.authorId) : null;
        if (!authorId) continue;
        if (!world.residents.has(authorId)) {
            const nr = rp.newResident;
            if (!(nr?.residentId && String(nr.residentId) === authorId && newResidentBudget > 0)) continue; // 查无此人且非法新建,丢弃
            if (!allowUserContact && nr.castName && isUserSide(nr.castName, ctx)) { console.warn('[Orrery] 已拦下叙事另一方越界注册住民小号(盖楼):', nr.castName); continue; }
            const payload = { residentId: authorId, handle: String(nr.handle || '?'), persona: nr.persona || '' };
            if (nr.castName) payload.castName = String(nr.castName);
            const added = await store.addEntry({ worldKey, sourceFloor, app: 'forum', type: 'resident', payload });
            world.residents.set(authorId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
            newResidentBudget--;
        }
        valid.push(rp);
    }
    if (!valid.length) return { ok: true, added: 0 };

    const anchor = thread.replies.length ? thread.replies[thread.replies.length - 1].worldTime : (thread.worldTime || Date.now());
    const times = layoutWorldTimes(valid, anchor, anchor);
    for (let i = 0; i < valid.length; i++) {
        const rp = valid[i];
        const rpayload = { threadId, authorId: String(rp.authorId), body: String(rp.body), worldTime: times[i] };
        { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
        { const rf = validReplyToFloor(rp.replyToFloor, thread.replies.length + i + 1); if (rf !== undefined) rpayload.replyToFloor = rf; }
        await store.addEntry({ worldKey, sourceFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
    }
    return { ok: true, added: valid.length };
}

// ── 对外入口:UI 只认这四个。messenger 两个内部自动接总结检查;forum 没有总结机制(§2 拍板不用改 PROMPT_C)。──

export async function generateMore(ctx, store, opts) {
    const result = await runMainGeneration(ctx, store, opts);
    if (result.ok && result.changed) {
        for (const threadId of result.touchedThreads) {
            await maybeSummarizeThread(ctx, store, { ...opts, threadId });
        }
    }
    return result;
}

export async function continueThread(ctx, store, opts) {
    const result = await runThreadContinue(ctx, store, opts);
    if (result.ok && result.added > 0) {
        await maybeSummarizeThread(ctx, store, opts);
    }
    return result;
}

export async function generateMoreForum(ctx, store, opts) {
    return await runForumMainGeneration(ctx, store, opts);
}

export async function continueForumThread(ctx, store, opts) {
    return await runForumThreadContinue(ctx, store, opts);
}

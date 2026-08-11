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
6. 克制:本次共 2〜8 条消息,分布在 1〜3 个线程;只在正文有依据或关系上合理时才新建联系人,一次最多新建 1 位(首次生成除外,首次可从正文推断 2〜4 位联系人把手机初始化)。
7. 联系人纪律(最重要,违反即全盘失败)。手机里只能出现主人**在剧情中已经认识、且合理交换过联系方式**的人。判断只看剧情事实,不看叙事结构:正文哪怕通篇是两个人的双线叙事,只要剧情里他们尚未相识,对方就绝不能出现在通讯录——素未谋面的人不会躺在彼此的手机里。不要被任何先验带偏(比如默认两位主角是恋人或熟人)。宁缺勿滥:联系人晚一点出现,永远比过早出现真实。
8. 熟稔度纪律。就算是真联系人,消息的语气亲疏也必须匹配剧情当前的关系阶段:刚认识就客气生分,熟人才随意,恋人才亲昵。关系阶段以正文为准,不许自行升温。
9. 群聊也是余波的舞台。主人的工作群/朋友群/同好群里,事件会以八卦、吐槽、歪楼的形式荡开;主人可以全程潜水。建群要有剧情依据(主人的职业、圈子),首次初始化最多 1 个群;群成员不必都是通讯录好友,但每个成员要有稳定的 id 和身份感。
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
    let s = String(raw).trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    try { return JSON.parse(s); } catch { /* 继续剥 */ }
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(s.slice(start, end + 1)); } catch { /* 放弃 */ }
    }
    return null;
}

function stripHtml(text) {
    return String(text || '').replace(/<[^>]+>/g, '').trim();
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

/** 从锚点起按 delayMin 依次排开一批消息的世界时刻。起点不早于线程尾,保证单调。 */
function layoutWorldTimes(messages, anchor, threadTailTs) {
    let clock = Math.max(anchor, threadTailTs || 0);
    return messages.map(m => {
        clock += (Number.isFinite(m.delayMin) ? Math.max(0, m.delayMin) : 0) * 60000;
        return clock;
    });
}

// ── LLM 调用优先级:独立 API > 指定 Connection Profile > 酒馆当前连接的裸调用。──

// 端点拼装沿用她中转站的通行习惯(同 Perigee buildChatEndpoint 语义)
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
            max_tokens: responseLength || 600,
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

async function callLLM(ctx, systemPrompt, userContent, { profileId, customApi, responseLength } = {}) {
    if (customApi?.enabled && customApi.baseUrl && customApi.model) {
        return await callCustomApi(customApi, systemPrompt, userContent, responseLength);
    }
    if (profileId && ctx.ConnectionManagerRequestService) {
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }];
        const constructed = ctx.ConnectionManagerRequestService.constructPrompt(messages, profileId);
        const result = await ctx.ConnectionManagerRequestService.sendRequest(profileId, constructed, responseLength || 600);
        return result?.content ?? '';
    }
    return await ctx.generateRaw({ prompt: userContent, systemPrompt, responseLength: responseLength || 600 });
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

// 人物设定参考:角色卡字段 + 世界书激活条目(她点单:主线人物扮演不得 OOC,以绑定世界书为准)。
// getWorldInfoPrompt(核实于 world-info.js:894)isDryRun=true 走纯读路径不触发副作用;失败静默降级为角色卡字段。
async function buildCastReference(ctx, floorTexts) {
    const parts = [];
    const ch = ctx.characters?.[ctx.characterId];
    if (ch) {
        const desc = [ch.description, ch.personality, ch.scenario].filter(Boolean).join('\n').trim();
        if (desc) parts.push(desc.slice(0, 1200));
    }
    try {
        if (typeof ctx.getWorldInfoPrompt === 'function') {
            const wi = await ctx.getWorldInfoPrompt(floorTexts, 4096, true);
            const str = (wi?.worldInfoString || '').trim();
            if (str) parts.push(str.slice(0, 1800));
        }
    } catch (err) {
        console.warn('[Orrery] 世界书读取失败,降级为仅角色卡字段', err);
    }
    return parts.length ? `【人物设定参考(权威;主线人物言行以此为准,不得OOC)】\n${parts.join('\n')}\n\n` : '';
}

function recentFloorTexts(ctx, count = 6) {
    // 与 ST 自身调用习惯一致(script.js:4455):带发言人名(可命中世界书人名关键词)、新→旧倒序
    return ctx.chat.slice(-count)
        .map(m => `${m?.name ? m.name + ': ' : ''}${stripHtml(m?.mes)}`)
        .filter(t => t.trim())
        .reverse();
}

function buildFloorContextText(ctx, pendingFloors, floorWindow) {
    if (!pendingFloors.length) return '';
    const maxFloor = Math.max(...pendingFloors);
    const start = Math.max(0, Math.min(...pendingFloors) - floorWindow);
    const lines = [];
    for (let i = start; i <= maxFloor && i < ctx.chat.length; i++) {
        const msg = ctx.chat[i];
        if (!msg) continue;
        const speaker = msg.name || (msg.is_user ? ctx.name1 : ctx.name2);
        lines.push(`[第${i}层] ${speaker}: ${stripHtml(msg.mes)}`);
    }
    return lines.join('\n');
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

// ── 水位 → pending 楼层区间(messenger/forum 共用):[max(水位+1, tip-窗口+1) .. tip]。
// M1 水位重构后 pending 不再靠事件累积,完全推导——冷启动的存量楼层、流式丢事件的楼层都自动补上;
// 推导只取尾部 floorWindow 层,捡到手机时更早的过去只存在于后续对话里。──
function derivePendingFloors(watermark, tip, floorWindow) {
    if (tip < 0) return [];
    const start = Math.max(0, watermark + 1, tip - (floorWindow - 1));
    const floors = [];
    for (let i = start; i <= tip; i++) floors.push(i);
    return floors;
}

/**
 * 二刷:楼层没有新进展时,刷新退化为「再涨一批」——同一扇正文窗口再看一圈涟漪
 * (她的用法:反复测试/想在同层多长内容——家人线程、新群、新帖)。靠世界状态差异+明示 hint 防重复。
 * 返回 { floors, hint };真空聊天 floors 为空。
 */
function pendingOrRegrow(watermark, tip, floorWindow) {
    const floors = derivePendingFloors(watermark, tip, floorWindow);
    if (floors.length) return { floors, hint: '' };
    if (tip < 0) return { floors: [], hint: '' };
    const start = Math.max(0, tip - (floorWindow - 1));
    const regrow = [];
    for (let i = start; i <= tip; i++) regrow.push(i);
    return {
        floors: regrow,
        hint: '(正文自上次生成后没有新进展。请基于同样的进展,让小世界继续自然生长——本次请优先考虑:有没有此前未出现、但关系上合理的存在应该在这里登场?比如主人的家人、旧友、同事、常去店家的群、圈子里的群聊、新的板块话题。有合理人选就让 TA 登场;实在没有,再自然续写已有内容。纪律照旧:不认识的人仍然不许出现,不要为了新而新,不要重复已有内容。)\n\n',
    };
}

// ── 主生成:楼层事件触发,批量产出多线程条目。──

async function runMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language }) {
    const watermark = await store.getWatermark(worldKey, 'messenger');
    const tip = ctx.chat.length - 1;
    const { floors: pendingFloors, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (!pendingFloors.length) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 点名警示:酒馆正文永远是双人叙事结构,模型极易先验地把 user 侧当成主人的恋人/熟人,
    // 哪怕剧情里两人素未谋面(她真机实测踩中)。指名道姓比抽象原则有效。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。除非剧情明确显示 TA 已与「${charName}」相识并交换了联系方式,否则「${userSideName}」不得出现在这部手机里;若现有联系人名册中没有 TA,大概率就是还不该有。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx));
    const userContent = `${regrowHint}${caution}${castRef}【正文最新进展】\n${buildFloorContextText(ctx, pendingFloors, floorWindow)}\n\n【手机当前状态】\n${buildWorldDigestText(world)}`;
    const systemPrompt = PROMPT_A.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('messenger', language));

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: 800 });
    if (!parsed || !Array.isArray(parsed.threads)) return { ok: false, error: 'parse_failed' };

    const batchFloor = Math.max(...pendingFloors);
    const touchedThreads = new Set();
    let addedCount = 0;
    const anchor = parseWorldTime(parsed.worldTime) ?? world.worldNow ?? Date.now();

    for (const t of parsed.threads) {
        if (!t || !t.threadId) continue;
        const threadId = String(t.threadId);

        if (t.newContact?.contactId && t.newContact?.name && !world.contacts.has(String(t.newContact.contactId))) {
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
                .map(m => ({ id: String(m.id), name: String(m.name) }));
            if (members.length >= 2) { // 一个人不成群
                const payload = { groupId, name: String(t.newGroup.name), members };
                const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'group', payload });
                world.groups.set(groupId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
            }
        }

        const isGroup = world.groups.has(threadId);
        if ((!isGroup && !world.contacts.has(threadId)) || !Array.isArray(t.messages)) continue;
        const valid = t.messages.filter(m => m && m.text);
        const times = layoutWorldTimes(valid, anchor, world.threads.get(threadId)?.lastMessage?.displayTs);
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

async function runThreadContinue(ctx, store, { worldKey, threadId, profileId, customApi, owner, language }) {
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
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx));
    const userContent = castRef + (buildThreadDigestText(thread, senderNameFn(world, thread)) || '(还没有聊天记录)');

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: 500 });
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
        summary = await callLLM(ctx, PROMPT_C, text, { profileId, customApi, responseLength: 300 });
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

async function runForumMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language }) {
    const watermark = await store.getWatermark(worldKey, 'forum');
    const tip = ctx.chat.length - 1;
    const { floors: pendingFloors, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (!pendingFloors.length) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同 messenger 的点名警示,换成论坛语境的措辞(住民注册发言而非通讯录出现)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得作为住民注册发言(除非剧情确实如此);更不得在任何帖子或回复中暗示 TA 与「${charName}」的关系——两人尚未相识/尚未交往时,连目击式的并排出现都不许写。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx));
    const userContent = `${regrowHint}${caution}${castRef}【正文最新进展】\n${buildFloorContextText(ctx, pendingFloors, floorWindow)}\n\n【论坛当前状态】\n${buildForumDigestText(world)}`;
    const systemPrompt = PROMPT_F.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('forum', language));

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: 1500 });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };

    const batchFloor = Math.max(...pendingFloors);
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
        if (!t?.boardId || !t?.title || !validAuthor(t.authorId) || !world.boards.has(String(t.boardId))) continue;
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
            if (Number.isFinite(rp.replyToFloor)) rpayload.replyToFloor = rp.replyToFloor;
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
            if (Number.isFinite(rp.replyToFloor)) rpayload.replyToFloor = rp.replyToFloor;
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
            addedCount++;
            thread.replies.push(rpayload);
        }
    }

    await store.setWatermark(worldKey, 'forum', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── 论坛盖楼:定向续写单帖,允许返回空;newResident 一批最多新建 2 名(任务书 §4)。──

async function runForumThreadContinue(ctx, store, { worldKey, threadId, profileId, customApi, language }) {
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.forumThreads.get(threadId);
    if (!thread?.title) return { ok: false, error: 'no_thread' };

    const systemPrompt = PROMPT_G.replaceAll('{{LANG_RULE}}', langRule('forum', language));
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx));
    const userContent = castRef + buildForumThreadDigestText(world, thread);

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: 600 });
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
        if (Number.isFinite(rp.replyToFloor)) rpayload.replyToFloor = rp.replyToFloor;
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

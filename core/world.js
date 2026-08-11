// 世界模型:worldKey 计算 + 账本 fold。不 import 任何 UI,不碰 IndexedDB(纯函数)。

/**
 * worldKey:世界的身份钥匙。ST 群聊/角色或聊天缺失时返回 null(ST 群聊不支持;
 * 小世界内部的群聊 type='group' 与此无关)。
 *
 * ⚠️身份冻结(2026-08-11 源码核查后的修):文件名 key(avatar::chatId)在 ST 里会漂——
 * 改聊天名、改角色名、导出再导入都会换文件名,世界瞬间孤儿化(数据在,钥匙对不上)。
 * 所以首次使用时把当时的文件名 key **冻进 chat_metadata**(它躺在聊天文件里,随文件走,
 * 改名/导入导出全都带着),此后永远读 metadata——钥匙从此不再跟文件名走。
 * 旧世界零迁移:冻结值就取当时的 legacy key,老数据直接无缝。
 */
export function computeWorldKey(ctx) {
    if (ctx.groupId) return null;
    const avatar = ctx.characters?.[ctx.characterId]?.avatar;
    const chatId = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
    if (!avatar || !chatId) return null;
    const legacy = `${avatar}::${chatId}`;
    const meta = ctx.chatMetadata;
    if (meta && typeof meta === 'object') {
        if (meta.orrery_world_id) return meta.orrery_world_id;
        meta.orrery_world_id = legacy;
        ctx.saveMetadataDebounced?.();
        return legacy;
    }
    return legacy; // metadata 尚未就绪(启动极早期):先用 legacy 顶着,就绪后冻结的仍是同一值
}

// 联系人头像色板,与 --or-* 皮肤色系同族但互相可辨。顺序固定,靠 contactId 哈希稳定取色——
// 同一个人无论出现在私聊还是群聊,颜色永远一致。
const CONTACT_PALETTE = ['#C7D7E1', '#D9CBB8', '#B7C9B0', '#D8C0C8', '#C9BFE0', '#CFCDBE'];

function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export function colorForContact(contactId) {
    return CONTACT_PALETTE[hashStr(contactId) % CONTACT_PALETTE.length];
}

export function monogramFor(name) {
    return (name || '?').trim().charAt(0) || '?';
}

/**
 * 住民短 ID(匿名板文化,同一住民永远同 ID):residentId 哈希后取 4 位十六进制,UI 显示 `handle #xxxx`。
 * 只是展示用的短哈希,不是身份密钥——碰撞不影响功能,只影响观感,概率也低到可以不管。
 */
export function shortIdFor(residentId) {
    return (hashStr(String(residentId)) % 0x10000).toString(16).padStart(4, '0');
}

/**
 * 账本 fold 成世界状态:{ contacts, groups, threads, worldNow, boards, residents, forumThreads, forumNow }。
 * threads: threadId -> { threadId, kind:'dm'|'group', contactId?, group?, messages:[], summaries:[], unread, lastMessage }
 * dm 的 threadId===contactId;群聊的 threadId===groupId,成员内联在 group.members(不必是通讯录好友)。
 * forumThreads: threadId -> { threadId, boardId, title, authorId, body, zh?, worldTime, replies:[](按 worldTime 升序),
 *   replyCount, lastActiveTs } —— 论坛自己的账,不碰 threads/worldNow(两个 app 的水互不相扰,水位重构的初衷)。
 */
export function foldWorld(entries) {
    const contacts = new Map();
    const groups = new Map();
    const threads = new Map();
    const boards = new Map();
    const residents = new Map();
    const forumThreads = new Map();

    function ensureThread(threadId) {
        if (!threads.has(threadId)) {
            threads.set(threadId, { threadId, messages: [], summaries: [] });
        }
        return threads.get(threadId);
    }
    function ensureForumThread(threadId) {
        if (!forumThreads.has(threadId)) {
            forumThreads.set(threadId, { threadId, replies: [] });
        }
        return forumThreads.get(threadId);
    }

    for (const e of entries) {
        // 一条畸形记录不能连累整部手机:下面每个分支都直接解构 e.payload.xxx,payload 缺失就是
        // 一次未捕获的 TypeError,而 foldWorld 在每次渲染前都要跑——等于这个世界永远打不开,
        // 只能进 devtools 手动删库才能救。跳过它,其余条目照常折叠。
        if (!e || !e.payload) continue;
        if (e.type === 'contact') {
            contacts.set(e.payload.contactId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts });
            ensureThread(e.payload.contactId);
        } else if (e.type === 'group') {
            groups.set(e.payload.groupId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts });
            ensureThread(e.payload.groupId);
        } else if (e.type === 'chat_message') {
            const t = ensureThread(e.payload.threadId);
            t.messages.push({ ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'summary') {
            const t = ensureThread(e.payload.threadId);
            t.summaries.push({ ...e.payload, id: e.id, ts: e.ts });
        } else if (e.type === 'board') {
            boards.set(e.payload.boardId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'resident') {
            residents.set(e.payload.residentId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'forum_thread') {
            const t = ensureForumThread(e.payload.threadId);
            Object.assign(t, e.payload, { id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'forum_reply') {
            const t = ensureForumThread(e.payload.threadId);
            t.replies.push({ ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        }
    }

    let worldNow = 0;
    for (const t of threads.values()) {
        t.kind = groups.has(t.threadId) ? 'group' : 'dm';
        t.contactId = t.kind === 'dm' ? t.threadId : null;
        t.group = t.kind === 'group' ? groups.get(t.threadId) : null;
        // 世界内时钟:生成期已按「正文推算的锚点 + delayMin」算好 payload.worldTime(见 generator)。
        // 缺 worldTime 的旧条目退回入账时间推导,保证单调。
        let clock = 0;
        for (const m of t.messages) {
            clock = m.worldTime || Math.max(m.ts, clock + (m.delayMin || 0) * 60000);
            m.displayTs = clock;
        }
        const lastFromOther = [...t.messages].reverse().find(m => m.sender !== 'me');
        t.unread = !!(lastFromOther && lastFromOther.read === false);
        t.lastMessage = t.messages.length ? t.messages[t.messages.length - 1] : null;
        if (t.lastMessage) worldNow = Math.max(worldNow, t.lastMessage.displayTs);
    }

    let forumNow = 0;
    for (const t of forumThreads.values()) {
        t.replies.sort((a, b) => (a.worldTime || a.ts) - (b.worldTime || b.ts));
        t.replyCount = t.replies.length;
        const times = [t.worldTime, ...t.replies.map(r => r.worldTime)].filter(Number.isFinite);
        t.lastActiveTs = times.length ? Math.max(...times) : 0;
        if (t.title) forumNow = Math.max(forumNow, t.lastActiveTs); // 帖子壳(无 title)是悬空回复,不计入时钟
    }

    return {
        contacts, groups, threads, worldNow: worldNow || null,
        boards, residents, forumThreads, forumNow: forumNow || null,
    };
}

/** 解析线程内某个发送者的显示信息(dm=对面那位联系人;群=成员表;查无此人给兜底)。 */
export function resolveSender(world, thread, senderId) {
    if (thread.kind !== 'group') {
        return world.contacts.get(thread.threadId) || null;
    }
    const m = (thread.group?.members || []).find(x => x.id === senderId);
    if (m) return { contactId: m.id, name: m.name, monogram: monogramFor(m.name), color: colorForContact(m.id) };
    const c = world.contacts.get(senderId);
    if (c) return c;
    return { contactId: senderId, name: '?', monogram: '?', color: colorForContact(String(senderId)) };
}

/** 某线程内,最后一条 summary 覆盖到的 ts——之前的消息只在 UI 显示,不再喂给 LLM。 */
export function lastCoveredTs(thread) {
    if (!thread.summaries.length) return -Infinity;
    return Math.max(...thread.summaries.map(s => s.coversUntilTs));
}

/** 某线程内尚未被任何 summary 覆盖的消息(生成/总结都用这份,UI 渲染用 thread.messages 全量)。 */
export function uncoveredMessages(thread) {
    const bound = lastCoveredTs(thread);
    return thread.messages.filter(m => m.ts > bound);
}

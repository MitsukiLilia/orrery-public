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
 * ⚠️唯一的例外是分支/检查点:它们把父聊天的钥匙也抄走了,要靠 inheritedWorldKey/forkBranchWorld 分叉。
 */
export function computeWorldKey(ctx) {
    if (ctx.groupId) return null;
    const avatar = ctx.characters?.[ctx.characterId]?.avatar;
    const chatId = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
    if (!avatar || !chatId) return null;
    const legacy = `${avatar}::${chatId}`;
    const meta = ctx.chatMetadata;
    if (meta && typeof meta === 'object') {
        // 分支/检查点刚从父聊天抄来的钥匙(见 inheritedWorldKey):世界还没分叉完,先答「没有世界」——
        // 所有调用方对 null 早有处理(群聊就是 null),比让它们在这几十毫秒里往父世界写东西安全得多。
        if (inheritedWorldKey(ctx)) return null;
        if (meta.orrery_world_id) return meta.orrery_world_id;
        meta.orrery_world_id = legacy;
        ctx.saveMetadataDebounced?.();
        return legacy;
    }
    return legacy; // metadata 尚未就绪(启动极早期):先用 legacy 顶着,就绪后冻结的仍是同一值
}

/**
 * 酒馆的分支/检查点会把父聊天的 chat_metadata 整份抄进新文件(script.js saveChat:
 * `{ ...chat_metadata, ...withMetadata }`,withMetadata 只多一个 main_chat=父聊天名)——冻结在里面的
 * orrery_world_id 也跟着被抄走,于是两个聊天共用一个世界:分支里能看到父线后半段的余波,分支里 swipe/
 * 删楼还会按 sourceFloor 砍掉父线的账(她 2026-08-30 开分支玩不同走向时撞上)。
 * 识别条件:main_chat 存在,且当前 id 恰好等于「父聊天的 legacy key」——说明这把钥匙是抄来的,不是
 * 自己冻的。改名/导入不会命中(main_chat 不变、id 也不等于新名字的 legacy);分支再分支同样命中
 * (中间那层已分叉成自己的 id,再往下抄走的正是它)。
 * @returns {string|null} 抄来的父世界 key;不是继承来的就 null
 */
export function inheritedWorldKey(ctx) {
    if (ctx.groupId) return null;
    const avatar = ctx.characters?.[ctx.characterId]?.avatar;
    const chatId = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
    const meta = ctx.chatMetadata;
    if (!avatar || !chatId || !meta || typeof meta !== 'object') return null;
    const parent = meta.main_chat;
    if (!parent || !meta.orrery_world_id || parent === chatId) return null;
    return meta.orrery_world_id === `${avatar}::${parent}` ? meta.orrery_world_id : null;
}

// 同一个分支在同一瞬间只分叉一次:CHAT_CHANGED 与 index.js 的启动检查可能前后脚到,第二个等第一个的结果。
const forkInFlight = new Map();

/**
 * 分支世界分叉:把父世界里「分支点之前」的余波复制成分支自己的世界,再把新钥匙写回分支的 metadata。
 * 分支的手机于是正好是「前 N 楼一模一样」的那部手机,之后两个世界各自生长、互不相砍。
 * 复制失败也照样换钥匙(空世界总比继续共用父世界安全),错误留在控制台。
 * @returns {Promise<string|null>} 分叉后的新 key;当前聊天不是待分叉的分支就 null
 */
export async function forkBranchWorld(ctx, store) {
    const from = inheritedWorldKey(ctx);
    if (!from) return null;
    const avatar = ctx.characters?.[ctx.characterId]?.avatar;
    const chatId = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
    const to = `${avatar}::${chatId}`;
    if (forkInFlight.has(to)) return forkInFlight.get(to);
    const job = (async () => {
        const tip = (ctx.chat?.length ?? 0) - 1;
        try {
            const r = await store.forkWorld(from, to, tip);
            console.info(`[Orrery] 分支世界已分叉:复制 ${r.copied} 条余波(≤第${tip}层)${r.skipped ? '(目标已有内容,跳过复制)' : ''}`);
        } catch (err) {
            // 失败不能只留控制台一行:分支从此是空世界,她在手机里看到的只是「什么都没有」,得让她知道是分叉炸了。
            console.error('[Orrery] 分支世界分叉失败,改用空世界', err);
            globalThis.toastr?.error?.('分支世界分叉失败,这个分支从空世界开始(详见控制台)', 'Orrery');
        }
        const meta = ctx.chatMetadata;
        if (meta && typeof meta === 'object') {
            meta.orrery_world_id = to;
            ctx.saveMetadataDebounced?.();
        }
        return to;
    })();
    forkInFlight.set(to, job);
    try { return await job; } finally { forkInFlight.delete(to); }
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

// M4 相册 tone 调色板(固定 12 键,内容色、主题无关——先例=CONTACT_PALETTE 的联系人色在三主题通用)。
// 导出给 generator.js(消化时白名单校验)与 apps/gallery/app.js(渲染时白名单再校验一遍,双保险,
// 不把模型字符串直接拼进 data-tone 属性)共用,一处定义两处消费,不会漂。非法值统一落 'street'。
export const GALLERY_TONES = ['sky', 'night', 'sunset', 'green', 'blossom', 'food', 'sea', 'indoor', 'street', 'white', 'dark', 'screen'];

/**
 * 住民短 ID(匿名板文化,同一住民永远同 ID):residentId 哈希后取 4 位十六进制,UI 显示 `handle #xxxx`。
 * 只是展示用的短哈希,不是身份密钥——碰撞不影响功能,只影响观感,概率也低到可以不管。
 */
export function shortIdFor(residentId) {
    return (hashStr(String(residentId)) % 0x10000).toString(16).padStart(4, '0');
}

/**
 * 匿名住民短 ID(M7a 次抛匿名):同一帖里同一个 key 永远同一个 ID(可以回来接话),
 * 跨帖天然不同(key 混进了 threadId 一起哈希)——同 shortIdFor 的哈希哲学,只是取位更长、
 * 输出 base36(匿名板文化里 6 位数字/字母混编的「ID:xxxxxx」更常见)。纯展示用,不是身份密钥。
 */
export function anonIdFor(threadId, key) {
    // hashStr 是 djb2:相邻的 key(a1/a2)只差最后一次乘加,输出也只差一点,展示出来就是 dpt5lw/dpt5lx
    // 这种连号——匿名板的 ID 该像随机串。补一段 murmur3 式的末端搅拌(移位异或+奇数乘)把低位差异
    // 打散到整个 32 位,shortIdFor 不动(4 位十六进制的连号肉眼不明显,且改了会让旧住民 ID 全变)。
    let h = hashStr(`${threadId}|${key}`) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return ((h >>> 0) % 36 ** 6).toString(36).padStart(6, '0'); // 异或会把值带回有符号,最后再转一次无符号
}

/**
 * 账本 fold 成世界状态:{ contacts, groups, threads, worldNow, boards, residents, forumThreads, forumNow,
 *   snsAccounts, tweets, snsNow, searches, visits, browserNow, worldClock }。
 * threads: threadId -> { threadId, kind:'dm'|'group', contactId?, group?, messages:[], summaries:[], unread, lastMessage }
 * dm 的 threadId===contactId;群聊的 threadId===groupId,成员内联在 group.members(不必是通讯录好友)。
 * forumThreads: threadId -> { threadId, side:'omote'|'ura', boardId?, title, authorId?, anon?, body, zh?,
 *   worldTime, replies:[](按 worldTime 升序,每条同样 authorId?/anon? 二选一), replyCount, lastActiveTs,
 *   myDraft? } —— 论坛自己的账,不碰 threads/worldNow(两个 app 的水互不相扰,水位重构的初衷)。
 *   authorId=固定住民(residents 表里能查到);anon={key,name}=次抛匿名(M7a §1.1),UI 用
 *   anonIdFor(threadId, key) 现算展示 ID,不落表。side(M12):payload 带 side:'ura' 才是裏サイト帖,
 *   没有 boardId、也没有固定住民(anon 恒真);其余(缺省)就是表板帖,fold 收尾统一归一成
 *   'omote'(见下方 forumNow 循环),UI/生成层从此不必再判 undefined。myDraft 一旦在 replies 里
 *   发现 fromDraftId 与之相符的一楼(草稿已发出),fold 收尾时置 null(见下方 forumNow 循环)。
 * residents: residentId -> resident payload(+sourceFloor/ts),同 accountId 一样后写覆盖。M13 表板実名制
 *   起形状是 { residentId, displayName, affiliation, kind:'member'|'guest', invitedBy?(仅 guest:招待
 *   TA 的成员 residentId), handle(=displayName,兼容 resolveByHandle/digestAuthorTag/旧渲染), persona,
 *   castName(真身;必填) }——payload 整份 spread(见下方 resident 分支),新增字段零改动即可落地。
 *   旧世界没有 displayName 的老住民原样保留在表里(handle 走旧值),不迁移、不强改历史数据。
 * snsAccounts: accountId -> sns_account payload(同 accountId 重发即覆盖——entries 已按 ts 升序 fold,Map.set
 *   天然「后写赢」,同 contacts 先例,不需要额外的"已存在就跳过"判断)。
 * tweets: tweetId -> { tweetId, accountId, body, zh?, worldTime, likes, retweets, retweetOf?, replies:[](按
 *   worldTime 升序), replyCount, lastActiveTs } —— SNS 自己的账,同样不碰 threads/forumThreads/worldNow/forumNow。
 * searches: queryId -> search_query payload(+id/sourceFloor/ts)。visits: visitId -> browse_visit payload
 *   (+id/sourceFloor/ts,可选 fromQueryId 指回某条检索)——M3 浏览器「Astrolabe」自己的账,两型平铺、不嵌套,
 *   UI 按 worldTime 各自排序;同样不碰 threads/forumThreads/tweets/worldNow/forumNow/snsNow。
 * photos: 按 worldTime 升序排好的数组(+ts/sourceFloor),M4 相册自己的账,只有 add/级联倒带,没有改写。
 * memos: noteId -> { noteId, text, zh?, createdTime, editedTime?, latestTs, ts },M4 备忘录自己的账——
 *   memo_edit 按入账顺序回放覆盖 text/zh 并推高 editedTime/latestTs(取 createdTime 与 editedTime 较新者),
 *   这就是「改写=独立条目、不另存历史」的全部机制:回滚删掉一条 edit,下次 fold 重放自然还原旧文本。
 *   edit 指向不存在的 noteId(理论上不该发生,防御性处理同下面「一条畸形记录」的哲学)→ 跳过 + console.warn。
 * 以上两者同样不碰 threads/forumThreads/tweets/searches/visits/worldNow/forumNow/snsNow/browserNow。
 * community: 所属对象或 null(app='world' type='community',一世界一条,后写覆盖=只留最新,同 snsSuggest)。
 * nowPlaying: { title, ts } 或 null(app='world' type='now_playing',一世界一条,后写覆盖=只留最新一首——
 *   同 community 的语义。心境没变时模型省略这个字段=不写入新条目,fold 出来的自然还是上一首,不需要
 *   额外的"沿用"逻辑——这就是"省略=沿用上一首"在账本层面的全部实现,M8 桌面小组件的音乐组件用它。
 * follows: { omote: Set<accountId>, ura: Set<accountId> }——M6 关注表,按账本顺序回放 sns_follow
 *   (follow=add,unfollow=delete;Set 语义天然让"unfollow 一个不在表里的 id"是 no-op)。fold 收尾时
 *   过滤掉 accountId 已不在 snsAccounts 里的悬空关注(账号被回滚/删除的防御性兜底,同 memo_edit 的第二道闸)。
 * sections: sectionId -> { sectionId, name, desc, sourceFloor, ts },M11 门户板块——仅首次初始化落账,
 *   永不按 worldTime 删(板块不是时间轴事件,同 deleteAlmanacFrom 的长注)。
 * almanacItems: itemId -> { ...条目 payload, sourceFloor, ts, updates:[按 ts 升序], status, lastActiveTs },
 *   M11 门户条目——status 取「有 update 带 status 就用最后一条的,否则用条目自己的」,lastActiveTs 取
 *   条目与全部 updates 的 worldTime 最大值(新着区/角标排序用它,收尾统一算好,见 return 前的长注)。
 * almanacPages: itemId -> { ...页面 payload, id, sourceFloor, ts },M11 门户条目页面——点开才生成,
 *   一条目一张,后写覆盖(理论上不会重发,同 community 的语义)。
 * worldClock: 七个 xxxNow 里的最大值(M7c 单一世界钟 + M11 补第七项,见下方 return 前的长注),七个都空才是 null。
 */
export function foldWorld(entries) {
    const contacts = new Map();
    const groups = new Map();
    const threads = new Map();
    const boards = new Map();
    const residents = new Map();
    const forumThreads = new Map();
    const snsAccounts = new Map();
    const tweets = new Map();
    const searches = new Map();
    const visits = new Map();
    const photosById = new Map(); // 内部工作表,最终按 worldTime 排序输出为 photos 数组(见 return)
    const memos = new Map();
    const snapshots = new Map();  // v0.14 网页快照:visitId -> web_snapshot(一 visit 一张,后写覆盖)
    let snsSuggest = null;        // v0.14 搜索联想:整批一条,后写覆盖=只留最新一批
    let community = null;         // M5 所属:一世界一条,后写覆盖=只留最新(同 snsSuggest 的语义)
    let nowPlaying = null;        // M8 单曲循环:一世界一条,后写覆盖=只留最新一首(同 community 的语义)
    const follows = { omote: new Set(), ura: new Set() }; // M6 关注表:by 分两套,follow/unfollow 按账本顺序回放
    const sections = new Map();       // M11 门户板块:sectionId -> section,仅首次初始化落账
    const almanacItems = new Map();   // M11 门户条目:itemId -> { ...payload, updates:[] }(updates 收尾再排序,见下方)
    const almanacPages = new Map();   // M11 门户条目页面:itemId -> page,后写覆盖

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
    function ensureTweet(tweetId) {
        if (!tweets.has(tweetId)) {
            tweets.set(tweetId, { tweetId, replies: [] });
        }
        return tweets.get(tweetId);
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
        } else if (e.type === 'forum_draft') {
            // 主角写了又删的回复草稿(task-006):挂在帖上,后写覆盖=同帖只留最新;
            // 不参与 lastActiveTs/forumNow(它不是论坛活动,是主角屏幕上的私密痕迹)
            const t = ensureForumThread(e.payload.threadId);
            t.myDraft = { ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts };
        } else if (e.type === 'sns_account') {
            snsAccounts.set(e.payload.accountId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'tweet') {
            const t = ensureTweet(e.payload.tweetId);
            Object.assign(t, e.payload, { id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'tweet_reply') {
            const t = ensureTweet(e.payload.tweetId);
            t.replies.push({ ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'sns_follow') {
            // M6 关注表:by 只认 omote/ura(其余归 omote 兜底,同其余字段的宽容解析习惯);
            // follow=Set.add,unfollow=Set.delete——delete 对不存在的 key 天然 no-op,契约自动满足。
            const by = e.payload.by === 'ura' ? 'ura' : 'omote';
            const accountId = e.payload.accountId;
            if (accountId) {
                if (e.payload.action === 'unfollow') follows[by].delete(accountId);
                else follows[by].add(accountId);
            }
        } else if (e.type === 'search_query') {
            searches.set(e.payload.queryId, { ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'browse_visit') {
            // M11:内网 lane 收编后,pinned 常驻卡不再是浏览器的东西——旧世界残留的 bvpin_* 条目
            // 直接跳过不入 visits,UI 不需要再像 M9 那样另写一层过滤(任务书 §8)。
            if (e.payload.pinned) continue;
            visits.set(e.payload.visitId, { ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'web_snapshot') {
            snapshots.set(e.payload.visitId, { ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'sns_suggest') {
            snsSuggest = { ...e.payload, ts: e.ts };
        } else if (e.type === 'community') {
            community = { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts }; // 后写覆盖=只留最新
        } else if (e.type === 'now_playing') {
            nowPlaying = { title: e.payload.title, ts: e.ts }; // 后写覆盖=只留最新一首,同 community 的语义
        } else if (e.type === 'almanac_section') {
            sections.set(e.payload.sectionId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'almanac_item') {
            almanacItems.set(e.payload.itemId, { ...e.payload, sourceFloor: e.sourceFloor, ts: e.ts, updates: [] });
        } else if (e.type === 'almanac_update') {
            // 正常流程下 updates 只会指向已经入账的条目(生成层已校验过一遍,见 runAlmanacMainGeneration
            // 的长注)——这里是防御性的第二道闸,同 memo_edit 指向不存在 noteId 的先例。
            const item = almanacItems.get(e.payload.itemId);
            if (!item) { console.warn('[Orrery] almanac_update 指向不存在的条目', e.payload.itemId, ',已跳过'); continue; }
            item.updates.push({ ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'almanac_page') {
            almanacPages.set(e.payload.itemId, { ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'photo') {
            photosById.set(e.payload.photoId, { ...e.payload, id: e.id, sourceFloor: e.sourceFloor, ts: e.ts });
        } else if (e.type === 'memo_note') {
            memos.set(e.payload.noteId, {
                noteId: e.payload.noteId, text: e.payload.text, zh: e.payload.zh,
                createdTime: e.payload.worldTime, editedTime: undefined,
                latestTs: e.payload.worldTime, ts: e.ts,
            });
        } else if (e.type === 'memo_edit') {
            // edit 指向不存在的 noteId:正常流程下不该发生(generator.js 消化时已校验过一遍,见下方
            // runMemoMainGeneration 的长注),这里是防御性的第二道闸——一条畸形记录不能连累整个备忘录。
            const m = memos.get(e.payload.noteId);
            if (!m) { console.warn('[Orrery] memo_edit 指向不存在的备忘', e.payload.noteId, ',已跳过'); continue; }
            m.text = e.payload.text;
            m.zh = e.payload.zh;
            m.editedTime = e.payload.worldTime;
            m.latestTs = Math.max(m.latestTs, e.payload.worldTime || 0);
            m.ts = Math.max(m.ts, e.ts);
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
        // M12:裏サイト(side:'ura')与表板——forum_thread 的 payload 带 side 就已经在上面的
        // Object.assign(e.payload)里写上了 t.side;这里补一次归一,把「没有 side」(表板旧世界、
        // 或帖壳还没等到 forum_thread 到达)一律钳成 'omote',UI/生成层从此不必再判 undefined。
        t.side = t.side === 'ura' ? 'ura' : 'omote';
        t.replies.sort((a, b) => (a.worldTime || a.ts) - (b.worldTime || b.ts));
        t.replyCount = t.replies.length;
        const times = [t.worldTime, ...t.replies.map(r => r.worldTime)].filter(Number.isFinite);
        t.lastActiveTs = times.length ? Math.max(...times) : 0;
        if (t.title) forumNow = Math.max(forumNow, t.lastActiveTs); // 帖子壳(无 title)是悬空回复,不计入时钟
        // 草稿发出(M7a §1.2):发出那一刻新写的 forum_reply 带 fromDraftId 指回被发出的草稿——
        // 一旦这一楼真的出现在 replies 里,输入框里的「未发送草稿」就该消失。反悔删掉那一楼
        // (deleteThreadFrom 按 ts)会让这个条件自然失效,草稿原样躺在账本里,下次 fold 自动回到输入框,
        // 不需要专门的"恢复草稿"逻辑——同 memo_edit 回滚即还原的哲学。
        if (t.myDraft && t.replies.some(r => r.fromDraftId === t.myDraft.draftId)) t.myDraft = null;
    }

    let snsNow = 0;
    for (const t of tweets.values()) {
        t.replies.sort((a, b) => (a.worldTime || a.ts) - (b.worldTime || b.ts));
        t.replyCount = t.replies.length;
        const times = [t.worldTime, ...t.replies.map(r => r.worldTime)].filter(Number.isFinite);
        t.lastActiveTs = times.length ? Math.max(...times) : 0;
        if (t.accountId) snsNow = Math.max(snsNow, t.lastActiveTs); // 推壳(无 accountId)是悬空回复,不计入时钟(同论坛 t.title 的判据)
    }

    // 浏览器时钟:两型平铺(不像 forum/sns 有"壳"概念——search_query/browse_visit 都是插件自合成 id,
    // 一入账就是完整条目),缺 worldTime 的畸形条目不计入。
    let browserNow = 0;
    for (const s of searches.values()) if (Number.isFinite(s.worldTime)) browserNow = Math.max(browserNow, s.worldTime);
    for (const v of visits.values()) if (Number.isFinite(v.worldTime)) browserNow = Math.max(browserNow, v.worldTime);

    // M4 相册时钟:photos 按 worldTime 升序输出(任务书 §2 明写的契约),UI 需要倒序时自己再排一遍
    // (同 browser 的习惯,app.js 不借 foldWorld 排好的方向,各自按自己的展示需求排)。
    const photos = [...photosById.values()].sort((a, b) => (a.worldTime || 0) - (b.worldTime || 0));
    let galleryNow = 0;
    for (const p of photos) if (Number.isFinite(p.worldTime)) galleryNow = Math.max(galleryNow, p.worldTime);

    // M4 备忘录时钟:memoNow 取每条备忘 latestTs(创建或最后编辑,取较新者)里的最大值。
    let memoNow = 0;
    for (const m of memos.values()) if (Number.isFinite(m.latestTs)) memoNow = Math.max(memoNow, m.latestTs);

    // M11 门户收尾:updates 组内按 ts 升序排好(同浏览器追記此前的排序习惯——fold 只做一次,
    // UI/生成层都直接消费排好的顺序);status 取「有 update 带 status 的就用最后一条,否则用条目自己的」
    // (从后往前找第一条带 status 的 update,找不到就沿用条目自身);lastActiveTs 取条目与全部 updates
    // 的 worldTime 最大值,almanacNow 只看 items/updates(页面是用户点开触发的,不算世界自己的动静)。
    let almanacNow = 0;
    for (const item of almanacItems.values()) {
        item.updates.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        const withStatus = [...item.updates].reverse().find(u => u.status);
        if (withStatus) item.status = withStatus.status;
        const times = [item.worldTime, ...item.updates.map(u => u.worldTime)].filter(Number.isFinite);
        item.lastActiveTs = times.length ? Math.max(...times) : 0;
        if (Number.isFinite(item.worldTime)) almanacNow = Math.max(almanacNow, item.worldTime);
        for (const u of item.updates) if (Number.isFinite(u.worldTime)) almanacNow = Math.max(almanacNow, u.worldTime);
    }

    // M6 关注表收尾:渲染前过滤一次悬空引用(account 已不在 snsAccounts 里的 accountId)——
    // 现有删除机制都是账号与关注同 sourceFloor 一起被 deleteEntriesFromFloor 清走,理论上不会出现,
    // 但防御性闸门成本极低(同 memo_edit 指向不存在 noteId 的先例),留着不吃亏。
    for (const role of ['omote', 'ura']) {
        for (const id of [...follows[role]]) {
            if (!snsAccounts.has(id)) follows[role].delete(id);
        }
    }

    // M7c 单一 worldClock(时间统一):此前六个 app 各自把自己的 xxxNow 当「现在」讲给 LLM、
    // 也各自当 UI 的相对时间参照——于是六个 app 各管各的钟,互不知情(真机症状:消息刚推到
    // 今晚,论坛还停在三天前却显示"刚刚",新一批论坛帖又可能被模型标进比消息更早的时刻)。
    // worldClock 取七者的最大值(M11 补 almanacNow):谁的动静最新,就代表"整部手机此刻确定活到多晚"——
    // 全手机的现在不该早于任何一个 app 已经走到的时刻。每个 app 自己的 xxxNow 语义不变、原样保留
    // (红点/NEW/latestTsOf* 仍靠它们认"这个 app 有没有新动静"),worldClock 只是叠加在上面的
    // 一把统一读数,不取代它们。七个都还是空世界(0)时 worldClock 才是 null。
    const worldClock = Math.max(worldNow, forumNow, snsNow, browserNow, galleryNow, memoNow, almanacNow) || null;

    return {
        contacts, groups, threads, worldNow: worldNow || null,
        boards, residents, forumThreads, forumNow: forumNow || null,
        snsAccounts, tweets, snsNow: snsNow || null,
        searches, visits, browserNow: browserNow || null, snapshots, snsSuggest,
        photos, galleryNow: galleryNow || null,
        memos, memoNow: memoNow || null,
        community, // M5:所属(对象或 null)
        nowPlaying, // M8:{ title, ts } 或 null,见上方长注
        follows, // M6:{ omote: Set, ura: Set } 关注表
        sections, almanacItems, almanacPages, almanacNow: almanacNow || null, // M11:门户板块/条目/页面 + 门户自己的时钟
        worldClock, // M7c:整部手机七个 app 共用的「现在」,见上方长注
    };
}

// ── 「我看过了」水位:用户视角的未读,与 payload.read 是两回事,不许混。 ──
// payload.read 是**叙事内**的已读(模型用它演已读不回,主角在故事里看没看到);
// 下面这套是**用户**有没有亲眼看过——刷新完新长出来的东西,她没点进去就是新的。
// 两者互不干涉:既読照常由模型演,红点/NEW 只认 seen 水位(每线程/每帖一个入账 ts)。
// 记 ts(入账序号)而不是 displayTs(世界时间):世界时间是模型编的,同一批生成里可能落在过去。

export function seenKeyForThread(threadId) { return `messenger:${threadId}`; }
export function seenKeyForForumThread(threadId) { return `forum:${threadId}`; }
export function seenKeyForTweet(tweetId) { return `sns:${tweetId}`; }
// 浏览器不按线程/帖子/推分 key——整个 app 一把快照(任务书 §1「新内容标记」),单键固定不带参数。
export function seenKeyForBrowser() { return 'browser:app'; }

// ── Asterism 星图键(v0.13.0):观测者收藏的 key,与 seen 键同风格但各是各的表——
// starred 表存在 meta 里,不进账本、不进 LLM 上下文(零输入铁律,星星只属于观测者)。 ──
export function starKeyForTweet(tweetId) { return `tw:${tweetId}`; }
export function starKeyForForumThread(threadId) { return `ft:${threadId}`; }
export function starKeyForVisit(visitId) { return `wv:${visitId}`; }
// M4 相册/备忘录同浏览器的整 app 一把快照工法(任务书-M4 §2)。
export function seenKeyForGallery() { return 'gallery:app'; }
export function seenKeyForMemo() { return 'memo:app'; }
// M11 门户同上,整 app 一把(条目/更新混在一起判新旧,不按板块/条目分)。
export function seenKeyForAlmanac() { return 'almanac:app'; }

/** 线程里最新一条消息的入账 ts(空线程 0)——看过之后 seen 就记到这个值。 */
export function latestTsOfThread(thread) {
    let max = 0;
    for (const m of thread.messages) if (m.ts > max) max = m.ts;
    return max;
}

/** 帖子的最新入账 ts:帖体与全部回复取最大(帖子本体也可能比某些回复晚入账)。 */
export function latestTsOfForumThread(thread) {
    let max = thread.ts || 0;
    for (const r of thread.replies) if (r.ts > max) max = r.ts;
    return max;
}

/** 上次看过之后新到的「别人发来的」消息数——自己发的不算未读(真手机也不会为自己的话亮红点)。 */
export function unreadCountOfThread(thread, seenTs) {
    let n = 0;
    for (const m of thread.messages) if (m.ts > (seenTs || 0) && m.sender !== 'me') n++;
    return n;
}

/** 上次看过之后这个帖子新增的回复数(帖体本身是不是新的由调用方看 seen 有没有记录判断)。 */
export function newReplyCountOfForumThread(thread, seenTs) {
    let n = 0;
    for (const r of thread.replies) if (r.ts > (seenTs || 0)) n++;
    return n;
}

/** 推的最新入账 ts:推本体与全部回复取最大(同 latestTsOfForumThread,推特回复串平铺无楼层)。 */
export function latestTsOfTweet(tweet) {
    let max = tweet.ts || 0;
    for (const r of tweet.replies) if (r.ts > max) max = r.ts;
    return max;
}

/** 上次看过之后这条推新增的回复数(照 newReplyCountOfForumThread 抄)。 */
export function newReplyCountOfTweet(tweet, seenTs) {
    let n = 0;
    for (const r of tweet.replies) if (r.ts > (seenTs || 0)) n++;
    return n;
}

/** 浏览器全部条目(检索+浏览)里最新的入账 ts——整 app 一把 seen 快照,打点/打基线都靠这一个数。 */
export function latestTsOfBrowser(world) {
    let max = 0;
    for (const s of world.searches.values()) if (s.ts > max) max = s.ts;
    for (const v of world.visits.values()) if (v.ts > max) max = v.ts;
    return max;
}

/** 相册全部照片里最新的入账 ts(同 latestTsOfBrowser 的整 app 一把快照工法)。 */
export function latestTsOfGallery(world) {
    let max = 0;
    for (const p of world.photos) if (p.ts > max) max = p.ts;
    return max;
}

/** 备忘录全部条目里最新的入账 ts——每条备忘的 ts 已在 fold 时推到「创建或最后一次改写」的较新者。 */
export function latestTsOfMemo(world) {
    let max = 0;
    for (const m of world.memos.values()) if (m.ts > max) max = m.ts;
    return max;
}

/** 门户全部条目(items 与 updates)里最新的入账 ts——同 latestTsOfBrowser 的整 app 一把快照工法(页面不算)。 */
export function latestTsOfAlmanac(world) {
    let max = 0;
    for (const it of world.almanacItems.values()) {
        if (it.ts > max) max = it.ts;
        for (const u of it.updates) if (u.ts > max) max = u.ts;
    }
    return max;
}

/** 某个 app 里还有没有她没看过的东西——真手机的图标角标就是这个语义(有未读就亮)。 */
export function hasUnseenInApp(app, world, seen) {
    if (app === 'messenger') {
        for (const t of world.threads.values()) {
            if (unreadCountOfThread(t, seen[seenKeyForThread(t.threadId)]) > 0) return true;
        }
        return false;
    }
    if (app === 'sns') {
        // SNS 没有论坛那种「悬空回复壳」概念——tweet_reply 只会追加到已存在的推,t.accountId 恒真;
        // 仍保留判据同论坛(t.accountId 缺失=畸形数据壳,不该亮角标)。没记录=NEW,有记录比回复数。
        for (const t of world.tweets.values()) {
            if (!t.accountId) continue;
            const s = seen[seenKeyForTweet(t.tweetId)];
            if (s === undefined || newReplyCountOfTweet(t, s) > 0) return true;
        }
        return false;
    }
    if (app === 'browser') {
        const latest = latestTsOfBrowser(world);
        if (!latest) return false; // 浏览器还是空的,不该为它亮角标
        return (seen[seenKeyForBrowser()] || 0) < latest;
    }
    if (app === 'gallery') {
        const latest = latestTsOfGallery(world);
        if (!latest) return false; // 相册还是空的,不该为它亮角标
        return (seen[seenKeyForGallery()] || 0) < latest;
    }
    if (app === 'memo') {
        const latest = latestTsOfMemo(world);
        if (!latest) return false; // 备忘录还是空的,不该为它亮角标
        return (seen[seenKeyForMemo()] || 0) < latest;
    }
    if (app === 'almanac') {
        const latest = latestTsOfAlmanac(world);
        if (!latest) return false; // 门户还是空的,不该为它亮角标
        return (seen[seenKeyForAlmanac()] || 0) < latest;
    }
    for (const t of world.forumThreads.values()) {
        if (!t.title) continue; // 帖子壳(悬空回复)不是能点开的东西,不该为它亮角标
        const s = seen[seenKeyForForumThread(t.threadId)];
        if (s === undefined || newReplyCountOfForumThread(t, s) > 0) return true;
    }
    return false;
}

/** 打基线用:当下每条线程/每个帖子/每条推的最新 ts,一次性记成「看过了」(见 store.initSeenBaseline)。 */
export function seenBaselinePairs(world) {
    const pairs = [];
    for (const t of world.threads.values()) {
        const ts = latestTsOfThread(t);
        if (ts) pairs.push([seenKeyForThread(t.threadId), ts]);
    }
    for (const t of world.forumThreads.values()) {
        const ts = latestTsOfForumThread(t);
        if (ts) pairs.push([seenKeyForForumThread(t.threadId), ts]);
    }
    for (const t of world.tweets.values()) {
        const ts = latestTsOfTweet(t);
        if (ts) pairs.push([seenKeyForTweet(t.tweetId), ts]);
    }
    const browserTs = latestTsOfBrowser(world);
    if (browserTs) pairs.push([seenKeyForBrowser(), browserTs]);
    const galleryTs = latestTsOfGallery(world);
    if (galleryTs) pairs.push([seenKeyForGallery(), galleryTs]);
    const memoTs = latestTsOfMemo(world);
    if (memoTs) pairs.push([seenKeyForMemo(), memoTs]);
    const almanacTs = latestTsOfAlmanac(world);
    if (almanacTs) pairs.push([seenKeyForAlmanac(), almanacTs]);
    return pairs;
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
    // filter(Number.isFinite) 与本文件其余聚合同款:一条畸形 summary 的 NaN 会让 uncoveredMessages
    // 恒空,总结与续聊上下文静默失效——第二道闸哲学同 memo_edit。
    const times = thread.summaries.map(s => s.coversUntilTs).filter(Number.isFinite);
    return times.length ? Math.max(...times) : -Infinity;
}

/** 某线程内尚未被任何 summary 覆盖的消息(生成/总结都用这份,UI 渲染用 thread.messages 全量)。 */
export function uncoveredMessages(thread) {
    const bound = lastCoveredTs(thread);
    return thread.messages.filter(m => m.ts > bound);
}

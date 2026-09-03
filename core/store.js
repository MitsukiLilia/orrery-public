// 世界账本:IndexedDB 持久化。全系统只认 RippleEntry(见 §3),这里不解释业务语义,只管存取。
// 库名 orrery,两个 store:
//   ledger — RippleEntry 本体,autoIncrement 主键;索引 worldKey(取某世界全部条目)、sourceFloor(极少单独用,配合内存过滤)
//   meta   — 每个 worldKey 一条,{ worldKey, owner, watermarks: { messenger, forum, sns, browser, gallery, memo, almanac } },
//            各 app 独立水位(M1 水位重构、M2 补 sns 档、M3 补 browser 档、M4 补 gallery/memo 档、M11 补 almanac 档,见
//            getWatermark/setWatermark/clampWatermarks;旧版单一 lastProcessedFloor + pendingFloors 已废除,
//            读到旧格式时兼容迁移)

const DB_NAME = 'orrery';
const DB_VERSION = 1;
const STORE_LEDGER = 'ledger';
const STORE_META = 'meta';

let dbPromise = null;

function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_LEDGER)) {
                const ledger = db.createObjectStore(STORE_LEDGER, { keyPath: '_key', autoIncrement: true });
                ledger.createIndex('worldKey', 'worldKey', { unique: false });
                ledger.createIndex('sourceFloor', 'sourceFloor', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'worldKey' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

// 自造 id:时间戳+随机后缀。与 IndexedDB 的 _key(自增)是两回事——_key 只用来定位物理记录,
// id 是条目自己的语义身份(反悔删除按 id 定位起点)。
function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 单调递增的入账序号,允许同一批生成里多条消息保持相对顺序(纯 Date.now() 在同一毫秒内会撞)。
let lastTs = 0;
function nextTs() {
    const now = Date.now();
    lastTs = now > lastTs ? now : lastTs + 1;
    return lastTs;
}

async function withStore(storeName, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/**
 * 入账一条 RippleEntry。调用方给 { worldKey, sourceFloor, app, type, payload },id/ts 由这里补上。
 * @returns {Promise<object>} 补全后的条目(含 id、ts)
 */
export async function addEntry(entry) {
    const full = { ...entry, id: makeId(), ts: nextTs() };
    await withStore(STORE_LEDGER, 'readwrite', store => store.add(full));
    return full;
}

/** 取某世界全部条目,按 ts 升序(入账顺序)。 */
export async function getEntriesForWorld(worldKey) {
    if (!worldKey) return [];
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readonly');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const out = [];
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) { out.push(cursor.value); cursor.continue(); }
        };
        tx.oncomplete = () => resolve(out.sort((a, b) => a.ts - b.ts));
        tx.onerror = () => reject(tx.error);
    });
}

// 回滚纪元:每发生一次倒带就 +1。生成是长事务(思考型模型几十秒起步),期间用户完全可能在酒馆里
// 删楼/swipe;而生成用的 tip/batchFloor 都是发起请求那一刻的快照。没有这个计数器,回来后那句
// setWatermark 会把回滚刚夹紧的水位又拍回去,这批楼层从此再也不会被生成(且无声无息)。
// generator 在下笔前比对纪元,变了就整批作废——回滚永远赢,因为它代表用户更晚的意图。
let rollbackEpoch = 0;
export function getRollbackEpoch() { return rollbackEpoch; }

/**
 * 世界分叉(酒馆分支/检查点,见 world.js forkBranchWorld):把 from 里 sourceFloor<=tip 的条目按入账顺序
 * 复制给 to(payload 与 ts 原样,只重发 id),世界级事实(app='world',所属推断那一挂)不看楼层一律带上——
 * 它不是某一层长出来的,分支重推一次纯属浪费。meta 复制主人/已看水位/星标/基线,各 app 水位夹到 tip
 * (复制到哪层,水位就只许声称到哪层)。to 已有条目=已分叉过(或两次调用前后脚到),不重复复制。
 * 条目写在一个事务里:半途失败不留半个世界。
 * @returns {Promise<{copied:number, skipped:boolean}>}
 */
export async function forkWorld(fromKey, toKey, tip) {
    if (!fromKey || !toKey || fromKey === toKey) return { copied: 0, skipped: true };
    if ((await getEntriesForWorld(toKey)).length) return { copied: 0, skipped: true };
    const entries = (await getEntriesForWorld(fromKey))
        .filter(e => e.app === 'world' || !Number.isFinite(e.sourceFloor) || e.sourceFloor <= tip);
    await withStore(STORE_LEDGER, 'readwrite', store => {
        // ts 原样保留:它是「我看过了」水位(meta.seen)的比对基准,重发的话分支里所有旧内容都会整批变成
        // 未读/NEW;主键是自增 _key(下面剥掉重发),id 只是条目标识,ts 只在世界内排序,同值跨世界互不相干。
        for (const { _key, ...e } of entries) store.add({ ...e, worldKey: toKey, id: makeId() }); // _key 是自增主键,带过去会撞键
    });
    const meta = await readMeta(fromKey);
    const wm = normalizeWatermarks(meta);
    for (const app of Object.keys(wm)) wm[app] = Math.min(wm[app], tip);
    const newMeta = { worldKey: toKey, watermarks: wm };
    if (meta.owner) newMeta.owner = meta.owner;
    if (meta.seen && typeof meta.seen === 'object') newMeta.seen = { ...meta.seen };
    if (meta.seenBaseline) newMeta.seenBaseline = meta.seenBaseline;
    if (meta.starred && typeof meta.starred === 'object') newMeta.starred = { ...meta.starred };
    await writeMeta(newMeta);
    return { copied: entries.length, skipped: false };
}

/** 删除某世界内 sourceFloor >= floor 的全部条目——回滚的唯一入口(联系人也是余波,一并消失)。 */
export async function deleteEntriesFromFloor(worldKey, floor) {
    if (!worldKey) return;
    rollbackEpoch++;
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            // 畸形条目(sourceFloor 缺失/非数字)一并清掉:`undefined >= n` 恒为 false,
            // 不特判的话连 wipeWorld 都清不动它,会变成谁也删不掉的永久孤儿。
            const sf = cursor.value?.sourceFloor;
            if (!Number.isFinite(sf) || sf >= floor) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 反悔删除:某线程内 ts >= fromTs 的非 contact 条目全部删除(联系人身份保留,线程可以是空的)。
 */
export async function deleteThreadFrom(worldKey, threadId, fromTs) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (v.type !== 'contact' && v.payload?.threadId === threadId
                && (!Number.isFinite(v.ts) || v.ts >= fromTs)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 手术刀:删除单个联系人/群及其线程全部消息与摘要(纪律破防时不必抹整机)。
 * 删掉的人若剧情里真的建立了联系,之后可被重新创建——语义自洽。
 */
export async function deleteContactCascade(worldKey, threadId) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const hit = (v.type === 'contact' && v.payload?.contactId === threadId)
                || (v.type === 'group' && v.payload?.groupId === threadId)
                || v.payload?.threadId === threadId;
            if (hit) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 论坛专用手术刀:整帖级联删除——帖子本体(forum_thread)+ 全部回复(forum_reply)。
 * 列表页长按/右键帖行走这条路径;帖内单楼反悔走下面的 deleteThreadFrom(与消息线程同一工法)。
 */
export async function deleteForumThreadCascade(worldKey, threadId) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const hit = (v.type === 'forum_thread' || v.type === 'forum_reply' || v.type === 'forum_draft') && v.payload?.threadId === threadId;
            if (hit) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * SNS 专用手术刀:整推级联删除——推本体(tweet)+ 全部回复(tweet_reply)。
 * TL/账号主页长按/右键推行走这条路径;推详情内单条回复反悔走下面的 deleteTweetRepliesFrom(与消息线程/论坛楼同一工法)。
 */
export async function deleteTweetCascade(worldKey, tweetId) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const hit = (v.type === 'tweet' || v.type === 'tweet_reply') && v.payload?.tweetId === tweetId;
            if (hit) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 推文回复反悔:从选中回复起,该推下 ts >= fromTs 的 tweet_reply 全部删除(推本体保留,推可以没有回复)。
 * 照 deleteThreadFrom 的形状,只匹配 type='tweet_reply' 且 payload.tweetId 相符(推特回复串平铺,无楼层引用)。
 */
export async function deleteTweetRepliesFrom(worldKey, tweetId, fromTs) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (v.type === 'tweet_reply' && v.payload?.tweetId === tweetId
                && (!Number.isFinite(v.ts) || v.ts >= fromTs)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * 浏览器专用倒带:search_query/browse_visit/web_snapshot 三型一起,payload.worldTime >= fromWorldTime
 * 的全删(任务书 §2)。工法同 deleteTweetRepliesFrom(游标扫世界、条件命中就删),但比对字段是
 * worldTime 不是 ts——两 tab 按世界时间混排展示,长按定位到的是"这一条在时间轴上的位置",反悔边界
 * 也该按这条线切,而不是各型各自的入账序号(检索与它带出的浏览往往同一批入账、ts 挨得很近但
 * worldTime 才是她在屏幕上认出来的那条时间线)。缺 worldTime 的畸形条目保守地一并删掉(同
 * deleteThreadFrom 的先例)。
 * ⚠️isBrowserType 仍列着 'web_snapshot_append'——M9 常驻卡与内网追記已随 M11 一并撤除(fold 不再
 * 消化这两型),但旧世界的账本里可能还躺着这些条目,倒带扫过它们时理应一并清掉,不留孤儿数据;
 * 这不是内网 lane 的复活,单纯是遗留清理,任务书 §13 的静态 grep 门允许这一处残留。
 */
export async function deleteBrowserFrom(worldKey, fromWorldTime) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const isBrowserType = v.type === 'search_query' || v.type === 'browse_visit' || v.type === 'web_snapshot' || v.type === 'web_snapshot_append';
            if (isBrowserType && (!Number.isFinite(v.payload?.worldTime) || v.payload.worldTime >= fromWorldTime)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * M4 相册专用倒带:photo 一型,payload.worldTime >= fromWorldTime 的全删(任务书-M4 §2)。
 * 工法同 deleteBrowserFrom——反悔语义是「世界回滚到这一刻」,不是单条剧情内删除,所以长按任一张
 * 删掉的不只是那一张,是那一刻及之后的全部相册痕迹(与浏览器的两 tab 一起倒带同一个哲学)。
 */
export async function deleteGalleryFrom(worldKey, fromWorldTime) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const isPhoto = v.type === 'photo';
            if (isPhoto && (!Number.isFinite(v.payload?.worldTime) || v.payload.worldTime >= fromWorldTime)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * M4 备忘录专用倒带:memo_note + memo_edit 两型一起,payload.worldTime >= fromWorldTime 的全删
 * (任务书-M4 §2)。长按倒带锚点=该条目的最近活动时间(创建或最后编辑,取较新者)——这样长按一条
 * 被改坏的旧备忘,worldTime 落在锚点之前的原始 memo_note 留了下来,只有那次改写(和它之后的动静)
 * 被抹掉,老底子自然浮现,fold 重放即还原旧文本,不需要另存历史版本。
 */
export async function deleteMemoFrom(worldKey, fromWorldTime) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const isMemo = v.type === 'memo_note' || v.type === 'memo_edit';
            if (isMemo && (!Number.isFinite(v.payload?.worldTime) || v.payload.worldTime >= fromWorldTime)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * M11 门户专用倒带:almanac_item/almanac_update/almanac_page 三型,payload.worldTime >= fromWorldTime
 * 的全删,工法同 deleteBrowserFrom/deleteGalleryFrom。almanac_section(板块)一律跳过——板块不是
 * 时间轴事件(它是首次初始化时一次性定下的分类框架,不随剧情"发生"也不该随反悔"消失"),否则
 * 长按随便一条条目就会把整个门户的板块结构清空,下次刷新又要重新生一遍、原有条目全变孤儿。
 */
export async function deleteAlmanacFrom(worldKey, fromWorldTime) {
    if (!worldKey) return;
    rollbackEpoch++; // 手动反悔/删除同样代表用户更晚的意图:在飞的生成整批作废(2026-08-31 整体review P0-1 回填)
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (v.type === 'almanac_section') { cursor.continue(); return; } // 板块不是时间轴事件,永不随反悔删
            const isAlmanacType = v.type === 'almanac_item' || v.type === 'almanac_update' || v.type === 'almanac_page';
            if (isAlmanacType && (!Number.isFinite(v.payload?.worldTime) || v.payload.worldTime >= fromWorldTime)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * M5 改組:清空该世界论坛的全部内容(board/resident/forum_thread/forum_reply/forum_draft,
 * 全部 app==='forum')+ community(所属,app==='world' type==='community')。旧世界不保留——
 * 一次性抹掉,下次「刷新」按主人的所属重新初始化(任务书-M5 §1.3)。
 * 比 wipeWorld 窄一圈:只清论坛+所属,messenger/sns/browser/gallery/memo 与主人设定原样保留。
 */
export async function deleteForumAll(worldKey) {
    if (!worldKey) return;
    rollbackEpoch++; // 同其他删除:生成中途被改組,整批作废
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (v.app === 'forum' || v.type === 'community') cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    // 论坛水位清零,下一次刷新按「首次」跑(同 pendingOrRegrow 对空水位的处理)。
    // 裏サイト同属 app==='forum',上面的游标已经把它的帖子/回复一并清空,水位也要跟着复位——
    // 否则改組后裏板的水位还停在旧账本的楼层上,下次「刷新」会被 pendingOrRegrow 误判成「无新楼层」。
    await setWatermark(worldKey, 'forum', -1);
    await setWatermark(worldKey, 'forumUra', -1);
    // 清论坛的 seen/star 键:Asterism 星图里的论坛来源卡片随之消失——如实显示消失,同反悔语义。
    // 前缀硬编码而不 import world.js 的 seenKeyForForumThread/starKeyForForumThread('forum:'/'ft:')——
    // store.js 本来就不认业务语义(见文件头注),两处前缀改名要记得一起改,同其余 store 函数的先例。
    const meta = await readMeta(worldKey);
    let touched = false;
    if (meta.seen && typeof meta.seen === 'object') {
        for (const key of Object.keys(meta.seen)) {
            if (key.startsWith('forum:')) { delete meta.seen[key]; touched = true; }
        }
    }
    if (meta.starred && typeof meta.starred === 'object') {
        for (const key of Object.keys(meta.starred)) {
            if (key.startsWith('ft:')) { delete meta.starred[key]; touched = true; }
        }
    }
    if (touched) await writeMeta(meta);
}

/**
 * M13(任务书-M13 §2.4)「论坛重来」:旧世界升级到実名制后,清空表板与裏サイト的帖子、回复、
 * 草稿与名册(type ∈ forum_thread/forum_reply/forum_draft/resident),保留板块(forum_board)与
 * 所属(community)——比 deleteForumAll 窄一圈:那个连板块和所属一起清、要重新推断所属,这个把
 * 「组织的架子」留着,只清「架子里发生过的事」,按実名制从零开始又不必重新烧一次所属推断。
 */
export async function deleteForumThreadsOnly(worldKey) {
    if (!worldKey) return;
    rollbackEpoch++; // 同其他删除:生成中途被清空,整批作废
    const CLEAR_TYPES = new Set(['forum_thread', 'forum_reply', 'forum_draft', 'resident']);
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (v.app === 'forum' && CLEAR_TYPES.has(v.type)) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    // 水位复位,写法照 deleteForumAll——表裏两个水位都要归零,下次「刷新」都按「首次」跑。
    await setWatermark(worldKey, 'forum', -1);
    await setWatermark(worldKey, 'forumUra', -1);
    // 清 seen/star 键,写法照 deleteForumAll(帖子都没了,旧键留着也只是死数据)。
    const meta = await readMeta(worldKey);
    let touched = false;
    if (meta.seen && typeof meta.seen === 'object') {
        for (const key of Object.keys(meta.seen)) {
            if (key.startsWith('forum:')) { delete meta.seen[key]; touched = true; }
        }
    }
    if (meta.starred && typeof meta.starred === 'object') {
        for (const key of Object.keys(meta.starred)) {
            if (key.startsWith('ft:')) { delete meta.starred[key]; touched = true; }
        }
    }
    if (touched) await writeMeta(meta);
}

/** 抹掉这部手机:账本条目 + meta(含主人设定/水位)全删,世界回到未激活状态。 */
export async function wipeWorld(worldKey) {
    if (!worldKey) return;
    await deleteEntriesFromFloor(worldKey, -Infinity);
    await withStore(STORE_META, 'readwrite', store => store.delete(worldKey));
}

// ── world meta(各 app 独立水位 + 手机主人)──

async function readMeta(worldKey) {
    const db = await openDB();
    const store = db.transaction(STORE_META, 'readonly').objectStore(STORE_META);
    const rec = await promisifyRequest(store.get(worldKey));
    return rec || { worldKey };
}

/** 手机主人:整个世界的锚点,一经设定不可更改(想换人只能 wipeWorld 重来)。 */
export async function getOwner(worldKey) {
    if (!worldKey) return null;
    return (await readMeta(worldKey)).owner || null;
}

export async function setOwner(worldKey, name) {
    if (!worldKey || !name) return;
    const meta = await readMeta(worldKey);
    if (meta.owner) return; // 不可更改——静默拒绝二次设定
    meta.owner = String(name).trim();
    await writeMeta(meta);
}

async function writeMeta(meta) {
    await withStore(STORE_META, 'readwrite', store => store.put(meta));
}

// 水位归一化:新格式({ messenger, forum, sns })直接用;旧格式(单一 lastProcessedFloor,M0 遗留)
// 一次性搬进 watermarks.messenger,forum/sns 从 -1 起(旧数据里论坛/SNS 这回事根本不存在)。
// 旧 pendingFloors 字段直接丢弃——M1 已废除该机制,pending 完全靠水位推导(见 generator.js)。
// M12:forumUra 是裏サイト自己的水位(与表板的 forum 各存各的,同 messenger/forum 分家的先例)——
// 她没开始用裏之前这个键永远是 -1,不会让悬浮球角标常亮(见 ui/shell.js 网格红点的 hasUra 判据)。
function normalizeWatermarks(meta) {
    if (meta.watermarks && typeof meta.watermarks === 'object') {
        return { messenger: -1, forum: -1, forumUra: -1, sns: -1, browser: -1, gallery: -1, memo: -1, almanac: -1, ...meta.watermarks };
    }
    const messenger = Number.isFinite(meta.lastProcessedFloor) ? meta.lastProcessedFloor : -1;
    return { messenger, forum: -1, forumUra: -1, sns: -1, browser: -1, gallery: -1, memo: -1, almanac: -1 };
}

/**
 * 某 app 已处理水位,默认 -1。有它,pending 就不只靠事件累积——装插件前的旧楼层(冷启动)和
 * 流式丢事件的楼层都能靠「水位 < 最新楼层」推导出来,红点和刷新不再依赖事件必达。
 * 两个 app(messenger/forum)各存各的,互不清对方的水——这就是 M1 水位重构要解决的问题。
 */
export async function getWatermark(worldKey, app) {
    if (!worldKey) return -1;
    const meta = await readMeta(worldKey);
    const wm = normalizeWatermarks(meta);
    return Number.isFinite(wm[app]) ? wm[app] : -1;
}

export async function setWatermark(worldKey, app, floor) {
    if (!worldKey) return;
    const meta = await readMeta(worldKey);
    const wm = normalizeWatermarks(meta);
    wm[app] = floor;
    delete meta.lastProcessedFloor; delete meta.pendingFloors; // 旧字段迁移进 watermarks 后即弃用
    meta.watermarks = wm;
    await writeMeta(meta);
}

// ── 「我看过了」水位(seen):meta.seen = { 'messenger:<threadId>': ts, 'forum:<threadId>': ts }。──
// 与上面的 watermarks 是两套东西:watermarks 记「哪些**楼层**已经生成过余波」(给红点和刷新用),
// seen 记「哪些**内容**用户已经亲眼看过」(给未读数和 NEW 角标用)。也与 payload.read 无关(见 world.js 长注)。

/** 整张 seen 表一次取出——渲染要挨个线程/帖子比对,逐 key 读库不划算。 */
export async function getSeenMap(worldKey) {
    if (!worldKey) return {};
    const meta = await readMeta(worldKey);
    return (meta.seen && typeof meta.seen === 'object') ? meta.seen : {};
}

/**
 * 只增不减:回滚后剩余内容的 ts 只会更小,水位留在高处也不会误报未读,不必特意夹紧。
 * @returns {Promise<boolean>} 水位是否真的动了——调用方靠它决定要不要去刷新外面那颗红点
 */
export async function markSeen(worldKey, key, ts) {
    if (!worldKey || !key || !Number.isFinite(ts)) return false;
    const meta = await readMeta(worldKey);
    const seen = (meta.seen && typeof meta.seen === 'object') ? meta.seen : {};
    if ((seen[key] || 0) >= ts) return false;
    seen[key] = ts;
    meta.seen = seen;
    await writeMeta(meta);
    return true;
}

/**
 * 基线打过没有。手机外面那颗红点要靠它判断「未读」这件事此刻算不算数——
 * 基线未打时整个账本都还没被认领过,任何未读判断都会把她早看过的旧内容误报成新的。
 */
export async function hasSeenBaseline(worldKey) {
    if (!worldKey) return false;
    return !!(await readMeta(worldKey)).seenBaseline;
}

/**
 * 基线:seen 是新机制,老世界一条记录都没有——不打基线的话,升级后一开手机满屏未读和 NEW,
 * 而那些内容她早就看过了。首次把当时已有的一切一次性记成看过,此后长出来的才算新。
 * @param {Array<[string, number]>} pairs [seenKey, 该线程/帖子当前最新 ts]
 * @returns {Promise<boolean>} 是否真的打了基线(已打过返回 false)
 */
export async function initSeenBaseline(worldKey, pairs) {
    if (!worldKey) return false;
    const meta = await readMeta(worldKey);
    if (meta.seenBaseline) return false;
    const seen = (meta.seen && typeof meta.seen === 'object') ? meta.seen : {};
    for (const [key, ts] of pairs) {
        if (key && Number.isFinite(ts) && (seen[key] || 0) < ts) seen[key] = ts;
    }
    meta.seen = seen;
    meta.seenBaseline = true;
    await writeMeta(meta);
    return true;
}

// ── Asterism 星图(v0.13.0 task-007):观测者自己的收藏,与 seen 同层的用户侧数据——
// 不进账本、不进 LLM 上下文,世界对"哪颗星被点亮"毫无感知(零输入铁律)。
// key 由 world.js 的 starKeyFor* 给('tw:<id>'/'ft:<id>'),值存点亮时刻——
// 这是观测者的现实时间,不是世界时间,星图按它倒序排(最近点亮的在最上)。

export async function getStarred(worldKey) {
    if (!worldKey) return {};
    const meta = await readMeta(worldKey);
    return (meta.starred && typeof meta.starred === 'object') ? meta.starred : {};
}

/** @returns {Promise<boolean>} 现在是否点亮(true=刚点亮,false=刚熄灭) */
export async function toggleStar(worldKey, key) {
    if (!worldKey || !key) return false;
    const meta = await readMeta(worldKey);
    const starred = (meta.starred && typeof meta.starred === 'object') ? meta.starred : {};
    let on;
    if (starred[key]) { delete starred[key]; on = false; }
    else { starred[key] = { at: Date.now() }; on = true; }
    meta.starred = starred;
    await writeMeta(meta);
    return on;
}

/** 回滚夹紧:某层被删/被 swipe 后,所有 app 的水位都不能再声称自己"已处理到"这层之后。 */
export async function clampWatermarks(worldKey, floor) {
    if (!worldKey) return;
    rollbackEpoch++;
    const meta = await readMeta(worldKey);
    const wm = normalizeWatermarks(meta);
    for (const app of Object.keys(wm)) wm[app] = Math.min(wm[app], floor - 1);
    delete meta.lastProcessedFloor; delete meta.pendingFloors;
    meta.watermarks = wm;
    await writeMeta(meta);
}

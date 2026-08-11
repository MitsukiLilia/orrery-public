// 世界账本:IndexedDB 持久化。全系统只认 RippleEntry(见 §3),这里不解释业务语义,只管存取。
// 库名 orrery,两个 store:
//   ledger — RippleEntry 本体,autoIncrement 主键;索引 worldKey(取某世界全部条目)、sourceFloor(极少单独用,配合内存过滤)
//   meta   — 每个 worldKey 一条,{ worldKey, owner, watermarks: { messenger, forum } },各 app 独立水位(M1 水位重构,
//            见 getWatermark/setWatermark/clampWatermarks;旧版单一 lastProcessedFloor + pendingFloors 已废除,读到旧格式时兼容迁移)

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

/** 删除某世界内 sourceFloor >= floor 的全部条目——回滚的唯一入口(联系人也是余波,一并消失)。 */
export async function deleteEntriesFromFloor(worldKey, floor) {
    if (!worldKey) return;
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            if (cursor.value.sourceFloor >= floor) cursor.delete();
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
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (v.type !== 'contact' && v.payload?.threadId === threadId && v.ts >= fromTs) cursor.delete();
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
    const db = await openDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LEDGER, 'readwrite');
        const idx = tx.objectStore(STORE_LEDGER).index('worldKey');
        const req = idx.openCursor(IDBKeyRange.only(worldKey));
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            const hit = (v.type === 'forum_thread' || v.type === 'forum_reply') && v.payload?.threadId === threadId;
            if (hit) cursor.delete();
            cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
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

// 水位归一化:新格式({ messenger, forum })直接用;旧格式(单一 lastProcessedFloor,M0 遗留)
// 一次性搬进 watermarks.messenger,forum 从 -1 起(旧数据里论坛这回事根本不存在)。
// 旧 pendingFloors 字段直接丢弃——M1 已废除该机制,pending 完全靠水位推导(见 generator.js)。
function normalizeWatermarks(meta) {
    if (meta.watermarks && typeof meta.watermarks === 'object') {
        return { messenger: -1, forum: -1, ...meta.watermarks };
    }
    const messenger = Number.isFinite(meta.lastProcessedFloor) ? meta.lastProcessedFloor : -1;
    return { messenger, forum: -1 };
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

/** 回滚夹紧:某层被删/被 swipe 后,所有 app 的水位都不能再声称自己"已处理到"这层之后。 */
export async function clampWatermarks(worldKey, floor) {
    if (!worldKey) return;
    const meta = await readMeta(worldKey);
    const wm = normalizeWatermarks(meta);
    for (const app of Object.keys(wm)) wm[app] = Math.min(wm[app], floor - 1);
    delete meta.lastProcessedFloor; delete meta.pendingFloors;
    meta.watermarks = wm;
    await writeMeta(meta);
}

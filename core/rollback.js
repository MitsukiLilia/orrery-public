// 回滚引擎:监听酒馆事件 → 世界倒带。只认 sourceFloor,不关心任何业务语义
// (联系人也是普通 RippleEntry,delete-by-floor 自动把回滚期间"新认识的人"一起抹掉)。
import { computeWorldKey, forkBranchWorld } from './world.js';

/**
 * @param {object} ctx SillyTavern.getContext() 结果
 * @param {object} store core/store.js 的导出
 * @param {(worldKey: string|null) => void} onWorldChanged 世界变化后的回调(刷红点/重渲染)
 */
export function registerRollback(ctx, store, onWorldChanged) {
    const { eventSource, eventTypes } = ctx;

    // 新楼层:pending 已改为完全由水位推导(见 core/generator.js),这里不再记账,
    // 只发信号让红点/网格重算——两个 app 各看各的水位,谁落后谁自己冒红点。
    function signalNewFloor() { onWorldChanged(computeWorldKey(ctx)); }
    eventSource.on(eventTypes.MESSAGE_SENT, signalNewFloor);
    eventSource.on(eventTypes.MESSAGE_RECEIVED, signalNewFloor);
    eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, signalNewFloor);

    // 删层 → 世界倒带到 N,两个 app 的水位一并夹紧。
    // ⚠️N 的语义只对「删此层及之后」精确:那条路径 `chat.length = this_del_mes` 后再 emit,
    // 新长度恰好等于起删楼层(核实于 script.js:11463)。单条删除走的是 `chat.splice(id,1)` 后
    // emit 新长度(script.js:1610/1626)——**给的是删完的总长,不是被删的下标**,ST 没有把下标
    // 告诉任何人。所以中间单删一层时,这里会按「从末层倒带」处理:最近一批余波被删掉、水位夹到
    // 末层之前(下次刷新会重新生成,能自愈),但更早那些条目的 sourceFloor 不会跟着前移一位,
    // 从此与真实楼层错位一格。要根治得自己维护一份楼层指纹快照来 diff 出被删下标,尚未做。
    eventSource.on(eventTypes.MESSAGE_DELETED, async (n) => {
        const worldKey = computeWorldKey(ctx);
        if (!worldKey || !Number.isInteger(n)) return;
        await store.deleteEntriesFromFloor(worldKey, n);
        await store.clampWatermarks(worldKey, n);
        onWorldChanged(worldKey);
    });

    // swipe:同样倒带到 N 并夹紧水位;水位夹紧到 N-1 后自然 < N,下次刷新会被 pending 推导重新纳入
    // (不需要再单独"重新计入待生成"——pending 本身就是水位到 tip 的推导结果)。
    eventSource.on(eventTypes.MESSAGE_SWIPED, async (n) => {
        const worldKey = computeWorldKey(ctx);
        if (!worldKey || !Number.isInteger(n)) return;
        await store.deleteEntriesFromFloor(worldKey, n);
        await store.clampWatermarks(worldKey, n);
        onWorldChanged(worldKey);
    });

    // 编辑楼层不触发回滚——不搞完美主义,觉得不对走手动反悔。
    eventSource.on(eventTypes.MESSAGE_EDITED, () => {});

    // 换聊天:先看这是不是刚从父聊天抄来钥匙的分支/检查点,是就先分叉世界,再对外报世界变了——
    // 顺序不能反,否则红点/自动刷新会拿着父世界的钥匙先跑一轮。
    eventSource.on(eventTypes.CHAT_CHANGED, async () => {
        await forkBranchWorld(ctx, store);
        onWorldChanged(computeWorldKey(ctx));
    });
}

/** 手动反悔:某线程 ts>=fromTs 的条目删除,contact 条目保留(线程可以是空的)。 */
export async function manualRevert(store, worldKey, threadId, fromTs) {
    await store.deleteThreadFrom(worldKey, threadId, fromTs);
}

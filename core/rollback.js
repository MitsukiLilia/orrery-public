// 回滚引擎:监听酒馆事件 → 世界倒带。只认 sourceFloor,不关心任何业务语义
// (联系人也是普通 RippleEntry,delete-by-floor 自动把回滚期间"新认识的人"一起抹掉)。
import { computeWorldKey } from './world.js';

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

    // 删层(单条删除 or "删此层及之后"批量删除,ST 两条路径 emit 的都是删除后的新 chat.length,
    // 数值上就等于起删楼层 N,见 docs/VERIFICATION.md)→ 世界倒带到 N,两个 app 的水位一并夹紧。
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

    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        onWorldChanged(computeWorldKey(ctx));
    });
}

/** 手动反悔:某线程 ts>=fromTs 的条目删除,contact 条目保留(线程可以是空的)。 */
export async function manualRevert(store, worldKey, threadId, fromTs) {
    await store.deleteThreadFrom(worldKey, threadId, fromTs);
}

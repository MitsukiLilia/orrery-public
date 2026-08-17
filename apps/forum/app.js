// 论坛:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/messenger/app.js 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/生成更多)+ 长按/右键反悔。
// castName 只活在 core/世界数据层,这个文件从不读它——住民短 ID 用 world.shortIdFor,不暴露真名。
import { ICON_BACK, ICON_MINUS, ICON_PLUS } from '../../ui/icons.js';
import { shortIdFor, seenKeyForForumThread, newReplyCountOfForumThread } from '../../core/world.js';

export const FORUM_APP_ID = 'forum';
export const FORUM_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
}

function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 相对时间:x分钟前/x小时前/昨天/M月D日,参照系是论坛最新世界时刻(forumNow),不是现实时钟。
function formatRelativeTime(ts, refNow) {
    const ref = refNow || Date.now();
    const diffMin = Math.max(0, Math.floor((ref - ts) / 60000));
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

function handleWithId(world, residentId) {
    const r = world.residents.get(residentId);
    return r ? `${r.handle} #${shortIdFor(residentId)}` : String(residentId);
}

/**
 * 帖子列表(论坛首屏,板块 chip 过滤 + 按 lastActiveTs 倒序)。
 * @param seen 「我看过了」水位表:某帖没有记录=她从没点进去过=新帖(挂 NEW),有记录就比对回复数
 * @param justUpdated 刚这一次刷新里新增/被盖楼的 threadId 集合——只用来播一次入场动效
 */
export function renderForumListHtml({ world, busy, boardId, seen = {}, justUpdated = null }) {
    const boards = [...world.boards.values()];
    const threads = [...world.forumThreads.values()]
        .filter(t => t.title && (!boardId || t.boardId === boardId))
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const chips = `<div class="or-forum-chips">
        <button class="or-forum-chip ${!boardId ? 'on' : ''}" data-action="select-forum-board" data-board-id="">全部</button>
        ${boards.map(b => `<button class="or-forum-chip ${boardId === b.boardId ? 'on' : ''}" data-action="select-forum-board" data-board-id="${escapeHtml(b.boardId)}">${escapeHtml(b.name)}</button>`).join('')}
    </div>`;

    const body = threads.length
        ? `<div class="or-forum-list">${threads.map(t => {
            const board = world.boards.get(t.boardId);
            const seenTs = seen[seenKeyForForumThread(t.threadId)];
            const neverOpened = seenTs === undefined;              // 一次都没点进去过 = 这帖对她来说是新的
            const newReplies = neverOpened ? 0 : newReplyCountOfForumThread(t, seenTs);
            const cls = ['or-forum-row', justUpdated?.has(t.threadId) ? 'just-arrived' : ''].filter(Boolean).join(' ');
            return `<button class="${cls}" data-action="open-forum-thread" data-thread-id="${escapeHtml(t.threadId)}">
                <div class="or-forum-row-tags">
                    ${board ? `<span class="or-forum-tag">${escapeHtml(board.name)}</span>` : ''}
                    ${neverOpened ? '<span class="or-forum-new">NEW</span>' : ''}
                </div>
                <div class="or-forum-title">${escapeHtml(t.title)}</div>
                <div class="or-forum-meta">${escapeHtml(handleWithId(world, t.authorId))} · ${t.replyCount} 回复 · ${formatRelativeTime(t.lastActiveTs, world.forumNow)}${newReplies ? `<span class="or-forum-newreply">+${newReplies} 新回复</span>` : ''}</div>
            </button>`;
        }).join('')}</div>`
        : `<div class="or-empty">论坛还没有人气。点「刷新」,让这个世界开始说话。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">论坛</span>
            <button class="or-pill-btn small" data-action="forum-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${chips}
        ${body}`;
}

/**
 * 帖内视图:楼主块 + 分隔 + 回复楼(细分隔线,不用气泡——论坛不是聊天)。
 * @param seenAt 进这个帖那一刻的 seen 快照(同消息线程,用快照而非实时水位,否则分界线当场消失)
 * @param replyBatch 「生成回复」这一次要点单几楼
 */
export function renderForumThreadHtml({ thread, world, busy, forumNow, seenAt = 0, replyBatch = 3 }) {
    let repliesHtml = '';
    let sepDone = false;
    thread.replies.forEach((r, i) => {
        if (!sepDone && seenAt > 0 && r.ts > seenAt) {
            repliesHtml += `<div class="or-new-sep" data-new-anchor><span>以下是新回复</span></div>`;
            sepDone = true;
        }
        repliesHtml += `<div class="or-forum-floor-row" data-ts="${r.ts}">
            <div class="or-forum-floor-head">
                <span class="or-forum-floor-num">${i + 1}F</span>
                <span class="or-forum-floor-author">${escapeHtml(handleWithId(world, r.authorId))}</span>
                <span class="or-forum-floor-time">${formatRelativeTime(r.worldTime, forumNow)}</span>
            </div>
            ${Number.isFinite(r.replyToFloor) && r.replyToFloor > 0 ? `<div class="or-forum-quote">&gt;&gt;${r.replyToFloor}</div>` : ''}
            <div class="or-forum-floor-body">${escapeHtml(r.body)}${r.zh && r.zh !== r.body ? `<div class="or-zh">${escapeHtml(r.zh)}</div>` : ''}</div>
        </div>`;
    });
    if (!thread.replies.length) repliesHtml = `<div class="or-empty">还没有人回复。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(thread.title)}</span>
        </div>
        <div class="or-forum-scroll">
            <div class="or-forum-op">
                <div class="or-forum-op-title">${escapeHtml(thread.title)}</div>
                <div class="or-forum-op-author">${escapeHtml(handleWithId(world, thread.authorId))} · ${formatRelativeTime(thread.worldTime, forumNow)}</div>
                <div class="or-forum-op-body">${escapeHtml(thread.body)}${thread.zh && thread.zh !== thread.body ? `<div class="or-zh">${escapeHtml(thread.zh)}</div>` : ''}</div>
            </div>
            <div class="or-forum-replies">${repliesHtml}</div>
        </div>
        <div class="or-chat-footer">
            <div class="or-batch">
                <button data-action="stepper" data-field="forumReplyBatch" data-delta="-1" ${busy ? 'disabled' : ''}>${ICON_MINUS}</button>
                <span class="or-batch-value">${replyBatch}</span>
                <button data-action="stepper" data-field="forumReplyBatch" data-delta="1" ${busy ? 'disabled' : ''}>${ICON_PLUS}</button>
            </div>
            <button class="or-pill-btn" data-action="forum-generate-more" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '生成回复'}</button>
        </div>`;
}
